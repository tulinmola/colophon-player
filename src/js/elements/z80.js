import { fields, hex, html, write } from "../lang"
import { Viewer } from "./viewer"

class Z80Element extends Viewer {
  #fields

  watch(machine) {
    this.innerHTML = html`
      <h2>Z80</h2>
      <dl>
        <dt>PC</dt>
        <dd data-field="pc"></dd>
      </dl>
    `

    this.#fields = fields(this)

    machine.addEventListener("frame", () => this.#render(machine), { signal: this.signal })
    this.#render(machine)
  }

  #render(machine) {
    write(this.#fields.pc, hex(machine.z80.pc, 4))
  }
}

Z80Element.define("colophon-z80")
