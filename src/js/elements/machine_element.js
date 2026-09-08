import { Element } from "./element"

// The element that builds a machine and holds it for every panel placed
// inside. A machine of its own says which attributes name it, how to build
// one, and where a browser's keys sit on its matrix; everything else — the
// focus, the reboot, the keys held and let go — is the same whatever board
// is standing.
export class MachineElement extends Element {
  #heldByKeyboard = new Map()
  #machine = null

  get machine() {
    return this.#machine
  }

  // Reconnection resumes a machine across a move; the observed attributes
  // name the machine itself, so a change discards it and boots the successor.
  // The announcement lets every observer rebuild around whatever now stands.
  attributeChangedCallback(name) {
    if (!this.standing) {
      return
    }

    this.releaseAll()

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
      this.watch(this.#machine)
      this.#machine.start()
      return
    }

    try {
      const machine = await this.build({ signal })

      if (!signal.aborted) {
        this.fit(machine)
      }
    } catch (error) {
      if (error.name != "AbortError") {
        throw error
      }
    }
  }

  dispose() {
    this.#machine?.stop()
    this.releaseAll()
  }

  onKeyDown(event) {
    const keys = this.matrixKeys(event)
    if (keys == null) {
      return
    }

    event.preventDefault()

    // The browser repeats a held key and so does the firmware.
    if (!event.repeat && this.#machine) {
      this.#heldByKeyboard.set(event.code, keys)

      for (const key of keys) {
        this.#machine.pressKey(key)
      }
      this.#machine.changed()
    }
  }

  onKeyUp(event) {
    const keys = this.matrixKeys(event)
    if (keys == null) {
      return
    }

    event.preventDefault()

    if (this.#heldByKeyboard.delete(event.code)) {
      this.#letGo(keys)
      this.#machine.changed()
    }
  }

  onBlur() {
    if (this.#heldByKeyboard.size > 0) {
      this.releaseKeyboard()
      this.#machine.changed()
    }
  }

  // A switch two browser keys close is still closed while either is down:
  // CAPS SHIFT is its own key and half of what Backspace and the arrows are.
  #letGo(keys) {
    const stillHeld = new Set()

    for (const held of this.#heldByKeyboard.values()) {
      for (const key of held) {
        stillHeld.add(key)
      }
    }

    for (const key of keys) {
      if (!stillHeld.has(key)) {
        this.#machine.releaseKey(key)
      }
    }
  }

  // Keys reach the machine only while the machine itself holds focus: a
  // register being typed into is not the keyboard, and preventDefault here
  // would swallow the keystroke. Command is a key on no machine here, so
  // anything held with it is left to the browser.
  matrixKeys(event) {
    if (event.metaKey || event.target != this) {
      return null
    }

    return this.keysFor(event)
  }

  releaseKeyboard() {
    for (const keys of this.#heldByKeyboard.values()) {
      for (const key of keys) {
        this.#machine.releaseKey(key)
      }
    }
    this.#heldByKeyboard.clear()
  }

  // Everything the element is holding, for a machine that is going.
  releaseAll() {
    this.releaseKeyboard()
  }

  fit(machine) {
    this.#machine = machine
    this.watch(machine)

    const ready = new Event("machine:ready")
    this.dispatchEvent(ready)

    machine.start()
  }

  // Listeners a machine of its own wants on the element's current signal.
  // Reconnection gives the element a new one, so this runs again then.
  watch() {}
}
