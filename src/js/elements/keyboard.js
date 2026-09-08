import { html, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

const BITS_A_LINE = 8

function renderKey(inscriptions, key) {
  const legend = inscriptions[key]

  if (!legend) {
    return html`<td></td>`
  }

  const [inscription, meaning] = legend

  return html`<td>
    <label title="Key ${key}: ${meaning}">
      <input type="checkbox" name="key${key}" />
      ${inscription}
    </label>
  </td>`
}

function renderLine(inscriptions, line) {
  const keys = Array.from({ length: BITS_A_LINE }, (_, bit) =>
    renderKey(inscriptions, line * BITS_A_LINE + bit)
  )

  return html`<tr>
    <th scope="row">${line}</th>
    ${keys.join("")}
  </tr>`
}

function renderBit(bit) {
  return html`<th scope="col">${bit}</th>`
}

class KeyboardElement extends MachineObserver {
  #form

  watch(machine) {
    const inscriptions = machine.inscriptions,
      bits = Array.from({ length: BITS_A_LINE }, (_, bit) => renderBit(bit)),
      lines = Array.from({ length: machine.keyboardLines }, (_, line) =>
        renderLine(inscriptions, line)
      )

    this.innerHTML = html`
      <h2>Keyboard</h2>
      <form>
        <table>
          <thead>
            <tr>
              <th scope="col">Line</th>
              ${bits.join("")}
            </tr>
          </thead>
          <tbody>
            ${lines.join("")}
          </tbody>
        </table>
      </form>
    `

    this.#form = this.querySelector("form")

    const { signal } = this
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("change", this.onChanged.bind(this), { signal })

    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  onKeyDown(event) {
    if (event.key == "Escape") {
      this.#form.reset()
    }
  }

  onChanged(event) {
    const input = event.target,
      key = Number(input.name.slice(3))

    this.machine.keyboard.putKey(key, input.checked)
    this.machine.changed()
  }

  #render(machine) {
    const keyboard = machine.keyboard,
      field = this.#form.elements

    for (let key = 0; key < machine.keyboardLines * BITS_A_LINE; key++) {
      if (field[`key${key}`]) {
        writeValue(field[`key${key}`], keyboard.pressed(key))
      }
    }
  }
}

KeyboardElement.define("colophon-keyboard")
