import { fields, hex, html, write } from "../lang"
import { Viewer } from "./viewer"
import { disassemble } from "../emulator"

const ROWS = 16

function renderRow(number) {
  return html`<div class="instruction">
    <span data-field="address${number}"></span>
    <span data-field="bytes${number}"></span>
    <span data-field="text${number}"></span>
  </div>`
}

class DisassemblyElement extends Viewer {
  #fields

  watch(machine) {
    const rows = Array.from({ length: ROWS }, (_row, number) => renderRow(number))

    this.innerHTML = html`
      <h2>Disassembly</h2>
      ${rows.join("")}
    `

    this.#fields = fields(this)

    machine.addEventListener("frame", () => this.#render(machine), { signal: this.signal })
    this.#render(machine)
  }

  #render(machine) {
    const peek = address => machine.peek(address)

    let address = machine.z80.pc
    for (let number = 0; number < ROWS; number++) {
      const { text, length } = disassemble(peek, address),
        bytes = []

      for (let taken = 0; taken < length; taken++) {
        const value = peek((address + taken) & 0xffff)
        bytes.push(hex(value, { prefix: "" }))
      }

      write(this.#fields[`address${number}`], hex(address, { digits: 4 }))
      write(this.#fields[`bytes${number}`], bytes.join(" "))
      write(this.#fields[`text${number}`], text)

      address = (address + length) & 0xffff
    }
  }
}

DisassemblyElement.define("colophon-disassembly")
