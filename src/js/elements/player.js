import { MATRIX } from "../emulator/keys"
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

  :host(:focus) {
    outline: none;
  }

  :host(:focus-visible) {
    outline: 2px solid currentColor;
    outline-offset: 4px;
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
  #draw = null
  #machine = null
  #pendingReleases = new Set()
  #presentCount = 0
  #pressedAt = new Map()
  #teardown = null

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
    // An element may not carry attributes until it is on the page: setting
    // this in the constructor breaks document.createElement.
    if (!this.hasAttribute("tabindex")) {
      this.tabIndex = 0
    }

    this.#teardown = new AbortController()
    const { signal } = this.#teardown

    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("keyup", this.onKeyUp.bind(this), { signal })
    this.addEventListener("blur", this.onBlur.bind(this), { signal })

    if (!this.#machine) {
      try {
        await this.#build(signal)
      } catch (error) {
        if (error.name != "AbortError") {
          throw error
        }
        return
      }
    }

    if (!signal.aborted) {
      this.#clock.start()
    }
  }

  disconnectedCallback() {
    this.#teardown.abort()
    this.#teardown = null
    this.#clock?.stop()
    this.#forgetKeys()
  }

  onKeyDown(event) {
    const key = this.#matrixKey(event)
    if (key == null) {
      return
    }

    event.preventDefault()
    this.#pendingReleases.delete(key)

    // The browser repeats a held key and so does the firmware.
    if (!event.repeat) {
      this.#pressedAt.set(key, this.#presentCount)
      this.#machine?.pressKey(key)
    }
  }

  onKeyUp(event) {
    const key = this.#matrixKey(event)
    if (key == null) {
      return
    }

    event.preventDefault()

    // The firmware reads the matrix once a frame, so a key pressed and let go
    // between two reads was never pressed at all. Holding the others any
    // longer would carry a shift into the keystroke after them.
    if (this.#presentCount > this.#pressedAt.get(key)) {
      this.#pressedAt.delete(key)
      this.#machine?.releaseKey(key)
    } else {
      this.#pendingReleases.add(key)
    }
  }

  onBlur() {
    this.#forgetKeys()
  }

  // The clock has run at least one frame by the time it presents one.
  onPresent(machine) {
    this.#presentCount++
    this.#draw(machine)

    for (const key of this.#pendingReleases) {
      this.#pressedAt.delete(key)
      machine.releaseKey(key)
    }
    this.#pendingReleases.clear()
  }

  #forgetKeys() {
    this.#pendingReleases.clear()
    this.#pressedAt.clear()
    this.#machine?.releaseAllKeys()
  }

  // Control is a key on this machine, and software reads it. Command is not.
  #matrixKey(event) {
    return event.metaKey ? null : MATRIX[event.code]
  }

  // The machine is fitted last, so an abandoned build leaves nothing half
  // fitted behind it.
  async #build(signal) {
    const name = this.getAttribute("machine") ?? DEFAULT_MACHINE,
      machine = await createMachine(name, { signal })

    const snapshot = this.getAttribute("snapshot")
    if (snapshot) {
      const response = await fetch(snapshot, { signal }),
        buffer = await response.arrayBuffer(),
        bytes = new Uint8Array(buffer)

      if (!machine.loadSnapshot(bytes)) {
        throw new Error(`${snapshot} is not a snapshot this machine can read`)
      }
    }

    this.#draw = createScreen(this.#canvas)
    this.#clock = createClock(machine, this.onPresent.bind(this))
    this.#machine = machine
  }
}

customElements.define("colophon-player", Player)
