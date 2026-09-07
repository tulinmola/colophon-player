import { KEYBOARD_AT_LINES, KEYBOARD_MAX_LINES, KEYBOARD_SIZE } from "./layout"
import { Struct } from "./struct"

const BITS_A_LINE = 8

// Keys are numbered line * 8 + bit, as keyboard.h numbers a matrix position.
function lineOf(key) {
  return Math.floor(key / BITS_A_LINE)
}

function maskOf(key) {
  return 1 << (key % BITS_A_LINE)
}

export class Keyboard extends Struct {
  #lines

  constructor(module, pointer, capture) {
    super(module, pointer, KEYBOARD_SIZE, capture)
    this.#lines = this.bytesAt(KEYBOARD_AT_LINES, KEYBOARD_MAX_LINES)
  }

  // One byte a line, a set bit meaning released, as the machine reads them.
  get lines() {
    return this.#lines
  }

  pressed(key) {
    return (this.lines[lineOf(key)] & maskOf(key)) == 0
  }

  putKey(key, pressed) {
    const line = lineOf(key),
      mask = maskOf(key),
      was = this.lines[line]

    this.putByteAt(KEYBOARD_AT_LINES + line, pressed ? was & ~mask : was | mask)
  }
}
