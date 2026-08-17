import { Element } from "./element"

// A custom element carries none of its properties until it is upgraded, and
// the one holding the machine may be defined after this one.
async function closestWith(element, property) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.localName.includes("-")) {
      await customElements.whenDefined(node.localName)
    }

    if (property in node) {
      return node
    }
  }

  return null
}

export class MachineObserver extends Element {
  #machine = null

  get machine() {
    return this.#machine
  }

  async init() {
    const host = await closestWith(this, "machine")

    if (host.machine) {
      this.#watch(host.machine)
    } else {
      host.addEventListener("machine", () => this.#watch(host.machine), {
        once: true,
        signal: this.signal
      })
    }
  }

  watch() {}

  #watch(machine) {
    this.#machine = machine
    this.watch(machine)
  }
}
