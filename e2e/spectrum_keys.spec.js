import { SPECTRUM_48, bootStopped, expectPressed, expectReleased, pressed } from "./machine"
import { expect, test } from "@playwright/test"
import { KEY_MATRIX } from "../src/js/emulator/spectrum_keys"

const [CAPS_SHIFT, ZERO] = KEY_MATRIX.Backspace

// CAPS SHIFT is its own key and half of what Backspace is, so letting one go
// must not open a switch the other is still holding.
test("a switch two keys close stays closed while either is held", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)

  await element.focus()
  await page.keyboard.down("ShiftLeft")
  await page.keyboard.down("Backspace")
  await expectPressed(element, [CAPS_SHIFT, ZERO])

  await page.keyboard.up("Backspace")
  await element.evaluate(host => host.machine.step())
  await expectReleased(element, [ZERO])
  expect(await pressed(element, CAPS_SHIFT)).toBe(true)

  await page.keyboard.up("ShiftLeft")
  await element.evaluate(host => host.machine.step())
  await expectReleased(element, [CAPS_SHIFT])
})

test("a key the case reaches with caps shift closes both switches", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)

  await element.focus()
  await page.keyboard.down("Backspace")
  await expectPressed(element, [CAPS_SHIFT, ZERO])

  await page.keyboard.up("Backspace")
  await element.evaluate(host => host.machine.step())
  await expectReleased(element, [CAPS_SHIFT, ZERO])
})
