import { CPC_464, bootStopped } from "./machine"
import { deckOf, headerlessTap, insertTape, multiloadTzx } from "./tape"
import { expect, test } from "@playwright/test"

const RECORDED = [0xa5, 0x5a, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20]

// Far enough for the firmware to reach its prompt.
const WARM_FRAMES = 200

// RUN" and a key for the "Press PLAY then any key" the firmware asks for,
// which is where it energises the motor.
const keyAt = (line, bit) => line * 8 + bit

const RUN_FROM_TAPE = [
  [keyAt(6, 2)],
  [keyAt(5, 2)],
  [keyAt(5, 6)],
  [keyAt(2, 5), keyAt(8, 1)],
  [keyAt(2, 2)],
  [keyAt(5, 7)]
]

function type(element, keys) {
  return element.evaluate(function (host, combinations) {
    const { machine } = host

    for (const combination of combinations) {
      for (const key of combination) {
        machine.pressKey(key)
      }
      machine.runFrames(4)
      machine.present()

      for (const key of combination) {
        machine.releaseKey(key)
      }
      machine.runFrames(4)
      machine.present()
    }
  }, keys)
}

// Bit 4 of the 8255's port C is the motor, and the board presses PLAY every
// tick the line is high.
test("the machine turns the reel, and a reader asking for it is overruled", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_464)

  await element.evaluate((host, frames) => host.machine.runFrames(frames), WARM_FRAMES)
  expect(await insertTape(element, multiloadTzx([RECORDED]), "test.cdt")).toBe(true)

  expect((await deckOf(element)).playing).toBe(false)

  await element.evaluate(function (host) {
    host.machine.tape.play()
    host.machine.runFrames(1)
  })

  expect((await deckOf(element)).playing).toBe(false)

  await type(element, RUN_FROM_TAPE)
  await element.evaluate(host => host.machine.runFrames(60))

  const searching = await deckOf(element)

  expect(searching.playing).toBe(true)
  expect(searching.at).toBeGreaterThan(0)

  // And the reader cannot stop it either: the next tick presses PLAY again.
  await element.evaluate(function (host) {
    host.machine.tape.stop()
    host.machine.runFrames(1)
  })

  expect((await deckOf(element)).playing).toBe(true)
})

// The reel is the one reading this deck has that a Spectrum's has not, so it
// must read high while the machine is driving it and not only when idle.
test("the deck panel shows the reel turning while the machine drives it", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_464, "<colophon-tape></colophon-tape>")

  const turning = page.locator('colophon-tape output[name="reel"]')

  await element.evaluate((host, frames) => host.machine.runFrames(frames), WARM_FRAMES)
  await insertTape(element, multiloadTzx([RECORDED]), "test.cdt")
  await element.evaluate(host => host.machine.changed())

  await expect(turning).toHaveText(".")

  await type(element, RUN_FROM_TAPE)
  await element.evaluate(function (host) {
    host.machine.runFrames(60)
    host.machine.changed()
  })

  await expect(turning).toHaveText("1")
})

// The deck and the reader travel in the machine's own state, so a moment
// before the tape went in stands at an empty deck rather than at a reader
// holding bounds measured against an image that is no longer there.
test("a moment before the tape went in stands at an empty deck", async function ({ page }) {
  const element = await bootStopped(page, CPC_464)

  await element.evaluate((host, frames) => host.machine.runFrames(frames), WARM_FRAMES)

  const mark = await element.evaluate(host => host.machine.ticks)

  // A capture at the tick a state already stands on overwrites it, so the
  // tape must go in later than the moment being marked.
  await element.evaluate(host => host.machine.runFrames(20))
  await insertTape(element, multiloadTzx([RECORDED]), "test.cdt")
  await type(element, RUN_FROM_TAPE)
  await element.evaluate(host => host.machine.runFrames(60))

  expect((await deckOf(element)).playing).toBe(true)

  await element.evaluate((host, at) => host.machine.rewind(at), mark)

  const stood = await deckOf(element)

  expect(stood.loaded).toBe(false)
  expect(stood.length).toBe(0)
  expect(stood.at).toBe(0)
})

// A tape named in the element's own attributes is fetched while the machine
// is being built, and goes in stopped: the motor has not been asked for yet.
test("a tape the element names is in the deck by the time a panel watches", async function ({
  page
}) {
  await page.route("**/e2e-tape.cdt", function (route) {
    const image = Buffer.from(multiloadTzx([RECORDED]))

    return route.fulfill({ contentType: "application/octet-stream", body: image })
  })

  const machine = {
      element: "colophon-cpc",
      attributes: 'model="cpc464" tape="/e2e-tape.cdt"'
    },
    element = await bootStopped(page, machine)

  const held = await deckOf(element)

  expect(held.loaded).toBe(true)
  expect(held.playing).toBe(false)
  expect(held.name).toBe("e2e-tape.cdt")
})

test("a Spectrum's own tape is refused by this deck", async function ({ page }) {
  const element = await bootStopped(page, CPC_464)

  expect(await insertTape(element, headerlessTap(RECORDED), "spectrum.tap")).toBe(false)

  const refused = await deckOf(element)

  expect(refused.loaded).toBe(false)
  expect(refused.problem).toContain("a Spectrum's alone")
})

test("the deck panel offers no key where the machine holds PLAY down", async function ({ page }) {
  const element = await bootStopped(page, CPC_464, "<colophon-tape></colophon-tape>")

  const panel = page.locator("colophon-tape")

  await expect(panel.locator('[data-action="play"]')).toHaveCount(0)
  await expect(panel.locator('output[name="reel"]')).toHaveText(".")

  await insertTape(element, multiloadTzx([RECORDED]), "test.cdt")
  await element.evaluate(host => host.machine.changed())

  await expect(panel.locator('output[name="name"]')).toHaveText("test.cdt")
  await expect(panel.locator('input[type="file"]')).toHaveAttribute("accept", ".cdt,.tzx")
})
