import { beforeEach, describe, expect, it } from "vitest"
import { Spectrum } from "./spectrum"
import { createModule } from "./module"

const RAM_SIZE = 0xc000

// The board answers from here and nothing answers below it.
const RAM_BASE = 0x4000

// Never ticked, so it needs no firmware: what is under test is where a store
// lands and what the record makes of one, not anything that runs.
async function bootMachine() {
  const module = await createModule()

  module._player_boot_spectrum(RAM_SIZE)

  return new Spectrum(module, RAM_SIZE)
}

describe("a Spectrum's memory", function () {
  let spectrum = null

  beforeEach(async function () {
    spectrum = await bootMachine()
  })

  it("gives the processor its RAM from &4000", function () {
    spectrum.poke(RAM_BASE, 0x5a)

    expect(spectrum.peek(RAM_BASE)).toBe(0x5a)
    expect(spectrum.ram[0]).toBe(0x5a)
  })

  it("keeps a poke under the ROM out of the RAM, as a write from the processor would", function () {
    const under = spectrum.peek(0)

    spectrum.poke(0, under ^ 0xff)

    expect(spectrum.peek(0)).toBe(under)
  })

  it("holds as much RAM as the machine was built with", function () {
    expect(spectrum.ram.length).toBe(RAM_SIZE)
    expect(spectrum.writes.length).toBe(RAM_SIZE)
  })
})

describe("a Spectrum's shape", function () {
  let spectrum = null

  beforeEach(async function () {
    spectrum = await bootMachine()
  })

  it("runs at its own clock and frame, not the other machine's", function () {
    expect(spectrum.ticksPerMillisecond).toBe(3500)
    expect(spectrum.ticksPerFrame).toBe(69888)
  })

  it("paints a raster its picture is cut from", function () {
    const { raster, left, width, height, scale } = spectrum.picture

    expect(spectrum.framebuffer.length).toBe(raster * 312)
    expect(left + width).toBeLessThanOrEqual(raster)
    expect(scale).toBe(1)
    expect(height).toBe(264)
  })

  it("reads sixteen colours, one for every code the chip drives", function () {
    expect(spectrum.palette.length).toBe(16)
    expect(spectrum.cssColours.length).toBe(16)
  })

  it("wires eight half-rows and leaves the rest of the matrix unlabelled", function () {
    expect(spectrum.keyboardLines).toBe(8)
    expect(spectrum.inscriptions[0]).toEqual(["CAPS", "Caps shift"])
    expect(spectrum.inscriptions[5]).toBeUndefined()
  })
})

describe("the ULA a Spectrum is built around", function () {
  it("derives the beam counters from the T-state it is stood at", async function () {
    const spectrum = await bootMachine(),
      ula = spectrum.ula

    ula.seek(0)
    const opening = { line: ula.line, column: ula.column }

    ula.seek(224)

    // A line on, at the same place along it: the frame is counted from the
    // interrupt, so the column is an offset and not zero.
    expect(ula.line).toBe(opening.line + 1)
    expect(ula.column).toBe(opening.column)
    expect(ula.frameTick).toBe(224)
  })

  it("takes a border only three bits wide, as the port write is", function () {
    return bootMachine().then(function (spectrum) {
      spectrum.ula.border = 0xff

      expect(spectrum.ula.border).toBe(7)
    })
  })
})
