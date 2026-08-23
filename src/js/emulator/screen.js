// The pen bit orders mirror decode_pens in the emulator's gate_array.c, and
// the samples written are hardware colour codes, not pens.
//
// A byte is eight samples, which is two words, and every mode writes exactly
// two of them: four samples at a time is one store where it would otherwise
// be four. The low byte of a word is the sample at the lowest address and so
// the leftmost on screen, the same little-endian order the palette in cpc.js
// reads the machine's colours in.
const TWO_SAMPLES = 0x0101,
  FOUR_SAMPLES = 0x01010101

function writeMode0(byte, palette, words, offset) {
  const left =
      palette[
        ((byte & 0x80) >> 7) | ((byte & 0x08) >> 2) | ((byte & 0x20) >> 3) | ((byte & 0x02) << 2)
      ],
    right =
      palette[
        ((byte & 0x40) >> 6) | ((byte & 0x04) >> 1) | ((byte & 0x10) >> 2) | ((byte & 0x01) << 3)
      ]

  words[offset] = left * FOUR_SAMPLES
  words[offset + 1] = right * FOUR_SAMPLES
}

function writeMode1(byte, palette, words, offset) {
  const first = palette[((byte >> 7) & 1) | (((byte >> 3) & 1) << 1)],
    second = palette[((byte >> 6) & 1) | (((byte >> 2) & 1) << 1)],
    third = palette[((byte >> 5) & 1) | (((byte >> 1) & 1) << 1)],
    fourth = palette[((byte >> 4) & 1) | ((byte & 1) << 1)]

  words[offset] = (first * TWO_SAMPLES) | ((second * TWO_SAMPLES) << 16)
  words[offset + 1] = (third * TWO_SAMPLES) | ((fourth * TWO_SAMPLES) << 16)
}

function writeMode2(byte, palette, words, offset) {
  let low = 0,
    high = 0

  for (let pixel = 0; pixel < 4; pixel++) {
    low |= palette[(byte >> (7 - pixel)) & 1] << (pixel * 8)
    high |= palette[(byte >> (3 - pixel)) & 1] << (pixel * 8)
  }

  words[offset] = low
  words[offset + 1] = high
}

const SAMPLES_PER_BYTE = 8,
  WORDS_PER_BYTE = 2,
  MODE_WRITERS = [writeMode0, writeMode1, writeMode2]

// The wiring is cpc_video_address in the emulator's cpc.c: MA9..MA0 land on
// A10..A1, RA on A13..A11 and MA13..MA12 on A15..A14, so a raster's bytes
// wrap within their 2K slice and a screen never leaves its 16K page.
export class Screen {
  #base
  #bytesPerLine
  #height
  #palette
  #rasters
  #samples
  #samplesPerLine
  #swept
  #words
  #write
  #written

  constructor({ base, width, height, rasters, mode, palette }) {
    this.#base = base
    this.#bytesPerLine = width * 2
    this.#height = height
    this.#palette = palette
    this.#rasters = rasters
    this.#samplesPerLine = this.#bytesPerLine * SAMPLES_PER_BYTE
    this.#samples = new Uint8Array(this.#samplesPerLine * height * rasters)
    this.#swept = new Uint8Array(this.#bytesPerLine * height * rasters)
    this.#words = new Uint32Array(this.#samples.buffer)
    this.#written = new Uint32Array(this.#bytesPerLine * height * rasters)
    this.#write = MODE_WRITERS[mode]
  }

  get lines() {
    return this.#height * this.#rasters
  }

  get samplesPerLine() {
    return this.#samplesPerLine
  }

  get samples() {
    return this.#samples
  }

  get written() {
    return this.#written
  }

  get swept() {
    return this.#swept
  }

  // The row start is the 6845's own VMA' latch, stable all row long, where
  // the running counter is mid-stride between ticks.
  sweep({ latch, column, raster, row, width, vsync }) {
    const swept = this.#swept

    if (row >= vsync) {
      swept.fill(0)
      return
    }

    if (width < 1 || ((latch >> 12) & 3) != this.#base >> 14) {
      swept.fill(1)
      return
    }

    const sectionBase = (latch - row * width) & 0x3ff,
      bytesPerLine = this.#bytesPerLine

    let index = 0
    for (let r = 0; r < this.#height; r++) {
      const rowStart = r * bytesPerLine

      for (let s = 0; s < this.#rasters; s++) {
        for (let byte = 0; byte < bytesPerLine; byte++) {
          const word = ((rowStart + byte) & 0x7ff) >> 1,
            distance = (word - sectionBase) & 0x3ff,
            section = Math.floor(distance / width)

          swept[index++] =
            section < row ||
            (section == row && (s < raster || (s == raster && distance - section * width < column)))
              ? 1
              : 0
        }
      }
    }
  }

  addressAt(sample, line) {
    const row = Math.floor(line / this.#rasters),
      raster = line % this.#rasters,
      byte = Math.floor(sample / SAMPLES_PER_BYTE),
      slice = this.#base | (raster << 11)

    return slice | ((row * this.#bytesPerLine + byte) & 0x7ff)
  }

  render(ram, writes) {
    const write = this.#write,
      palette = this.#palette,
      words = this.#words,
      written = this.#written

    let offset = 0,
      index = 0
    for (let row = 0; row < this.#height; row++) {
      const rowStart = row * this.#bytesPerLine

      for (let raster = 0; raster < this.#rasters; raster++) {
        const slice = this.#base | (raster << 11)

        for (let byte = 0; byte < this.#bytesPerLine; byte++) {
          const address = slice | ((rowStart + byte) & 0x7ff)

          written[index++] = writes[address]
          write(ram[address], palette, words, offset)
          offset += WORDS_PER_BYTE
        }
      }
    }
  }
}
