import { hex, html, write } from "../lang"
import { Element } from "./element"

const COLOUR_CODES = 32,
  BORDER_PEN = 16

function renderColour(_colour, code) {
  const value = hex(code)

  return html`<button type="submit" class="colour" value="${value}" aria-label="Code ${value}">
    <span class="swatch"></span><span class="code">${value}</span>
  </button>`
}

class InkFormElement extends Element {
  machine = null
  pen = 0

  #dialog

  static create(machine, pen) {
    const form = document.createElement("colophon-ink-form")

    form.machine = machine
    form.pen = pen
    document.body.append(form)
  }

  init() {
    this.innerHTML = html`
      <dialog aria-label="Ink">
        <form method="dialog">
          <h2></h2>
          <div class="palette">${Array.from({ length: COLOUR_CODES }, renderColour).join("")}</div>
          <div class="actions">
            <button type="button" data-action="cancel">Cancel</button>
          </div>
        </form>
      </dialog>
    `

    this.#dialog = this.querySelector("dialog")

    const { signal } = this
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.#dialog.addEventListener("close", this.onClose.bind(this), { signal })

    this.#fill()
    this.#dialog.showModal()
  }

  onClick(event) {
    if (event.target.dataset.action == "cancel") {
      this.#dialog.close()
    }
  }

  onClose() {
    const chosen = this.#dialog.returnValue

    if (chosen) {
      this.machine.gateArray.putInk(this.pen, parseInt(chosen, 16))
      this.machine.changed()
    }

    this.remove()
  }

  #fill() {
    const pen = this.pen,
      cssColours = this.machine.cssColours,
      standing = this.machine.gateArray.inks[pen],
      buttons = this.querySelectorAll(".colour"),
      swatches = this.querySelectorAll(".colour .swatch")

    for (let code = 0; code < swatches.length; code++) {
      swatches[code].style.background = cssColours[code]
    }

    buttons[standing].classList.add("current")

    const naming = pen == BORDER_PEN ? "the border" : `pen ${pen}`
    write(this.querySelector("h2"), `Ink for ${naming}`)
  }
}

InkFormElement.define("colophon-ink-form")

export { InkFormElement as InkForm }
