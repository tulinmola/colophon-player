import { Breakpoints } from "./breakpoints"
import { Keyboard } from "./keyboard"
import { SymbolTable } from "../symbols"
import { Tape } from "./tape"
import { Z80 } from "./z80"
import { readColours } from "./colours"

// A tab hidden for an hour owes an hour of emulation. The machine loses the
// time instead, as one switched off would.
const MAXIMUM_DEBT_MILLISECONDS = 80

const TRAP_KINDS = { 1: "execute", 2: "read", 4: "write", 8: "break" }

const GRAINS = { instruction: 0, scanline: 1, row: 2, frame: 3 }

// What the host offers whatever machine it is holding: the record it keeps,
// the marks it stops on, the processor and the matrix every board has. A
// machine class adds its own board to this and nothing else.
export class Machine extends EventTarget {
  #advance
  #breakInstructions = false
  #breakpoints
  #cssColours
  #debt = 0
  #framebuffer
  #greys
  #keyboard
  #last = 0
  #module
  #palette
  #pendingReleases = new Set()
  #presentCount = 0
  #pressedAt = new Map()
  #ram
  #request = null
  #tape
  #writes
  #z80

  // How many of the machine's milliseconds are run for each of the reader's.
  speed = 1

  symbols = new SymbolTable()

  trap = null

  // The module's memory never grows (player.c holds all of it in fixed
  // storage), so the views taken here stay valid for the machine's life.
  constructor(module, { ramSize, framebufferSize, colourCodes }) {
    super()

    const z80Pointer = module._player_z80(),
      keyboardPointer = module._player_keyboard(),
      framebufferPointer = module._player_framebuffer(),
      ramPointer = module._player_ram(),
      tapePointer = module._player_tape(),
      writesStart = module._player_writes() >> 2,
      { palette, greys, cssColours } = readColours(code => module._player_rgb(code), colourCodes),
      capture = () => module._player_capture()

    this.#advance = this.onAnimationFrame.bind(this)
    this.#module = module
    this.#breakpoints = new Breakpoints(module)
    this.#palette = palette
    this.#greys = greys
    this.#cssColours = cssColours
    this.#z80 = new Z80(module, z80Pointer, capture)
    this.#keyboard = new Keyboard(module, keyboardPointer, capture)
    this.#tape = tapePointer == 0 ? null : new Tape(module, tapePointer, capture)
    this.#framebuffer = module.HEAPU8.subarray(
      framebufferPointer,
      framebufferPointer + framebufferSize
    )
    this.#ram = module.HEAPU8.subarray(ramPointer, ramPointer + ramSize)
    this.#writes = module.HEAPU32.subarray(writesStart, writesStart + ramSize)
  }

  get module() {
    return this.#module
  }

  get z80() {
    return this.#z80
  }

  get keyboard() {
    return this.#keyboard
  }

  get breakpoints() {
    return this.#breakpoints
  }

  // Null on a board with no deck to put a tape in.
  get tape() {
    return this.#tape
  }

  get palette() {
    return this.#palette
  }

  get greys() {
    return this.#greys
  }

  get cssColours() {
    return this.#cssColours
  }

  get framebuffer() {
    return this.#framebuffer
  }

  get ram() {
    return this.#ram
  }

  get writes() {
    return this.#writes
  }

  get breakInstructions() {
    return this.#breakInstructions
  }

  set breakInstructions(honoured) {
    this.#breakInstructions = honoured
    this.#module._player_set_break_instructions(honoured)
  }

  get running() {
    return this.#request != null
  }

  get frame() {
    return this.#module._player_frame()
  }

  get ticks() {
    return this.#module._player_ticks()
  }

  get historyFrom() {
    return this.#module._player_history_from()
  }

  get historyUntil() {
    return this.#module._player_history_until()
  }

  start() {
    if (this.running) {
      return
    }

    this.#last = performance.now()
    this.#debt = 0
    this.trap = null
    this.#request = requestAnimationFrame(this.#advance)

    const started = new Event("machine:start")
    this.dispatchEvent(started)
  }

  stop() {
    if (!this.running) {
      return
    }

    cancelAnimationFrame(this.#request)
    this.#request = null
    this.#module._player_finish_instruction()

    const stopped = new Event("machine:stop")
    this.dispatchEvent(stopped)
    this.present()
  }

  step() {
    this.#stepTo("instruction")
  }

  stepScanline() {
    this.#stepTo("scanline")
  }

  stepRow() {
    this.#stepTo("row")
  }

  stepFrame() {
    this.#stepTo("frame")
  }

  stepBack() {
    this.#stepBackTo("instruction")
  }

  stepBackScanline() {
    this.#stepBackTo("scanline")
  }

  stepBackRow() {
    this.#stepBackTo("row")
  }

  stepBackFrame() {
    this.#stepBackTo("frame")
  }

  rewind(tick) {
    this.stop()
    this.#module._player_seek(tick)
    this.trap = null
    this.present()
  }

  returnToNow() {
    this.rewind(this.historyUntil)
  }

  rewindToWriter(address) {
    const stored = this.findWrite(address, this.ticks)

    if (stored) {
      this.rewind(stored.tick)
    }
  }

  findWrite(address, before) {
    const module = this.#module

    if (!module._player_trace_find(address, before)) {
      return null
    }

    return {
      tick: module._player_trace_tick(),
      pc: module._player_trace_pc(),
      value: module._player_trace_value()
    }
  }

  capture() {
    this.#module._player_capture()
  }

  runFrames(frames) {
    this.#module._player_run_frames(frames)
  }

  peek(address) {
    return this.#module._player_peek(address)
  }

  poke(address, value) {
    this.#module._player_poke(address, value)
  }

  writeRam(physical, value) {
    this.#ram[physical] = value
    this.#module._player_capture()
  }

  // Refused rather than written where there is no room, as a disc is: the
  // buffer is fixed and what follows it is the record.
  loadSnapshot(bytes) {
    const module = this.#module

    if (bytes.length > module._player_snapshot_capacity()) {
      return false
    }

    module.HEAPU8.set(bytes, module._player_snapshot())
    return module._player_load_snapshot(bytes.length)
  }

  pressKey(key) {
    this.#pendingReleases.delete(key)
    this.#pressedAt.set(key, this.#presentCount)
    this.#module._player_press(key)
  }

  // The firmware reads the matrix once a frame, so a key pressed and let go
  // between two reads was never pressed at all.
  releaseKey(key) {
    if (this.#presentCount > this.#pressedAt.get(key)) {
      this.#pressedAt.delete(key)
      this.#module._player_release(key)
    } else {
      this.#pendingReleases.add(key)
    }
  }

  present() {
    this.#presentCount++

    for (const key of this.#pendingReleases) {
      this.#pressedAt.delete(key)
      this.#module._player_release(key)
    }
    this.#pendingReleases.clear()

    const frame = new Event("machine:frame")
    this.dispatchEvent(frame)
    this.changed()
  }

  showMemory(at, space = "cpu") {
    const centre = new CustomEvent("memory:center", { detail: { at, space } })

    this.dispatchEvent(centre)
  }

  changed() {
    const change = new Event("machine:changed")
    this.dispatchEvent(change)
  }

  readTrap() {
    const kind = this.#module._player_trap_kind()

    if (kind == 0) {
      return null
    }

    return { kind: TRAP_KINDS[kind], address: this.#module._player_trap_address() }
  }

  onAnimationFrame(now) {
    this.#request = requestAnimationFrame(this.#advance)

    const advancing = new Event("machine:advance")
    this.dispatchEvent(advancing)

    const owed = (now - this.#last) * this.ticksPerMillisecond * this.speed,
      maximum = MAXIMUM_DEBT_MILLISECONDS * this.ticksPerMillisecond * this.speed

    this.#debt = Math.min(this.#debt + owed, maximum)
    this.#last = now

    let ran = false
    while (this.#debt > 0) {
      // Running past the time owed by a frame's length lets one finish, so
      // the picture is presented whole.
      const limit = Math.ceil(this.#debt) + this.ticksPerFrame
      this.#debt -= this.#module._player_run_until_retrace(limit)
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

  #stepTo(grain) {
    this.stop()
    this.#module._player_step_to(GRAINS[grain])
    this.trap = this.readTrap()
    this.present()
    this.#announceTrap()
  }

  #stepBackTo(grain) {
    this.stop()
    this.#module._player_step_back_to(GRAINS[grain])
    this.trap = null
    this.present()
  }

  #announceTrap() {
    if (this.trap) {
      const trapped = new Event("machine:break")
      this.dispatchEvent(trapped)
    }
  }
}
