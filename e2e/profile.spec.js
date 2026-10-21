import { CPC_6128_ABDUCTION, CPC_6128_NAMED, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

function readStrip(profile) {
  return profile.evaluate(function (panel) {
    const bars = Array.from(panel.querySelectorAll(".bar"))

    return {
      frames: Number(panel.style.getPropertyValue("--frames")),
      heights: bars.map(bar => Number(bar.style.getPropertyValue("--height"))),
      clipped: bars.filter(bar => bar.classList.contains("clipped")).length
    }
  })
}

// The record then holds frames 172 to 300, all of them the menu's, past the
// short passes it begins with.
function runPastTheMenusSettingUp(machine) {
  return machine.evaluate(function (host) {
    host.machine.runFrames(300)
    host.machine.present()
  })
}

test("the profile draws a bar for each of Abduction's passes, two frames each, and stands the machine on the one pressed", async function ({
  page
}) {
  const machine = await bootStopped(
      page,
      CPC_6128_ABDUCTION,
      "<colophon-profile></colophon-profile>"
    ),
    profile = page.locator("colophon-profile"),
    start = profile.locator('input[name="start"]'),
    bars = profile.locator(".bar"),
    summary = profile.locator(".summary")

  await start.fill("297E")
  await start.press("Enter")
  await expect(start).toHaveValue("&297E")
  await expect(profile).toHaveAttribute("start", "&297E")
  await expect(summary).toHaveText("No profiling frame has ended yet")

  await runPastTheMenusSettingUp(machine)

  const held = await bars.count(),
    cuts = await machine.evaluate(host => host.machine.profilingCuts().length)

  expect(held).toBeGreaterThan(50)
  expect(held).toBe(cuts - 1)
  await expect(summary).toHaveText(`${held} profiling frames, 2 frames each`)

  const pressed = bars.nth(10)

  await pressed.click()
  await expect(pressed).toHaveClass(/current/u)
  await expect(summary).toHaveText(/^From frame \d+ · 2 frames · 3993\d µs$/u)
  expect(await machine.evaluate(host => host.machine.z80.pc)).toBe(0x297e)
})

test("pressing a bar lays out where its profiling frame spent its time, without moving the machine off its start, and a routine there offers a breakpoint", async function ({
  page
}) {
  const machine = await bootStopped(
      page,
      CPC_6128_ABDUCTION,
      '<colophon-profile start="&297E"></colophon-profile>'
    ),
    profile = page.locator("colophon-profile"),
    routines = profile.locator(".routine")

  await runPastTheMenusSettingUp(machine)
  await expect(routines).toHaveCount(0)

  const pressed = profile.locator(".bar").nth(10),
    tick = Number(await pressed.getAttribute("data-tick")),
    { length } = (await pressed.getAttribute("title")).match(/(?<length>\d+) µs$/u).groups

  await pressed.click()
  await expect(routines.first()).toBeVisible()

  const frame = routines.first(),
    begun = profile.locator(".routine.start"),
    waiting = routines.filter({ hasText: "_renderer_waitForSemaphore" }).first(),
    spent = await routines.locator(".self").allTextContents(),
    total = spent.reduce((sum, microseconds) => sum + Number(microseconds), 0)

  await expect(frame.locator(".name")).toHaveText("profiling frame")
  await expect(frame.locator(".total")).toHaveText(length)
  await expect(frame.locator(".share")).toHaveText("100.0%")
  await expect(begun.locator(".name")).toHaveText("&297E")
  await expect(waiting).toBeVisible()
  expect(Math.abs(total - Number(length))).toBeLessThan(spent.length)
  expect(await machine.evaluate(host => host.machine.ticks)).toBe(tick)

  await waiting.click({ button: "right" })
  await expect(page.locator("colophon-actions button").first()).toHaveText("Add breakpoint…")
})

test("a routine folds away the routines it reached, and stays folded in the next profiling frame opened", async function ({
  page
}) {
  const machine = await bootStopped(
      page,
      CPC_6128_ABDUCTION,
      '<colophon-profile start="&297E"></colophon-profile>'
    ),
    profile = page.locator("colophon-profile"),
    bars = profile.locator(".bar"),
    routines = profile.locator(".routine"),
    drawing = routines.filter({ has: page.getByText("_renderer_draw", { exact: true }) }),
    fold = drawing.locator(".fold"),
    waiting = routines.filter({ has: page.getByText("_renderer_waitForSemaphore") })

  await runPastTheMenusSettingUp(machine)
  await bars.nth(10).click()
  await expect(fold).toHaveAttribute("aria-expanded", "true")
  await expect(waiting).toBeVisible()

  await fold.click()
  await expect(fold).toHaveAttribute("aria-expanded", "false")
  await expect(waiting).toBeHidden()
  await expect(drawing).toBeVisible()

  await bars.nth(11).click()
  await expect(bars.nth(11)).toHaveClass(/current/u)
  await expect(fold).toHaveAttribute("aria-expanded", "false")
  await expect(waiting).toBeHidden()

  await fold.click()
  await expect(waiting).toBeVisible()
})

test("the strip fits the longest profiling frame, or stands as many frames tall as it is told", async function ({
  page
}) {
  const machine = await bootStopped(
      page,
      CPC_6128_ABDUCTION,
      '<colophon-profile start="&297E"></colophon-profile>'
    ),
    profile = page.locator("colophon-profile")

  await runPastTheMenusSettingUp(machine)

  const fitted = await readStrip(profile),
    tallest = Math.max(...fitted.heights)

  expect(fitted.clipped).toBe(0)
  expect(tallest).toBeLessThanOrEqual(1)
  expect(tallest).toBeGreaterThan((fitted.frames - 1) / fitted.frames)

  await profile.locator("colophon-options button").click()

  const frames = profile.locator('input[name="frames"]')

  await expect(frames).toHaveValue("")
  await frames.fill("4")
  await frames.press("Enter")
  await expect(profile).toHaveAttribute("frames", "4")

  // Polled whole, because a strip built again keeps its old bars until the
  // panel has found its machine.
  await expect
    .poll(async function () {
      const { heights } = await readStrip(profile)

      return heights.length > 50 && heights.every(height => Math.abs(height - 0.5) < 0.001)
    })
    .toBe(true)

  await profile.evaluate(panel => panel.setAttribute("frames", "1"))
  await expect.poll(async () => (await readStrip(profile)).clipped).toBeGreaterThan(50)
})

test("the profile's start takes a name, says where it stands, and refuses one it cannot find", async function ({
  page
}) {
  await bootStopped(page, CPC_6128_NAMED, "<colophon-profile></colophon-profile>")

  const profile = page.locator("colophon-profile"),
    start = profile.locator('input[name="start"]')

  await start.fill("game_step")
  await start.press("Enter")
  await expect(profile).toHaveAttribute("start", "game_step")
  await expect(start).toHaveValue("_game_step")
  await expect(profile.locator(".address").first()).toHaveText("&022B")

  await start.fill("_nowhere")
  await start.press("Enter")
  await expect(start).toHaveJSProperty("validationMessage", "unknown name")

  await start.press("Escape")
  await expect(start).toHaveValue("_game_step")

  await start.fill("")
  await start.press("Enter")
  await expect(profile).not.toHaveAttribute("start")
})

test("a profile with no start of its own shows the machine's, and one set on the page is followed where the panel stands", async function ({
  page
}) {
  const machine = await bootStopped(
      page,
      CPC_6128_NAMED,
      '<colophon-profile start="&297E"></colophon-profile><colophon-profile></colophon-profile>'
    ),
    profiles = page.locator("colophon-profile"),
    declaring = profiles.first(),
    reading = profiles.last(),
    strip = await declaring.locator(".strip").elementHandle()

  await expect(reading.locator('input[name="start"]')).toHaveValue("&297E")
  expect(await machine.evaluate(host => host.machine.profiling.start)).toBe(0x297e)

  await declaring.evaluate(panel => panel.setAttribute("start", "_game_step"))

  await expect(declaring.locator('input[name="start"]')).toHaveValue("_game_step")
  await expect(reading.locator('input[name="start"]')).toHaveValue("_game_step")
  expect(await strip.evaluate(node => node.isConnected)).toBe(true)
})

test("a profile of calls cuts each one from its entry to its return, and measures it against the clock", async function ({
  page
}) {
  const machine = await bootStopped(
      page,
      CPC_6128_ABDUCTION,
      '<colophon-profile start="_renderer_draw" mode="call"></colophon-profile>'
    ),
    profile = page.locator("colophon-profile"),
    bars = profile.locator(".bar"),
    routines = profile.locator(".routine")

  await runPastTheMenusSettingUp(machine)
  await expect(profile.locator(".summary")).toHaveText(/^\d+ profiling frames, \d+ to \d+ µs$/u)

  const pressed = bars.nth(10),
    { length } = (await pressed.getAttribute("title")).match(
      /^From frame \d+ · (?<length>\d+) µs$/u
    ).groups

  await pressed.click()
  await expect(routines.first()).toBeVisible()

  await expect(routines.first().locator(".total")).toHaveText(length)
  await expect(routines.nth(1).locator(".name")).toHaveText("_renderer_draw")
  expect(await machine.evaluate(host => host.machine.z80.pc)).toBe(0x2868)
})

test("a profile until an end leaves out what runs from the end to the next start", async function ({
  page
}) {
  const machine = await bootStopped(
      page,
      CPC_6128_ABDUCTION,
      '<colophon-profile start="&297E"></colophon-profile>'
    ),
    profile = page.locator("colophon-profile"),
    mode = profile.locator('select[name="mode"]'),
    end = profile.locator('input[name="end"]'),
    bars = profile.locator(".bar"),
    routines = profile.locator(".routine")

  await expect(end).toBeHidden()
  await mode.selectOption("until")
  await expect(profile).toHaveAttribute("mode", "until")
  await expect(end).toBeEnabled()

  await end.fill("2977")
  await end.press("Enter")
  await expect(profile).toHaveAttribute("end", "&2977")
  await expect(end).toHaveValue("_renderer_waitForSemaphore")
  await expect(profile.locator(".address").last()).toHaveText("&2977")

  await runPastTheMenusSettingUp(machine)
  await expect(profile.locator(".summary")).toHaveText(/^\d+ profiling frames, \d+ to \d+ µs$/u)

  const lengths = (await bars.evaluateAll(all => all.map(bar => bar.title))).map(title =>
    Number(title.match(/(?<length>\d+) µs$/u).groups.length)
  )

  expect(Math.max(...lengths)).toBeLessThan(39936)

  await bars.nth(10).click()
  await expect(profile.locator(".routine.start .name")).toHaveText("&297E")
  await expect(routines.filter({ hasText: "_renderer_waitForSemaphore" })).toHaveCount(0)
})

test("only a profile that gives the start says how its profiling frames end", async function ({
  page
}) {
  await bootStopped(page, CPC_6128_NAMED, "<colophon-profile></colophon-profile>")

  const profile = page.locator("colophon-profile"),
    start = profile.locator('input[name="start"]'),
    mode = profile.locator('select[name="mode"]'),
    end = profile.locator('input[name="end"]')

  await expect(mode).toBeDisabled()
  await expect(end).toBeHidden()

  await start.fill("_game_step")
  await start.press("Enter")
  await expect(mode).toBeEnabled()
  await expect(mode).toHaveValue("pass")
  await expect(end).toBeHidden()
})

test("a profile with no start of its own shows how another's profiling frames end, and leaves them to it", async function ({
  page
}) {
  await bootStopped(
    page,
    CPC_6128_NAMED,
    '<colophon-profile start="&297E" mode="until" end="&2977"></colophon-profile><colophon-profile></colophon-profile>'
  )

  const reading = page.locator("colophon-profile").last(),
    mode = reading.locator('select[name="mode"]'),
    end = reading.locator('input[name="end"]')

  await expect(mode).toHaveValue("until")
  await expect(mode).toBeDisabled()
  await expect(end).toBeVisible()
  await expect(end).toHaveValue("_renderer_waitForSemaphore")
  await expect(end).toBeDisabled()
})

test("the bars keep their places, and the panel its width, while the record gains profiling frames and loses them", async function ({
  page
}) {
  const machine = await bootStopped(
    page,
    CPC_6128_ABDUCTION,
    '<colophon-profile start="&297E"></colophon-profile>'
  )

  await runPastTheMenusSettingUp(machine)

  const seen = await machine.evaluate(function (host) {
    const panel = host.querySelector("colophon-profile"),
      strip = panel.querySelector(".strip"),
      counts = new Set(),
      layouts = new Set(),
      widths = new Set()

    function look() {
      const right = strip.getBoundingClientRect().right,
        bars = Array.from(strip.querySelectorAll(".bar")),
        newest = bars.slice(-10).map(bar => right - bar.getBoundingClientRect().left),
        layout = newest.join(" ")

      counts.add(bars.length)
      layouts.add(layout)
      widths.add(panel.offsetWidth)
    }

    function runOn(frames) {
      for (let frame = 0; frame < frames; frame++) {
        host.machine.runFrames(1)
        host.machine.present()
        look()
      }
    }

    runOn(20)

    const cuts = host.machine.profilingCuts()

    host.machine.rewind(cuts[10].tick)
    look()
    runOn(20)

    return { counts: counts.size, layouts: layouts.size, widths: widths.size }
  })

  expect(seen.counts).toBeGreaterThan(2)
  expect(seen.layouts).toBe(1)
  expect(seen.widths).toBe(1)
})
