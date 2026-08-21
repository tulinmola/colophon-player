import { hex, html, nodesByName, write, writeFitted } from "../lang"
import { MachineObserver } from "./machine_observer"
import { disassemble } from "../emulator"
import { renderToggle } from "./fields"

const DEFAULT_LINES = 16

// "RES 0,(IX+&05),B" is the widest the decoding produces.
const ADDRESS = 5,
  BYTES = 11,
  TEXT = 16,
  NAMED_TEXT = 22,
  GAP = 1

function renderRow(_row, number) {
  return html`<div class="label" data-field="label${number}" hidden></div>
    <div class="instruction${number == 0 ? " current" : ""}" data-field="row${number}">
      <span data-field="address${number}"></span>
      <span data-field="bytes${number}"></span>
      <span data-field="text${number}"></span>
    </div>`
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
  #nodes
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

    this.#nodes = nodesByName(this)
    this.#form = this.querySelector("form")

    const { signal } = this
    this.addEventListener("change", () => this.#render(machine), { signal })

    machine.addEventListener("changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  #layout(naming) {
    const text = naming ? NAMED_TEXT : TEXT

    if (text == this.#textRoom) {
      return
    }

    this.#textRoom = text
    this.#labelRoom = ADDRESS + BYTES + text + GAP * 2
    this.style.setProperty("--columns", `${ADDRESS}ch ${BYTES}ch ${text}ch`)
    this.style.setProperty("--gap", `${GAP}ch`)
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
      const names = naming ? symbols.namesAt(address) : [],
        above = heading(names, number == 0 ? standing : null)

      this.#writeLabel(number, above, names.length == 0)

      if (above) {
        lines++
      }

      if (lines == this.#lines) {
        this.#blankRow(number)
        continue
      }

      const { text, length } = disassemble(peek, address, nameOf),
        bytes = []

      for (let taken = 0; taken < length; taken++) {
        const value = peek((address + taken) & 0xffff)
        bytes.push(hex(value, { prefix: "" }))
      }

      this.#nodes[`row${number}`].hidden = false
      write(this.#nodes[`address${number}`], hex(address, { digits: 4, prefix: "&" }))
      write(this.#nodes[`bytes${number}`], bytes.join(" "))
      writeFitted(this.#nodes[`text${number}`], text, this.#textRoom)

      address = (address + length) & 0xffff
      lines++
    }

    for (; number < this.#lines; number++) {
      this.#writeLabel(number, "", false)
      this.#blankRow(number)
    }
  }

  #writeLabel(number, text, offset) {
    const label = this.#nodes[`label${number}`]

    writeFitted(label, text, this.#labelRoom)
    label.classList.toggle("offset", offset && text != "")
    label.hidden = text == ""
  }

  #blankRow(number) {
    write(this.#nodes[`address${number}`], "")
    write(this.#nodes[`bytes${number}`], "")
    writeFitted(this.#nodes[`text${number}`], "", this.#textRoom)
    this.#nodes[`row${number}`].hidden = true
  }
}

DisassemblyElement.define("colophon-disassembly")
