import {
  GATE_ARRAY_AT_INKS,
  GATE_ARRAY_AT_INTERRUPT_REQUEST,
  GATE_ARRAY_AT_LOWER_ROM,
  GATE_ARRAY_AT_MODE,
  GATE_ARRAY_AT_MODE_PENDING,
  GATE_ARRAY_AT_PEN,
  GATE_ARRAY_AT_R52,
  GATE_ARRAY_AT_UPPER_ROM,
  GATE_ARRAY_INKS,
  GATE_ARRAY_SIZE
} from "./layout"
import { Chip } from "./chip"

// The bits a write reaches, as src/gate_array.c masks them: a colour code is
// five bits, a mode two, and R52 counts to 52 in six.
const INK_BITS = 0x1f,
  MODE_BITS = 0x03,
  R52_BITS = 0x3f

const BORDER_PEN = 16

export class GateArray extends Chip {
  constructor(module, pointer) {
    super(module, pointer, GATE_ARRAY_SIZE)
  }

  // Hardware colour codes, one a pen; the seventeenth is the border's.
  get inks() {
    return this.bytesAt(GATE_ARRAY_AT_INKS, GATE_ARRAY_INKS)
  }

  putInk(pen, colourCode) {
    this.putByteAt(GATE_ARRAY_AT_INKS + pen, colourCode & INK_BITS)
  }

  get pen() {
    return this.byteAt(GATE_ARRAY_AT_PEN)
  }

  // PENR's own decoding: bit 4 names the border, the low nibble a pen.
  set pen(value) {
    this.putByteAt(GATE_ARRAY_AT_PEN, value & 0x10 ? BORDER_PEN : value & 0x0f)
  }

  get mode() {
    return this.byteAt(GATE_ARRAY_AT_MODE)
  }

  set mode(value) {
    this.putByteAt(GATE_ARRAY_AT_MODE, value & MODE_BITS)
  }

  get modePending() {
    return this.byteAt(GATE_ARRAY_AT_MODE_PENDING)
  }

  set modePending(value) {
    this.putByteAt(GATE_ARRAY_AT_MODE_PENDING, value & MODE_BITS)
  }

  get lowerRomEnabled() {
    return this.boolAt(GATE_ARRAY_AT_LOWER_ROM)
  }

  set lowerRomEnabled(on) {
    this.putBoolAt(GATE_ARRAY_AT_LOWER_ROM, on)
  }

  get upperRomEnabled() {
    return this.boolAt(GATE_ARRAY_AT_UPPER_ROM)
  }

  set upperRomEnabled(on) {
    this.putBoolAt(GATE_ARRAY_AT_UPPER_ROM, on)
  }

  get r52() {
    return this.byteAt(GATE_ARRAY_AT_R52)
  }

  set r52(value) {
    this.putByteAt(GATE_ARRAY_AT_R52, value & R52_BITS)
  }

  get interruptRequest() {
    return this.boolAt(GATE_ARRAY_AT_INTERRUPT_REQUEST)
  }

  set interruptRequest(on) {
    this.putBoolAt(GATE_ARRAY_AT_INTERRUPT_REQUEST, on)
  }
}
