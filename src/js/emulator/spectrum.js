import {
  SPECTRUM_FRAMEBUFFER_HEIGHT,
  SPECTRUM_FRAMEBUFFER_WIDTH,
  SPECTRUM_HALF_ROWS,
  SPECTRUM_TICKS_PER_FRAME,
  SPECTRUM_TICKS_PER_MILLISECOND
} from "./layout"
import { INSCRIPTIONS } from "./spectrum_inscriptions"
import { Machine } from "./machine"
import { Ula } from "./ula"
import { createModule } from "./module"
import { fileNameFrom } from "./file_name_from"
import { readSymbolFile } from "./read_symbol_file"

const MODELS = {
  spectrum48: { romFile: "spectrum48.rom", ramSize: 0xc000 }
}

const DEFAULT_ROMS_URL = "/roms"

const COLOUR_CODES = 16

// The window the emulator crops its own screenshots to, and the reason the two
// can be compared pixel for pixel.
const PICTURE = {
  raster: SPECTRUM_FRAMEBUFFER_WIDTH,
  left: 96,
  top: 20,
  width: 352,
  height: 264,
  scale: 1
}

export class Spectrum extends Machine {
  #ula

  static async create(model, { romsUrl, snapshotUrl, symbolsUrl, tapeUrl, signal } = {}) {
    const machine = MODELS[model],
      roms = romsUrl ?? DEFAULT_ROMS_URL,
      module = await createModule(),
      response = await fetch(`${roms}/${machine.romFile}`, { signal }),
      rom = new Uint8Array(await response.arrayBuffer())

    if (machine.ramSize > module._player_ram_capacity()) {
      throw new Error(`${model} asks for more memory than a machine is given here`)
    }

    if (rom.length > module._player_rom_capacity()) {
      throw new Error(`${machine.romFile} is larger than the room a firmware is given here`)
    }

    module.HEAPU8.set(rom, module._player_rom())
    module._player_boot_spectrum(machine.ramSize)

    const spectrum = new Spectrum(module, machine.ramSize)

    if (tapeUrl) {
      const recorded = await fetch(tapeUrl, { signal }),
        bytes = new Uint8Array(await recorded.arrayBuffer()),
        name = fileNameFrom(tapeUrl)

      if (!spectrum.tape.insert(bytes, name)) {
        throw new Error(`${tapeUrl} is not a tape this machine can read: ${spectrum.tape.problem}`)
      }
    }

    if (snapshotUrl) {
      const saved = await fetch(snapshotUrl, { signal }),
        bytes = new Uint8Array(await saved.arrayBuffer())

      if (!spectrum.loadSnapshot(bytes)) {
        throw new Error(`${snapshotUrl} is not a snapshot this machine can read`)
      }
    }

    if (symbolsUrl) {
      await readSymbolFile(spectrum, symbolsUrl, signal)
    }

    return spectrum
  }

  constructor(module, ramSize) {
    const framebufferSize = SPECTRUM_FRAMEBUFFER_WIDTH * SPECTRUM_FRAMEBUFFER_HEIGHT,
      shape = { ramSize, framebufferSize, colourCodes: COLOUR_CODES }

    super(module, shape)

    const ulaPointer = module._player_spectrum_ula(),
      capture = () => module._player_capture()

    this.#ula = new Ula(module, ulaPointer, capture)
  }

  get ticksPerMillisecond() {
    return SPECTRUM_TICKS_PER_MILLISECOND
  }

  get ticksPerFrame() {
    return SPECTRUM_TICKS_PER_FRAME
  }

  get picture() {
    return PICTURE
  }

  get keyboardLines() {
    return SPECTRUM_HALF_ROWS
  }

  get inscriptions() {
    return INSCRIPTIONS
  }

  get ula() {
    return this.#ula
  }
}
