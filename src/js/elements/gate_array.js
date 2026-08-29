import { hex, html, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

const PENS = 16

function renderAbbreviation(label, meaning) {
  return html`<abbr title="${meaning}">${label}</abbr>`
}

function renderInk(pen) {
  const label = pen == PENS ? "B" : `P${pen}`,
    meaning = pen == PENS ? "Ink for the border" : `Ink for pen ${pen}`

  return html`<label>
    ${renderAbbreviation(label, meaning)}
    <span class="ink"
      ><span class="swatch"></span
      ><span class="input-group"
        ><input
          name="ink${pen}"
          aria-label="${label}"
          maxlength="2"
          pattern="[0-1]?[0-9A-Fa-f]" /></span
    ></span>
  </label>`
}

function renderByte(label, meaning, name, pattern) {
  return html`<label
    >${renderAbbreviation(label, meaning)}<span class="input-group"
      ><input name="${name}" aria-label="${label}" maxlength="2" pattern="${pattern}" /></span
  ></label>`
}

function renderMode(label, meaning, name) {
  return html`<label
    >${renderAbbreviation(label, meaning)}<span class="input-group"
      ><input name="${name}" aria-label="${label}" maxlength="1" pattern="[0-3]" /></span
  ></label>`
}

function renderState(label, meaning, name) {
  return html`<label
    >${renderAbbreviation(label, meaning)}<input
      type="checkbox"
      class="state"
      name="${name}"
      aria-label="${label}"
  /></label>`
}

class GateArrayElement extends MachineObserver {
  #form
  #shown
  #swatches

  watch(machine) {
    const inks = Array.from({ length: PENS + 1 }, (_ink, pen) => renderInk(pen))

    this.innerHTML = html`
      <h2>Gate Array</h2>
      <form>
        <div class="fields inks">${inks.join("")}</div>
        <div class="fields pairs">
          ${[
            renderByte(
              "PEN",
              "The colour register an ink write lands on; &10 is the border",
              "pen",
              "[0-1]?[0-9A-Fa-f]"
            ),
            renderByte(
              "R52",
              "Line syncs counted; the fifty-second raises an interrupt",
              "r52",
              "[0-3]?[0-9A-Fa-f]"
            )
          ].join("")}
        </div>
        <div class="fields indicators">
          ${[
            renderMode("MODE", "The video mode in force", "mode"),
            renderMode(
              "MODE'",
              "The mode as last written, in force after the next line sync",
              "modePending"
            ),
            renderState("LOWER", "The lower ROM stands over &0000 to &3FFF", "lowerRomEnabled"),
            renderState("UPPER", "The upper ROM stands over &C000 to &FFFF", "upperRomEnabled"),
            renderState(
              "INT",
              "An interrupt is asked for, and held until it is taken",
              "interruptRequest"
            )
          ].join("")}
        </div>
      </form>
    `

    this.#form = this.querySelector("form")
    this.#swatches = Array.from(this.querySelectorAll(".swatch"))
    this.#shown = new Int16Array(PENS + 1).fill(-1)

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
    const input = event.target,
      gateArray = this.machine.gateArray

    if (input.type == "checkbox") {
      gateArray[input.name] = input.checked
      // What the processor reads is derived from the ROM enables, and the
      // machine is what holds that derivation.
      this.machine.remap()
    } else {
      if (input.checkValidity()) {
        const value = parseInt(input.value, 16)

        if (input.name.startsWith("ink")) {
          gateArray.putInk(Number(input.name.slice(3)), value)
        } else {
          gateArray[input.name] = value
        }
      }

      input.blur()
    }

    this.machine.changed()
  }

  #render(machine) {
    const gateArray = machine.gateArray,
      colours = machine.colours,
      field = this.#form.elements,
      inks = gateArray.inks

    for (let pen = 0; pen < inks.length; pen++) {
      const code = inks[pen]

      writeValue(field[`ink${pen}`], hex(code))

      if (this.#shown[pen] != code) {
        this.#shown[pen] = code
        this.#swatches[pen].style.background = colours[code]
      }
    }

    writeValue(field.pen, hex(gateArray.pen))
    writeValue(field.r52, hex(gateArray.r52))
    writeValue(field.mode, String(gateArray.mode))
    writeValue(field.modePending, String(gateArray.modePending))
    writeValue(field.lowerRomEnabled, gateArray.lowerRomEnabled)
    writeValue(field.upperRomEnabled, gateArray.upperRomEnabled)
    writeValue(field.interruptRequest, gateArray.interruptRequest)
  }
}

GateArrayElement.define("colophon-gate-array")
