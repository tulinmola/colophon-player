import { Cpc, KEY_MATRIX } from "../emulator"
import { Element } from "./element"

const DEFAULT_MODEL = "cpc6128"

class CpcElement extends Element {
  #machine = null
  #pendingReleases = new Set()
  #presentCount = 0
  #pressedAt = new Map()

  get machine() {
    return this.#machine
  }

  async init() {
    // An element may not carry attributes until it is on the page: setting
    // this in the constructor breaks document.createElement.
    if (!this.hasAttribute("tabindex")) {
      this.tabIndex = 0
    }

    const { signal } = this

    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("keyup", this.onKeyUp.bind(this), { signal })
    this.addEventListener("blur", this.onBlur.bind(this), { signal })

    if (this.#machine) {
      this.#machine.start()
      return
    }

    const model = this.getAttribute("model") ?? DEFAULT_MODEL,
      snapshotUrl = this.getAttribute("snapshot")

    try {
      const machine = await Cpc.create(model, { signal, snapshotUrl })
      this.#fit(machine)
    } catch (error) {
      if (error.name != "AbortError") {
        throw error
      }
    }
  }

  dispose() {
    this.#machine?.stop()
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

  onPresent() {
    this.#presentCount++

    for (const key of this.#pendingReleases) {
      this.#pressedAt.delete(key)
      this.#machine.releaseKey(key)
    }
    this.#pendingReleases.clear()
  }

  #fit(machine) {
    const { signal } = this
    if (signal.aborted) {
      return
    }

    machine.addEventListener("frame", this.onPresent.bind(this), { signal })
    this.#machine = machine

    const ready = new Event("machine")
    this.dispatchEvent(ready)

    machine.start()
  }

  #forgetKeys() {
    this.#pendingReleases.clear()
    this.#pressedAt.clear()
    this.#machine?.releaseAllKeys()
  }

  // Keys reach the machine only while the machine itself holds focus: a
  // register being typed into is not the keyboard, and preventDefault here
  // would swallow the keystroke.
  //
  // Control is a key on this machine, and software reads it. Command is not.
  #matrixKey(event) {
    if (event.metaKey || event.target != this) {
      return null
    }

    return KEY_MATRIX[event.code]
  }
}

CpcElement.define("colophon-cpc")
