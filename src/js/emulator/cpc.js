import { Breakpoints } from "./breakpoints"
import { CpcVideo } from "./cpc_video"
import { Crtc } from "./crtc"
import { Drive } from "./drive"
import { Floppy } from "./floppy"
import { GateArray } from "./gate_array"
import { Machine } from "./machine"
import { Upd765 } from "./upd765"
import { Z80 } from "./z80"
import { createModule } from "./module"
import { readSymbols } from "../symbols"

const MODELS = {
  cpc464: { romFile: "cpc464.rom", ramSize: 0x10000, discInterface: false },
  cpc664: { romFile: "cpc664.rom", ramSize: 0x10000, discInterface: true },
  cpc6128: { romFile: "cpc6128.rom", ramSize: 0x20000, discInterface: true }
}

const DEFAULT_ROMS_URL = "/roms"

const AMSDOS_ROM_FILE = "amsdos.rom"

const DRIVES = 2

const TEXT = new TextDecoder()

function discNameFrom(url) {
  const { pathname } = new URL(url, document.baseURI)

  return pathname.slice(pathname.lastIndexOf("/") + 1)
}

const TRAP_KINDS = { 1: "execute", 2: "read", 4: "write", 8: "break" }

const GRAINS = { instruction: 0, scanline: 1, row: 2, frame: 3 }

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

function readDiscProblem(module) {
  const heap = module.HEAPU8,
    at = module._player_disc_problem()

  let end = at
  while (heap[end] != 0) {
    end++
  }

  return TEXT.decode(heap.subarray(at, end))
}

// The same codes as CSS, for a page that shows an ink rather than draws it.
function readCssColours(module) {
  const colours = new Array(COLOUR_CODES)

  for (let code = 0; code < COLOUR_CODES; code++) {
    const rgb = module._player_rgb(code)
    colours[code] = `#${rgb.toString(16).padStart(6, "0")}`
  }

  return colours
}

export class Cpc extends Machine {
  #breakInstructions = false
  #breakpoints
  #cssColours
  #crtc
  #framebuffer
  #gateArray
  #greys
  #discInterface
  #discNames = []
  #discProblem = null
  #drives
  #fdc
  #module
  #palette
  #ram
  #video
  #writes
  #z80

  static async create(model, { romsUrl, snapshotUrl, symbolsUrl, discUrls, signal } = {}) {
    const machine = MODELS[model],
      roms = romsUrl ?? DEFAULT_ROMS_URL,
      discs = discUrls ?? [],
      module = await createModule(),
      response = await fetch(`${roms}/${machine.romFile}`, { signal }),
      rom = new Uint8Array(await response.arrayBuffer())

    module.HEAPU8.set(rom, module._player_rom())

    const discInterface = machine.discInterface || discs.some(url => url)

    if (discInterface) {
      const fitted = await fetch(`${roms}/${AMSDOS_ROM_FILE}`, { signal }),
        amsdos = new Uint8Array(await fitted.arrayBuffer())

      module.HEAPU8.set(amsdos, module._player_amsdos())
    }

    module._player_boot(machine.ramSize, discInterface)

    const cpc = new Cpc(module, machine.ramSize, discInterface)

    for (let drive = 0; drive < discs.length; drive++) {
      const url = discs[drive]

      if (!url) {
        continue
      }

      const image = await fetch(url, { signal }),
        bytes = new Uint8Array(await image.arrayBuffer()),
        name = discNameFrom(url)

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

  constructor(module, ramSize, discInterface) {
    super()

    const z80Pointer = module._player_z80(),
      crtcPointer = module._player_crtc(),
      gateArrayPointer = module._player_gate_array(),
      fdcPointer = module._player_fdc(),
      framebufferPointer = module._player_framebuffer(),
      framebufferLength = FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT,
      ramPointer = module._player_ram(),
      writesStart = module._player_writes() >> 2

    this.#module = module
    this.#breakpoints = new Breakpoints(module)
    this.#discInterface = discInterface
    this.#palette = readPalette(module)
    this.#cssColours = readCssColours(module)
    this.#greys = readGreys(module)
    const capture = () => module._player_capture()

    this.#z80 = new Z80(module, z80Pointer, capture)
    this.#crtc = new Crtc(module, crtcPointer, capture)
    this.#gateArray = new GateArray(module, gateArrayPointer, capture)
    this.#fdc = new Upd765(module, fdcPointer, capture)
    this.#video = new CpcVideo(this.#crtc)

    this.#drives = []
    for (let unit = 0; unit < DRIVES; unit++) {
      const drivePointer = module._player_drive(unit),
        floppyPointer = module._player_floppy(unit),
        floppy = new Floppy(module, floppyPointer, capture)

      this.#drives.push(new Drive(module, drivePointer, unit, floppy, capture))
    }

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

  get breakInstructions() {
    return this.#breakInstructions
  }

  set breakInstructions(honoured) {
    this.#breakInstructions = honoured
    this.#module._player_set_break_instructions(honoured)
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

  discName(drive) {
    return this.#discNames[drive] ?? ""
  }

  get discCapacity() {
    return this.#module._player_disc_capacity()
  }

  get video() {
    return this.#video
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

  stepBackTo(grain) {
    this.#module._player_step_back_to(GRAINS[grain])
  }

  seek(tick) {
    this.#module._player_seek(tick)
  }

  capture() {
    this.#module._player_capture()
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

  writeRam(physical, value) {
    this.#ram[physical] = value
    this.#module._player_capture()
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

  // An image with no room for it is never written: the buffer it would land in
  // is the disc a drive may still be reading.
  insertDisc(drive, bytes, name) {
    const module = this.#module

    if (bytes.length <= this.discCapacity) {
      module.HEAPU8.set(bytes, module._player_disc(drive))
    }

    if (module._player_insert_disc(drive, bytes.length)) {
      this.#discNames[drive] = name
      this.#discProblem = null
      return true
    }

    this.#discProblem = readDiscProblem(module)

    if (!this.drives[drive].floppy) {
      this.#discNames[drive] = ""
    }

    return false
  }

  ejectDisc(drive) {
    this.#module._player_eject_disc(drive)
    this.#discProblem = null
  }

  // Null where there is no image to write, with discProblem saying why.
  saveDisc(drive) {
    const module = this.#module,
      length = module._player_save_disc(drive)

    if (length == 0) {
      this.#discProblem = readDiscProblem(module)
      return null
    }

    this.#discProblem = null
    const at = module._player_written_disc()

    return module.HEAPU8.slice(at, at + length)
  }
}
