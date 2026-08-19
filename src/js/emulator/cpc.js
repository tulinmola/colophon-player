import { Crtc } from "./crtc"
import { Machine } from "./machine"
import { Z80 } from "./z80"
import { createModule } from "./module"

const MODELS = {
  cpc464: { romFile: "cpc464.rom", ramSize: 0x10000 },
  cpc664: { romFile: "cpc664.rom", ramSize: 0x10000 },
  cpc6128: { romFile: "cpc6128.rom", ramSize: 0x20000 }
}

const DEFAULT_ROMS_URL = "/roms"

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

export class Cpc extends Machine {
  #crtc
  #module
  #palette
  #ramSize
  #z80

  static async create(model, { romsUrl, snapshotUrl, signal } = {}) {
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

    return cpc
  }

  constructor(module, ramSize) {
    super()

    const z80Pointer = module._player_z80(),
      crtcPointer = module._player_crtc()

    this.#module = module
    this.#palette = readPalette(module)
    this.#ramSize = ramSize
    this.#z80 = new Z80(module, z80Pointer)
    this.#crtc = new Crtc(module, crtcPointer)
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

  get crtc() {
    return this.#crtc
  }

  get palette() {
    return this.#palette
  }

  get framebuffer() {
    const pointer = this.#module._player_framebuffer(),
      length = FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT

    return this.#module.HEAPU8.subarray(pointer, pointer + length)
  }

  get ram() {
    const pointer = this.#module._player_ram()

    return this.#module.HEAPU8.subarray(pointer, pointer + this.#ramSize)
  }

  runFrames(frames) {
    this.#module._player_run_frames(frames)
  }

  runUntilRetrace(limit) {
    return this.#module._player_run_until_retrace(limit)
  }

  finishInstruction() {
    this.#module._player_finish_instruction()
  }

  stepInstruction() {
    this.#module._player_step_instruction()
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

  loadSnapshot(bytes) {
    this.#module.HEAPU8.set(bytes, this.#module._player_snapshot())
    return this.#module._player_load_snapshot(bytes.length)
  }
}
