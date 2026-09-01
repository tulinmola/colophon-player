export class Chip {
  #capture
  #state

  // The module's memory never grows, so the window onto the struct is taken
  // once and holds for the life of the machine.
  constructor(module, pointer, size, capture) {
    this.#capture = capture
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

  putByteAt(offset, value) {
    this.#state.setUint8(offset, value)
    this.#capture()
  }

  putWordAt(offset, value) {
    this.#state.setUint16(offset, value, true)
    this.#capture()
  }

  putBoolAt(offset, on) {
    this.#state.setUint8(offset, on ? 1 : 0)
    this.#capture()
  }

  bytesAt(offset, length) {
    const at = this.#state.byteOffset + offset
    return new Uint8Array(this.#state.buffer, at, length)
  }
}
