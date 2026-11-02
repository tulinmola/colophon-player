import { CPC_6128, SPECTRUM_48, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

const VOLUME = "<colophon-volume></colophon-volume>",
  NOTICE = "colophon-sound-notice"

// Long enough for several frames to be delivered, were any being made.
const QUIET_MILLISECONDS = 300

// The meters' floor, which is silence.
const FLOOR_DECIBELS = -60

// A gain eased toward nothing approaches it rather than reaching it: 120dB
// down is silence.
const SILENCE = 1e-6

// Playwright's own calls into the page count as presses in Chromium, so here
// only the test's own input does.
function pressedByInputOnly() {
  let pressed = false

  function press() {
    pressed = true
  }

  addEventListener("keydown", press, { capture: true })
  addEventListener("pointerdown", press, { capture: true })
  Object.defineProperty(navigator, "userActivation", { get: () => ({ hasBeenActive: pressed }) })
}

// A notice shown and hidden again at once leaves nothing to find afterwards.
function countNoticesShown() {
  window.noticesShown = 0
  document.addEventListener(
    "beforetoggle",
    function (event) {
      if (event.newState == "open") {
        window.noticesShown++
      }
    },
    { capture: true }
  )
}

// What the page hands the worklet is counted on its way out, since the
// worklet itself is on a thread the test cannot reach.
function countDeliveries() {
  const post = MessagePort.prototype.postMessage

  window.deliveries = 0
  MessagePort.prototype.postMessage = function (message, transfer) {
    if (message?.kind == "samples") {
      window.deliveries++
    }

    return post.call(this, message, transfer)
  }
}

// What the worklet plays is listened to before the volume, long enough to time
// a tone by, and what reaches the speakers after it, only for as long as a
// change of volume takes to be heard.
function tapAmplifiers() {
  const { connect } = AudioNode.prototype

  window.played = []
  window.heard = []
  AudioNode.prototype.connect = function (destination) {
    if (this instanceof AudioWorkletNode) {
      const analyser = new AnalyserNode(this.context, { fftSize: 32768 })

      window.played.push(analyser)
      connect.call(this, analyser)
    } else if (this instanceof GainNode && destination == this.context.destination) {
      const analyser = new AnalyserNode(this.context, { fftSize: 2048 })

      window.heard.push(analyser)
      connect.call(this, analyser)
    }

    return connect.call(this, destination)
  }
}

// How often the newest tap rose through silence, and the furthest it went from
// it.
function lastOf(taps) {
  const [analyser] = window[taps].slice(-1),
    values = new Float32Array(analyser.fftSize)

  analyser.getFloatTimeDomainData(values)

  let rises = 0
  for (let index = 1; index < values.length; index++) {
    if (values[index - 1] < 0 && values[index] >= 0) {
      rises++
    }
  }

  return {
    hertz: rises / (values.length / analyser.context.sampleRate),
    peak: Math.max(...values.map(Math.abs))
  }
}

function deliveries(page) {
  return page.evaluate(() => window.deliveries)
}

async function expectDelivering(page) {
  const before = await deliveries(page)

  await expect.poll(() => deliveries(page), "sound delivered").toBeGreaterThan(before + 2)
}

async function expectQuiet(page) {
  const before = await deliveries(page)

  await page.waitForTimeout(QUIET_MILLISECONDS)

  expect(await deliveries(page)).toBe(before)
}

function withAttributes(machine, attributes) {
  return { ...machine, attributes: `${machine.attributes} ${attributes}` }
}

async function bootRunning(page, machine, panels = VOLUME) {
  await page.addInitScript(pressedByInputOnly)
  await page.addInitScript(countDeliveries)

  const element = await bootStopped(page, machine, panels)

  await element.evaluate(host => host.machine.start())

  return element
}

function meterReadings(page) {
  return page
    .locator("colophon-volume meter")
    .evaluateAll(meters => meters.map(meter => meter.value))
}

// DI, then the speaker's bit set and cleared by OUT (&FE),A, each followed by
// LD B,64 and a DJNZ to itself, and JR back: 1713 T-states a cycle.
const BEEPING = [
    0xf3, 0x3e, 0x10, 0xd3, 0xfe, 0x06, 0x40, 0x10, 0xfe, 0xaf, 0xd3, 0xfe, 0x06, 0x40, 0x10, 0xfe,
    0x18, 0xef
  ],
  BEEPING_AT = 0x9000,
  BEEPING_HERTZ = 3500000 / 1713

function beep(element) {
  return element.evaluate(
    function (host, { program, at }) {
      for (const [offset, byte] of program.entries()) {
        host.machine.poke(at + offset, byte)
      }

      host.machine.z80.pc = at
    },
    { program: BEEPING, at: BEEPING_AT }
  )
}

test("a machine's volume starts from its attribute, and the volume panel shows it", async function ({
  page
}) {
  await page.addInitScript(tapAmplifiers)

  const element = await bootRunning(
      page,
      withAttributes(SPECTRUM_48, `volume="${FLOOR_DECIBELS}"`)
    ),
    panel = page.locator("colophon-volume")

  await expect(panel.getByRole("slider", { name: "Volume" })).toHaveValue(String(FLOOR_DECIBELS))
  await expect(panel.locator("output")).toHaveText("Off")

  await beep(element)
  await element.click()
  await expectDelivering(page)
  await page.waitForTimeout(QUIET_MILLISECONDS)

  expect((await page.evaluate(lastOf, "heard")).peak).toBeLessThan(SILENCE)
})

test("a machine's volume set on its element shows on the volume panel and reaches the speakers", async function ({
  page
}) {
  await page.addInitScript(tapAmplifiers)

  const element = await bootRunning(page, SPECTRUM_48),
    panel = page.locator("colophon-volume"),
    fader = panel.locator('input[name="volume"]')

  await beep(element)
  await element.click()
  await expectDelivering(page)
  await page.waitForTimeout(QUIET_MILLISECONDS)

  const asItSounds = (await page.evaluate(lastOf, "heard")).peak

  await element.evaluate(host => host.setAttribute("volume", "6"))
  await expect(fader).toHaveValue("6")
  await expect(panel.locator("output")).toHaveText("+6dB")
  await page.waitForTimeout(QUIET_MILLISECONDS)

  // Six decibels up is twice the swing.
  expect((await page.evaluate(lastOf, "heard")).peak / asItSounds).toBeCloseTo(2, 0)

  await element.evaluate(
    (host, decibels) => host.setAttribute("volume", String(decibels)),
    FLOOR_DECIBELS
  )
  await expect(fader).toHaveValue(String(FLOOR_DECIBELS))
  await expect(panel.locator("output")).toHaveText("Off")
  await page.waitForTimeout(QUIET_MILLISECONDS)

  expect((await page.evaluate(lastOf, "heard")).peak).toBeLessThan(SILENCE)
  // Followed where it stands: the speakers it was first connected to.
  expect(await page.evaluate(() => window.heard.length)).toBe(1)
})

for (const machine of [CPC_6128, SPECTRUM_48]) {
  test(`a ${machine.element} is heard from the first press on it, with no panel placed in it`, async function ({
    page
  }) {
    const element = await bootRunning(page, machine, "")

    await expectQuiet(page)
    await element.click()
    await expectDelivering(page)
  })
}

test("a page not yet pressed is told so, and heard from the first click anywhere on it", async function ({
  page
}) {
  await bootRunning(page, CPC_6128, "")

  const notice = page.locator(NOTICE),
    { height } = page.viewportSize(),
    beside = { x: 5, y: height - 5 }

  await expect(notice).toBeVisible()
  await expect(notice).toHaveText("Press a key or click to hear the machine.")
  await expectQuiet(page)

  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y).closest("colophon-cpc"),
      beside
    )
  ).toBeNull()
  await page.mouse.click(beside.x, beside.y)

  await expect(notice).toBeHidden()
  await expectDelivering(page)
})

test("a page not yet pressed is heard from the first key pressed on it", async function ({ page }) {
  await bootRunning(page, SPECTRUM_48, "")

  const notice = page.locator(NOTICE)

  await expect(notice).toBeVisible()
  await page.keyboard.press("Enter")

  await expect(notice).toBeHidden()
  await expectDelivering(page)
})

test("a machine built on a page pressed already is heard with no press, and tells nothing", async function ({
  page
}) {
  await page.addInitScript(pressedByInputOnly)
  await page.addInitScript(countDeliveries)
  await page.addInitScript(countNoticesShown)

  const element = await bootStopped(page, withAttributes(CPC_6128, "muted"))

  await element.click()
  await page.evaluate(function ({ element: name, attributes }) {
    document.body.insertAdjacentHTML("beforeend", `<${name} ${attributes}></${name}>`)
  }, SPECTRUM_48)

  await expectDelivering(page)
  expect(await page.evaluate(() => window.noticesShown)).toBe(0)
})

test("a muted machine makes no sound and asks for no press, and is heard once it is not", async function ({
  page
}) {
  await page.addInitScript(tapAmplifiers)

  const element = await bootRunning(page, withAttributes(CPC_6128, "muted")),
    panel = page.locator("colophon-volume")

  await expect(page.locator(NOTICE)).toBeHidden()
  await expect(panel.locator("output")).toHaveText("Muted")
  await expect(panel.locator('input[name="volume"]')).toBeDisabled()

  await element.click()
  await expectQuiet(page)
  expect(await page.evaluate(() => window.played.length)).toBe(0)

  await element.evaluate(host => host.removeAttribute("muted"))
  await expect(panel.locator("output")).toHaveText("0dB")
  await expectDelivering(page)

  await element.evaluate(host => host.setAttribute("muted", ""))
  await expect(panel.locator("output")).toHaveText("Muted")
  await expectQuiet(page)
})

test("a machine rebooted on a page not yet pressed lays one notice", async function ({ page }) {
  const element = await bootRunning(page, CPC_6128, "")

  await expect(page.locator(NOTICE)).toBeVisible()
  await element.evaluate(function (host) {
    return new Promise(function (resolve) {
      host.addEventListener("machine:ready", () => resolve(), { once: true })
      host.setAttribute("model", "cpc464")
    })
  })

  await expect(page.locator(NOTICE)).toHaveCount(1)
  await expect(page.locator(NOTICE)).toBeVisible()
})

test("a page that cannot play sound runs its machine silent, with no notice and the fader at its foot", async function ({
  page
}) {
  await page.addInitScript(() => delete window.AudioWorkletNode)

  const element = await bootRunning(page, CPC_6128),
    panel = page.locator("colophon-volume")

  await expect(page.locator(NOTICE)).toHaveCount(0)
  await expect(panel.locator('input[name="volume"]')).toBeDisabled()
  await expect(panel.locator('input[name="volume"]')).toHaveValue(String(FLOOR_DECIBELS))
  await expect(panel.locator('input[name="volume"]')).toHaveAttribute("aria-valuetext", "Off")
  await expect(panel.locator("output")).toHaveText("Off")

  await element.click()
  await expectQuiet(page)
})

test("two volume panels in one machine show the same volume", async function ({ page }) {
  await bootStopped(page, CPC_6128, VOLUME + VOLUME)

  const faders = page.locator('colophon-volume input[name="volume"]')

  await faders.first().fill("-12")

  await expect(faders.last()).toHaveValue("-12")
  await expect(page.locator("colophon-volume output").last()).toHaveText("−12dB")
})

test("the volume panel meters each channel the machine sounds", async function ({ page }) {
  await bootStopped(page, CPC_6128, VOLUME)

  await expect(page.locator("colophon-volume label span")).toHaveText(["Left", "Right"])

  await bootStopped(page, SPECTRUM_48, VOLUME)

  await expect(page.locator("colophon-volume label span")).toHaveText(["Mono"])
})

test("the machine falls silent when it stops, and is heard again when it runs", async function ({
  page
}) {
  const element = await bootRunning(page, CPC_6128)

  await element.click()
  await expectDelivering(page)

  await element.evaluate(host => host.machine.stop())
  await expectQuiet(page)

  await element.evaluate(host => host.machine.start())
  await expectDelivering(page)
})

test("the worklet asks for more of the machine while it is short of its lead", async function ({
  page
}) {
  const element = await bootRunning(page, SPECTRUM_48)

  await element.evaluate(function (host) {
    const { machine } = host,
      steer = machine.setListeningRate.bind(machine)

    window.rates = []
    machine.setListeningRate = function (rate) {
      window.rates.push(rate)
      steer(rate)
    }
  })

  await element.click()
  await expect.poll(() => page.evaluate(() => window.rates.length)).toBeGreaterThan(2)

  // The first samples arrive to find nothing held, as short of the lead as it
  // can be, and are answered with the most the rate is ever steered by.
  const [rate] = await page.evaluate(() => window.rates),
    deviceRate = await page.evaluate(() => new AudioContext().sampleRate)

  expect(rate / deviceRate).toBeCloseTo(1.002, 6)
})

test("nothing is heard faster than the hardware ran", async function ({ page }) {
  const element = await bootRunning(page, CPC_6128)

  await element.click()
  await expectDelivering(page)

  await element.evaluate(function (host) {
    host.machine.speed = 2
  })
  await expectQuiet(page)
})

test("a Spectrum's speaker is played at the pitch its loop moves it, inside full scale", async function ({
  page
}) {
  await page.addInitScript(tapAmplifiers)

  const element = await bootRunning(page, SPECTRUM_48)

  await beep(element)
  await element.click()
  await expectDelivering(page)
  // The coupling settles, and the analyser fills with nothing but the tone.
  await page.waitForTimeout(1500)

  const { hertz, peak } = await page.evaluate(lastOf, "played")

  expect(hertz / BEEPING_HERTZ).toBeCloseTo(1, 2)
  expect(peak).toBeGreaterThan(0.2)
  expect(peak).toBeLessThan(1)
})

test("the meters read the tone while it plays, and fall to the floor as it stops", async function ({
  page
}) {
  const element = await bootRunning(page, SPECTRUM_48)

  await beep(element)
  await element.click()
  await expect.poll(() => meterReadings(page)).toEqual([expect.any(Number)])
  await expect
    .poll(async () => (await meterReadings(page))[0], "the tone read")
    .toBeGreaterThan(-12)

  await element.evaluate(host => host.machine.stop())

  expect(await meterReadings(page)).toEqual([FLOOR_DECIBELS])
})

test("the volume turned off silences the speakers and leaves the meters reading", async function ({
  page
}) {
  await page.addInitScript(tapAmplifiers)

  const element = await bootRunning(page, SPECTRUM_48),
    panel = page.locator("colophon-volume"),
    fader = panel.locator('input[name="volume"]')

  await beep(element)
  await element.click()
  await expectDelivering(page)

  await fader.fill(String(FLOOR_DECIBELS))
  await expect(element).toHaveAttribute("volume", String(FLOOR_DECIBELS))
  await expect(panel.locator("output")).toHaveText("Off")
  await page.waitForTimeout(QUIET_MILLISECONDS)

  expect((await page.evaluate(lastOf, "heard")).peak).toBeLessThan(SILENCE)
  expect((await meterReadings(page))[0]).toBeGreaterThan(-12)

  await fader.fill("-12")
  await expect(panel.locator("output")).toHaveText("−12dB")
  await page.waitForTimeout(QUIET_MILLISECONDS)

  expect((await page.evaluate(lastOf, "heard")).peak).toBeGreaterThan(0)
})
