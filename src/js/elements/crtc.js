import { hex, html, nodesByName, write } from "../lang"
import { MachineObserver } from "./machine_observer"

const COUNTERS = ["c0", "c4", "c9"]

function renderRow(name) {
  return html`
    <dt>${name.toUpperCase()}</dt>
    <dd data-field="${name}"></dd>
  `
}

class CrtcElement extends MachineObserver {
  #nodes
  #registerNames

  watch(machine) {
    this.#registerNames = Array.from(machine.crtc.registers, (_value, number) => `r${number}`)

    this.innerHTML = html`
      <h2>CRTC 6845</h2>
      <dl>${COUNTERS.map(renderRow).join("")}</dl>
      <dl class="registers">${this.#registerNames.map(renderRow).join("")}</dl>
    `

    this.#nodes = nodesByName(this)

    machine.addEventListener("changed", () => this.#render(machine), { signal: this.signal })
    this.#render(machine)
  }

  #render(machine) {
    const crtc = machine.crtc,
      registers = crtc.registers

    for (const name of COUNTERS) {
      write(this.#nodes[name], hex(crtc[name], { prefix: "&" }))
    }

    for (let number = 0; number < registers.length; number++) {
      write(this.#nodes[this.#registerNames[number]], hex(registers[number], { prefix: "&" }))
    }
  }
}

CrtcElement.define("colophon-crtc")
