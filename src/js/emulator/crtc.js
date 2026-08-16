import {
  CRTC_AT_C0,
  CRTC_AT_C4,
  CRTC_AT_C9,
  CRTC_AT_REGISTERS,
  CRTC_REGISTERS,
  CRTC_SIZE
} from "./layout"
import { Chip } from "./chip"

export class Crtc extends Chip {
  constructor(module, pointer) {
    super(module, pointer, CRTC_SIZE)
  }

  get registers() {
    return this.bytesAt(CRTC_AT_REGISTERS, CRTC_REGISTERS)
  }

  get c0() {
    return this.byteAt(CRTC_AT_C0)
  }

  get c4() {
    return this.byteAt(CRTC_AT_C4)
  }

  get c9() {
    return this.byteAt(CRTC_AT_C9)
  }
}
