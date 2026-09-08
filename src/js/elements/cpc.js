import { CPC_JOYSTICK_MATRIX, CPC_KEY_MATRIX, Cpc } from "../emulator"
import { MachineElement } from "./machine_element"
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

class CpcElement extends MachineElement {
  static observedAttributes = ["disc", "disc-b", "model", "roms", "snapshot", "symbols", "tape"]

  #heldByGamepads = CPC_JOYSTICK_MATRIX.map(() => new Set())

  build({ signal }) {
    const model = this.getAttribute("model") ?? DEFAULT_MODEL,
      romsUrl = this.getAttribute("roms"),
      snapshotUrl = this.getAttribute("snapshot"),
      symbolsUrl = this.getAttribute("symbols"),
      discUrls = [this.getAttribute("disc"), this.getAttribute("disc-b")],
      tapeUrl = this.getAttribute("tape"),
      options = { signal, romsUrl, snapshotUrl, symbolsUrl, discUrls, tapeUrl }

    return Cpc.create(model, options)
  }

  // Control is a key on this machine, and software reads it.
  keysFor(event) {
    if (this.getAttribute("joystick") == "cursors") {
      const name = JOYSTICK_ON_CURSORS[event.code]

      if (name) {
        return [CPC_JOYSTICK_MATRIX[0][name]]
      }
    }

    return CPC_KEY_MATRIX[event.code]
  }

  onAdvance() {
    const gamepads = navigator.getGamepads()

    for (let joystick = 0; joystick < CPC_JOYSTICK_MATRIX.length; joystick++) {
      const switches = CPC_JOYSTICK_MATRIX[joystick],
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
          this.machine.pressKey(key)
        }
      }

      for (const key of before) {
        if (!held.has(key)) {
          this.machine.releaseKey(key)
        }
      }

      this.#heldByGamepads[joystick] = held
    }
  }

  watch(machine) {
    if (gamepadsAllowed()) {
      machine.addEventListener("machine:advance", this.onAdvance.bind(this), {
        signal: this.signal
      })
    }
  }

  // A gamepad has no focus to lose, so its switches are let go when the
  // machine goes and never on a blur.
  releaseAll() {
    super.releaseAll()

    for (const held of this.#heldByGamepads) {
      for (const key of held) {
        this.machine.releaseKey(key)
      }
      held.clear()
    }
  }
}

CpcElement.define("colophon-cpc")
