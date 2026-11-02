import { FLOOR_DECIBELS } from "./volume_floor"

// A worklet module is fetched under the page's own policy, which may refuse
// one inlined as a data: URL, so the processor ships as a file of its own,
// found beside the module wherever that is served from.
const PROCESSOR = "colophon-amplifier",
  PROCESSOR_URL = new URL("./amplifier_processor.js?no-inline", import.meta.url)

// A change of gain made at once is a step in the wave, heard as a click, so it
// is eased in over a time constant of this many seconds.
const VOLUME_EASING_SECONDS = 0.01

// However many machines a page holds, it plays through one context, at the
// device's own rate.
let context = null,
  processorLoaded = null

function gainOf(decibels) {
  return decibels <= FLOOR_DECIBELS ? 0 : 10 ** (decibels / 20)
}

function sharedContext() {
  if (context == null) {
    context = new AudioContext()
    processorLoaded = context.audioWorklet.addModule(PROCESSOR_URL)
  }

  return context
}

// What a machine sounds while it runs live at its own speed, and nothing it
// sounds otherwise: the delivery, and the volume it is played at.
export class Amplifier extends EventTarget {
  #connecting = false
  #levels = null
  #listening = false
  #machine
  #muted
  #node = null
  #signal
  #spare = []
  #volume
  #volumeNode = null
  #waitingForPress = false

  static get supported() {
    return "AudioWorkletNode" in window
  }

  constructor(machine, { signal, muted, volume }) {
    super()

    this.#machine = machine
    this.#signal = signal
    this.#muted = muted
    this.#volume = volume

    machine.addEventListener("machine:advance", () => this.#listenOrFallSilent(), { signal })
    machine.addEventListener("machine:frame", () => this.#deliver(), { signal })
    machine.addEventListener("machine:stop", () => this.#fallSilent(), { signal })

    // Caught on the way down, so that a page stopping a press on its way does
    // not keep it from the sound; a touch is a press only once it is let go.
    window.addEventListener("keydown", () => this.#wake(), { signal, capture: true })
    window.addEventListener("pointerup", () => this.#wake(), { signal, capture: true })

    this.#wake()
  }

  // What was played, before the volume, at its peak since the last levels: a
  // level from 0 to 1 for each of the machine's channels, and null once the
  // machine has fallen silent.
  get levels() {
    return this.#levels
  }

  get muted() {
    return this.#muted
  }

  set muted(muted) {
    this.#muted = muted

    if (muted) {
      this.#writeWaitingForPress(false)
    } else {
      this.#wake()
    }

    this.#changed()
  }

  // In decibels: 0 plays the machine as it sounds, and the floor or anything
  // below it is silence.
  get volume() {
    return this.#volume
  }

  set volume(decibels) {
    const gain = gainOf(decibels)

    this.#volume = decibels
    this.#volumeNode?.gain.setTargetAtTime(gain, context.currentTime, VOLUME_EASING_SECONDS)
    this.#changed()
  }

  get waitingForPress() {
    return this.#waitingForPress
  }

  close() {
    if (this.#listening) {
      this.#machine.stopListening()
      this.#listening = false
    }

    if (this.#node) {
      this.#node.port.postMessage({ kind: "end" })
      this.#node.disconnect()
      this.#volumeNode.disconnect()
    }
  }

  onReturned({ samples, adjustment, peaks }) {
    this.#spare.push(samples)

    if (this.#listening) {
      this.#machine.setListeningRate(context.sampleRate * adjustment)
      this.#writeLevels(peaks)
    }
  }

  #changed() {
    const changed = new Event("amplifier:changed")
    this.dispatchEvent(changed)
  }

  #writeWaitingForPress(waiting) {
    if (this.#waitingForPress != waiting) {
      this.#waitingForPress = waiting
      this.#changed()
    }
  }

  #writeLevels(levels) {
    const read = new Event("amplifier:levels")

    this.#levels = levels
    this.dispatchEvent(read)
  }

  // A context made on a page not yet pressed is refused, with a warning on the
  // console. Not every key is a press: Escape is not, by HTML's
  // activation-triggering input events
  // (https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event),
  // and Chromium and Firefox leave out a modifier alone as well.
  #wake() {
    if (this.#muted) {
      return
    }

    if (!navigator.userActivation.hasBeenActive) {
      this.#writeWaitingForPress(true)
      return
    }

    const shared = sharedContext(),
      onStateChanged = () => this.#writeWaitingForPress(!this.#muted && shared.state != "running")

    if (!this.#connecting) {
      this.#connecting = true
      shared.addEventListener("statechange", onStateChanged, { signal: this.#signal })
      this.#makeNode()
    }

    shared.resume()
    onStateChanged()
  }

  async #makeNode() {
    await processorLoaded

    if (this.#signal.aborted) {
      return
    }

    const options = { numberOfInputs: 0, outputChannelCount: [2] },
      node = new AudioWorkletNode(context, PROCESSOR, options),
      gain = gainOf(this.#volume),
      volumeNode = new GainNode(context, { gain })

    node.port.onmessage = event => this.onReturned(event.data)
    node.connect(volumeNode)
    volumeNode.connect(context.destination)
    this.#node = node
    this.#volumeNode = volumeNode
  }

  #listenOrFallSilent() {
    const machine = this.#machine,
      heard = !this.#muted && this.#node != null && context.state == "running" && machine.speed == 1

    if (heard && !this.#listening) {
      machine.listen(context.sampleRate)
      this.#node.port.postMessage({ kind: "begin", channels: machine.soundChannels })
      this.#listening = true
    } else if (!heard) {
      this.#fallSilent()
    }
  }

  #deliver() {
    if (!this.#listening) {
      return
    }

    const heard = this.#machine.hear()

    if (heard.length == 0) {
      return
    }

    let samples = this.#spare.pop()

    if (samples == null || samples.length < heard.length) {
      samples = new Float32Array(heard.length)
    }

    samples.set(heard)
    this.#node.port.postMessage({ kind: "samples", samples, length: heard.length }, [
      samples.buffer
    ])
  }

  // What the last run made is played out before the machine falls silent.
  #fallSilent() {
    if (!this.#listening) {
      return
    }

    this.#deliver()
    this.#machine.stopListening()
    this.#listening = false
    this.#writeLevels(null)
  }
}
