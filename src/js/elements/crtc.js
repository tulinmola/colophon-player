import { hex, html, write, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

// aria-label is what keeps the sigil from being read out as part of the name.
function renderByte(label, meaning, name) {
  return html`<label>
    <abbr title="${meaning}">${label}</abbr>
    <span class="input-group">
      <input name="${name}" aria-label="${label}" maxlength="2" pattern="[0-9A-Fa-f]{1,2}" />
    </span>
  </label>`
}

function renderRegister(number, meaning) {
  return renderByte(`R${number}`, meaning, `r${number}`)
}

function renderLightPen(number, meaning) {
  const label = `R${number}`

  return html`<label>
    <abbr title="${meaning}">${label}</abbr>
    <output name="r${number}" aria-label="${label}" aria-live="off"> </output>
  </label>`
}

class CrtcElement extends MachineObserver {
  #counterNames
  #form

  watch(machine) {
    this.innerHTML = html`
      <h2><abbr title="Cathode Ray Tube Controller">CRTC</abbr> <span></span></h2>
      <form>
        <div class="fields counters">
          ${[
            renderByte("C0", "Horizontal character counter", "c0"),
            renderByte("C9", "Vertical line counter", "c9"),
            renderByte("C4", "Vertical character counter", "c4"),
            renderByte("C3l", "Horizontal sync counter", "c3l"),
            renderByte("C3h", "Vertical sync counter", "c3h"),
            renderByte("C5", "Vertical total adjust counter", "c5"),
            renderByte(
              "C9.IVM",
              "Scanline counter for the display in Interlace Video Mode",
              "c9Ivm"
            )
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

    const crtc = machine.crtc,
      chipName = this.querySelector("h2 span")

    write(chipName, `${crtc.type} ${crtc.part}`)

    this.#counterNames = crtc.counterNames
    this.#form = this.querySelector("form")

    for (const input of this.#form.querySelectorAll(".counters input")) {
      input.closest("label").hidden = !this.#counterNames.includes(input.name)
    }

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

    for (const name of this.#counterNames) {
      writeValue(field[name], hex(crtc[name]))
    }

    for (let number = 0; number < registers.length; number++) {
      writeValue(field[`r${number}`], hex(registers[number]))
    }
  }
}

CrtcElement.define("colophon-crtc")
