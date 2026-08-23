import { hex, html, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

function renderAbbreviation(label, meaning) {
  return meaning ? html`<abbr title="${meaning}">${label}</abbr>` : label
}

// aria-label is what keeps the sigil from being read out as part of the name.
function renderByte(label, meaning, name) {
  return html`<label>
    <abbr title="${meaning}">${label}</abbr>
    <span class="input-group">
      <input name="${name}" aria-label="${label}" maxlength="2" pattern="[0-9A-Fa-f]{1,2}" />
    </span>
  </label>`
}

function renderCounter(number, meaning) {
  return renderByte(`C${number}`, meaning, `c${number}`)
}

function renderRegister(number, meaning) {
  return renderByte(`R${number}`, meaning, `r${number}`)
}

function renderLightPen(number, meaning) {
  const label = `R${number}`

  return html`<label>
    ${renderAbbreviation(label, meaning)}
    <output name="r${number}" aria-label="${label}" aria-live="off"> </output>
  </label>`
}

class CrtcElement extends MachineObserver {
  #form

  watch(machine) {
    this.innerHTML = html`
      <h2>CRTC 6845</h2>
      <form>
        <div class="fields counters">
          ${[
            renderCounter(0, "Horizontal character counter"),
            renderCounter(9, "Scanline within the character row, driving RA"),
            renderCounter(4, "Character row counter")
          ].join("")}
        </div>
        <div class="fields registers">
          ${[
            renderRegister(0, "Horizontal total"),
            renderRegister(1, "Horizontal displayed"),
            renderRegister(2, "Horizontal sync position"),
            renderRegister(3, "Sync widths: HSYNC in the low nibble, VSYNC in the high"),
            renderRegister(4, "Vertical total"),
            renderRegister(5, "Vertical total adjust"),
            renderRegister(6, "Vertical displayed"),
            renderRegister(7, "Vertical sync position"),
            renderRegister(8, "Interlace and skew"),
            renderRegister(9, "Maximum raster address"),
            renderRegister(10, "Cursor start raster"),
            renderRegister(11, "Cursor end raster"),
            renderRegister(12, "Display start address, high"),
            renderRegister(13, "Display start address, low"),
            renderRegister(14, "Cursor address, high"),
            renderRegister(15, "Cursor address, low"),
            renderLightPen(16, "Light pen address, high"),
            renderLightPen(17, "Light pen address, low")
          ].join("")}
        </div>
      </form>
    `

    this.#form = this.querySelector("form")

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
      crtc = this.machine.crtc

    if (input.checkValidity()) {
      const value = parseInt(input.value, 16)

      if (input.name.startsWith("r")) {
        const index = Number(input.name.slice(1))
        crtc.putRegister(index, value)
      } else {
        crtc[input.name] = value
      }
    }

    input.blur()
    this.machine.changed()
  }

  #render(machine) {
    const crtc = machine.crtc,
      field = this.#form.elements,
      registers = crtc.registers

    writeValue(field.c0, hex(crtc.c0))
    writeValue(field.c9, hex(crtc.c9))
    writeValue(field.c4, hex(crtc.c4))

    for (let number = 0; number < registers.length; number++) {
      writeValue(field[`r${number}`], hex(registers[number]))
    }
  }
}

CrtcElement.define("colophon-crtc")
