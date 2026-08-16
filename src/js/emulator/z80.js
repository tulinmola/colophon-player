import { Z80_AT_PC, Z80_SIZE } from "./layout"
import { Chip } from "./chip"

export class Z80 extends Chip {
  constructor(module, pointer) {
    super(module, pointer, Z80_SIZE)
  }

  get pc() {
    return this.wordAt(Z80_AT_PC)
  }
}
