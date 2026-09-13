import { CPC_6128, CPC_6128_NAMED, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

function addresses(panel) {
  return panel.locator(".row .at")
}

function offered(page) {
  return page.locator("colophon-actions button")
}

test("a dump stands as its attributes shape it, from exactly its base, and writes back where it goes", async function ({
  page
}) {
  await bootStopped(
    page,
    CPC_6128,
    '<colophon-memory lines="2" width="8" base="&4003"></colophon-memory>'
  )

  const memory = page.locator("colophon-memory")

  await expect(addresses(memory)).toHaveText(["4003", "400B"])
  await expect(memory.locator(".bytes span")).toHaveCount(16)

  await memory.locator(".dump").hover()
  await page.mouse.wheel(0, 100)
  await expect(addresses(memory)).toHaveText(["400B", "4013"])
  await expect(memory).toHaveAttribute("base", "&400B")

  const first = await memory.locator(".row").first().elementHandle()

  await memory.evaluate(panel => panel.setAttribute("base", "&4100"))
  await expect(addresses(memory)).toHaveText(["4100", "4108"])
  expect(await first.evaluate(row => row.isConnected)).toBe(true)

  await memory.locator("colophon-options button").click()

  const lines = memory.locator('input[name="lines"]')

  await expect(lines).toHaveValue("2")
  await expect(memory.locator('input[name="width"]')).toHaveValue("8")
  await expect(memory.locator('input[name="scroll"]')).toBeChecked()
  await lines.fill("3")
  await lines.press("Enter")
  await expect(memory).toHaveAttribute("lines", "3")
  await expect(addresses(memory)).toHaveText(["4100", "4108", "4110"])
})

test("a name is the processor's, and turns a dump reading the banks back to it", async function ({
  page
}) {
  await bootStopped(page, CPC_6128_NAMED, '<colophon-memory space="ram"></colophon-memory>')

  const memory = page.locator("colophon-memory"),
    at = memory.locator('input[name="at"]')

  await expect(at).toHaveValue("&00000")

  await at.fill("_nowhere")
  await at.press("Enter")
  await expect(at).toHaveJSProperty("validationMessage", "unknown name")
  await expect(addresses(memory).first()).toHaveText("00000")

  await at.press("Escape")
  await expect(at).toHaveValue("&00000")
  await expect(at).toHaveJSProperty("validationMessage", "")
  await expect(memory.locator('select[name="space"]')).toHaveValue("ram")

  await at.fill("_game_step")
  await at.press("Enter")
  await expect(at).toHaveValue("&022B")
  await expect(addresses(memory).first()).toHaveText("022B")
  await expect(memory.locator('select[name="space"]')).toHaveValue("cpu")
  await expect(memory).toHaveAttribute("space", "cpu")
  await expect(memory).toHaveAttribute("base", "_game_step")
})

test("each memory panel is offered under its label, and only the one chosen is sent", async function ({
  page
}) {
  await bootStopped(
    page,
    CPC_6128,
    `<colophon-disassembly lines="4" base="&4000" fixed></colophon-disassembly>
    <colophon-memory label="Table"></colophon-memory>
    <colophon-memory label="Screen <C000>" base="&C000" width="80"></colophon-memory>`
  )

  const table = page.locator('colophon-memory[label="Table"]'),
    screen = page.locator('colophon-memory[label="Screen <C000>"]')

  await expect(screen.locator("h2")).toHaveText("Screen <C000>")

  await page.locator("colophon-disassembly .instruction").first().click({ button: "right" })
  await expect(offered(page)).toHaveText([
    "Add breakpoint…",
    "Show in Table",
    "Show in Screen <C000>"
  ])

  await page.getByRole("button", { name: "Show in Screen <C000>" }).click()
  await expect(addresses(screen).first()).toHaveText("3D60")
  await expect(screen.locator(".row").nth(8).locator(".bytes span").nth(32)).toHaveClass(/found/u)
  await expect(screen.locator(".bytes input")).toBeFocused()
  await expect(addresses(table).first()).toHaveText("0000")
  await expect(table).not.toHaveAttribute("base")
})

test("a page with no memory panel is offered none", async function ({ page }) {
  await bootStopped(page, CPC_6128, '<colophon-disassembly lines="4"></colophon-disassembly>')

  await page.locator("colophon-disassembly .instruction").first().click({ button: "right" })
  await expect(offered(page)).toHaveText(["Add breakpoint…"])
})

test("a dump that does not scroll leaves the wheel to the page, and ends typing at its last byte", async function ({
  page
}) {
  const element = await bootStopped(
      page,
      CPC_6128,
      '<colophon-memory noscroll lines="1" width="4" base="&4000"></colophon-memory>'
    ),
    memory = page.locator("colophon-memory")

  await page.evaluate(function () {
    document.body.style.minHeight = "200vh"
  })
  await memory.locator(".dump").hover()
  await page.mouse.wheel(0, 100)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(addresses(memory)).toHaveText(["4000"])

  await memory.locator(".bytes span").nth(3).click()
  await page.keyboard.type("AB")
  await expect(memory.locator(".bytes input")).toHaveCount(0)
  await expect(addresses(memory)).toHaveText(["4000"])
  expect(await element.evaluate(host => host.machine.peek(0x4003))).toBe(0xab)
})

test("the Scroll switch and noscroll keep each other in step, with the menu left open", async function ({
  page
}) {
  await bootStopped(
    page,
    CPC_6128,
    '<colophon-memory noscroll lines="1" width="4" base="&4000"></colophon-memory>'
  )

  const memory = page.locator("colophon-memory"),
    scroll = memory.locator("label.toggle", { hasText: "Scroll" }),
    box = memory.locator('input[name="scroll"]')

  await memory.locator("colophon-options button").click()
  await expect(box).not.toBeChecked()
  await scroll.click()
  await expect(memory).not.toHaveAttribute("noscroll")
  await expect(scroll).toBeVisible()

  await memory.evaluate(panel => panel.setAttribute("noscroll", ""))
  await expect(box).not.toBeChecked()
  await memory.evaluate(panel => panel.removeAttribute("noscroll"))
  await expect(box).toBeChecked()

  await page.keyboard.press("Escape")
  await memory.locator(".dump").hover()
  await page.mouse.wheel(0, 100)
  await expect(addresses(memory)).toHaveText(["4004"])
})

test("one digit and Enter commit a byte and close its field", async function ({ page }) {
  const element = await bootStopped(
      page,
      CPC_6128,
      '<colophon-memory space="ram" lines="1" width="4" base="&100"></colophon-memory>'
    ),
    memory = page.locator("colophon-memory")

  await memory.locator(".bytes span").nth(1).click()
  await page.keyboard.type("7")
  await page.keyboard.press("Enter")
  await expect(memory.locator(".bytes input")).toHaveCount(0)
  await expect(memory.locator(".bytes span").nth(1)).toHaveText("07")
  expect(await element.evaluate(host => host.machine.ram[0x101])).toBe(0x07)
})

test("a dump moved under an open byte writes it where it was opened", async function ({ page }) {
  const element = await bootStopped(
      page,
      CPC_6128,
      '<colophon-memory space="ram" lines="2" width="4" base="&100"></colophon-memory>'
    ),
    memory = page.locator("colophon-memory")

  await element.evaluate(function (host) {
    for (let at = 0x100; at < 0x10c; at++) {
      host.machine.writeRam(at, 0)
    }
    host.machine.changed()
  })
  await memory.locator(".bytes span").nth(1).click()
  await page.keyboard.type("7")
  await memory.locator(".dump").hover()
  await page.mouse.wheel(0, 100)
  await expect(memory).toHaveAttribute("base", "&00104")
  await expect(memory.locator(".bytes input")).toHaveCount(0)
  expect(
    await element.evaluate(host => [host.machine.ram[0x101], host.machine.ram[0x105]])
  ).toEqual([7, 0])
})

test("a wheel that moves nothing leaves an open byte open", async function ({ page }) {
  const element = await bootStopped(
      page,
      CPC_6128,
      '<colophon-memory space="ram" lines="2" width="4" base="&0"></colophon-memory>'
    ),
    memory = page.locator("colophon-memory")

  await memory.locator(".bytes span").nth(1).click()
  await page.keyboard.type("7")
  await memory.locator(".dump").hover()
  await page.mouse.wheel(0, -100)
  await page.mouse.wheel(100, 0)
  await page.keyboard.type("B")
  await expect(memory).toHaveAttribute("base", "&00000")
  expect(await element.evaluate(host => host.machine.ram[0x1])).toBe(0x7b)
})

test("typing through the last byte of the banks ends the edit there", async function ({ page }) {
  const element = await bootStopped(
      page,
      CPC_6128,
      '<colophon-memory space="ram" lines="1" width="4" base="&1FFFC"></colophon-memory>'
    ),
    memory = page.locator("colophon-memory")

  await memory.locator(".bytes span").nth(3).click()
  await page.keyboard.type("AB")
  await expect(memory.locator(".bytes input")).toHaveCount(0)
  await expect(memory.locator(".bytes span").nth(3)).toHaveText("AB")
  await expect(addresses(memory)).toHaveText(["1FFFC"])
  expect(await element.evaluate(host => host.machine.ram[0x1ffff])).toBe(0xab)
})
