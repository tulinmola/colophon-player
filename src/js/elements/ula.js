import { html, write, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

function renderField(name, label, pattern) {
  return html`<label>
    <span>${label}</span>
    <input type="text" name="${name}" size="5" pattern="${pattern}" />
  </label>`
}

function renderState(name, label) {
  return html`<label title="${label}"><span>${name}</span> <output name="${name}"></output></label>`
}

class UlaElement extends MachineObserver {
  #form

  watch(machine) {
    this.innerHTML = html`
      <h2>
        <abbr title="Uncommitted Logic Array">ULA</abbr>
        Ferranti 5C102E
      </h2>
      <form>
        <div class="fields">
          ${renderField("frameTick", "Frame T-state", "[0-9]{1,5}")}
          ${renderField("border", "Border", "[0-7]")}
        </div>
        <div class="list">
          ${renderState("Line", "The line the beam stands on, counted from the interrupt")}
          ${renderState("Column", "The T-state of that line")}
          ${renderState("Frame", "Frames since reset; FLASH swaps ink and paper on bit 4")}
          ${renderState("EAR", "The speaker bit, which also drives the EAR socket")}
          ${renderState("MIC", "The bit written to tape, which goes nowhere here")}
        </div>
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
      ula = this.machine.ula

    if (input.checkValidity()) {
      const value = parseInt(input.value)

      if (input.name == "frameTick") {
        ula.seek(value)
      } else {
        ula.border = value
      }
    }

    input.blur()
    this.machine.changed()
  }

  #render(machine) {
    const ula = machine.ula,
      field = this.#form.elements

    writeValue(field.frameTick, String(ula.frameTick))
    writeValue(field.border, String(ula.border))

    write(field.Line, String(ula.line))
    write(field.Column, String(ula.column))
    write(field.Frame, String(ula.frameCount))
    write(field.EAR, ula.speaker ? "1" : ".")
    write(field.MIC, ula.microphone ? "1" : ".")
  }
}

UlaElement.define("colophon-ula")
