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

function sharedContext() {
  if (context == null) {
    context = new AudioContext()
    processorLoaded = context.audioWorklet.addModule(PROCESSOR_URL)
  }

  return context
}

// What a machine sounds while it runs live at its own speed, and nothing it
// sounds otherwise: the delivery, and the volume it is played at.
export class Amplifier {
  #connecting = false
  #listening = false
  #machine
  #node = null
  #onLevels
  #signal
  #spare = []
  #volume = 0
  #volumeNode = null

  static get supported() {
    return "AudioWorkletNode" in window
  }

  // A context begins suspended, and only a gesture lets it run: this is called
  // from one, and resumes before anything is waited for. A page woken is woken
  // for every machine on it, those built later included.
  static wake() {
    sharedContext().resume()
  }

  // `onLevels` is given what was played, before the volume, at its peak since
  // the last time, a level from 0 to 1 for each of the machine's channels; and
  // null as the machine falls silent.
  constructor(machine, { signal, onLevels }) {
    this.#machine = machine
    this.#signal = signal
    this.#onLevels = onLevels

    machine.addEventListener("machine:advance", () => this.#listenOrFallSilent(), { signal })
    machine.addEventListener("machine:frame", () => this.#deliver(), { signal })
    machine.addEventListener("machine:stop", () => this.#fallSilent(), { signal })
  }

  // In decibels: 0 plays the machine as it sounds, and -Infinity is silence.
  setVolume(decibels) {
    const gain = 10 ** (decibels / 20)

    this.#volume = decibels
    this.#volumeNode?.gain.setTargetAtTime(gain, context.currentTime, VOLUME_EASING_SECONDS)
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
      this.#onLevels(peaks)
    }
  }

  async #makeNode() {
    await processorLoaded

    if (this.#signal.aborted) {
      return
    }

    const options = { numberOfInputs: 0, outputChannelCount: [2] },
      node = new AudioWorkletNode(context, PROCESSOR, options),
      gain = 10 ** (this.#volume / 20),
      volumeNode = new GainNode(context, { gain })

    node.port.onmessage = event => this.onReturned(event.data)
    node.connect(volumeNode)
    volumeNode.connect(context.destination)
    this.#node = node
    this.#volumeNode = volumeNode
  }

  // Before each run. The page's context is looked for here, since whichever
  // machine was pressed woke it for all of them.
  #listenOrFallSilent() {
    if (context != null && !this.#connecting) {
      this.#connecting = true
      this.#makeNode()
    }

    const machine = this.#machine,
      heard = this.#node != null && context.state == "running" && machine.speed == 1

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
    this.#onLevels(null)
  }
}
