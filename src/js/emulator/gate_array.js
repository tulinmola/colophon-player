import { GATE_ARRAY_AT_INKS, GATE_ARRAY_AT_MODE, GATE_ARRAY_INKS, GATE_ARRAY_SIZE } from "./layout"
import { Chip } from "./chip"

export class GateArray extends Chip {
  constructor(module, pointer) {
    super(module, pointer, GATE_ARRAY_SIZE)
  }

  // Hardware colour codes, one a pen; the seventeenth is the border's.
  get inks() {
    return this.bytesAt(GATE_ARRAY_AT_INKS, GATE_ARRAY_INKS)
  }

  get mode() {
    return this.byteAt(GATE_ARRAY_AT_MODE)
  }
}
