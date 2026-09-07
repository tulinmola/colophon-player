import { CPC_6128, bootStopped, expectPressed, expectReleased, pressed } from "./machine"
import { expect, test } from "@playwright/test"
import { JOYSTICK_MATRIX } from "../src/js/emulator/cpc_joysticks"
import { KEY_MATRIX } from "../src/js/emulator/cpc_keys"

const KEY_F = KEY_MATRIX.KeyF,
  JOYSTICK_0_FIRE_2 = JOYSTICK_MATRIX[0].fire2

const KEYBOARD = "<colophon-keyboard></colophon-keyboard>"

test("a switch held in the panel is held in the matrix", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, KEYBOARD),
    fire = page.locator(`colophon-keyboard input[name=key${JOYSTICK_0_FIRE_2}]`),
    inscription = page.locator(`colophon-keyboard label[title^='Key ${JOYSTICK_0_FIRE_2}:']`)

  await expect(fire).not.toBeChecked()
  await inscription.click()
  expect(await pressed(element, JOYSTICK_0_FIRE_2)).toBe(true)

  // Held across a step, and shown held.
  await element.evaluate(host => host.machine.step())
  expect(await pressed(element, JOYSTICK_0_FIRE_2)).toBe(true)
  await expect(fire).toBeChecked()

  await inscription.click()
  expect(await pressed(element, JOYSTICK_0_FIRE_2)).toBe(false)
})

test("a key pressed on the keyboard shows in the panel", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, KEYBOARD),
    letter = page.locator(`colophon-keyboard input[name=key${KEY_F}]`)

  await element.focus()
  await page.keyboard.down("KeyF")
  await expectPressed(element, [KEY_F])
  await expect(letter).toBeChecked()

  await page.keyboard.up("KeyF")
  await element.evaluate(host => host.machine.step())
  await expectReleased(element, [KEY_F])
  await expect(letter).not.toBeChecked()
})

test("every position of the matrix has a key", async function ({ page }) {
  await bootStopped(page, CPC_6128, KEYBOARD)

  await expect(page.locator("colophon-keyboard tbody tr")).toHaveCount(10)
  await expect(page.locator("colophon-keyboard input[type=checkbox]")).toHaveCount(80)
  await expect(
    page.locator(`colophon-keyboard label[title^='Key ${JOYSTICK_MATRIX[0].up}:']`)
  ).toHaveText("(UP)")
})
