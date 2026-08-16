import createModule from "../vendor/colophon-a8614c4.mjs"

const MACHINES = {
  cpc464: { romFile: "cpc464.rom", ramSize: 0x10000 },
  cpc664: { romFile: "cpc664.rom", ramSize: 0x10000 },
  cpc6128: { romFile: "cpc6128.rom", ramSize: 0x20000 }
}

const FRAMEBUFFER_WIDTH = 1024,
  FRAMEBUFFER_HEIGHT = 312,
  COLOUR_CODES = 32

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

class Machine {
  #module
  #palette

  constructor(module) {
    this.#module = module
    this.#palette = readPalette(module)
  }

  get palette() {
    return this.#palette
  }

  get framebuffer() {
    const pointer = this.#module._player_framebuffer(),
      length = FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT

    return this.#module.HEAPU8.subarray(pointer, pointer + length)
  }

  runFrames(frames) {
    this.#module._player_run_frames(frames)
  }

  runUntilRetrace(limit) {
    return this.#module._player_run_until_retrace(limit)
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

export async function createMachine(name, { romsUrl = "/roms", signal } = {}) {
  const machine = MACHINES[name],
    module = await createModule(),
    response = await fetch(`${romsUrl}/${machine.romFile}`, { signal }),
    rom = new Uint8Array(await response.arrayBuffer())

  module.HEAPU8.set(rom, module._player_rom())
  module._player_boot(machine.ramSize)

  return new Machine(module)
}
