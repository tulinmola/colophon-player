export class Element extends HTMLElement {
  #teardown = null

  static define(name) {
    customElements.define(name, this)
  }

  get signal() {
    return this.#teardown.signal
  }

  connectedCallback() {
    this.#teardown = new AbortController()
    this.init()
  }

  // The controller is kept once aborted, so work still in flight can ask
  // whether the element is still on the page.
  disconnectedCallback() {
    this.#teardown.abort()
    this.dispose()
  }

  init() {}

  dispose() {}
}
