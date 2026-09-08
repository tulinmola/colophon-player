import { SPECTRUM_48, bootStopped, expectPressed, expectReleased, pressed } from "./machine"
import { expect, test } from "@playwright/test"
import { KEY_MATRIX } from "../src/js/emulator/spectrum_keys"

const KEY_P = KEY_MATRIX.KeyP[0],
  [CAPS_SHIFT, ZERO] = KEY_MATRIX.Backspace

const DISPLAY_FILE_BYTES = 0x1800

test("the firmware runs far enough to draw with", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)

  await element.evaluate(host => host.machine.runFrames(200))

  const drawn = await element.evaluate(function (host, length) {
    return host.machine.ram.subarray(0, length).some(byte => byte != 0)
  }, DISPLAY_FILE_BYTES)

  expect(drawn).toBe(true)
})

test("a key typed at the element closes its switch until a frame has passed", async function ({
  page
}) {
  const element = await bootStopped(page, SPECTRUM_48)

  await element.focus()
  await page.keyboard.down("KeyP")
  await expectPressed(element, [KEY_P])

  await page.keyboard.up("KeyP")
  await element.evaluate(host => host.machine.step())
  await expectReleased(element, [KEY_P])
})

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
