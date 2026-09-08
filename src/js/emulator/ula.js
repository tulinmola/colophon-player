import {
  ULA_AT_BORDER,
  ULA_AT_COLUMN,
  ULA_AT_FRAME_COUNT,
  ULA_AT_FRAME_TICK,
  ULA_AT_LINE,
  ULA_AT_MICROPHONE,
  ULA_AT_SPEAKER,
  ULA_SIZE
} from "./layout"
import { Struct } from "./struct"

// The bits a write to port &FE reaches, as src/ula.c masks them.
const BORDER_BITS = 0x07

export class Ula extends Struct {
  #capture
  #module

  constructor(module, pointer, capture) {
    super(module, pointer, ULA_SIZE, capture)
    this.#module = module
    this.#capture = capture
  }

  // T-states since the interrupt, which is the unit every published timing
  // for this machine is given in.
  get frameTick() {
    return this.longAt(ULA_AT_FRAME_TICK)
  }

  // The line and the column are worked out from this rather than kept beside
  // it, so ula.h places the chip through here and never by the field.
  seek(frameTick) {
    this.#module._player_spectrum_ula_seek(frameTick)
    this.#capture()
  }

  get frameCount() {
    return this.longAt(ULA_AT_FRAME_COUNT)
  }

  get line() {
    return this.wordAt(ULA_AT_LINE)
  }

  get column() {
    return this.wordAt(ULA_AT_COLUMN)
  }

  get border() {
    return this.byteAt(ULA_AT_BORDER)
  }

  set border(value) {
    this.putByteAt(ULA_AT_BORDER, value & BORDER_BITS)
  }

  get speaker() {
    return this.boolAt(ULA_AT_SPEAKER)
  }

  get microphone() {
    return this.boolAt(ULA_AT_MICROPHONE)
  }
}
