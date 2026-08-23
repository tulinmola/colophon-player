import { Element } from "./element"
import { html } from "../lang"

const EDGE = 4

class OptionsElement extends Element {
  #button
  #form

  get form() {
    return this.#form
  }

  init() {
    const label = this.getAttribute("label"),
      written = Array.from(this.children)

    this.innerHTML = html`
      <button type="button" title="${label}"><span aria-hidden="true">⋮</span></button>
      <form popover></form>
    `

    const button = this.querySelector("button"),
      form = this.querySelector("form")

    form.append(...written)
    button.popoverTargetElement = form
    this.#button = button
    this.#form = form

    const { signal } = this
    form.addEventListener("beforetoggle", this.onBeforeToggle.bind(this), { signal })
    form.addEventListener("toggle", this.onToggle.bind(this), { signal })
    form.addEventListener("submit", this.onSubmit.bind(this), { signal })
  }

  onBeforeToggle(event) {
    if (event.newState == "open") {
      this.#openBelow()
    }
  }

  onToggle(event) {
    if (event.newState != "open") {
      return
    }

    const { below, above } = this.#room()

    if (this.#form.scrollHeight > below && above > below) {
      this.#openAbove()
    }
  }

  // A form whose only text field is this one submits on Enter, and submitting
  // navigates away from the page.
  onSubmit(event) {
    event.preventDefault()
  }

  #room() {
    const against = this.#button.getBoundingClientRect()

    return {
      against,
      below: window.innerHeight - against.bottom - EDGE * 2,
      above: against.top - EDGE * 2
    }
  }

  #openBelow() {
    const { against, below } = this.#room(),
      style = this.#form.style

    style.right = `${window.innerWidth - against.right}px`
    style.top = `${against.bottom + EDGE}px`
    style.bottom = "auto"
    style.maxHeight = `${below}px`
  }

  #openAbove() {
    const { against, above } = this.#room(),
      style = this.#form.style

    style.right = `${window.innerWidth - against.right}px`
    style.top = "auto"
    style.bottom = `${window.innerHeight - against.top + EDGE}px`
    style.maxHeight = `${above}px`
  }
}

OptionsElement.define("colophon-options")
