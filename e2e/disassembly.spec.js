import { CPC_6128, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

const CPC_6128_NAMED = {
  element: "colophon-cpc",
  attributes: 'model="cpc6128" symbols="/abduction.noi"'
}

const ORIGIN = 0x4000,
  NOP = [0x00],
  LD_HL_1234 = [0x21, 0x34, 0x12],
  JP_ORIGIN = [0xc3, 0x00, 0x40],
  PROGRAM = [...NOP, ...NOP, ...NOP, ...NOP, ...LD_HL_1234, ...JP_ORIGIN]

const FOUR_LINES = '<colophon-disassembly lines="4"></colophon-disassembly>',
  FIXED_AT_LD_HL = '<colophon-disassembly lines="4" base="&4004" fixed></colophon-disassembly>'

async function placeProgram(element) {
  await element.evaluate(
    function (host, [origin, bytes]) {
      const machine = host.machine

      for (let offset = 0; offset < bytes.length; offset++) {
        machine.poke(origin + offset, bytes[offset])
      }

      machine.z80.iff1 = false
      machine.z80.halted = false
      machine.z80.pc = origin
      machine.changed()
    },
    [ORIGIN, PROGRAM]
  )
}

function step(element, times = 1) {
  return element.evaluate(function (host, count) {
    for (let taken = 0; taken < count; taken++) {
      host.machine.step()
    }
  }, times)
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
