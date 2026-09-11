import { CPC_6128, SPECTRUM_48, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

const CPC_6128_NAMED = {
  element: "colophon-cpc",
  attributes: 'model="cpc6128" symbols="/abduction.noi"'
}

const MACHINES = [
  ["a CPC", CPC_6128],
  ["a Spectrum", SPECTRUM_48]
]

const ORIGIN = 0x4000,
  NOP = [0x00],
  LD_HL_1234 = [0x21, 0x34, 0x12],
  JP_ORIGIN = [0xc3, 0x00, 0x40],
  CALL_4010 = [0xcd, 0x10, 0x40],
  JR_HERE = [0x18, 0xfe],
  LDIR = [0xed, 0xb0],
  PUSH_BC = [0xc5],
  POP_BC = [0xc1],
  POP_HL = [0xe1],
  RET = [0xc9]

const LOOP = [[ORIGIN, [...NOP, ...NOP, ...NOP, ...NOP, ...LD_HL_1234, ...JP_ORIGIN]]],
  CALLING = [
    [ORIGIN, [...CALL_4010, ...NOP, ...JR_HERE]],
    [0x4010, [...PUSH_BC, ...NOP, ...POP_BC, ...RET]]
  ],
  NEVER_RETURNING = [
    [ORIGIN, [...CALL_4010, ...NOP]],
    [0x4010, [...POP_HL, ...JR_HERE]]
  ],
  COPYING = [[ORIGIN, [...LDIR, ...NOP]]]

const FOUR_LINES = '<colophon-disassembly lines="4"></colophon-disassembly>',
  FIXED_AT_LD_HL = '<colophon-disassembly lines="4" base="&4004" fixed></colophon-disassembly>'

async function placeProgram(element, pieces = LOOP) {
  await element.evaluate(
    function (host, [origin, placed]) {
      const machine = host.machine

      for (const [at, bytes] of placed) {
        for (let offset = 0; offset < bytes.length; offset++) {
          machine.poke(at + offset, bytes[offset])
        }
      }

      machine.z80.iff1 = false
      machine.z80.halted = false
      machine.z80.pc = origin
      machine.changed()
    },
    [ORIGIN, pieces]
  )
}

function step(element, times = 1) {
  return element.evaluate(function (host, count) {
    for (let taken = 0; taken < count; taken++) {
      host.machine.step()
    }
  }, times)
}

function marks(element) {
  return element.evaluate(host => host.machine.breakpoints.all())
}

function listed(page) {
  return page.locator("colophon-disassembly .instruction:not([hidden]) .at")
}

function current(page) {
  return page.locator("colophon-disassembly .instruction.current .at")
}

test("a listing turns to the next page when the processor leaves it", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, FOUR_LINES)

  await placeProgram(element)
  await expect(listed(page)).toHaveText(["&4000", "&4001", "&4002", "&4003"])
  await expect(current(page)).toHaveText("&4000")

  await step(element, 3)
  await expect(listed(page).first()).toHaveText("&4000")
  await expect(current(page)).toHaveText("&4003")

  await step(element)
  await expect(listed(page).nth(0)).toHaveText("&4004")
  await expect(listed(page).nth(1)).toHaveText("&4007")
  await expect(current(page)).toHaveText("&4004")

  await step(element)
  await expect(listed(page).first()).toHaveText("&4004")
  await expect(current(page)).toHaveText("&4007")

  await step(element)
  await expect(listed(page).first()).toHaveText("&4000")
  await expect(current(page)).toHaveText("&4000")
})

test("the wheel scrolls both ways, and reads back to where an instruction begins", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, FOUR_LINES),
    base = page.locator('colophon-disassembly input[name="base"]')

  await placeProgram(element)
  await page.locator("colophon-disassembly .listing").hover()

  for (const top of ["&4001", "&4002", "&4003", "&4004", "&4007"]) {
    await page.mouse.wheel(0, 100)
    await expect(listed(page).first()).toHaveText(top)
  }

  await expect(base).toHaveValue("&4007")
  await expect(current(page)).toHaveCount(0)

  await page.mouse.wheel(0, -100)
  await expect(listed(page).first()).toHaveText("&4004")

  await page.mouse.wheel(0, -100)
  await expect(listed(page).first()).toHaveText("&4003")

  await element.evaluate(function (host, at) {
    host.machine.poke(at, 0x00)
    host.machine.changed()
  }, ORIGIN + 0x20)
  await expect(listed(page).first()).toHaveText("&4003")
})

test("a base is only where a listing begins", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, FOUR_LINES)

  await page.locator("colophon-disassembly").evaluate(panel => panel.setAttribute("base", "&4004"))
  await expect(listed(page).first()).toHaveText("&4004")

  await placeProgram(element)
  await expect(listed(page).first()).toHaveText("&4000")
})

test("a fixed listing stays put and marks the processor only where it stands exactly", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, FIXED_AT_LD_HL)

  await placeProgram(element)
  await expect(listed(page).first()).toHaveText("&4004")
  await expect(current(page)).toHaveCount(0)

  await step(element, 4)
  await expect(current(page)).toHaveText("&4004")

  await step(element)
  await expect(current(page)).toHaveText("&4007")

  await step(element)
  await expect(listed(page).first()).toHaveText("&4004")
  await expect(current(page)).toHaveCount(0)
})

test("the target brings a listing back to the program counter, fixed or not", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, FIXED_AT_LD_HL),
    target = page.getByRole("button", { name: "Go to the program counter" })

  await placeProgram(element)
  await expect(listed(page).first()).toHaveText("&4004")

  await target.click()
  await expect(listed(page).first()).toHaveText("&4000")
  await expect(current(page)).toHaveText("&4000")

  await page.locator("colophon-disassembly .listing").hover()
  await page.mouse.wheel(0, 100)
  await expect(listed(page).first()).toHaveText("&4001")

  await target.click()
  await expect(listed(page).first()).toHaveText("&4000")
})

test("the options move a listing to a name and fix it there", async function ({ page }) {
  const element = await bootStopped(
      page,
      CPC_6128_NAMED,
      "<colophon-disassembly></colophon-disassembly>"
    ),
    base = page.locator('colophon-disassembly input[name="base"]')

  await placeProgram(element)
  await page.locator("colophon-disassembly colophon-options button").click()
  await base.fill("_game_step")
  await base.press("Enter")
  await expect(listed(page).first()).toHaveText("&022B")

  await page.locator("colophon-disassembly label.toggle", { hasText: "Fixed" }).click()
  await step(element)
  await expect(listed(page).first()).toHaveText("&022B")
})

test("step over runs a call through to the instruction after it, and any other alone", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, FOUR_LINES),
    over = page.getByRole("button", { name: "Step over" })

  await placeProgram(element, CALLING)
  await over.click()
  await expect(current(page)).toHaveText("&4003")
  expect(await marks(element)).toEqual([])

  await over.click()
  await expect(current(page)).toHaveText("&4004")
})

test("step over leaves the stopping to a mark of the reader's already there", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, FOUR_LINES)

  await placeProgram(element, CALLING)
  await element.evaluate(host => host.machine.breakpoints.add(0x4003, "execute"))

  await page.getByRole("button", { name: "Step over" }).click()
  await expect(current(page)).toHaveText("&4003")
  expect(await marks(element)).toEqual([
    expect.objectContaining({ address: 0x4003, label: "", once: false })
  ])
})

test("step over runs on past a mark the reader disarmed there", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, FOUR_LINES)

  await placeProgram(element, CALLING)
  await element.evaluate(function (host) {
    host.machine.breakpoints.add(0x4003, "execute")
    host.machine.breakpoints.enable(0x4003, "execute", false)
  })

  const frame = await element.evaluate(host => host.machine.frame)

  await page.getByRole("button", { name: "Step over" }).click()
  await expect.poll(() => element.evaluate(host => host.machine.frame)).toBeGreaterThan(frame + 2)
  expect(await element.evaluate(host => host.machine.running)).toBe(true)
  expect(await marks(element)).toEqual([
    expect.objectContaining({ address: 0x4003, enabled: false, once: false })
  ])
})

test("step over runs a repeating instruction to its end, where into takes one pass", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, FOUR_LINES)

  await placeProgram(element, COPYING)
  await element.evaluate(function (host) {
    const z80 = host.machine.z80

    z80.b = 0x00
    z80.c = 0x03
    z80.h = 0x41
    z80.l = 0x00
    z80.d = 0x42
    z80.e = 0x00
  })

  await page.getByRole("button", { name: "Step into" }).click()
  await expect(current(page)).toHaveText("&4000")
  expect(await element.evaluate(host => host.machine.z80.bc)).toBe(2)

  await page.getByRole("button", { name: "Step over" }).click()
  await expect(current(page)).toHaveText("&4002")
  expect(await element.evaluate(host => host.machine.z80.bc)).toBe(0)
})

test("a call that never comes back leaves its mark standing in the breakpoints", async function ({
  page
}) {
  const element = await bootStopped(
      page,
      CPC_6128,
      `${FOUR_LINES}<colophon-breakpoints></colophon-breakpoints>`
    ),
    listedMarks = page.locator("colophon-breakpoints .breakpoint")

  await placeProgram(element, NEVER_RETURNING)
  await page.getByRole("button", { name: "Step over" }).click()
  expect(await element.evaluate(host => host.machine.running)).toBe(true)

  await element.evaluate(host => host.machine.stop())
  await expect(listedMarks).toHaveCount(1)
  await expect(listedMarks).toContainText("after &4000")
  expect(await marks(element)).toEqual([
    expect.objectContaining({ address: 0x4003, label: "after &4000", once: true })
  ])
})

for (const [name, machine] of MACHINES) {
  test(`step out on ${name} returns past what the routine pushed, to after its call`, async function ({
    page
  }) {
    const element = await bootStopped(page, machine, FOUR_LINES)

    await placeProgram(element, CALLING)
    await step(element, 2)
    await expect(current(page)).toHaveText("&4011")

    await page.getByRole("button", { name: "Step out" }).click()
    await expect(current(page)).toHaveText("&4003")
    expect(await marks(element)).toEqual([])
  })

  test(`step out on ${name} with no call on record says so, and leaves it standing`, async function ({
    page
  }) {
    const element = await bootStopped(page, machine, FOUR_LINES),
      problem = page.locator('colophon-disassembly p[role="status"]')

    await placeProgram(element)
    await element.evaluate(function (host) {
      host.machine.z80.sp = 0x8000
    })

    await page.getByRole("button", { name: "Step out" }).click()
    await expect(problem).toHaveText("No call on record to step out of")
    expect(await element.evaluate(host => host.machine.running)).toBe(false)

    await step(element)
    await expect(problem).toBeHidden()
  })
}
