import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Spectrum } from "./spectrum"
import { createModule } from "./module"

const RAM_SIZE = 0xc000

// The loop asks the browser for the next frame; here the test hands it one,
// so the machine's own time is the only clock in the room.
async function bootMachine() {
  const module = await createModule()

  module._player_boot_spectrum(RAM_SIZE)

  return new Spectrum(module, RAM_SIZE)
}

describe("the time a machine is given", function () {
  let machine = null

  beforeEach(async function () {
    vi.stubGlobal("requestAnimationFrame", () => 1)
    machine = await bootMachine()
  })

  afterEach(function () {
    vi.unstubAllGlobals()
  })

  // A run ends at the retrace past the time owed, so a frame is the grain
  // every answer here can be measured in.
  function advance(milliseconds) {
    const from = machine.ticks

    machine.onAnimationFrame(milliseconds)

    return (machine.ticks - from) / machine.ticksPerFrame
  }

  it("runs one of its milliseconds for each of the reader's", function () {
    expect(advance(16)).toBeCloseTo(1, 1)
  })

  it("runs eight for each when the reader asks for eight", function () {
    machine.speed = 8

    expect(advance(16)).toBeGreaterThan(6)
  })

  it("loses the time a hidden tab owed rather than running it", function () {
    expect(advance(10000)).toBeLessThan(6)
  })

  it("loses it at speed too, rather than running eighty seconds of it", function () {
    machine.speed = 8

    expect(advance(10000)).toBeLessThan(40)
  })
})
