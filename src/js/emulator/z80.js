import {
  Z80_AT_A,
  Z80_AT_AF_,
  Z80_AT_A_,
  Z80_AT_B,
  Z80_AT_BC_,
  Z80_AT_B_,
  Z80_AT_C,
  Z80_AT_C_,
  Z80_AT_D,
  Z80_AT_DE_,
  Z80_AT_D_,
  Z80_AT_E,
  Z80_AT_EI,
  Z80_AT_E_,
  Z80_AT_F,
  Z80_AT_F_,
  Z80_AT_H,
  Z80_AT_HALTED,
  Z80_AT_HL_,
  Z80_AT_H_,
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
  Z80_AT_L_,
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
  constructor(module, pointer, capture) {
    super(module, pointer, Z80_SIZE, capture)
  }

  #putFlag(mask, on) {
    const f = this.byteAt(Z80_AT_F)
    this.putByteAt(Z80_AT_F, on ? f | mask : f & ~mask)
  }

  get a() {
    return this.byteAt(Z80_AT_A)
  }

  set a(value) {
    this.putByteAt(Z80_AT_A, value)
  }

  get f() {
    return this.byteAt(Z80_AT_F)
  }

  set f(value) {
    this.putByteAt(Z80_AT_F, value)
  }

  get b() {
    return this.byteAt(Z80_AT_B)
  }

  set b(value) {
    this.putByteAt(Z80_AT_B, value)
  }

  get c() {
    return this.byteAt(Z80_AT_C)
  }

  set c(value) {
    this.putByteAt(Z80_AT_C, value)
  }

  get d() {
    return this.byteAt(Z80_AT_D)
  }

  set d(value) {
    this.putByteAt(Z80_AT_D, value)
  }

  get e() {
    return this.byteAt(Z80_AT_E)
  }

  set e(value) {
    this.putByteAt(Z80_AT_E, value)
  }

  get h() {
    return this.byteAt(Z80_AT_H)
  }

  set h(value) {
    this.putByteAt(Z80_AT_H, value)
  }

  get l() {
    return this.byteAt(Z80_AT_L)
  }

  set l(value) {
    this.putByteAt(Z80_AT_L, value)
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

  get a_() {
    return this.byteAt(Z80_AT_A_)
  }

  set a_(value) {
    this.putByteAt(Z80_AT_A_, value)
  }

  get f_() {
    return this.byteAt(Z80_AT_F_)
  }

  set f_(value) {
    this.putByteAt(Z80_AT_F_, value)
  }

  get b_() {
    return this.byteAt(Z80_AT_B_)
  }

  set b_(value) {
    this.putByteAt(Z80_AT_B_, value)
  }

  get c_() {
    return this.byteAt(Z80_AT_C_)
  }

  set c_(value) {
    this.putByteAt(Z80_AT_C_, value)
  }

  get d_() {
    return this.byteAt(Z80_AT_D_)
  }

  set d_(value) {
    this.putByteAt(Z80_AT_D_, value)
  }

  get e_() {
    return this.byteAt(Z80_AT_E_)
  }

  set e_(value) {
    this.putByteAt(Z80_AT_E_, value)
  }

  get h_() {
    return this.byteAt(Z80_AT_H_)
  }

  set h_(value) {
    this.putByteAt(Z80_AT_H_, value)
  }

  get l_() {
    return this.byteAt(Z80_AT_L_)
  }

  set l_(value) {
    this.putByteAt(Z80_AT_L_, value)
  }

  get af_() {
    return this.wordAt(Z80_AT_AF_)
  }

  set af_(value) {
    this.putWordAt(Z80_AT_AF_, value)
  }

  get bc_() {
    return this.wordAt(Z80_AT_BC_)
  }

  set bc_(value) {
    this.putWordAt(Z80_AT_BC_, value)
  }

  get de_() {
    return this.wordAt(Z80_AT_DE_)
  }

  set de_(value) {
    this.putWordAt(Z80_AT_DE_, value)
  }

  get hl_() {
    return this.wordAt(Z80_AT_HL_)
  }

  set hl_(value) {
    this.putWordAt(Z80_AT_HL_, value)
  }

  get ixh() {
    return this.byteAt(Z80_AT_IXH)
  }

  set ixh(value) {
    this.putByteAt(Z80_AT_IXH, value)
  }

  get ixl() {
    return this.byteAt(Z80_AT_IXL)
  }

  set ixl(value) {
    this.putByteAt(Z80_AT_IXL, value)
  }

  get iyh() {
    return this.byteAt(Z80_AT_IYH)
  }

  set iyh(value) {
    this.putByteAt(Z80_AT_IYH, value)
  }

  get iyl() {
    return this.byteAt(Z80_AT_IYL)
  }

  set iyl(value) {
    this.putByteAt(Z80_AT_IYL, value)
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

  set sp(value) {
    this.putWordAt(Z80_AT_SP, value)
  }

  get pc() {
    return this.wordAt(Z80_AT_PC)
  }

  set pc(value) {
    this.putWordAt(Z80_AT_PC, value)
  }

  get wz() {
    return this.wordAt(Z80_AT_WZ)
  }

  set wz(value) {
    this.putWordAt(Z80_AT_WZ, value)
  }

  get i() {
    return this.byteAt(Z80_AT_I)
  }

  set i(value) {
    this.putByteAt(Z80_AT_I, value)
  }

  get r() {
    return this.byteAt(Z80_AT_R)
  }

  set r(value) {
    this.putByteAt(Z80_AT_R, value)
  }

  get im() {
    return this.byteAt(Z80_AT_IM)
  }

  set im(value) {
    this.putByteAt(Z80_AT_IM, value)
  }

  get iff1() {
    return this.boolAt(Z80_AT_IFF1)
  }

  set iff1(on) {
    this.putBoolAt(Z80_AT_IFF1, on)
  }

  get iff2() {
    return this.boolAt(Z80_AT_IFF2)
  }

  set iff2(on) {
    this.putBoolAt(Z80_AT_IFF2, on)
  }

  get halted() {
    return this.boolAt(Z80_AT_HALTED)
  }

  set halted(on) {
    this.putBoolAt(Z80_AT_HALTED, on)
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

  set flagS(on) {
    this.#putFlag(Z80_FLAG_S, on)
  }

  get flagZ() {
    return (this.f & Z80_FLAG_Z) != 0
  }

  set flagZ(on) {
    this.#putFlag(Z80_FLAG_Z, on)
  }

  get flagY() {
    return (this.f & Z80_FLAG_Y) != 0
  }

  set flagY(on) {
    this.#putFlag(Z80_FLAG_Y, on)
  }

  get flagH() {
    return (this.f & Z80_FLAG_H) != 0
  }

  set flagH(on) {
    this.#putFlag(Z80_FLAG_H, on)
  }

  get flagX() {
    return (this.f & Z80_FLAG_X) != 0
  }

  set flagX(on) {
    this.#putFlag(Z80_FLAG_X, on)
  }

  get flagPV() {
    return (this.f & Z80_FLAG_PV) != 0
  }

  set flagPV(on) {
    this.#putFlag(Z80_FLAG_PV, on)
  }

  get flagN() {
    return (this.f & Z80_FLAG_N) != 0
  }

  set flagN(on) {
    this.#putFlag(Z80_FLAG_N, on)
  }

  get flagC() {
    return (this.f & Z80_FLAG_C) != 0
  }

  set flagC(on) {
    this.#putFlag(Z80_FLAG_C, on)
  }
}
