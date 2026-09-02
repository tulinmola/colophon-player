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

function linear({ base, width, height, wrap }) {
  const addresses = new Uint32Array(width * height)

  let index = 0
  for (let line = 0; line < height; line++) {
    const lineStart = base + line * width

    for (let column = 0; column < width; column++) {
      addresses[index++] = (lineStart + column) % wrap
    }
  }

  return addresses
}

function columns({ base, width, height, wrap }) {
  const addresses = new Uint32Array(width * height)

  for (let column = 0; column < width; column++) {
    const columnStart = base + column * height

    for (let line = 0; line < height; line++) {
      addresses[line * width + column] = (columnStart + line) % wrap
    }
  }

  return addresses
}

function addressesFor({ reading, base, width, height, rasters, wrap, video }) {
  switch (reading) {
    case "linear":
      return linear({ base, width, height, wrap })

    case "columns":
      return columns({ base, width, height, wrap })

    default:
      return video.addresses({ base, width, height, rasters })
  }
}

export class Screen {
  #addresses
  #palette
  #ram
  #samples
  #samplesPerLine
  #swept
  #video
  #width
  #words
  #write
  #written

  constructor({ reading, base, width, height, rasters, mode, palette, ram, video }) {
    const wrap = ram.length,
      addresses = addressesFor({ reading, base, width, height, rasters, wrap, video })

    this.#addresses = addresses
    this.#palette = palette
    this.#ram = ram
    this.#samples = new Uint8Array(addresses.length * SAMPLES_PER_BYTE)
    this.#samplesPerLine = width * SAMPLES_PER_BYTE
    this.#swept = new Uint8Array(addresses.length)
    this.#video = video
    this.#width = width
    this.#words = new Uint32Array(this.#samples.buffer)
    this.#write = MODE_WRITERS[mode]
    this.#written = new Uint32Array(addresses.length)
  }

  get lines() {
    return this.#addresses.length / this.#width
  }

  get samples() {
    return this.#samples
  }

  get samplesPerLine() {
    return this.#samplesPerLine
  }

  get swept() {
    return this.#swept
  }

  get written() {
    return this.#written
  }

  addressAt(sample, line) {
    return this.#addresses[line * this.#width + Math.floor(sample / SAMPLES_PER_BYTE)]
  }

  sweep() {
    this.#video.sweep(this.#addresses, this.#swept)
  }

  render(writes) {
    const addresses = this.#addresses,
      palette = this.#palette,
      ram = this.#ram,
      words = this.#words,
      write = this.#write,
      written = this.#written

    let offset = 0
    for (let index = 0; index < addresses.length; index++) {
      const address = addresses[index]

      written[index] = writes[address]
      write(ram[address], palette, words, offset)
      offset += WORDS_PER_BYTE
    }
  }
}
