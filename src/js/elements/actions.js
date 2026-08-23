import { Element } from "./element"
import { html } from "../lang"

const EDGE = 4

function renderItem(item, index) {
  return html`<li><button type="button" data-index="${index}">${item.label}</button></li>`
}

class ActionsElement extends Element {
  items = []
  x = 0
  y = 0

  #menu

  static create(event, items) {
    const actions = document.createElement("colophon-actions")

    actions.items = items
    actions.x = event.clientX
    actions.y = event.clientY
    document.body.append(actions)
  }

  init() {
    this.innerHTML = html` <menu popover="auto">${this.items.map(renderItem).join("")}</menu>`
    this.#menu = this.querySelector("menu")

    const { signal } = this
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.#menu.addEventListener("toggle", this.onToggle.bind(this), { signal })

    this.#menu.style.left = `${this.x}px`
    this.#menu.style.top = `${this.y}px`
    this.#menu.showPopover()
    this.#keepInView()
  }

  onClick(event) {
    const { index } = event.target.dataset

    if (index != null) {
      this.#menu.hidePopover()
      this.items[index].execute()
    }
  }

  onToggle(event) {
    if (event.newState == "closed") {
      this.remove()
    }
  }

  #keepInView() {
    const box = this.#menu.getBoundingClientRect()

    if (box.right > window.innerWidth) {
      this.#menu.style.left = `${window.innerWidth - box.width - EDGE}px`
    }

    if (box.bottom > window.innerHeight) {
      this.#menu.style.top = `${window.innerHeight - box.height - EDGE}px`
    }
  }
}

ActionsElement.define("colophon-actions")

export { ActionsElement as Actions }
