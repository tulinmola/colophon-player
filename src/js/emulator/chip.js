export class Chip {
  #state

  // The module's memory never grows, so the window onto the struct is taken
  // once and holds for the life of the machine.
  constructor(module, pointer, size) {
    this.#state = new DataView(module.HEAPU8.buffer, pointer, size)
  }

  byteAt(offset) {
    return this.#state.getUint8(offset)
  }

  wordAt(offset) {
    return this.#state.getUint16(offset, true)
  }

  boolAt(offset) {
    return this.#state.getUint8(offset) != 0
  }

  bytesAt(offset, length) {
    const at = this.#state.byteOffset + offset
    return new Uint8Array(this.#state.buffer, at, length)
  }
}
