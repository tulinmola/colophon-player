import {
  CRTC_AT_C0,
  CRTC_AT_C4,
  CRTC_AT_C9,
  CRTC_AT_REGISTERS,
  CRTC_REGISTERS,
  CRTC_SIZE
} from "./layout"
import { Chip } from "./chip"

// The bits a write reaches, as src/crtc.c masks them to the documented type-0
// widths (Compendium ch. 4.3). R16 and R17 are the light pen's to write, so
// they take nothing. This is the one table here that layout.c cannot generate:
// crtc.c keeps it static.
const WRITABLE_BITS = [
  0xff, 0xff, 0xff, 0xff, 0x7f, 0x1f, 0x7f, 0x7f, 0xf3, 0x1f, 0x7f, 0x1f, 0x3f, 0xff, 0x3f, 0xff,
  0x00, 0x00
]

// A counter is narrower than the byte holding it, and the width is what brings
// it back when a program leaves it above its limit (Compendium ch. 10.3.1.1).
const C4_BITS = 0x7f,
  C9_BITS = 0x1f

export class Crtc extends Chip {
  constructor(module, pointer) {
    super(module, pointer, CRTC_SIZE)
  }

  get registers() {
    return this.bytesAt(CRTC_AT_REGISTERS, CRTC_REGISTERS)
  }

  putRegister(number, value) {
    this.putByteAt(CRTC_AT_REGISTERS + number, value & WRITABLE_BITS[number])
  }

  get c0() {
    return this.byteAt(CRTC_AT_C0)
  }

  set c0(value) {
    this.putByteAt(CRTC_AT_C0, value)
  }

  get c4() {
    return this.byteAt(CRTC_AT_C4)
  }

  set c4(value) {
    this.putByteAt(CRTC_AT_C4, value & C4_BITS)
  }

  get c9() {
    return this.byteAt(CRTC_AT_C9)
  }

  set c9(value) {
    this.putByteAt(CRTC_AT_C9, value & C9_BITS)
  }
}
