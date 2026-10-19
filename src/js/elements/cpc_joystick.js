import { CPC_JOYSTICK_MATRIX } from "../emulator"
import { MachineObserver } from "./machine_observer"
import { html } from "../lang"

const KEYS = CPC_JOYSTICK_MATRIX[0]

const CENTRED = { up: false, down: false, left: false, right: false },
  LET_GO = { ...CENTRED, fire1: false, fire2: false }

const DEAD_ZONE = 0.3

const SECTOR = Math.PI / 4,
  HALF_SECTOR_SINE = Math.sin(SECTOR / 2)

const MAIN_BUTTON = 0

function directionsAt(x, y, radius) {
  const distance = Math.hypot(x, y)

  if (distance < radius * DEAD_ZONE) {
    return CENTRED
  }

  const horizontal = x / distance,
    vertical = y / distance

  return {
    up: vertical < -HALF_SECTOR_SINE,
    down: vertical > HALF_SECTOR_SINE,
    left: horizontal < -HALF_SECTOR_SINE,
    right: horizontal > HALF_SECTOR_SINE
  }
}

class CpcJoystickElement extends MachineObserver {
  #held = new Set()
  #stick
  #stickPointer = null
  #switches

  // The variation selector keeps iOS from drawing the side arrows as emoji,
  // which take no colour: a held arrow would not turn dark on its disc.
  watch(machine) {
    this.innerHTML = html`
      <h2>Joystick 0</h2>
      <div class="pad">
        <div class="stick">
          <span data-switch="up">▲</span>
          <span data-switch="left">◀&#xFE0E;</span>
          <span data-switch="right">▶&#xFE0E;</span>
          <span data-switch="down">▼</span>
        </div>
        <span class="fire" data-switch="fire1">Fire 1</span>
        <span class="fire" data-switch="fire2">Fire 2</span>
      </div>
    `

    this.#stick = this.querySelector(".stick")
    this.#switches = this.querySelectorAll("[data-switch]")

    const { signal } = this
    this.addEventListener("pointerdown", this.onPointerDown.bind(this), { signal })
    this.addEventListener("pointermove", this.onPointerMove.bind(this), { signal })
    this.addEventListener("lostpointercapture", this.onLostPointerCapture.bind(this), { signal })
    this.addEventListener("contextmenu", event => event.preventDefault(), { signal })

    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  dispose() {
    this.#put(LET_GO)
    this.#stickPointer = null
    super.dispose()
  }

  onPointerDown(event) {
    if (event.button != MAIN_BUTTON) {
      return
    }

    const stick = event.target.closest(".stick"),
      fire = event.target.closest(".fire")

    if (stick && this.#stickPointer == null) {
      this.#stickPointer = event.pointerId
      stick.setPointerCapture(event.pointerId)
      this.#steer(event)
    } else if (fire) {
      fire.setPointerCapture(event.pointerId)
      this.#put({ [fire.dataset.switch]: true })
    }
  }

  onPointerMove(event) {
    if (event.pointerId == this.#stickPointer) {
      this.#steer(event)
    }
  }

  // A touch is captured wherever it lands, so capture is lost here too for
  // touches this element never took: a second thumb on the stick, one on the
  // heading.
  onLostPointerCapture(event) {
    if (event.pointerId == this.#stickPointer) {
      this.#stickPointer = null
      this.#put(CENTRED)
    } else if (event.target.matches(".fire")) {
      this.#put({ [event.target.dataset.switch]: false })
    }
  }

  #steer(event) {
    const { left, top, width } = this.#stick.getBoundingClientRect(),
      radius = width / 2,
      directions = directionsAt(event.clientX - left - radius, event.clientY - top - radius, radius)

    this.#put(directions)
  }

  #put(switches) {
    let changed = false

    for (const [name, held] of Object.entries(switches)) {
      if (held == this.#held.has(name)) {
        continue
      }

      if (held) {
        this.#held.add(name)
        this.machine.pressKey(KEYS[name])
      } else {
        this.#held.delete(name)
        this.machine.releaseKey(KEYS[name])
      }
      changed = true
    }

    if (changed) {
      this.machine.changed()
    }
  }

  #render(machine) {
    const keyboard = machine.keyboard

    for (const drawn of this.#switches) {
      const key = KEYS[drawn.dataset.switch],
        held = keyboard.pressed(key)

      drawn.classList.toggle("held", held)
    }
  }
}

CpcJoystickElement.define("colophon-cpc-joystick")
