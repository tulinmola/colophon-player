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

function load(machine, program, at) {
  for (const [offset, byte] of program.entries()) {
    machine.poke(at + offset, byte)
  }

  machine.z80.pc = at
}

// Longer than any instruction either machine runs, contention included, so a
// landing "at the next boundary" can be told from a landing anywhere else.
const LONGEST_INSTRUCTION = 64

// Both firmwares answer the interrupt here, once a frame or more.
const INTERRUPT_HANDLER = 0x38

// EI, HALT, and a jump back to the EI: the jump runs once an interrupt, and
// the halted processor fetches it every four T-states between them.
const IDLE_LOOP = [0xfb, 0x76, 0x18, 0xfd],
  IDLE_LOOP_AT = 0x9000,
  RESUMED_AT = IDLE_LOOP_AT + 2

// NOP and a jump back to it, where a Spectrum's ULA contends: the jump ends on
// a cycle whose address the ULA weighs, so the processor is held at the NOP
// for as many T-states as the beam asks.
const TIGHT_LOOP = [0x00, 0x18, 0xfd],
  TIGHT_LOOP_AT = 0x6000,
  TIGHT_LOOP_T_STATES = 16

// A loop calling a routine on a stack of its own, and the routine calling
// itself twice more: LD SP,&9F00, LD B,3, CALL &900A, JR back to the start,
// then DJNZ past a RET to a CALL &900A and a RET of its own.
const NESTED_CALLS = [
    0x31, 0x00, 0x9f, 0x06, 0x03, 0xcd, 0x0a, 0x90, 0x18, 0xf6, 0x10, 0x01, 0xc9, 0xcd, 0x0a, 0x90,
    0xc9
  ],
  NESTED_CALLS_AT = 0x9000,
  CALLING_AT = 0x9003,
  RETURNED_TO = 0x9008,
  CALLED_AT = 0x900a,
  CALLED_AGAIN_AT = 0x900d,
  STACK = 0x9f00

// A call into the instruction after it, which returns there and runs again:
// LD SP,&9F00, LD HL,&9000, PUSH HL, CALL &900A, then NOP and RET, which the
// second time returns to the start through the word pushed.
const RETURN_INTO_ITSELF = [0x31, 0x00, 0x9f, 0x21, 0x00, 0x90, 0xe5, 0xcd, 0x0a, 0x90, 0x00, 0xc9],
  RETURN_INTO_ITSELF_AT = 0x9000,
  RETURNED_INTO_AT = 0x900a

// A loop of instructions with operands of every kind, two of which read a byte
// as data: LD IX,&9010, LD A,&42, LD A,(&9010), BIT 0,(IX+0), whose opcode
// follows its displacement and carries no M1, and JR back to the start.
const READING_LOOP = [
    0xdd, 0x21, 0x10, 0x90, 0x3e, 0x42, 0x3a, 0x10, 0x90, 0xdd, 0xcb, 0x00, 0x46, 0x18, 0xf1
  ],
  READING_LOOP_AT = 0x9000,
  READ_AS_DATA = 0x9010

// LD A,(&9001), which reads its own operand as data too, and JR back to it.
const READING_ITSELF = [0x3a, 0x01, 0x90, 0x18, 0xfb],
  READING_ITSELF_AT = 0x9000,
  READ_OF_ITSELF = 0x9001

// A range each firmware writes every frame — a CPC's stack and system area, a
// Spectrum's system variables — and how many interrupts a frame it answers.
const MACHINES = [
  ["a CPC", bootCpc, [0xb100, 0xbfff], 6],
  ["a Spectrum", bootSpectrum, [0x5c00, 0x5cff], 1]
]

for (const [name, boot, [from, until], interrupts] of MACHINES) {
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

  describe(`the profiling frames of ${name}`, function () {
    let machine = null

    beforeEach(async function () {
      machine = await boot()
      machine.runFrames(40)
    })

    it("are cut each time the start is about to run, and never while the processor is halted", function () {
      load(machine, IDLE_LOOP, IDLE_LOOP_AT)
      machine.profiling = { start: RESUMED_AT, mode: "pass" }
      machine.runFrames(10)

      const count = machine.profilingCuts().length

      expect(count).toBeGreaterThanOrEqual(10 * interrupts - 1)
      expect(count).toBeLessThanOrEqual(10 * interrupts + 1)
    })

    it("are cut once an instruction, however long the processor is held before it", function () {
      load(machine, TIGHT_LOOP, TIGHT_LOOP_AT)
      machine.profiling = { start: TIGHT_LOOP_AT, mode: "pass" }
      machine.runFrames(1)

      const cuts = machine.profilingCuts()

      for (let index = 1; index < cuts.length; index++) {
        expect(cuts[index].tick - cuts[index - 1].tick).toBeGreaterThanOrEqual(TIGHT_LOOP_T_STATES)
      }
    })

    it("stand the machine on the instruction each one begins with", function () {
      load(machine, IDLE_LOOP, IDLE_LOOP_AT)
      machine.profiling = { start: RESUMED_AT, mode: "pass" }
      machine.runFrames(10)

      const [, , third] = machine.profilingCuts()

      machine.rewind(third.tick)

      expect(machine.ticks).toBe(third.tick)
      expect(machine.z80.pc).toBe(RESUMED_AT)
    })

    it("are cut once, however often the record replays them", function () {
      load(machine, IDLE_LOOP, IDLE_LOOP_AT)
      machine.profiling = { start: RESUMED_AT, mode: "pass" }
      machine.runFrames(10)

      const before = machine.profilingCuts()

      machine.rewind(before[2].tick)
      machine.runFrames(5)
      const after = machine.profilingCuts()

      expect(after.length).toBeGreaterThan(3)
      expect(after).toEqual(before.slice(0, after.length))
    })

    it("begin afresh when the start moves, or how they end", function () {
      load(machine, IDLE_LOOP, IDLE_LOOP_AT)
      machine.profiling = { start: RESUMED_AT, mode: "pass" }
      machine.runFrames(10)
      machine.profiling = { start: IDLE_LOOP_AT, mode: "pass" }

      expect(machine.profilingCuts()).toEqual([])

      machine.runFrames(10)
      machine.profiling = { start: IDLE_LOOP_AT, mode: "call" }

      expect(machine.profilingCuts()).toEqual([])
    })

    it("as calls, run from where the outermost call begins to where it returns", function () {
      load(machine, NESTED_CALLS, NESTED_CALLS_AT)
      machine.profiling = { start: CALLED_AT, mode: "call" }
      machine.runFrames(2)

      const cuts = machine.profilingCuts(),
        [entered, returned] = cuts,
        { ticks } = machine.profile(entered.tick, returned.tick)

      expect(cuts.length).toBeGreaterThan(20)
      expect(cuts.map(cut => cut.opens)).toEqual(cuts.map((cut, index) => index % 2 == 0))
      expect(ticks[CALLED_AGAIN_AT]).toBeGreaterThan(0)
      expect(ticks[RETURNED_TO]).toBe(0)

      machine.rewind(entered.tick)
      expect([machine.z80.pc, machine.z80.sp]).toEqual([CALLED_AT, STACK - 2])

      machine.rewind(returned.tick)
      expect([machine.z80.pc, machine.z80.sp]).toEqual([RETURNED_TO, STACK])
    })

    it("as calls, end and begin again on the one instruction a call returns to its own start", function () {
      load(machine, RETURN_INTO_ITSELF, RETURN_INTO_ITSELF_AT)
      machine.profiling = { start: RETURNED_INTO_AT, mode: "call" }
      machine.runFrames(1)

      const cuts = machine.profilingCuts(),
        [, returned] = cuts

      expect(cuts.slice(0, 6).map(cut => cut.opens)).toEqual([true, true, false, true, true, false])

      machine.rewind(returned.tick)
      expect([machine.z80.pc, machine.z80.sp]).toEqual([RETURNED_INTO_AT, STACK - 2])
    })

    it("as calls, are open again where the record is cut back inside one", function () {
      load(machine, NESTED_CALLS, NESTED_CALLS_AT)
      machine.profiling = { start: CALLED_AT, mode: "call" }
      machine.runFrames(2)

      const before = machine.profilingCuts()

      machine.rewind(before[2].tick + 8)
      machine.runFrames(1)
      const after = machine.profilingCuts()

      expect(after.length).toBeGreaterThan(3)
      expect(after).toEqual(before.slice(0, after.length))
    })

    it("as stretches, run from where each begins to its end, and leave out what runs between", function () {
      load(machine, NESTED_CALLS, NESTED_CALLS_AT)
      machine.profiling = { start: CALLING_AT, mode: "until", end: RETURNED_TO }
      machine.runFrames(2)

      const cuts = machine.profilingCuts(),
        [begun, ended] = cuts,
        { ticks } = machine.profile(begun.tick, ended.tick)

      expect(cuts.length).toBeGreaterThan(20)
      expect(cuts.map(cut => cut.opens)).toEqual(cuts.map((cut, index) => index % 2 == 0))
      expect(ticks[CALLED_AT]).toBeGreaterThan(0)
      expect(ticks[NESTED_CALLS_AT]).toBe(0)

      machine.rewind(begun.tick)
      expect(machine.z80.pc).toBe(CALLING_AT)

      machine.rewind(ended.tick)
      expect(machine.z80.pc).toBe(RETURNED_TO)
    })

    it("as stretches whose end is never reached, end where the next begins", function () {
      load(machine, NESTED_CALLS, NESTED_CALLS_AT)
      machine.profiling = { start: CALLING_AT, mode: "until", end: NESTED_CALLS_AT + 1 }
      machine.runFrames(2)

      const cuts = machine.profilingCuts()

      expect(cuts.length).toBeGreaterThan(20)
      expect(cuts.every(cut => cut.opens)).toBe(true)
    })

    it("are counted tick by tick on replay, and leave the machine standing where it stood", function () {
      load(machine, IDLE_LOOP, IDLE_LOOP_AT)
      machine.profiling = { start: RESUMED_AT, mode: "pass" }
      machine.runFrames(10)

      const cuts = machine.profilingCuts(),
        [, , third, fourth] = cuts

      machine.rewind(cuts[6].tick + 100)

      const standing = {
          ticks: machine.ticks,
          pc: machine.z80.pc,
          ram: machine.ram.slice(),
          picture: machine.framebuffer.slice(),
          heat: machine.writes.slice(),
          until: machine.historyUntil,
          cuts: machine.profilingCuts()
        },
        { ticks, halted } = machine.profile(third.tick, fourth.tick),
        counted = ticks.reduce((sum, spent) => sum + spent, 0) + halted

      expect(counted).toBe(fourth.tick - third.tick)
      expect(halted).toBeGreaterThan(0)
      expect(ticks[RESUMED_AT]).toBeGreaterThan(0)
      expect(ticks[INTERRUPT_HANDLER]).toBeGreaterThan(0)
      expect({
        ticks: machine.ticks,
        pc: machine.z80.pc,
        ram: machine.ram.slice(),
        picture: machine.framebuffer.slice(),
        heat: machine.writes.slice(),
        until: machine.historyUntil,
        cuts: machine.profilingCuts()
      }).toEqual(standing)
    })

    it("count each tick against the instruction a step would", function () {
      load(machine, TIGHT_LOOP, TIGHT_LOOP_AT)
      machine.profiling = { start: TIGHT_LOOP_AT, mode: "pass" }
      machine.runFrames(1)

      const cuts = machine.profilingCuts(),
        begins = cuts.at(-3).tick,
        ends = cuts.at(-2).tick,
        { ticks } = machine.profile(begins, ends),
        stepped = new Map()

      machine.rewind(begins)

      while (machine.ticks < ends) {
        const pc = machine.z80.pc,
          before = machine.ticks

        machine.step()
        stepped.set(pc, (stepped.get(pc) ?? 0) + machine.ticks - before)
      }

      for (const [pc, spent] of stepped) {
        expect(ticks[pc]).toBe(spent)
      }
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

    it("runs past a read watch over an instruction's own bytes", function () {
      const lastByte = READING_LOOP_AT + READING_LOOP.length - 1

      load(machine, READING_LOOP, READING_LOOP_AT)
      machine.breakpoints.add(READING_LOOP_AT, "read", { until: lastByte })
      machine.stepFrame()

      expect(machine.trap).toBeNull()
    })

    it("stops on a read watch over a byte read as data", function () {
      load(machine, READING_LOOP, READING_LOOP_AT)
      machine.breakpoints.add(READ_AS_DATA, "read")
      machine.stepFrame()

      expect(machine.trap).toEqual({ kind: "read", address: READ_AS_DATA })
    })

    it("stops on a read watch over an operand an instruction also reads as data", function () {
      load(machine, READING_ITSELF, READING_ITSELF_AT)
      machine.breakpoints.add(READ_OF_ITSELF, "read")
      machine.stepFrame()

      expect(machine.trap).toEqual({ kind: "read", address: READ_OF_ITSELF })
    })
  })
}
