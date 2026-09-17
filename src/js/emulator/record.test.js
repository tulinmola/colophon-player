import { beforeEach, describe, expect, it } from "vitest"
import { Cpc } from "./cpc"
import { Spectrum } from "./spectrum"
import { createModule } from "./module"
import { readFileSync } from "node:fs"

// The record is replayed rather than kept whole, so these run real firmware:
// what is under test is that a moment stood at twice is the same moment.
function firmware(name) {
  return new Uint8Array(readFileSync(new URL(`../../public/roms/${name}`, import.meta.url)))
}

async function bootCpc() {
  const module = await createModule()

  module.HEAPU8.set(firmware("cpc6128.rom"), module._player_rom())
  module._player_boot_cpc(0x20000, false)

  return new Cpc(module, 0x20000, false)
}

async function bootSpectrum() {
  const module = await createModule()

  module.HEAPU8.set(firmware("spectrum48.rom"), module._player_rom())
  module._player_boot_spectrum(0xc000)

  return new Spectrum(module, 0xc000)
}

// Longer than any instruction either machine runs, contention included, so a
// landing "at the next boundary" can be told from a landing anywhere else.
const LONGEST_INSTRUCTION = 64

// Both firmwares answer the interrupt here, once a frame or more.
const INTERRUPT_HANDLER = 0x38

// A range each firmware writes every frame: a CPC's stack and system area, a
// Spectrum's system variables.
const MACHINES = [
  ["a CPC", bootCpc, [0xb100, 0xbfff]],
  ["a Spectrum", bootSpectrum, [0x5c00, 0x5cff]]
]

for (const [name, boot, [from, until]] of MACHINES) {
  describe(`the record of ${name}`, function () {
    let machine = null

    beforeEach(async function () {
      machine = await boot()
      machine.runFrames(40)
    })

    it("counts ticks and frames as it runs", function () {
      const ticks = machine.ticks,
        frame = machine.frame

      machine.runFrames(2)

      expect(machine.ticks).toBeGreaterThan(ticks)
      expect(machine.frame).toBeGreaterThan(frame)
    })

    it("keeps a history reaching back from where it stands", function () {
      expect(machine.historyUntil).toBe(machine.ticks)
      expect(machine.historyFrom).toBeLessThan(machine.historyUntil)
    })

    // A machine stopped mid-instruction has a PC that belongs to no
    // instruction anyone can name, so a moment stood at is the boundary at or
    // just after the tick asked for — never before it, never a whole
    // instruction late.
    it("stands at the boundary at or just after the moment asked for", function () {
      const at = machine.ticks

      machine.runFrames(3)
      expect(machine.ticks).toBeGreaterThan(at)

      machine.rewind(at)

      expect(machine.ticks).toBeGreaterThanOrEqual(at)
      expect(machine.ticks - at).toBeLessThan(LONGEST_INSTRUCTION)
    })

    it("replays to the same machine twice over", function () {
      const at = machine.ticks

      machine.runFrames(3)
      machine.rewind(at)
      const once = { pc: machine.z80.pc, sp: machine.z80.sp, af: machine.z80.af }

      machine.returnToNow()
      machine.rewind(at)

      expect({ pc: machine.z80.pc, sp: machine.z80.sp, af: machine.z80.af }).toEqual(once)
    })

    it("steps back behind the instruction it stepped forward over", function () {
      const at = machine.ticks

      machine.step()
      expect(machine.ticks).toBeGreaterThan(at)

      machine.stepBack()

      expect(machine.ticks).toBeLessThanOrEqual(at)
      expect(at - machine.ticks).toBeLessThan(LONGEST_INSTRUCTION)
    })

    it("steps back roughly a frame, and never forwards", function () {
      const at = machine.ticks,
        frame = machine.frame

      machine.stepBackFrame()

      expect(machine.ticks).toBeLessThan(at)
      expect(machine.frame).toBeLessThanOrEqual(frame)
      expect(at - machine.ticks).toBeLessThan(machine.ticksPerFrame * 2)
    })

    it("returns to now after standing in the past", function () {
      const now = machine.historyUntil

      machine.rewind(machine.historyFrom)
      expect(machine.ticks).toBeLessThan(now)

      machine.returnToNow()

      expect(machine.ticks).toBeGreaterThanOrEqual(now)
      expect(machine.ticks - now).toBeLessThan(LONGEST_INSTRUCTION)
    })

    it("names the instruction that last wrote a byte", function () {
      // Somewhere the firmware is writing while it boots.
      let found = null

      for (let at = 0; at < machine.ram.length && !found; at += 1) {
        if (machine.writes[at] > 0) {
          found = machine.findWrite(at, machine.ticks)
        }
      }

      expect(found).not.toBeNull()
      expect(found.tick).toBeLessThanOrEqual(machine.ticks)
      expect(found.value).toBeGreaterThanOrEqual(0)
    })

    it("stamps a byte it writes with the frame it was written in", function () {
      const at = 0x100

      machine.writeRam(at, 0x5a)
      expect(machine.ram[at]).toBe(0x5a)
    })

    it("keeps a poke, and the record it leaves, when standing still", function () {
      const at = machine.ticks

      machine.poke(0x4000, 0x5a)
      machine.runFrames(1)
      machine.rewind(at)

      expect(machine.peek(0x4000)).toBe(0x5a)
    })
  })

  describe(`a frame step on ${name}`, function () {
    let machine = null

    // A Spectrum's frame boundary falls some 160 T-states after its
    // interrupt, so a step begun between the two meets the boundary first and
    // never the interrupt. Each step here begins from a boundary.
    beforeEach(async function () {
      machine = await boot()
      machine.runFrames(150)
      machine.stepFrame()
    })

    it("stops on an execute breakpoint", function () {
      machine.breakpoints.add(INTERRUPT_HANDLER, "execute")
      machine.stepFrame()

      expect(machine.trap).toEqual({ kind: "execute", address: INTERRUPT_HANDLER })
    })

    it("stops on a write watch", function () {
      machine.breakpoints.add(from, "write", { until })
      machine.stepFrame()

      expect(machine.trap?.kind).toBe("write")
      expect(machine.trap.address).toBeGreaterThanOrEqual(from)
      expect(machine.trap.address).toBeLessThanOrEqual(until)
    })
  })
}
