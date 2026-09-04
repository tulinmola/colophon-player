import { bit, hex, html, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

const MICROSECONDS = { pattern: "[0-9]{1,6}", width: 6, unit: "µs" }

// The bits of each status register, as the µPD765A datasheet names them. The
// main status register's low four are one per unit and stand in its hex alone.
const MSR_BITS = [
  { label: "RQM", meaning: "Request for master: a byte wants moving", name: "requestForMaster" },
  {
    label: "DIO",
    meaning: "Direction: set when the chip is sending",
    name: "directionToProcessor"
  },
  {
    label: "EXM",
    meaning: "Execution mode: a transfer is under way, non-DMA",
    name: "executionMode"
  },
  { label: "CB", meaning: "Controller busy: a command is in progress", name: "controllerBusy" }
]

const ST0_BITS = [
  { label: "SE", meaning: "Seek end", name: "seekEnd" },
  { label: "EC", meaning: "Equipment check: no track 0 in 77 steps", name: "equipmentCheck" },
  { label: "NR", meaning: "Not ready", name: "notReady" },
  { label: "HD", meaning: "Head address", name: "headAddress" }
]

const ST1_BITS = [
  { label: "EN", meaning: "End of cylinder: a sector past the last", name: "endOfCylinder" },
  { label: "DE", meaning: "Data error: a check failed", name: "dataError" },
  { label: "OR", meaning: "Overrun: the processor was late", name: "overrun" },
  { label: "ND", meaning: "No data: the sector was not found", name: "noData" },
  { label: "NW", meaning: "Not writeable", name: "notWriteable" },
  { label: "MA", meaning: "Missing address mark", name: "missingAddressMark" }
]

const ST2_BITS = [
  { label: "CM", meaning: "Control mark: the other kind of data mark", name: "controlMark" },
  { label: "DD", meaning: "Data error in the data field", name: "dataErrorInDataField" },
  { label: "WC", meaning: "Wrong cylinder", name: "wrongCylinder" },
  { label: "SH", meaning: "Scan equal hit", name: "scanHit" },
  { label: "SN", meaning: "Scan not satisfied", name: "scanNotSatisfied" },
  { label: "BC", meaning: "Bad cylinder: C read as &FF", name: "badCylinder" },
  {
    label: "MD",
    meaning: "Missing address mark in the data field",
    name: "missingAddressMarkInDataField"
  }
]

function bytes(values) {
  return Array.from(values, value => hex(value)).join(" ")
}

const STATUS_REGISTERS = [
  { label: "MSR", meaning: "Main status register", name: "status", bits: MSR_BITS },
  { label: "ST0", meaning: "Status register 0", name: "st0", bits: ST0_BITS },
  { label: "ST1", meaning: "Status register 1", name: "st1", bits: ST1_BITS },
  { label: "ST2", meaning: "Status register 2", name: "st2", bits: ST2_BITS }
]

const GROUPS = [
  {
    kind: "indicators",
    readings: [
      {
        label: "IC",
        meaning: "Interrupt code: how the last command ended",
        name: "interruptCode",
        read: fdc => fdc.interruptCode
      },
      {
        label: "US",
        meaning: "Unit select: the drive the last command named",
        name: "unitSelect",
        read: fdc => String(fdc.unitSelect)
      },
      {
        label: "Phase",
        meaning: "Which of a command's three phases is under way",
        name: "phase",
        read: fdc => fdc.phase
      },
      {
        label: "Stage",
        meaning: "Where an execution phase has got to on the track",
        name: "stage",
        read: fdc => fdc.stage
      },
      {
        label: "Moved",
        meaning: "Bytes across the data register, of the length the command moves",
        name: "moved",
        read: fdc => `${fdc.transferred}/${fdc.transferLength}`
      },
      {
        label: "TC",
        meaning: "Terminal count, the pin these boards leave unwired",
        name: "terminalCount",
        read: fdc => bit(fdc.terminalCount)
      }
    ]
  },
  {
    kind: "registers",
    readings: [
      {
        label: "C",
        meaning: "Cylinder, as the last command left it",
        name: "c",
        read: fdc => hex(fdc.c)
      },
      {
        label: "H",
        meaning: "Head, as the last command left it",
        name: "h",
        read: fdc => hex(fdc.h)
      },
      { label: "R", meaning: "Record: the sector number", name: "r", read: fdc => hex(fdc.r) },
      {
        label: "N",
        meaning: "Size code: 128 << N bytes, and 32K from eight up",
        name: "n",
        read: fdc => hex(fdc.n)
      }
    ]
  },
  {
    kind: "sequence",
    readings: [
      {
        label: "CMD",
        meaning: "The command bytes the chip has taken",
        name: "command",
        read: fdc => bytes(fdc.command.subarray(0, fdc.commandReceived))
      },
      {
        label: "RES",
        meaning: "The result bytes it answered with",
        name: "result",
        read: fdc => bytes(fdc.result.subarray(0, fdc.resultLength))
      }
    ]
  },
  {
    kind: "indicators",
    readings: [
      {
        label: "SRT",
        meaning: "Step rate time, as Specify set it",
        name: "stepTime",
        read: fdc => String(fdc.stepTime),
        edit: MICROSECONDS,
        write: (fdc, set) => (fdc.stepTime = set)
      },
      {
        label: "HLT",
        meaning: "Head load time, as Specify set it",
        name: "headLoadTime",
        read: fdc => String(fdc.headLoadTime),
        edit: MICROSECONDS,
        write: (fdc, set) => (fdc.headLoadTime = set)
      },
      {
        label: "HUT",
        meaning: "Head unload time, as Specify set it",
        name: "headUnloadTime",
        read: fdc => String(fdc.headUnloadTime),
        edit: MICROSECONDS,
        write: (fdc, set) => (fdc.headUnloadTime = set)
      },
      {
        label: "ND",
        meaning: "Non-DMA mode, which these boards must use",
        name: "nonDma",
        read: fdc => fdc.nonDma,
        edit: { toggle: true },
        write: (fdc, set) => (fdc.nonDma = set)
      },
      {
        label: "HEAD",
        meaning: "Whether the head is loaded onto the disc",
        name: "headLoaded",
        read: fdc => bit(fdc.headLoaded)
      }
    ]
  }
]

// A reading a command sets is a reading a reader can set: those carry an edit,
// and the platform's own control does the committing and the refusing.
function renderControl({ label, name, edit }) {
  if (!edit) {
    return html`<output name="${name}" aria-label="${label}" aria-live="off"> </output>`
  }

  if (edit.toggle) {
    return html`<input type="checkbox" class="state" name="${name}" aria-label="${label}" />`
  }

  return html`<span class="input-group"
    ><input
      name="${name}"
      aria-label="${label}"
      maxlength="${edit.width}"
      pattern="${edit.pattern}"
    />${edit.unit}</span
  >`
}

function renderReading(reading) {
  return html`<label>
    <abbr title="${reading.meaning}">${reading.label}</abbr>
    ${renderControl(reading)}
  </label>`
}

function renderStatus({ label, meaning, name, bits }) {
  const register = renderReading({ label, meaning, name }),
    shown = bits.map(renderReading).join("")

  return html`<div class="fields status">
    ${register}
    <div>${shown}</div>
  </div>`
}

function renderGroup({ kind, readings }) {
  return html`<div class="fields ${kind}">${readings.map(renderReading).join("")}</div>`
}

const EDITABLE = new Map(
  GROUPS.flatMap(group => group.readings)
    .filter(reading => reading.edit)
    .map(reading => [reading.name, reading])
)

class Upd765Element extends MachineObserver {
  #form

  watch(machine) {
    this.innerHTML = html`
      <h2><abbr title="NEC µPD765A floppy disc controller">µPD765A</abbr></h2>
      <form>
        ${STATUS_REGISTERS.map(renderStatus).join("")} ${GROUPS.map(renderGroup).join("")}
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
      { write } = EDITABLE.get(control.name),
      fdc = this.machine.fdc

    if (control.type == "checkbox") {
      write(fdc, control.checked)
    } else {
      if (control.checkValidity()) {
        write(fdc, Number(control.value))
      }

      control.blur()
    }

    this.machine.changed()
  }

  #render(machine) {
    const fdc = machine.fdc

    for (const { name, bits } of STATUS_REGISTERS) {
      this.#show(name, hex(fdc[name]))

      for (const flag of bits) {
        this.#show(flag.name, bit(fdc[flag.name]))
      }
    }

    for (const { readings } of GROUPS) {
      for (const { name, read } of readings) {
        this.#show(name, read(fdc))
      }
    }
  }

  #show(name, text) {
    writeValue(this.#form.elements[name], text)
  }
}

Upd765Element.define("colophon-upd765")
