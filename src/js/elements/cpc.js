import { Cpc, JOYSTICK_MATRIX, KEY_MATRIX } from "../emulator"
import { Element } from "./element"
import { readGamepad } from "../input/gamepad"

const DEFAULT_MODEL = "cpc6128"

// Z, X and C are where Caprice32 (src/keyboard.cpp,
// https://github.com/ColinPitrat/caprice32) and CPCEC (cpcec-os.h,
// https://github.com/cpcitor/cpcec) put the buttons of a keyboard joystick.
const JOYSTICK_ON_CURSORS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyZ: "fire2",
  KeyX: "fire1",
  KeyC: "spare"
}

const DIRECTIONS = ["up", "down", "left", "right"]

const GAMEPAD_BUTTON = { fire2: 0, fire1: 1, spare: 2 }

// Asking throws where a permissions policy forbids gamepads.
function gamepadsAllowed() {
  try {
    navigator.getGamepads()
    return true
  } catch {
    return false
  }
}

class CpcElement extends Element {
  static observedAttributes = ["disc", "disc-b", "model", "roms", "snapshot", "symbols"]

  #heldByGamepads = JOYSTICK_MATRIX.map(() => new Set())
  #heldByKeyboard = new Set()
  #machine = null

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

    this.#releaseAllHeld()

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
    this.#releaseAllHeld()
  }

  onKeyDown(event) {
    const key = this.#matrixKey(event)
    if (key == null) {
      return
    }

    event.preventDefault()

    // The browser repeats a held key and so does the firmware.
    if (!event.repeat && this.#machine) {
      this.#heldByKeyboard.add(key)
      this.#machine.pressKey(key)
      this.#machine.changed()
    }
  }

  onKeyUp(event) {
    const key = this.#matrixKey(event)
    if (key == null) {
      return
    }

    event.preventDefault()

    if (this.#heldByKeyboard.delete(key)) {
      this.#machine.releaseKey(key)
      this.#machine.changed()
    }
  }

  onBlur() {
    if (this.#heldByKeyboard.size > 0) {
      this.#releaseHeld(this.#heldByKeyboard)
      this.#machine.changed()
    }
  }

  onAdvance() {
    const gamepads = navigator.getGamepads()

    for (let joystick = 0; joystick < JOYSTICK_MATRIX.length; joystick++) {
      const switches = JOYSTICK_MATRIX[joystick],
        pad = readGamepad(gamepads[joystick]),
        before = this.#heldByGamepads[joystick],
        held = new Set()

      if (pad) {
        for (const direction of DIRECTIONS) {
          if (pad[direction]) {
            held.add(switches[direction])
          }
        }

        for (const [name, button] of Object.entries(GAMEPAD_BUTTON)) {
          if (pad.buttons[button]) {
            held.add(switches[name])
          }
        }
      }

      for (const key of held) {
        if (!before.has(key)) {
          this.#machine.pressKey(key)
        }
      }

      for (const key of before) {
        if (!held.has(key)) {
          this.#machine.releaseKey(key)
        }
      }

      this.#heldByGamepads[joystick] = held
    }
  }

  #fit(machine) {
    const { signal } = this
    if (signal.aborted) {
      return
    }

    if (gamepadsAllowed()) {
      machine.addEventListener("machine:advance", this.onAdvance.bind(this), { signal })
    }
    this.#machine = machine

    const ready = new Event("machine:ready")
    this.dispatchEvent(ready)

    machine.start()
  }

  #releaseHeld(held) {
    for (const key of held) {
      this.#machine.releaseKey(key)
    }
    held.clear()
  }

  #releaseAllHeld() {
    this.#releaseHeld(this.#heldByKeyboard)

    for (const held of this.#heldByGamepads) {
      this.#releaseHeld(held)
    }
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

    if (this.getAttribute("joystick") == "cursors") {
      const name = JOYSTICK_ON_CURSORS[event.code]

      if (name) {
        return JOYSTICK_MATRIX[0][name]
      }
    }

    return KEY_MATRIX[event.code]
  }
}

CpcElement.define("colophon-cpc")
