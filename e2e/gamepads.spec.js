import { bootStopped, expectPressed, expectReleased, pressed } from "./machine"
import { expect, test } from "@playwright/test"
import { JOYSTICK_MATRIX } from "../src/js/emulator/cpc_joysticks"

const [JOYSTICK_0, JOYSTICK_1] = JOYSTICK_MATRIX

const DPAD_UP = 12,
  DPAD_LEFT = 14

// The page is given a list of pads the test fills, where the browser's would be.
test.beforeEach(async function ({ page }) {
  await page.addInitScript(function () {
    window.gamepadsUnderTest = []
    navigator.getGamepads = () => window.gamepadsUnderTest
  })
})

function plug(page, index, { held = [], axes = [0, 0, 0, 0] } = {}) {
  return page.evaluate(
    function (gamepad) {
      const buttons = Array.from({ length: 17 }, (_, button) => ({
        pressed: gamepad.held.includes(button)
      }))

      window.gamepadsUnderTest[gamepad.index] = {
        index: gamepad.index,
        mapping: "standard",
        buttons,
        axes: gamepad.axes
      }
    },
    { index, held, axes }
  )
}

function unplugAll(page) {
  return page.evaluate(() => {
    window.gamepadsUnderTest = []
  })
}

async function run(element) {
  await element.evaluate(cpc => cpc.machine.start())
}

test("the first gamepad is joystick 0, read as the machine runs", async function ({ page }) {
  const element = await bootStopped(page)

  await plug(page, 0, { held: [0, DPAD_UP] })

  // Stopped, nothing is read.
  await page.waitForTimeout(100)
  expect(await pressed(element, JOYSTICK_0.up)).toBe(false)

  await run(element)
  await expectPressed(element, [JOYSTICK_0.up, JOYSTICK_0.fire2])
  expect(await pressed(element, JOYSTICK_0.fire1)).toBe(false)

  await plug(page, 0, { held: [1, 2], axes: [-1, 0, 0, 0] })
  await expectPressed(element, [JOYSTICK_0.left, JOYSTICK_0.fire1, JOYSTICK_0.spare])
  await expectReleased(element, [JOYSTICK_0.up, JOYSTICK_0.fire2])
})

test("the second gamepad is joystick 1, over the letters", async function ({ page }) {
  const element = await bootStopped(page)

  await plug(page, 0)
  await plug(page, 1, { held: [0, DPAD_LEFT] })
  await run(element)

  await expectPressed(element, [JOYSTICK_1.left, JOYSTICK_1.fire2])
  expect(await pressed(element, JOYSTICK_0.left)).toBe(false)
})

test("a gamepad unplugged lets its switches go", async function ({ page }) {
  const element = await bootStopped(page)

  await plug(page, 0, { held: [DPAD_UP] })
  await run(element)
  await expectPressed(element, [JOYSTICK_0.up])

  await unplugAll(page)
  await expectReleased(element, [JOYSTICK_0.up])
})

test("a held direction outlives a stop, for stepping under it", async function ({ page }) {
  const element = await bootStopped(page)

  await plug(page, 0, { held: [DPAD_UP] })
  await run(element)
  await expectPressed(element, [JOYSTICK_0.up])

  await element.evaluate(cpc => cpc.machine.stop())
  await unplugAll(page)
  await page.waitForTimeout(100)
  expect(await pressed(element, JOYSTICK_0.up)).toBe(true)
})
