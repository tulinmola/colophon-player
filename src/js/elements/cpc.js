import { Cpc, KEY_MATRIX } from "../emulator"
import { Element } from "./element"

const DEFAULT_MODEL = "cpc6128"

class CpcElement extends Element {
  static observedAttributes = ["disc", "disc-b", "model", "roms", "snapshot", "symbols"]

  #machine = null
  #pendingReleases = new Set()
  #presentCount = 0
  #pressedAt = new Map()

  get machine() {
    return this.#machine
  }

  // Reconnection resumes a machine across a move; these attributes name the
  // machine itself, so a change discards it and boots the successor. The
  // announcement lets every observer rebuild around whatever now stands.
  attributeChangedCallback(name) {
    if (!this.standing) {
      return
    }

    const machine = this.#machine
    this.#machine = null
    machine?.stop()

    super.attributeChangedCallback(name)

    const rebooted = new Event("machine:reboot")
    this.dispatchEvent(rebooted)
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
      romsUrl = this.getAttribute("roms"),
      snapshotUrl = this.getAttribute("snapshot"),
      symbolsUrl = this.getAttribute("symbols"),
      discUrls = [this.getAttribute("disc"), this.getAttribute("disc-b")]

    try {
      const options = { signal, romsUrl, snapshotUrl, symbolsUrl, discUrls },
        machine = await Cpc.create(model, options)
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

    machine.addEventListener("machine:frame", this.onPresent.bind(this), { signal })
    this.#machine = machine

    const ready = new Event("machine:ready")
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
