// The pen bit orders mirror decode_pens in the emulator's gate_array.c, and
// the samples written are hardware colour codes, not pens.
function writeMode0(byte, palette, samples, offset) {
  const left =
      palette[
        ((byte & 0x80) >> 7) | ((byte & 0x08) >> 2) | ((byte & 0x20) >> 3) | ((byte & 0x02) << 2)
      ],
    right =
      palette[
        ((byte & 0x40) >> 6) | ((byte & 0x04) >> 1) | ((byte & 0x10) >> 2) | ((byte & 0x01) << 3)
      ]

  samples.fill(left, offset, offset + 4)
  samples.fill(right, offset + 4, offset + 8)
}

function writeMode1(byte, palette, samples, offset) {
  for (let pixel = 0; pixel < 4; pixel++) {
    const pen = ((byte >> (7 - pixel)) & 1) | (((byte >> (3 - pixel)) & 1) << 1),
      colour = palette[pen],
      position = offset + pixel * 2

    samples[position] = colour
    samples[position + 1] = colour
  }
}

function writeMode2(byte, palette, samples, offset) {
  for (let pixel = 0; pixel < 8; pixel++) {
    samples[offset + pixel] = palette[(byte >> (7 - pixel)) & 1]
  }
}

const SAMPLES_PER_BYTE = 8,
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
  #write

  constructor({ base, width, height, rasters, mode, palette }) {
    this.#base = base
    this.#bytesPerLine = width * 2
    this.#height = height
    this.#palette = palette
    this.#rasters = rasters
    this.#samplesPerLine = this.#bytesPerLine * SAMPLES_PER_BYTE
    this.#samples = new Uint8Array(this.#samplesPerLine * height * rasters)
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

  render(ram) {
    const write = this.#write,
      palette = this.#palette,
      samples = this.#samples

    let offset = 0
    for (let row = 0; row < this.#height; row++) {
      const rowStart = row * this.#bytesPerLine

      for (let raster = 0; raster < this.#rasters; raster++) {
        const slice = this.#base | (raster << 11)

        for (let byte = 0; byte < this.#bytesPerLine; byte++) {
          const address = slice | ((rowStart + byte) & 0x7ff)

          write(ram[address], palette, samples, offset)
          offset += SAMPLES_PER_BYTE
        }
      }
    }
  }
}
