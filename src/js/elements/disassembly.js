import { hex, html, write, writeFitted, writeValue } from "../lang"
import { Actions } from "./actions"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"
import { disassemble } from "../emulator"

const DEFAULT_LINES = 16

const FARTHEST_BACK = 32

// "RES 0,(IX+&05),B" is the widest the decoding produces.
const ARMED = 1,
  ADDRESS = 5,
  BYTES = 11,
  TEXT = 16,
  NAMED_TEXT = 22,
  GAP = 1

const BLANK = { label: "", offset: false, address: null }

const STEP_OVER = html`<svg class="icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M2 7.5a4 4 0 0 1 8 0M8.25 5.75 10 7.5l1.75-1.75" />
    <circle cx="6" cy="10.25" r="1.25" />
  </svg>`,
  STEP_INTO = html`<svg class="icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M6 1v6M3.75 4.75 6 7l2.25-2.25" />
    <circle cx="6" cy="10.25" r="1.25" />
  </svg>`,
  STEP_OUT = html`<svg class="icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M6 7.5v-6M3.75 3.75 6 1.5l2.25 2.25" />
    <circle cx="6" cy="10.25" r="1.25" />
  </svg>`

function renderRow() {
  return html`<div class="label" hidden></div>
    <div class="instruction">
      <input type="checkbox" class="armed" aria-label="Armed" disabled />
      <span class="at"></span>
      <span class="bytes"></span>
      <span class="text"></span>
    </div>`
}

function collectRows(root) {
  const labels = root.querySelectorAll(".label")

  return Array.from(root.querySelectorAll(".instruction"), function (instruction, number) {
    const [armed, at, bytes, text] = instruction.children

    return { label: labels[number], instruction, armed, at, bytes, text, address: null }
  })
}

function heading(names, standing) {
  if (names.length > 0) {
    return `${names.join(", ")}:`
  }

  if (!standing) {
    return ""
  }

  return standing.offset
    ? `${standing.name}+${hex(standing.offset, { prefix: "&" })}`
    : standing.name
}

function instructionEndingAt(peek, from, address) {
  let at = from,
    previous = null

  while (at != address && ((address - at) & 0xffff) <= FARTHEST_BACK) {
    const { length } = disassemble(peek, at)

    previous = at
    at = (at + length) & 0xffff
  }

  return at == address ? previous : null
}

function instructionBefore(peek, address) {
  for (let back = FARTHEST_BACK; back > 0; back--) {
    const previous = instructionEndingAt(peek, (address - back) & 0xffff, address)

    if (previous != null) {
      return previous
    }
  }

  return (address - 1) & 0xffff
}

class DisassemblyElement extends MachineObserver {
  static observedAttributes = ["base", "fixed", "label", "lines"]

  #labelRoom
  #lines
  #options
  #previousPc
  #problem
  #rows
  #textRoom
  #top

  watch(machine) {
    const lines = Number(this.getAttribute("lines") ?? DEFAULT_LINES),
      base = this.getAttribute("base"),
      start = base == null ? machine.z80.pc : machine.symbols.addressOf(base),
      label = this.getAttribute("label") ?? "Disassembly",
      fixed = this.hasAttribute("fixed"),
      rows = Array.from({ length: lines }, renderRow),
      toggle = html`<label
        class="toggle"
        title="Read the listing back under the program's own names"
      >
        <input type="checkbox" name="symbols" checked /> Symbols
      </label>`

    this.#lines = lines

    this.innerHTML = html`
      <header>
        <h2></h2>
        <button type="button" data-action="stepOver" title="Step over">${STEP_OVER}</button>
        <button type="button" data-action="stepInto" title="Step into">${STEP_INTO}</button>
        <button type="button" data-action="stepOut" title="Step out">${STEP_OUT}</button>
        <button type="button" data-action="goToProgramCounter" title="Go to the program counter">
          <span aria-hidden="true">⌖</span>
        </button>
        <colophon-options label="Disassembly options">
          <div class="fields">
            <label>
              Lines
              <input
                name="lines"
                aria-label="Lines"
                inputmode="numeric"
                maxlength="2"
                pattern="[1-9][0-9]?"
              />
            </label>
            <label title="A name or an address">
              Base
              <input
                name="base"
                aria-label="Base"
                maxlength="64"
                pattern="&?[0-9A-Fa-f]{1,4}|[A-Za-z_.$][0-9A-Za-z_.$]{0,63}"
              />
            </label>
          </div>
          <label class="toggle" title="Keep the listing where it stands while the processor moves">
            <input type="checkbox" name="fixed" /> Fixed
          </label>
          ${machine.symbols.size > 0 ? toggle : ""}
        </colophon-options>
      </header>
      <div class="listing">${rows.join("")}</div>
      <p role="status"></p>
    `

    this.#rows = collectRows(this)

    const { signal } = this,
      options = this.querySelector("colophon-options"),
      listing = this.querySelector(".listing"),
      fields = options.form.elements

    this.#options = options
    this.#problem = this.querySelector('p[role="status"]')
    this.querySelector("h2").textContent = label
    writeValue(fields.lines, String(lines))
    writeValue(fields.fixed, fixed)

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("contextmenu", this.onContextMenu.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    listing.addEventListener("wheel", this.onWheel.bind(this), { passive: false, signal })

    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })
    this.#previousPc = machine.z80.pc
    this.#moveTo(start)
  }

  onChanged(event) {
    const control = event.target

    if (control.name == "lines") {
      if (control.checkValidity()) {
        this.setAttribute("lines", control.value)
      }
      return
    }

    if (control.name == "base") {
      this.#commitBase(control)
      return
    }

    const machine = this.machine,
      row = this.#rows.find(found => found.armed == control)

    if (!row) {
      this.#render(machine)
      return
    }

    const covering = machine.breakpoints.covering(row.address, "execute")

    machine.breakpoints.enable(covering.address, covering.kind, control.checked)
    machine.changed()
  }

  onClick(event) {
    const button = event.target.closest("button")

    if (!button) {
      return
    }

    const machine = this.machine

    switch (button.dataset.action) {
      case "stepOver":
        machine.stepOver()
        break

      case "stepInto":
        machine.step()
        break

      case "stepOut": {
        const steppedOut = machine.stepOut()

        write(this.#problem, steppedOut ? "" : "No call on record to step out of")
        break
      }

      case "goToProgramCounter":
        this.#moveTo(machine.z80.pc)
        break

      default:
        break
    }
  }

  onContextMenu(event) {
    const instruction = event.target.closest(".instruction"),
      row = this.#rows.find(found => found.instruction == instruction)

    if (!row || row.address == null) {
      return
    }

    const machine = this.machine

    event.preventDefault()
    Actions.create(event, [
      {
        label: "Add breakpoint…",
        execute: () => BreakpointForm.create(machine, { address: row.address })
      },
      { label: "Show in memory", execute: () => machine.showMemory(row.address) }
    ])
  }

  onInput(event) {
    event.target.setCustomValidity("")
  }

  onWheel(event) {
    event.preventDefault()

    const peek = address => this.machine.peek(address),
      top = this.#top

    if (event.deltaY > 0) {
      const { length } = disassemble(peek, top)

      this.#moveTo((top + length) & 0xffff)
    } else if (event.deltaY < 0) {
      const above = instructionBefore(peek, top)

      this.#moveTo(above)
    }
  }

  #commitBase(control) {
    if (!control.checkValidity()) {
      return
    }

    const typed = control.value.trim(),
      address = this.machine.symbols.addressOf(typed)

    if (address == null) {
      control.setCustomValidity("unknown name")
      control.reportValidity()
      return
    }

    this.#moveTo(address)
  }

  #moveTo(address) {
    this.#beginAt(address)
    this.#render(this.machine)
  }

  #beginAt(address) {
    const shown = hex(address, { digits: 4, prefix: "&" })

    this.#top = address
    writeValue(this.#options.form.elements.base, shown)
  }

  #layout(naming) {
    const text = naming ? NAMED_TEXT : TEXT

    if (text == this.#textRoom) {
      return
    }

    this.#textRoom = text
    this.#labelRoom = ADDRESS + BYTES + text + GAP * 2
    this.style.setProperty("--columns", `${ARMED}ch ${ADDRESS}ch ${BYTES}ch ${text}ch`)
    this.style.setProperty("--gap", `${GAP}ch`)
    this.style.setProperty("--indent", `${ARMED + GAP}ch`)
  }

  #render(machine) {
    const pc = machine.z80.pc,
      fields = this.#options.form.elements,
      naming = fields.symbols != null && fields.symbols.checked,
      following = pc != this.#previousPc && !fields.fixed.checked

    let listing = this.#read(machine, this.#top, naming)

    if (following && !listing.some(entry => entry.address == pc)) {
      this.#beginAt(pc)
      listing = this.#read(machine, pc, naming)
    }

    this.#previousPc = pc
    write(this.#problem, "")
    this.#layout(naming)

    for (let number = 0; number < this.#lines; number++) {
      const row = this.#rows[number],
        entry = listing[number] ?? BLANK

      this.#writeLabel(row, entry.label, entry.offset)

      if (entry.address == null) {
        this.#blankRow(row)
      } else {
        this.#writeInstruction(machine, row, entry, pc)
      }
    }
  }

  #read(machine, top, naming) {
    const peek = address => machine.peek(address),
      symbols = machine.symbols,
      nameOf = naming ? address => symbols.namesAt(address)[0] : null,
      standing = naming ? symbols.nearest(top) : null,
      listing = []

    let address = top,
      lines = 0

    while (lines < this.#lines) {
      const names = naming ? symbols.namesAt(address) : [],
        label = heading(names, listing.length == 0 ? standing : null),
        offset = names.length == 0

      if (label) {
        lines++
      }

      if (lines == this.#lines) {
        listing.push({ label, offset, address: null })
        break
      }

      const { text, length } = disassemble(peek, address, nameOf)

      listing.push({ label, offset, address, text, length })
      address = (address + length) & 0xffff
      lines++
    }

    return listing
  }

  #writeInstruction(machine, row, { address, text, length }, pc) {
    const bytes = new Array(length)

    for (let taken = 0; taken < length; taken++) {
      const value = machine.peek((address + taken) & 0xffff)
      bytes[taken] = hex(value, { prefix: "" })
    }

    const covering = machine.breakpoints.covering(address, "execute")

    row.address = address
    row.armed.disabled = covering == null
    writeValue(row.armed, covering != null && covering.enabled)
    row.instruction.hidden = false
    row.instruction.classList.toggle("current", address == pc)
    write(row.at, hex(address, { digits: 4, prefix: "&" }))
    write(row.bytes, bytes.join(" "))
    writeFitted(row.text, text, this.#textRoom)
  }

  #writeLabel(row, text, offset) {
    writeFitted(row.label, text, this.#labelRoom)
    row.label.classList.toggle("offset", offset && text != "")
    row.label.hidden = text == ""
  }

  #blankRow(row) {
    row.address = null
    row.armed.disabled = true
    write(row.at, "")
    write(row.bytes, "")
    writeFitted(row.text, "", this.#textRoom)
    row.instruction.hidden = true
  }
}

DisassemblyElement.define("colophon-disassembly")
