import { SPECTRUM_48, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

// LD-BYTES, which every Spectrum loader reaches in the end: IX where the
// bytes go, DE how many, A the flag byte the block must open with, and carry
// set to load rather than verify.
const LD_BYTES = 0x0556

const RAM_BASE = 0x4000

// All three stand above &8000, which the ULA does not contend for. The loader
// times its own edges, so a stack on contended RAM would cost it whatever the
// beam happened to be doing.
const AT = 0x8000,
  PARK_AT = 0xa000,
  STACK = 0xbffe

// A jump to itself. A HALT will not do: the loader returns with interrupts
// enabled, so the next one resumes the processor into RAM and on into the
// reset vector, and a halted processor cannot be sent back to the loader by
// writing its counter.
const PARK = [0x18, 0xfe]

const RECORDED = [0xa5, 0x5a, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20]

const BEHIND_THE_MARK = [0x3c, 0x42, 0x81, 0x18, 0x24, 0x42, 0x99, 0x7e]

const BEHIND_AT = 0x8100

// Far enough for the firmware to finish counting its memory and reach the
// prompt: a loader called before that runs against a machine still booting.
const WARM_FRAMES = 400

// Two seconds of pilot, the sync, and ten bytes behind it.
const LOADING_FRAMES = 200

// A .tap is bare blocks, each opening with the two bytes saying how many
// follow: the flag, the bytes themselves, and the checksum they exclusive-or
// to. A flag of 255 makes this the headerless block a loader asks for.
function headerlessTap(bytes) {
  const flag = 0xff,
    length = bytes.length + 2

  let checksum = flag
  for (const byte of bytes) {
    checksum ^= byte
  }

  return [length & 0xff, length >> 8, flag, ...bytes, checksum]
}

// A .tzx opens with a signature and a version, and names every block by an
// identifying byte. &10 is a block at the firmware's own timings, and &2A is
// the mark a multiload puts between its parts.
function multiloadTzx(parts) {
  const image = [...[..."ZXTape!"].map(character => character.charCodeAt(0)), 0x1a, 1, 13]

  for (let index = 0; index < parts.length; index++) {
    if (index > 0) {
      image.push(0x2a, 0, 0, 0, 0)
    }

    const block = headerlessTap(parts[index]).slice(2),
      pause = 100

    image.push(0x10, pause & 0xff, pause >> 8, block.length & 0xff, block.length >> 8, ...block)
  }

  return image
}

function loaded(element, at, length) {
  return element.evaluate(
    (host, read) => Array.from(host.machine.ram.subarray(read.from, read.from + read.length)),
    { from: at - RAM_BASE, length }
  )
}

function insert(element, image, name = "test.tap") {
  return element.evaluate(
    (host, [bytes, given]) => host.machine.tape.insert(new Uint8Array(bytes), given),
    [image, name]
  )
}

function callLoader(element, destination, length) {
  return element.evaluate(
    function (host, { at, parkAt, park, stack, entry, bytes }) {
      const { machine } = host,
        { z80 } = machine

      for (let index = 0; index < park.length; index++) {
        machine.poke(parkAt + index, park[index])
      }

      machine.poke(stack, parkAt & 0xff)
      machine.poke(stack + 1, parkAt >> 8)

      z80.sp = stack
      z80.ixh = at >> 8
      z80.ixl = at & 0xff
      z80.d = bytes >> 8
      z80.e = bytes & 0xff
      z80.a = 0xff
      z80.f = 0x01
      z80.pc = entry

      machine.tape.play()
    },
    { at: destination, parkAt: PARK_AT, park: PARK, stack: STACK, entry: LD_BYTES, bytes: length }
  )
}

test("a tape the deck turns is read into memory by the firmware's own loader", async function ({
  page
}) {
  const element = await bootStopped(page, SPECTRUM_48)

  await element.evaluate((host, frames) => host.machine.runFrames(frames), WARM_FRAMES)

  expect(await insert(element, headerlessTap(RECORDED))).toBe(true)

  await callLoader(element, AT, RECORDED.length)

  await element.evaluate((host, frames) => host.machine.runFrames(frames), LOADING_FRAMES)

  expect(await loaded(element, AT, RECORDED.length)).toEqual(RECORDED)
})

test("a loading rewound to the middle of itself plays on from there", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)

  await element.evaluate((host, frames) => host.machine.runFrames(frames), WARM_FRAMES)
  await insert(element, headerlessTap(RECORDED))
  await callLoader(element, AT, RECORDED.length)

  await element.evaluate(host => host.machine.runFrames(60))
  const mark = await element.evaluate(host => host.machine.ticks)
  await element.evaluate(host => host.machine.runFrames(60))

  await element.evaluate((host, at) => host.machine.rewind(at), mark)
  await element.evaluate((host, frames) => host.machine.runFrames(frames), LOADING_FRAMES)

  expect(await loaded(element, AT, RECORDED.length)).toEqual(RECORDED)
})

// No motor line reaches this deck, so the machine cannot stop the reel.
test("the reel turns to the end of the image and stops there", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)
  const image = headerlessTap(RECORDED)

  await insert(element, image)
  await element.evaluate(host => host.machine.tape.play())
  await element.evaluate((host, frames) => host.machine.runFrames(frames), LOADING_FRAMES)

  const played = await element.evaluate(host => ({
    at: host.machine.tape.at,
    length: host.machine.tape.length,
    playing: host.machine.tape.playing
  }))

  expect(played.length).toBe(image.length)
  expect(played.at).toBe(image.length)
  expect(played.playing).toBe(false)

  const emptied = await element.evaluate(function (host) {
    host.machine.tape.eject()

    return { loaded: host.machine.tape.loaded, name: host.machine.tape.name }
  })

  expect(emptied.loaded).toBe(false)
  expect(emptied.name).toBe("")
})

function deck(element) {
  return element.evaluate(host => ({
    loaded: host.machine.tape.loaded,
    playing: host.machine.tape.playing,
    name: host.machine.tape.name,
    length: host.machine.tape.length,
    at: host.machine.tape.at,
    problem: host.machine.tape.problem
  }))
}

test("an image the reader cannot play empties the deck it was put into", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)

  await insert(element, headerlessTap(RECORDED), "good.tap")
  await element.evaluate(host => host.machine.tape.play())
  await element.evaluate(host => host.machine.runFrames(20))

  expect(await insert(element, [0x02, 0x00], "bad.tap")).toBe(false)

  const refused = await deck(element)

  expect(refused.loaded).toBe(false)
  expect(refused.playing).toBe(false)
  expect(refused.name).toBe("")
  expect(refused.length).toBe(0)
  expect(refused.at).toBe(0)
  expect(refused.problem).toBeTruthy()
})

test("an image too large for the room a tape is given is refused before anything moves", async function ({
  page
}) {
  const element = await bootStopped(page, SPECTRUM_48)

  await insert(element, headerlessTap(RECORDED), "good.tap")
  await element.evaluate(host => host.machine.tape.play())
  await element.evaluate(host => host.machine.runFrames(20))

  const oversize = await element.evaluate(function (host) {
    const { tape } = host.machine,
      image = new Uint8Array(tape.capacity + 1)

    return { taken: tape.insert(image, "huge.tzx"), problem: tape.problem }
  })

  expect(oversize.taken).toBe(false)
  expect(oversize.problem).toBeTruthy()

  const held = await deck(element)

  expect(held.loaded).toBe(true)
  expect(held.playing).toBe(true)
  expect(held.name).toBe("good.tap")
  expect(held.length).toBe(headerlessTap(RECORDED).length)
})

// The reader's bounds travel in the record and the bytes it reads do not, so
// a reader handed back to another tape's image reads off the end of it.
test("a moment before the tape was changed stands at an empty deck", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)

  await insert(element, headerlessTap(RECORDED), "first.tap")
  await element.evaluate(host => host.machine.tape.play())
  await element.evaluate(host => host.machine.runFrames(20))

  const mark = await element.evaluate(host => host.machine.ticks)

  await element.evaluate(host => host.machine.runFrames(20))
  await insert(element, multiloadTzx([BEHIND_THE_MARK]), "second.tzx")
  await element.evaluate(host => host.machine.tape.play())
  await element.evaluate(host => host.machine.runFrames(20))

  await element.evaluate((host, at) => host.machine.rewind(at), mark)

  const stood = await deck(element)

  expect(stood.loaded).toBe(false)
  expect(stood.playing).toBe(false)
  expect(stood.length).toBe(0)
  expect(stood.at).toBe(0)
})

test("the deck panel names the tape, turns the reel and takes it out again", async function ({
  page
}) {
  const element = await bootStopped(page, SPECTRUM_48, "<colophon-tape></colophon-tape>")

  const panel = page.locator("colophon-tape"),
    play = panel.locator('[data-action="play"]'),
    eject = panel.locator('[data-action="eject"]')

  await expect(play).toBeDisabled()

  await insert(element, headerlessTap(RECORDED), "abduction.tap")
  await element.evaluate(host => host.machine.changed())

  await expect(panel.locator('output[name="name"]')).toHaveText("abduction.tap")
  await expect(play).toBeEnabled()

  await play.click()
  await expect(panel).toHaveAttribute("playing", "")

  await play.click()
  await expect(panel).not.toHaveAttribute("playing", "")

  await eject.click()
  await expect(panel).not.toHaveAttribute("loaded", "")
  await expect(play).toBeDisabled()
  await expect(eject).toBeDisabled()

  await expect(panel.locator('output[name="name"]')).toHaveText("")
  expect(await panel.locator("progress").evaluate(reel => reel.value)).toBe(0)
})

test("the deck shows the level at the play head as the reel turns", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48, "<colophon-tape></colophon-tape>")

  const head = page.locator('colophon-tape output[name="head"]')

  await insert(element, headerlessTap(RECORDED))
  await element.evaluate(host => host.machine.tape.play())

  // A pilot turns the level over every 2168 T-states, so it is high within a
  // frame of the reel starting.
  await expect
    .poll(async function () {
      await element.evaluate(function (host) {
        host.machine.runFrames(1)
        host.machine.changed()
      })

      return head.textContent()
    })
    .toBe("1")
})

test("a tape picked from the page that cannot be played says so under the deck", async function ({
  page
}) {
  await bootStopped(page, SPECTRUM_48, "<colophon-tape></colophon-tape>")

  const panel = page.locator("colophon-tape")

  await panel.locator('input[type="file"]').setInputFiles({
    name: "broken.tap",
    mimeType: "application/octet-stream",
    buffer: Buffer.from([0x02, 0x00])
  })

  await expect(panel.locator('p[role="status"]')).not.toBeEmpty()
  await expect(panel).not.toHaveAttribute("loaded", "")
})

test("a mark between two parts stops the reel until it is played again", async function ({ page }) {
  const element = await bootStopped(page, SPECTRUM_48)

  await element.evaluate((host, frames) => host.machine.runFrames(frames), WARM_FRAMES)

  const image = multiloadTzx([RECORDED, BEHIND_THE_MARK])
  expect(await insert(element, image)).toBe(true)

  await callLoader(element, AT, RECORDED.length)
  await element.evaluate((host, frames) => host.machine.runFrames(frames), LOADING_FRAMES)

  expect(await loaded(element, AT, RECORDED.length)).toEqual(RECORDED)
  expect(await element.evaluate(host => host.machine.tape.playing)).toBe(false)

  await callLoader(element, BEHIND_AT, BEHIND_THE_MARK.length)
  await element.evaluate((host, frames) => host.machine.runFrames(frames), LOADING_FRAMES)

  expect(await loaded(element, BEHIND_AT, BEHIND_THE_MARK.length)).toEqual(BEHIND_THE_MARK)
})

test("a tape the element names is in the deck by the time a panel watches", async function ({
  page
}) {
  await page.route("**/e2e-tape.tzx", function (route) {
    const image = Buffer.from(multiloadTzx([RECORDED]))

    return route.fulfill({ contentType: "application/octet-stream", body: image })
  })

  const machine = {
      element: "colophon-spectrum",
      attributes: 'model="spectrum48" tape="/e2e-tape.tzx"'
    },
    element = await bootStopped(page, machine)

  const held = await deck(element)

  expect(held.loaded).toBe(true)
  expect(held.playing).toBe(false)
  expect(held.name).toBe("e2e-tape.tzx")
})
