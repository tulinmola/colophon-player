import { TAPE_AT_LEVEL, TAPE_AT_PLAYING, TAPE_AT_SOURCE, TAPE_SIZE } from "./layout"
import { Struct } from "./struct"
import { readProblem } from "./read_problem"

export class Tape extends Struct {
  #module
  #name = ""

  constructor(module, pointer, capture) {
    super(module, pointer, TAPE_SIZE, capture)
    this.#module = module
  }

  // No source is no tape in the deck, which is how tape_loaded reads it.
  get loaded() {
    return this.longAt(TAPE_AT_SOURCE) != 0
  }

  get playing() {
    return this.boolAt(TAPE_AT_PLAYING)
  }

  get level() {
    return this.boolAt(TAPE_AT_LEVEL)
  }

  get name() {
    return this.#name
  }

  get at() {
    return this.#module._player_tape_at()
  }

  get length() {
    return this.#module._player_tape_length()
  }

  get capacity() {
    return this.#module._player_tape_capacity()
  }

  get problem() {
    const at = this.#module._player_tape_problem()

    return readProblem(this.#module, at)
  }

  // An image with no room for it is never written: the buffer it would land
  // in is the tape the reel may still be turning.
  insert(bytes, name) {
    const module = this.#module

    if (bytes.length <= this.capacity) {
      module.HEAPU8.set(bytes, module._player_tape_image())
    }

    if (module._player_tape_insert(bytes.length)) {
      this.#name = name
      return true
    }

    if (!this.loaded) {
      this.#name = ""
    }

    return false
  }

  eject() {
    this.#module._player_tape_eject()
    this.#name = ""
  }

  play() {
    this.#module._player_tape_play()
  }

  stop() {
    this.#module._player_tape_stop()
  }
}
