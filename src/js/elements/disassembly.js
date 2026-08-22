import { hex, html, write, writeFitted } from "../lang"
import { renderToggle, show } from "./fields"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"
import { Options } from "./options"
import { disassemble } from "../emulator"

const DEFAULT_LINES = 16

// "RES 0,(IX+&05),B" is the widest the decoding produces.
const ARMED = 1,
  ADDRESS = 5,
  BYTES = 11,
  TEXT = 16,
  NAMED_TEXT = 22,
  GAP = 1

function renderRow(_row, number) {
  return html`<div class="label" hidden></div>
    <div class="instruction${number == 0 ? " current" : ""}">
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

class DisassemblyElement extends MachineObserver {
  #form = null
  #labelRoom
  #lines
  #rows
  #textRoom

  watch(machine) {
    const lines = Number(this.getAttribute("lines") ?? DEFAULT_LINES),
      rows = Array.from({ length: lines }, renderRow),
      toggle = renderToggle(
        "Symbols",
        "Read the listing back under the program's own names",
        "symbols",
        true
      )

    this.#lines = lines

    this.innerHTML = html`
      <header>
        <h2>Disassembly</h2>
        ${machine.symbols.size > 0 ? html`<form>${toggle}</form>` : ""}
      </header>
      ${rows.join("")}
    `

    this.#rows = collectRows(this)
    this.#form = this.querySelector("form")

    const { signal } = this
    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("contextmenu", this.onContextMenu.bind(this), { signal })

    machine.addEventListener("changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  onChanged(event) {
    const machine = this.machine,
      row = this.#rows.find(found => found.armed == event.target)

    if (!row) {
      this.#render(machine)
      return
    }

    const covering = machine.breakpoints.covering(row.address, "execute")

    machine.breakpoints.enable(covering.address, covering.kind, event.target.checked)
    machine.changed()
  }

  onContextMenu(event) {
    const instruction = event.target.closest(".instruction"),
      row = this.#rows.find(found => found.instruction == instruction)

    if (!row || row.address == null) {
      return
    }

    const machine = this.machine

    event.preventDefault()
    Options.create(event, [
      {
        label: "Add breakpoint…",
        execute: () => BreakpointForm.create(machine, { address: row.address })
      },
      { label: "Show in memory", execute: () => machine.showMemory(row.address) }
    ])
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
    const peek = address => machine.peek(address),
      symbols = machine.symbols,
      naming = this.#form != null && this.#form.elements.symbols.checked,
      nameOf = naming ? address => symbols.namesAt(address)[0] : null,
      standing = naming ? symbols.nearest(machine.z80.pc) : null

    this.#layout(naming)

    let address = machine.z80.pc,
      lines = 0,
      number = 0

    for (; number < this.#lines && lines < this.#lines; number++) {
      const row = this.#rows[number],
        names = naming ? symbols.namesAt(address) : [],
        above = heading(names, number == 0 ? standing : null)

      this.#writeLabel(row, above, names.length == 0)

      if (above) {
        lines++
      }

      if (lines == this.#lines) {
        this.#blankRow(row)
        continue
      }

      const { text, length } = disassemble(peek, address, nameOf),
        bytes = []

      for (let taken = 0; taken < length; taken++) {
        const value = peek((address + taken) & 0xffff)
        bytes.push(hex(value, { prefix: "" }))
      }

      const covering = machine.breakpoints.covering(address, "execute")

      row.address = address
      row.armed.disabled = covering == null
      show(row.armed, covering != null && covering.enabled)
      row.instruction.hidden = false
      write(row.at, hex(address, { digits: 4, prefix: "&" }))
      write(row.bytes, bytes.join(" "))
      writeFitted(row.text, text, this.#textRoom)

      address = (address + length) & 0xffff
      lines++
    }

    for (; number < this.#lines; number++) {
      const row = this.#rows[number]

      this.#writeLabel(row, "", false)
      this.#blankRow(row)
    }
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
