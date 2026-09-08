import {
  CPC_FRAMEBUFFER_HEIGHT,
  CPC_FRAMEBUFFER_WIDTH,
  CPC_KEYBOARD_LINES,
  CPC_TICKS_PER_FRAME,
  CPC_TICKS_PER_MILLISECOND
} from "./layout"
import { CpcVideo } from "./cpc_video"
import { Crtc } from "./crtc"
import { Drive } from "./drive"
import { Floppy } from "./floppy"
import { GateArray } from "./gate_array"
import { INSCRIPTIONS } from "./cpc_inscriptions"
import { Machine } from "./machine"
import { Upd765 } from "./upd765"
import { createModule } from "./module"
import { fileNameFrom } from "./file_name_from"
import { readProblem } from "./read_problem"
import { readSymbolFile } from "./read_symbol_file"

const MODELS = {
  cpc464: { romFile: "cpc464.rom", ramSize: 0x10000, discInterface: false },
  cpc664: { romFile: "cpc664.rom", ramSize: 0x10000, discInterface: true },
  cpc6128: { romFile: "cpc6128.rom", ramSize: 0x20000, discInterface: true }
}

const DEFAULT_ROMS_URL = "/roms"

const AMSDOS_ROM_FILE = "amsdos.rom"

const DRIVES = 2

const COLOUR_CODES = 32

// The window the emulator crops its own screenshots to, and the reason the two
// can be compared pixel for pixel. Sixteen samples to the microsecond make a
// sample half a pixel wide, which is what brings the window back to four by
// three.
const PICTURE = {
  raster: CPC_FRAMEBUFFER_WIDTH,
  left: 208,
  top: 34,
  width: 768,
  height: 272,
  scale: 0.5
}

export class Cpc extends Machine {
  #crtc
  #discInterface
  #discNames = []
  #discProblem = null
  #drives
  #fdc
  #gateArray
  #video

  static async create(model, { romsUrl, snapshotUrl, symbolsUrl, discUrls, signal } = {}) {
    const machine = MODELS[model],
      roms = romsUrl ?? DEFAULT_ROMS_URL,
      discs = discUrls ?? [],
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

    const discInterface = machine.discInterface || discs.some(url => url)

    if (discInterface) {
      const fitted = await fetch(`${roms}/${AMSDOS_ROM_FILE}`, { signal }),
        amsdos = new Uint8Array(await fitted.arrayBuffer())

      module.HEAPU8.set(amsdos, module._player_cpc_amsdos())
    }

    module._player_boot_cpc(machine.ramSize, discInterface)

    const cpc = new Cpc(module, machine.ramSize, discInterface)

    for (let drive = 0; drive < discs.length; drive++) {
      const url = discs[drive]

      if (!url) {
        continue
      }

      const image = await fetch(url, { signal }),
        bytes = new Uint8Array(await image.arrayBuffer()),
        name = fileNameFrom(url)

      if (!cpc.insertDisc(drive, bytes, name)) {
        throw new Error(`${url} is not a disc this machine can read: ${cpc.discProblem}`)
      }
    }

    if (snapshotUrl) {
      const saved = await fetch(snapshotUrl, { signal }),
        bytes = new Uint8Array(await saved.arrayBuffer())

      if (!cpc.loadSnapshot(bytes)) {
        throw new Error(`${snapshotUrl} is not a snapshot this machine can read`)
      }
    }

    if (symbolsUrl) {
      await readSymbolFile(cpc, symbolsUrl, signal)
    }

    return cpc
  }

  constructor(module, ramSize, discInterface) {
    const framebufferSize = CPC_FRAMEBUFFER_WIDTH * CPC_FRAMEBUFFER_HEIGHT,
      shape = { ramSize, framebufferSize, colourCodes: COLOUR_CODES }

    super(module, shape)

    const crtcPointer = module._player_cpc_crtc(),
      gateArrayPointer = module._player_cpc_gate_array(),
      fdcPointer = module._player_cpc_fdc(),
      capture = () => module._player_capture()

    this.#discInterface = discInterface
    this.#crtc = new Crtc(module, crtcPointer, capture)
    this.#gateArray = new GateArray(module, gateArrayPointer, capture)
    this.#fdc = new Upd765(module, fdcPointer, capture)
    this.#video = new CpcVideo(this.#crtc)

    this.#drives = []
    for (let unit = 0; unit < DRIVES; unit++) {
      const drivePointer = module._player_cpc_drive(unit),
        floppyPointer = module._player_cpc_floppy(unit),
        floppy = new Floppy(module, floppyPointer, capture)

      this.#drives.push(new Drive(module, drivePointer, unit, floppy, capture))
    }
  }

  get ticksPerMillisecond() {
    return CPC_TICKS_PER_MILLISECOND
  }

  get ticksPerFrame() {
    return CPC_TICKS_PER_FRAME
  }

  get picture() {
    return PICTURE
  }

  get keyboardLines() {
    return CPC_KEYBOARD_LINES
  }

  get inscriptions() {
    return INSCRIPTIONS
  }

  get crtc() {
    return this.#crtc
  }

  get gateArray() {
    return this.#gateArray
  }

  get fdc() {
    return this.#fdc
  }

  get drives() {
    return this.#drives
  }

  get discInterface() {
    return this.#discInterface
  }

  // The last refusal, whichever drive it was for.
  get discProblem() {
    return this.#discProblem
  }

  #readDiscProblem() {
    const module = this.module,
      at = module._player_cpc_disc_problem()

    return readProblem(module, at)
  }

  discName(drive) {
    return this.#discNames[drive] ?? ""
  }

  get discCapacity() {
    return this.module._player_cpc_disc_capacity()
  }

  get video() {
    return this.#video
  }

  // The pages the processor reads are derived from the ROM enables and the
  // bank register, so a host that writes those recomputes them.
  remap() {
    this.module._player_cpc_remap()
  }

  // An image with no room for it is never written: the buffer it would land in
  // is the disc a drive may still be reading.
  insertDisc(drive, bytes, name) {
    const module = this.module

    if (bytes.length <= this.discCapacity) {
      module.HEAPU8.set(bytes, module._player_cpc_disc(drive))
    }

    if (module._player_cpc_insert_disc(drive, bytes.length)) {
      this.#discNames[drive] = name
      this.#discProblem = null
      return true
    }

    this.#discProblem = this.#readDiscProblem()

    if (!this.drives[drive].floppy) {
      this.#discNames[drive] = ""
    }

    return false
  }

  ejectDisc(drive) {
    this.module._player_cpc_eject_disc(drive)
    this.#discProblem = null
  }

  // Null where there is no image to write, with discProblem saying why.
  saveDisc(drive) {
    const module = this.module,
      length = module._player_cpc_save_disc(drive)

    if (length == 0) {
      this.#discProblem = this.#readDiscProblem()
      return null
    }

    this.#discProblem = null
    const at = module._player_cpc_written_disc()

    return module.HEAPU8.slice(at, at + length)
  }
}
