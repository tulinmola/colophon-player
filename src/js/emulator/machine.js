import { SymbolTable } from "../symbols"

// A tab hidden for an hour owes an hour of emulation. The machine loses the
// time instead, as one switched off would.
const MAXIMUM_DEBT_MILLISECONDS = 80

export class Machine extends EventTarget {
  #advance
  #debt = 0
  #last = 0
  #request = null

  symbols = new SymbolTable()

  trap = null

  constructor() {
    super()
    this.#advance = this.onAnimationFrame.bind(this)
  }

  get running() {
    return this.#request != null
  }

  start() {
    if (this.running) {
      return
    }

    this.#last = performance.now()
    this.#debt = 0
    this.trap = null
    this.#request = requestAnimationFrame(this.#advance)

    const started = new Event("start")
    this.dispatchEvent(started)
  }

  stop() {
    if (!this.running) {
      return
    }

    cancelAnimationFrame(this.#request)
    this.#request = null
    this.finishInstruction()

    const stopped = new Event("stop")
    this.dispatchEvent(stopped)
    this.present()
  }

  step() {
    this.stop()
    this.stepInstruction()
    this.trap = this.readTrap()
    this.present()
    this.#announceTrap()
  }

  // Twice a frame's length, so a program that has made this one longer than
  // the standard still reaches the end of it.
  stepFrame() {
    this.stop()
    this.runUntilRetrace(this.ticksPerFrame * 2)
    this.finishInstruction()
    this.trap = this.readTrap()
    this.present()
    this.#announceTrap()
  }

  present() {
    const frame = new Event("frame")
    this.dispatchEvent(frame)
    this.changed()
  }

  changed() {
    const change = new Event("changed")
    this.dispatchEvent(change)
  }

  onAnimationFrame(now) {
    this.#request = requestAnimationFrame(this.#advance)

    const owed = (now - this.#last) * this.ticksPerMillisecond,
      maximum = MAXIMUM_DEBT_MILLISECONDS * this.ticksPerMillisecond

    this.#debt = Math.min(this.#debt + owed, maximum)
    this.#last = now

    let ran = false
    while (this.#debt > 0) {
      // Running past the time owed by a frame's length lets one finish, so
      // the picture is presented whole.
      const limit = Math.ceil(this.#debt) + this.ticksPerFrame
      this.#debt -= this.runUntilRetrace(limit)
      ran = true

      const trap = this.readTrap()
      if (trap) {
        this.trap = trap
        this.stop()
        this.#announceTrap()
        return
      }
    }

    if (ran) {
      this.present()
    }
  }

  #announceTrap() {
    if (this.trap) {
      const trapped = new Event("break")
      this.dispatchEvent(trapped)
    }
  }
}
