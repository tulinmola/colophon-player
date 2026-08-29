import { Breakpoints } from "./breakpoints"
import { Crtc } from "./crtc"
import { GateArray } from "./gate_array"
import { Machine } from "./machine"
import { Z80 } from "./z80"
import { createModule } from "./module"
import { readSymbols } from "../symbols"

const MODELS = {
  cpc464: { romFile: "cpc464.rom", ramSize: 0x10000 },
  cpc664: { romFile: "cpc664.rom", ramSize: 0x10000 },
  cpc6128: { romFile: "cpc6128.rom", ramSize: 0x20000 }
}

const DEFAULT_ROMS_URL = "/roms"

const TRAP_KINDS = { 1: "execute", 2: "read", 4: "write" }

const FRAMEBUFFER_WIDTH = 1024,
  FRAMEBUFFER_HEIGHT = 312,
  COLOUR_CODES = 32

// A frame is 312 lines of 64µs, and four T-states fill a microsecond of a
// 4MHz clock.
const TICKS_PER_MILLISECOND = 4000,
  TICKS_PER_FRAME = FRAMEBUFFER_HEIGHT * 64 * 4

// A canvas holds its pixels as bytes in red, green, blue, alpha order, so a
// word written into one lands blue end first on a little-endian machine.
function readPalette(module) {
  const palette = new Uint32Array(COLOUR_CODES)

  for (let code = 0; code < COLOUR_CODES; code++) {
    const rgb = module._player_rgb(code)
    palette[code] = 0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)
  }

  return palette
}

// Rec. 601 luma, so a colour keeps its brightness when it loses its hue.
function readGreys(module) {
  const greys = new Uint32Array(COLOUR_CODES)

  for (let code = 0; code < COLOUR_CODES; code++) {
    const rgb = module._player_rgb(code),
      red = (rgb >> 16) & 0xff,
      green = (rgb >> 8) & 0xff,
      blue = rgb & 0xff,
      luma = Math.round(0.299 * red + 0.587 * green + 0.114 * blue)

    greys[code] = 0xff000000 | (luma << 16) | (luma << 8) | luma
  }

  return greys
}

// The same codes as CSS, for a page that shows an ink rather than draws it.
function readColours(module) {
  const colours = []

  for (let code = 0; code < COLOUR_CODES; code++) {
    const rgb = module._player_rgb(code)
    colours.push(`#${rgb.toString(16).padStart(6, "0")}`)
  }

  return colours
}

export class Cpc extends Machine {
  #breakpoints
  #colours
  #crtc
  #framebuffer
  #gateArray
  #greys
  #module
  #palette
  #ram
  #writes
  #z80

  static async create(model, { romsUrl, snapshotUrl, symbolsUrl, signal } = {}) {
    const machine = MODELS[model],
      roms = romsUrl ?? DEFAULT_ROMS_URL,
      module = await createModule(),
      response = await fetch(`${roms}/${machine.romFile}`, { signal }),
      rom = new Uint8Array(await response.arrayBuffer())

    module.HEAPU8.set(rom, module._player_rom())
    module._player_boot(machine.ramSize)

    const cpc = new Cpc(module, machine.ramSize)
    if (snapshotUrl) {
      const saved = await fetch(snapshotUrl, { signal }),
        bytes = new Uint8Array(await saved.arrayBuffer())

      if (!cpc.loadSnapshot(bytes)) {
        throw new Error(`${snapshotUrl} is not a snapshot this machine can read`)
      }
    }

    if (symbolsUrl) {
      const listed = await fetch(symbolsUrl, { signal }),
        text = await listed.text(),
        defined = readSymbols(text)

      if (!defined) {
        throw new Error(`${symbolsUrl} is not a symbol file this debugger can read`)
      }

      cpc.symbols.add(defined)
    }

    return cpc
  }

  constructor(module, ramSize) {
    super()

    const z80Pointer = module._player_z80(),
      crtcPointer = module._player_crtc(),
      gateArrayPointer = module._player_gate_array(),
      framebufferPointer = module._player_framebuffer(),
      framebufferLength = FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT,
      ramPointer = module._player_ram(),
      writesStart = module._player_writes() >> 2

    this.#module = module
    this.#breakpoints = new Breakpoints(module)
    this.#palette = readPalette(module)
    this.#colours = readColours(module)
    this.#greys = readGreys(module)
    this.#z80 = new Z80(module, z80Pointer)
    this.#crtc = new Crtc(module, crtcPointer)
    this.#gateArray = new GateArray(module, gateArrayPointer)

    // The module's memory never grows (player.c holds all of it in fixed
    // storage), so a view taken once stays valid.
    this.#framebuffer = module.HEAPU8.subarray(
      framebufferPointer,
      framebufferPointer + framebufferLength
    )
    this.#ram = module.HEAPU8.subarray(ramPointer, ramPointer + ramSize)
    this.#writes = module.HEAPU32.subarray(writesStart, writesStart + ramSize)
  }

  get ticksPerMillisecond() {
    return TICKS_PER_MILLISECOND
  }

  get ticksPerFrame() {
    return TICKS_PER_FRAME
  }

  get z80() {
    return this.#z80
  }

  get breakpoints() {
    return this.#breakpoints
  }

  get crtc() {
    return this.#crtc
  }

  get gateArray() {
    return this.#gateArray
  }

  get palette() {
    return this.#palette
  }

  get greys() {
    return this.#greys
  }

  get colours() {
    return this.#colours
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

  get frame() {
    return this.#module._player_frame()
  }

  runFrames(frames) {
    this.#module._player_run_frames(frames)
  }

  runUntilRetrace(limit) {
    return this.#module._player_run_until_retrace(limit)
  }

  readTrap() {
    const kind = this.#module._player_trap_kind()

    if (kind == 0) {
      return null
    }

    return { kind: TRAP_KINDS[kind], address: this.#module._player_trap_address() }
  }

  finishInstruction() {
    this.#module._player_finish_instruction()
  }

  stepInstruction() {
    this.#module._player_step_instruction()
  }

  stepScanline() {
    this.stop()

    const crtc = this.#crtc,
      c4 = crtc.c4,
      c9 = crtc.c9

    for (let guard = 0; guard < 512 && crtc.c4 == c4 && crtc.c9 == c9; guard++) {
      this.stepInstruction()
    }

    this.present()
  }

  stepRow() {
    this.stop()

    const crtc = this.#crtc,
      c4 = crtc.c4

    for (let guard = 0; guard < 16384 && crtc.c4 == c4; guard++) {
      this.stepInstruction()
    }

    this.present()
  }

  pressKey(key) {
    this.#module._player_press(key)
  }

  releaseKey(key) {
    this.#module._player_release(key)
  }

  releaseAllKeys() {
    this.#module._player_release_all()
  }

  peek(address) {
    return this.#module._player_peek(address)
  }

  poke(address, value) {
    this.#module._player_poke(address, value)
  }

  remap() {
    this.#module._player_remap()
  }

  loadSnapshot(bytes) {
    this.#module.HEAPU8.set(bytes, this.#module._player_snapshot())
    return this.#module._player_load_snapshot(bytes.length)
  }
}
