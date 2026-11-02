import { Amplifier } from "../sound"
import { Element } from "./element"
import { SoundNotice } from "./sound_notice"

function volumeOf(element) {
  return Number(element.getAttribute("volume") ?? 0)
}

// The element that builds a machine and holds it for every panel placed
// inside. A machine of its own says which attributes name it, how to build
// one, and where a browser's keys sit on its matrix; everything else — the
// focus, the reboot, the keys held and let go — is the same whatever board
// is standing.
export class MachineElement extends Element {
  static observedAttributes = ["muted", "volume"]

  #amplifier = null
  #heldByKeyboard = new Map()
  #machine = null
  #notice = null

  // Null while no machine stands, and wherever the page cannot play sound.
  get amplifier() {
    return this.#amplifier
  }

  get machine() {
    return this.#machine
  }

  // There is no amplifier while the machine is being built, which reads the
  // sound's attributes as it makes one, nor on a page that cannot play sound.
  attributeChangedCallback(name) {
    if (!this.standing) {
      return
    }

    switch (name) {
      case "muted":
        if (this.#amplifier) {
          this.#amplifier.muted = this.hasAttribute("muted")
        }
        break

      case "volume":
        if (this.#amplifier) {
          this.#amplifier.volume = volumeOf(this)
        }
        break

      default:
        this.#reboot(name)
        break
    }
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
      this.#makeAmplifier(this.#machine)
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
    this.#amplifier?.close()
    this.#amplifier = null
    this.#notice?.remove()
    this.#notice = null
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
    this.#makeAmplifier(machine)
    this.watch(machine)

    const ready = new Event("machine:ready")
    this.dispatchEvent(ready)

    machine.start()
  }

  // Listeners a machine of its own wants on the element's current signal.
  // Reconnection gives the element a new one, so this runs again then.
  watch() {}

  // Before the observers are told of the machine, so that they find it.
  #makeAmplifier(machine) {
    if (!Amplifier.supported) {
      return
    }

    const { signal } = this,
      muted = this.hasAttribute("muted"),
      volume = volumeOf(this),
      amplifier = new Amplifier(machine, { signal, muted, volume }),
      notice = SoundNotice.create(),
      onChanged = () => notice.togglePopover(amplifier.waitingForPress)

    amplifier.addEventListener("amplifier:changed", onChanged, { signal })
    onChanged()
    this.#amplifier = amplifier
    this.#notice = notice
  }

  // Reconnection resumes a machine across a move; every other observed
  // attribute names the machine itself, so a change discards it and boots the
  // successor. The announcement lets every observer rebuild around whatever
  // now stands.
  #reboot(name) {
    this.releaseAll()

    const machine = this.#machine
    this.#machine = null
    machine?.stop()

    super.attributeChangedCallback(name)

    const rebooted = new Event("machine:reboot")
    this.dispatchEvent(rebooted)
  }
}
