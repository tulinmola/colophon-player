import { fields, hex, html, write } from "../lang"
import { Viewer } from "./viewer"

const COUNTERS = ["c0", "c4", "c9"]

function renderRow(name) {
  return html`
    <dt>${name.toUpperCase()}</dt>
    <dd data-field="${name}"></dd>
  `
}

class CrtcElement extends Viewer {
  #fields
  #registerNames

  watch(machine) {
    this.#registerNames = Array.from(machine.crtc.registers, (_value, number) => `r${number}`)

    this.innerHTML = html`
      <h2>CRTC 6845</h2>
      <dl>${COUNTERS.map(renderRow).join("")}</dl>
      <dl class="registers">${this.#registerNames.map(renderRow).join("")}</dl>
    `

    this.#fields = fields(this)

    machine.addEventListener("frame", () => this.#render(machine), { signal: this.signal })
    this.#render(machine)
  }

  #render(machine) {
    const crtc = machine.crtc,
      registers = crtc.registers

    for (const name of COUNTERS) {
      write(this.#fields[name], hex(crtc[name], 2))
    }

    for (let number = 0; number < registers.length; number++) {
      write(this.#fields[this.#registerNames[number]], hex(registers[number], 2))
    }
  }
}

CrtcElement.define("colophon-crtc")
