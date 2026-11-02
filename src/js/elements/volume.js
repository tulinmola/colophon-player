import { html, write, writeValue } from "../lang"
import { FLOOR_DECIBELS } from "../sound"
import { MachineObserver } from "./machine_observer"

const HEAD_DECIBELS = 12

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

class VolumeElement extends MachineObserver {
  #fader
  #meters
  #readings
  #readAt = 0
  #volume

  watch(machine) {
    const names = CHANNEL_NAMES[machine.soundChannels],
      { amplifier } = this.host

    this.innerHTML = html`
      <h2>Volume</h2>
      <div class="levels">
        <input
          type="range"
          name="volume"
          aria-label="Volume"
          min="${FLOOR_DECIBELS}"
          max="${HEAD_DECIBELS}"
          step="1"
        />
        <output name="volume" aria-live="off"></output>
        ${names.map(renderMeter).join("")}
      </div>
    `

    const { signal } = this

    this.#fader = this.querySelector('input[name="volume"]')
    this.#volume = this.querySelector('output[name="volume"]')
    this.#meters = Array.from(this.querySelectorAll("meter"))
    this.#readings = this.#meters.map(() => FLOOR_DECIBELS)

    if (amplifier == null) {
      this.#writeVolume({ volume: FLOOR_DECIBELS, muted: false })
      this.#fader.disabled = true
      this.#fader.title = "Sound cannot be played on this page"
      return
    }

    amplifier.addEventListener("amplifier:levels", () => this.#read(amplifier.levels), { signal })
    amplifier.addEventListener("amplifier:changed", () => this.#writeVolume(amplifier), { signal })
    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.#writeVolume(amplifier)
  }

  onChanged(event) {
    this.host.setAttribute("volume", event.target.value)
  }

  #writeVolume({ volume, muted }) {
    const silent = volume <= FLOOR_DECIBELS,
      sign = volume < 0 ? "−" : volume > 0 ? "+" : "",
      shown = muted ? "Muted" : silent ? "Off" : `${sign}${Math.abs(volume)}dB`

    writeValue(this.#fader, String(volume))
    write(this.#volume, shown)

    if (this.#fader.getAttribute("aria-valuetext") != shown) {
      this.#fader.setAttribute("aria-valuetext", shown)
    }

    if (this.#fader.disabled != muted) {
      this.#fader.disabled = muted
    }
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

VolumeElement.define("colophon-volume")
