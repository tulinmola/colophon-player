import { CPC_6128, bootStopped, expectPressed, expectReleased, pressed } from "./machine"
import { expect, test } from "@playwright/test"
import { JOYSTICK_MATRIX } from "../src/js/emulator/cpc_joysticks"

const [JOYSTICK_0] = JOYSTICK_MATRIX

const JOYSTICK = "<colophon-cpc-joystick></colophon-cpc-joystick>"

test.use({ hasTouch: true })

// Through the browser's own input, so the page sees what a finger makes:
// pointers of type touch, captured implicitly where they land. Each event
// names only the fingers it starts, moves or lifts.
async function fingers(page) {
  const session = await page.context().newCDPSession(page)

  return function touch(type, touchPoints) {
    return session.send("Input.dispatchTouchEvent", { type, touchPoints })
  }
}

// A point on a part of the joystick, from its centre, in radii.
async function partOf(page, selector) {
  const { x, y, width, height } = await page
      .locator(`colophon-cpc-joystick ${selector}`)
      .boundingBox(),
    radius = width / 2

  return function at(across, down) {
    return { x: x + radius + across * radius, y: y + height / 2 + down * radius }
  }
}

function step(element) {
  return element.evaluate(host => host.machine.step())
}

test("a thumb on the stick holds where it points, two at a diagonal, none at the centre", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, JOYSTICK),
    touch = await fingers(page),
    stick = await partOf(page, ".stick")

  await touch("touchStart", [{ id: 0, ...stick(0, -0.8) }])
  await expectPressed(element, [JOYSTICK_0.up])

  await touch("touchMove", [{ id: 0, ...stick(0.6, 0.6) }])
  await step(element)
  await expectPressed(element, [JOYSTICK_0.down, JOYSTICK_0.right])
  await expectReleased(element, [JOYSTICK_0.up])

  // Off the circle, still steering from its centre.
  await touch("touchMove", [{ id: 0, ...stick(2.5, 0) }])
  await step(element)
  await expectReleased(element, [JOYSTICK_0.down])
  expect(await pressed(element, JOYSTICK_0.right)).toBe(true)

  await touch("touchMove", [{ id: 0, ...stick(0.1, 0) }])
  await step(element)
  await expectReleased(element, [JOYSTICK_0.right])
})

test("two thumbs hold the stick and a button at once, and each lets go of its own", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, JOYSTICK),
    touch = await fingers(page),
    stick = await partOf(page, ".stick"),
    fire = await partOf(page, "[data-switch=fire2]"),
    steering = { id: 0, ...stick(-0.8, 0) },
    firing = { id: 1, ...fire(0, 0) }

  await touch("touchStart", [steering])
  await touch("touchStart", [firing])
  await expectPressed(element, [JOYSTICK_0.left, JOYSTICK_0.fire2])
  expect(await pressed(element, JOYSTICK_0.fire1)).toBe(false)

  await touch("touchEnd", [firing])
  await step(element)
  await expectReleased(element, [JOYSTICK_0.fire2])
  expect(await pressed(element, JOYSTICK_0.left)).toBe(true)

  await touch("touchEnd", [steering])
  await step(element)
  await expectReleased(element, [JOYSTICK_0.left])
})

test("a second thumb on the stick is ignored, coming and going", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, JOYSTICK),
    touch = await fingers(page),
    stick = await partOf(page, ".stick"),
    arrow = await partOf(page, "[data-switch=right]"),
    first = { id: 0, ...stick(0.6, -0.6) },
    second = { id: 1, ...arrow(0, 0) }

  await touch("touchStart", [first])
  await expectPressed(element, [JOYSTICK_0.up, JOYSTICK_0.right])

  await touch("touchStart", [second])
  await step(element)
  expect(await pressed(element, JOYSTICK_0.up)).toBe(true)

  await touch("touchEnd", [second])
  await step(element)
  expect(await pressed(element, JOYSTICK_0.right)).toBe(true)
})

test("a touch the system takes back lets its switches go", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, JOYSTICK),
    touch = await fingers(page),
    stick = await partOf(page, ".stick"),
    fire = await partOf(page, "[data-switch=fire1]")

  await touch("touchStart", [
    { id: 0, ...stick(0, 0.8) },
    { id: 1, ...fire(0, 0) }
  ])
  await expectPressed(element, [JOYSTICK_0.down, JOYSTICK_0.fire1])

  await touch("touchCancel", [])
  await step(element)
  await expectReleased(element, [JOYSTICK_0.down, JOYSTICK_0.fire1])
})

test("a joystick taken off the page lets go of what it held", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, JOYSTICK),
    touch = await fingers(page),
    fire = await partOf(page, "[data-switch=fire2]")

  await touch("touchStart", [{ id: 0, ...fire(0, 0) }])
  await expectPressed(element, [JOYSTICK_0.fire2])

  await page.locator("colophon-cpc-joystick").evaluate(joystick => joystick.remove())
  await step(element)
  await expectReleased(element, [JOYSTICK_0.fire2])
})

test("a mouse lets go of a button wherever it is released", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, JOYSTICK),
    fire = await partOf(page, "[data-switch=fire2]"),
    { x, y } = fire(0, 0)

  await page.mouse.move(x, y)
  await page.mouse.down()
  await expectPressed(element, [JOYSTICK_0.fire2])

  await page.mouse.move(x + 400, y + 400)
  await page.mouse.up()
  await step(element)
  await expectReleased(element, [JOYSTICK_0.fire2])
})

test("the joystick fills what the machine holds, whoever closed it", async function ({ page }) {
  const element = await bootStopped(page, CPC_6128, JOYSTICK),
    fire = page.locator("colophon-cpc-joystick [data-switch=fire1]")

  await expect(fire).not.toHaveClass(/held/u)

  await element.evaluate(function (host, key) {
    host.machine.pressKey(key)
    host.machine.changed()
  }, JOYSTICK_0.fire1)
  await expect(fire).toHaveClass(/held/u)
})
