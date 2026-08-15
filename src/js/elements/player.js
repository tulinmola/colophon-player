import { createClock } from "../emulator/clock"
import { createMachine } from "../emulator"
import { createScreen } from "../screen"

const DEFAULT_MACHINE = "cpc464"

// A raster line is not square: the height is doubled, as the emulator
// doubles lines when it writes a screenshot.
const STYLE = `
  :host {
    display: inline-block;
  }

  canvas {
    display: block;
    width: 768px;
    height: 544px;
    image-rendering: pixelated;
  }
`

class Player extends HTMLElement {
  #canvas
  #clock = null
  #machine = null

  constructor() {
    super()

    const root = this.attachShadow({ mode: "open" }),
      style = document.createElement("style")

    style.textContent = STYLE
    this.#canvas = document.createElement("canvas")
    root.append(style, this.#canvas)
  }

  get machine() {
    return this.#machine
  }

  async connectedCallback() {
    if (!this.#machine) {
      await this.#build()
    }

    // Building waits on the module, the firmware and perhaps a snapshot, and
    // the element can be taken off the page while it does.
    if (this.isConnected) {
      this.#clock.start()
    }
  }

  disconnectedCallback() {
    this.#clock?.stop()
  }

  async #build() {
    const name = this.getAttribute("machine") ?? DEFAULT_MACHINE
    this.#machine = await createMachine(name)

    const snapshot = this.getAttribute("snapshot")
    if (snapshot) {
      const response = await fetch(snapshot),
        buffer = await response.arrayBuffer(),
        bytes = new Uint8Array(buffer)

      if (!this.#machine.loadSnapshot(bytes)) {
        throw new Error(`${snapshot} is not a snapshot this machine can read`)
      }
    }

    const screen = createScreen(this.#canvas)
    this.#clock = createClock(this.#machine, screen)
  }
}

customElements.define("colophon-player", Player)
