// The board's video address wiring, cpc_video_address in the emulator's
// cpc.c: MA9..MA0 land on A10..A1, RA on A13..A11 and MA13..MA12 on A15..A14.
// The counter is fourteen bits and MA10, MA11 reach nothing.
const MA_BITS = 0x3fff

// The video hardware reads the base 64K and nothing else, whatever the
// processor is looking at (cpc.c, cpc_tick).
const VIDEO_SPACE = 0x10000

export class CpcVideo {
  #crtc
  #markedAt = new Uint32Array(VIDEO_SPACE)
  #sweeps = 0

  constructor(crtc) {
    this.#crtc = crtc
  }

  addresses({ base, width, height, rasters }) {
    const firstCharacter = ((base & 0xc000) >> 2) | ((base & 0x7fe) >> 1),
      firstByte = base & 1,
      addresses = new Uint32Array(width * height)

    let index = 0
    for (let line = 0; line < height; line++) {
      const raster = line % rasters,
        rowStart = firstByte + Math.floor(line / rasters) * width

      for (let column = 0; column < width; column++) {
        const offset = rowStart + column,
          ma = (firstCharacter + (offset >> 1)) & MA_BITS

        addresses[index++] = this.#addressOf(ma, raster) | (offset & 1)
      }
    }

    return addresses
  }

  sweep(addresses, swept) {
    const crtc = this.#crtc

    if (crtc.c4 >= crtc.registers[7]) {
      swept.fill(0)
      return
    }

    const passed = ++this.#sweeps,
      coming = ++this.#sweeps
    this.#mark(passed, coming)

    const markedAt = this.#markedAt

    let onScreen = false
    for (let index = 0; index < addresses.length; index++) {
      const address = addresses[index],
        mark = address < VIDEO_SPACE ? markedAt[address] : 0

      swept[index] = mark == passed ? 1 : 0
      onScreen ||= mark == passed || mark == coming
    }

    if (!onScreen) {
      swept.fill(1)
    }
  }

  #addressOf(ma, raster) {
    return ((ma & 0x3000) << 2) | ((raster & 7) << 11) | ((ma & 0x3ff) << 1)
  }

  #mark(passed, coming) {
    const crtc = this.#crtc,
      registers = crtc.registers,
      width = registers[1],
      rows = registers[6],
      rasters = registers[9] + 1,
      start = this.#displayStart(),
      markedAt = this.#markedAt,
      // C0 counts on to R0 through the border, past the characters R1 shows.
      displayed =
        crtc.c4 >= rows
          ? rows * rasters * width
          : (crtc.c4 * rasters + crtc.c9) * width + Math.min(crtc.c0, width)

    let character = 0
    for (let row = 0; row < rows; row++) {
      const rowStart = start + row * width

      for (let raster = 0; raster < rasters; raster++) {
        for (let column = 0; column < width; column++) {
          const stamp = character < displayed ? passed : coming,
            address = this.#addressOf((rowStart + column) & MA_BITS, raster)

          markedAt[address] = stamp
          markedAt[address | 1] = stamp
          character++
        }
      }
    }
  }

  // VMA' captures VMA where C0 meets R1 on a row's last raster line, so for
  // the rest of that line it already stands at the row after (crtc.c).
  #displayStart() {
    const crtc = this.#crtc,
      registers = crtc.registers,
      latched = crtc.c9 == registers[9] && crtc.c0 > registers[1] ? crtc.c4 + 1 : crtc.c4

    return (crtc.vma_ - latched * registers[1]) & MA_BITS
  }
}
