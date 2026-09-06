import { bootStopped, expectPressed, expectReleased, pressed } from "./machine"
import { expect, test } from "@playwright/test"
import { JOYSTICK_MATRIX } from "../src/js/emulator/cpc_joysticks"
import { KEY_MATRIX } from "../src/js/emulator/cpc_keys"

const KEY_F = KEY_MATRIX.KeyF,
  CURSOR_UP = KEY_MATRIX.ArrowUp,
  [JOYSTICK_0] = JOYSTICK_MATRIX

test("a key typed at the element closes its switch until a frame has passed", async function ({
  page
}) {
  const element = await bootStopped(page)

  await element.focus()
  await page.keyboard.down("KeyF")
  await expectPressed(element, [KEY_F])

  // Let go before the machine ran: still down.
  await page.keyboard.up("KeyF")
  expect(await pressed(element, KEY_F)).toBe(true)

  // A step presents a frame, and the release is owed.
  await element.evaluate(cpc => cpc.machine.step())
  await expectReleased(element, [KEY_F])
})

test("a key typed elsewhere on the page never reaches the matrix", async function ({ page }) {
  const element = await bootStopped(page)

  await page.locator("colophon-z80 input[name=a]").focus()
  await page.keyboard.down("KeyF")
  expect(await pressed(element, KEY_F)).toBe(false)
  await page.keyboard.up("KeyF")
})

test("the cursor keys are the cursor keys unless asked to be joystick 0", async function ({
  page
}) {
  const element = await bootStopped(page)

  await element.focus()
  await page.keyboard.down("ArrowUp")
  await expectPressed(element, [CURSOR_UP])
  expect(await pressed(element, JOYSTICK_0.up)).toBe(false)
  await page.keyboard.up("ArrowUp")
  await element.evaluate(cpc => cpc.machine.step())
  await expectReleased(element, [CURSOR_UP])

  await element.evaluate(cpc => cpc.setAttribute("joystick", "cursors"))
  await page.keyboard.down("ArrowUp")
  await page.keyboard.down("KeyZ")
  await page.keyboard.down("KeyC")
  await expectPressed(element, [JOYSTICK_0.up, JOYSTICK_0.fire2, JOYSTICK_0.spare])
  expect(await pressed(element, CURSOR_UP)).toBe(false)

  // The attribute is read as a key arrives, so taking it off reboots nothing.
  await element.evaluate(cpc => cpc.removeAttribute("joystick"))
  expect(await element.evaluate(cpc => cpc.machine.frame)).toBeGreaterThan(0)
})

test("losing focus lets every key go, under the same rule", async function ({ page }) {
  const element = await bootStopped(page)

  await element.focus()
  await page.keyboard.down("KeyF")
  await expectPressed(element, [KEY_F])

  await page.locator("colophon-z80 input[name=a]").focus()
  await page.keyboard.up("KeyF")
  expect(await pressed(element, KEY_F)).toBe(true)

  await element.evaluate(cpc => cpc.machine.step())
  await expectReleased(element, [KEY_F])
})
