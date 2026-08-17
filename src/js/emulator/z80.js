import {
  Z80_AT_A,
  Z80_AT_AF_,
  Z80_AT_B,
  Z80_AT_BC_,
  Z80_AT_C,
  Z80_AT_D,
  Z80_AT_DE_,
  Z80_AT_E,
  Z80_AT_EI,
  Z80_AT_F,
  Z80_AT_H,
  Z80_AT_HALTED,
  Z80_AT_HL_,
  Z80_AT_I,
  Z80_AT_IFF1,
  Z80_AT_IFF2,
  Z80_AT_IM,
  Z80_AT_INTERRUPT_SHADOW,
  Z80_AT_INT_LINE,
  Z80_AT_IXH,
  Z80_AT_IXL,
  Z80_AT_IYH,
  Z80_AT_IYL,
  Z80_AT_L,
  Z80_AT_PC,
  Z80_AT_R,
  Z80_AT_SP,
  Z80_AT_WZ,
  Z80_FLAG_C,
  Z80_FLAG_H,
  Z80_FLAG_N,
  Z80_FLAG_PV,
  Z80_FLAG_S,
  Z80_FLAG_X,
  Z80_FLAG_Y,
  Z80_FLAG_Z,
  Z80_SIZE
} from "./layout"
import { Chip } from "./chip"

export class Z80 extends Chip {
  constructor(module, pointer) {
    super(module, pointer, Z80_SIZE)
  }

  get a() {
    return this.byteAt(Z80_AT_A)
  }

  get f() {
    return this.byteAt(Z80_AT_F)
  }

  get b() {
    return this.byteAt(Z80_AT_B)
  }

  get c() {
    return this.byteAt(Z80_AT_C)
  }

  get d() {
    return this.byteAt(Z80_AT_D)
  }

  get e() {
    return this.byteAt(Z80_AT_E)
  }

  get h() {
    return this.byteAt(Z80_AT_H)
  }

  get l() {
    return this.byteAt(Z80_AT_L)
  }

  get af() {
    return (this.a << 8) | this.f
  }

  get bc() {
    return (this.b << 8) | this.c
  }

  get de() {
    return (this.d << 8) | this.e
  }

  get hl() {
    return (this.h << 8) | this.l
  }

  get af_() {
    return this.wordAt(Z80_AT_AF_)
  }

  get bc_() {
    return this.wordAt(Z80_AT_BC_)
  }

  get de_() {
    return this.wordAt(Z80_AT_DE_)
  }

  get hl_() {
    return this.wordAt(Z80_AT_HL_)
  }

  get ix() {
    return (this.byteAt(Z80_AT_IXH) << 8) | this.byteAt(Z80_AT_IXL)
  }

  get iy() {
    return (this.byteAt(Z80_AT_IYH) << 8) | this.byteAt(Z80_AT_IYL)
  }

  get sp() {
    return this.wordAt(Z80_AT_SP)
  }

  get pc() {
    return this.wordAt(Z80_AT_PC)
  }

  get wz() {
    return this.wordAt(Z80_AT_WZ)
  }

  get i() {
    return this.byteAt(Z80_AT_I)
  }

  get r() {
    return this.byteAt(Z80_AT_R)
  }

  get im() {
    return this.byteAt(Z80_AT_IM)
  }

  get iff1() {
    return this.boolAt(Z80_AT_IFF1)
  }

  get iff2() {
    return this.boolAt(Z80_AT_IFF2)
  }

  get halted() {
    return this.boolAt(Z80_AT_HALTED)
  }

  get ei() {
    return this.boolAt(Z80_AT_EI)
  }

  get interruptShadow() {
    return this.boolAt(Z80_AT_INTERRUPT_SHADOW)
  }

  get intLine() {
    return this.boolAt(Z80_AT_INT_LINE)
  }

  get flagS() {
    return (this.f & Z80_FLAG_S) != 0
  }

  get flagZ() {
    return (this.f & Z80_FLAG_Z) != 0
  }

  get flagY() {
    return (this.f & Z80_FLAG_Y) != 0
  }

  get flagH() {
    return (this.f & Z80_FLAG_H) != 0
  }

  get flagX() {
    return (this.f & Z80_FLAG_X) != 0
  }

  get flagPV() {
    return (this.f & Z80_FLAG_PV) != 0
  }

  get flagN() {
    return (this.f & Z80_FLAG_N) != 0
  }

  get flagC() {
    return (this.f & Z80_FLAG_C) != 0
  }
}
