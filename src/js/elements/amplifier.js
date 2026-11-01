import { html, write, writeValue } from "../lang"
import { Amplifier } from "../sound"
import { MachineObserver } from "./machine_observer"

// The fader's foot is silence rather than a level, and the meters read from
// the same depth up to full scale.
const FLOOR_DECIBELS = -60,
  HEAD_DECIBELS = 12

// Rising at once and falling back 20dB in 1.7s, as IEC 60268-18's digital
// peak meter does ("Table of characteristics",
// https://en.wikipedia.org/wiki/Peak_programme_meter, read 2026-11-01).
const FALL_DECIBELS_PER_MILLISECOND = 20 / 1700

const CHANNEL_NAMES = { 1: ["Mono"], 2: ["Left", "Right"] }

function renderMeter(name) {
  return html`<label>
    <span>${name}</span>
    <meter min="${FLOOR_DECIBELS}" max="0" value="${FLOOR_DECIBELS}"></meter>
  </label>`
}

function decibelsOf(level) {
  return 20 * Math.log10(level)
}

class AmplifierElement extends MachineObserver {
  static observedAttributes = ["volume"]

  #amplifier = null
  #fader
  #meters
  #readings
  #readAt = 0
  #volume

  watch(machine) {
    const names = CHANNEL_NAMES[machine.soundChannels]

    this.innerHTML = html`
      <h2>Amplifier</h2>
      <div class="levels">
        <label>
          <span>Volume</span>
          <input
            type="range"
            name="volume"
            min="${FLOOR_DECIBELS}"
            max="${HEAD_DECIBELS}"
            step="1"
          />
          <output name="volume"></output>
        </label>
        ${names.map(renderMeter).join("")}
      </div>
    `

    const { signal } = this

    this.#fader = this.querySelector('input[name="volume"]')
    this.#volume = this.querySelector('output[name="volume"]')
    this.#meters = Array.from(this.querySelectorAll("meter"))
    this.#readings = this.#meters.map(() => FLOOR_DECIBELS)

    this.#fader.disabled = !Amplifier.supported
    if (this.#fader.disabled) {
      this.#fader.title = "Sound cannot be played on this page"
    } else {
      const wake = () => Amplifier.wake(),
        onLevels = peaks => this.#read(peaks)

      this.#amplifier = new Amplifier(machine, { signal, onLevels })
      this.host.addEventListener("keydown", wake, { signal })
      this.host.addEventListener("pointerup", wake, { signal })
    }

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.#writeVolume()
  }

  attributeChangedCallback(name) {
    if (this.machine == null) {
      super.attributeChangedCallback(name)
      return
    }

    switch (name) {
      case "volume":
        this.#writeVolume()
        break

      default:
        super.attributeChangedCallback(name)
        break
    }
  }

  dispose() {
    super.dispose()
    this.#amplifier?.close()
    this.#amplifier = null
  }

  onChanged(event) {
    this.setAttribute("volume", event.target.value)
  }

  #writeVolume() {
    const decibels = Number(this.getAttribute("volume") ?? 0),
      silent = decibels <= FLOOR_DECIBELS,
      sign = decibels < 0 ? "−" : decibels > 0 ? "+" : "",
      shown = silent ? "Off" : `${sign}${Math.abs(decibels)}dB`

    writeValue(this.#fader, String(decibels))
    write(this.#volume, shown)

    if (this.#fader.getAttribute("aria-valuetext") != shown) {
      this.#fader.setAttribute("aria-valuetext", shown)
    }

    this.#amplifier?.setVolume(silent ? -Infinity : decibels)
  }

  // Null when the machine falls silent, which brings the meters down at once:
  // nothing arrives after it to let them fall.
  #read(peaks) {
    const now = performance.now(),
      fallen = (now - this.#readAt) * FALL_DECIBELS_PER_MILLISECOND

    this.#readAt = now

    for (let channel = 0; channel < this.#meters.length; channel++) {
      const peak = peaks == null ? -Infinity : decibelsOf(peaks[channel]),
        held = peaks == null ? -Infinity : this.#readings[channel] - fallen,
        reading = Math.max(FLOOR_DECIBELS, peak, held),
        meter = this.#meters[channel],
        shown = Math.round(reading)

      this.#readings[channel] = reading

      if (meter.value != shown) {
        meter.value = shown
      }
    }
  }
}

AmplifierElement.define("colophon-amplifier")
