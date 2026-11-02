import {
  CRTC_AT_C0,
  CRTC_AT_C3H,
  CRTC_AT_C3L,
  CRTC_AT_C4,
  CRTC_AT_C5,
  CRTC_AT_C9,
  CRTC_AT_C9_IVM,
  CRTC_AT_REGISTERS,
  CRTC_AT_TYPE,
  CRTC_AT_VMA_,
  CRTC_REGISTERS,
  CRTC_SIZE
} from "./layout"
import { Struct } from "./struct"

// The bits a write reaches, as src/crtc.c masks them to the documented type-0
// widths (Compendium ch. 4.3), and R8 to its interlace bits alone on types 1
// and 2 (ch. 19.1). R16 and R17 are the light pen's to write, so they take
// nothing. layout.c cannot generate these: crtc.c keeps them static.
const WRITABLE_BITS = [
    0xff, 0xff, 0xff, 0xff, 0x7f, 0x1f, 0x7f, 0x7f, 0xf3, 0x1f, 0x7f, 0x1f, 0x3f, 0xff, 0x3f, 0xff,
    0x00, 0x00
  ],
  R8_INTERLACE_BITS = 0x03

// A counter is narrower than the byte holding it, and the width is what brings
// it back when a program leaves it above its limit (Compendium ch. 10.3.1.1).
// C9.IVM has no width of its own and is held in C9's.
const C4_BITS = 0x7f,
  C9_BITS = 0x1f,
  C5_BITS = 0x1f,
  C3_BITS = 0x0f

// C5 counts a frame's adjustment lines on types 1 and 2 alone, where the other
// three spend C9 on them (Compendium ch. 11.1), and C9.IVM is a type 2's alone
// (ch. 19.8.3).
const COUNTERS_BY_TYPE = [
    ["c0", "c9", "c4", "c3l", "c3h"],
    ["c0", "c9", "c4", "c3l", "c3h", "c5"],
    ["c0", "c9", "c4", "c3l", "c3h", "c5", "c9Ivm"],
    ["c0", "c9", "c4", "c3l", "c3h"],
    ["c0", "c9", "c4", "c3l", "c3h"]
  ],
  // The Compendium's table of parts (ch. 4.2), the two ASICs named by their maker.
  PARTS_BY_TYPE = ["HD6845S/UM6845", "UM6845R", "MC6845", "Amstrad 40489", "Amstrad 40226"]

export class Crtc extends Struct {
  constructor(module, pointer, capture) {
    super(module, pointer, CRTC_SIZE, capture)
  }

  get type() {
    return this.byteAt(CRTC_AT_TYPE)
  }

  get part() {
    return PARTS_BY_TYPE[this.type]
  }

  get counterNames() {
    return COUNTERS_BY_TYPE[this.type]
  }

  get registers() {
    return this.bytesAt(CRTC_AT_REGISTERS, CRTC_REGISTERS)
  }

  putRegister(number, value) {
    const writable = this.#writableBitsOf(number)

    this.putByteAt(CRTC_AT_REGISTERS + number, value & writable)
  }

  #writableBitsOf(number) {
    if (number == 8 && (this.type == 1 || this.type == 2)) {
      return R8_INTERLACE_BITS
    }

    return WRITABLE_BITS[number]
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

  get c9Ivm() {
    return this.byteAt(CRTC_AT_C9_IVM)
  }

  set c9Ivm(value) {
    this.putByteAt(CRTC_AT_C9_IVM, value & C9_BITS)
  }

  get c5() {
    return this.byteAt(CRTC_AT_C5)
  }

  set c5(value) {
    this.putByteAt(CRTC_AT_C5, value & C5_BITS)
  }

  get c3l() {
    return this.byteAt(CRTC_AT_C3L)
  }

  set c3l(value) {
    this.putByteAt(CRTC_AT_C3L, value & C3_BITS)
  }

  get c3h() {
    return this.byteAt(CRTC_AT_C3H)
  }

  set c3h(value) {
    this.putByteAt(CRTC_AT_C3H, value & C3_BITS)
  }

  get vma_() {
    return this.wordAt(CRTC_AT_VMA_)
  }
}
