import { bit, html, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

const UNITS = { a: 0, b: 1 }

const DEFAULT_DRIVE = "a"

const SHUGART_LINES = [
  { label: "MOTOR", meaning: "Motor on, as the machine drives it", name: "motor" },
  { label: "READY", meaning: "A disc, the motor on, and the spin-up over", name: "ready" },
  { label: "TRK0", meaning: "The head stands over cylinder zero", name: "trackZero" },
  { label: "WP", meaning: "The tab on the disc in the drive", name: "writeProtected" },
  { label: "2SIDE", meaning: "Whether the drive has a second head at all", name: "twoSided" }
]

// An empty drive has no track under its head for a position to be on.
function onTrack(drive) {
  const floppy = drive.floppy

  return floppy ? `${drive.position}/${floppy.trackLength(drive.cylinder, drive.side)}` : "—"
}

// What the head is doing, and what a reader may set it to. STEP and SIDE
// SELECT drive the first two, and drive.h leaves the spin-up to whoever fits
// the drive, since nobody has measured one for these.
const READINGS = [
  {
    label: "Cylinder",
    meaning: "The cylinder the head stands over",
    name: "cylinder",
    read: drive => String(drive.cylinder),
    edit: { pattern: "[0-9]{1,3}", width: 3 },
    write: (drive, set) => (drive.cylinder = set)
  },
  {
    label: "Side",
    meaning: "Side select, which one head ignores",
    name: "side",
    read: drive => String(drive.side),
    edit: { pattern: "[01]", width: 1 },
    write: (drive, set) => (drive.side = set)
  },
  {
    label: "Position",
    meaning: "The byte under the head, from the index",
    name: "position",
    read: onTrack
  },
  {
    label: "Turns",
    meaning: "Index pulses since the disc went in",
    name: "revolutions",
    read: drive => String(drive.revolutions)
  },
  {
    label: "SPIN",
    meaning: "Microseconds from motor on to speed, which no source measures",
    name: "spinUp",
    read: drive => String(drive.spinUp),
    edit: { pattern: "[0-9]{1,7}", width: 7, unit: "µs" },
    write: (drive, set) => (drive.spinUp = set)
  }
]

function renderControl({ label, name, edit }) {
  if (!edit) {
    return html`<output name="${name}" aria-label="${label}" aria-live="off"> </output>`
  }

  return html`<span class="input-group"
    ><input
      name="${name}"
      aria-label="${label}"
      maxlength="${edit.width}"
      pattern="${edit.pattern}"
    />${edit.unit ?? ""}</span
  >`
}

function renderReading(reading) {
  return html`<label>
    <abbr title="${reading.meaning}">${reading.label}</abbr>
    ${renderControl(reading)}
  </label>`
}

const EDITABLE = new Map(
  READINGS.filter(reading => reading.edit).map(reading => [reading.name, reading])
)

class DriveElement extends MachineObserver {
  static observedAttributes = ["drive"]

  #form
  #unit

  watch(machine) {
    const letter = this.getAttribute("drive") ?? DEFAULT_DRIVE

    this.#unit = UNITS[letter.toLowerCase()]

    this.innerHTML = html`
      <h2>Drive ${letter.toUpperCase()}</h2>
      <form>
        <div class="fields indicators">${SHUGART_LINES.map(renderReading).join("")}</div>
        <div class="fields indicators">${READINGS.map(renderReading).join("")}</div>
      </form>
    `

    this.#form = this.querySelector("form")

    const { signal } = this
    this.addEventListener("focusin", this.onFocusIn.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("change", this.onChanged.bind(this), { signal })

    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  onFocusIn(event) {
    if (event.target.type == "text") {
      event.target.select()
    }
  }

  onKeyDown(event) {
    if (event.key == "Escape") {
      this.#form.reset()
    }
  }

  onChanged(event) {
    const control = event.target,
      { write } = EDITABLE.get(control.name)

    if (control.checkValidity()) {
      write(this.machine.drives[this.#unit], Number(control.value))
    }

    control.blur()
    this.machine.changed()
  }

  #render(machine) {
    const drive = machine.drives[this.#unit]

    for (const { name } of SHUGART_LINES) {
      this.#show(name, bit(drive[name]))
    }

    for (const { name, read } of READINGS) {
      this.#show(name, read(drive))
    }
  }

  #show(name, text) {
    writeValue(this.#form.elements[name], text)
  }
}

DriveElement.define("colophon-drive")
