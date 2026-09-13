import { CPC_6128, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

function setA(element, value) {
  return element.evaluate(function (host, a) {
    host.machine.z80.a = a
    host.machine.changed()
  }, value)
}

test("a focused register is left alone by the redraw, even after Escape", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128, "<colophon-z80></colophon-z80>"),
    a = page.locator('colophon-z80 input[name="a"]')

  await setA(element, 0x22)
  await a.focus()
  await a.press("Escape")
  await setA(element, 0x33)
  expect(await a.inputValue()).toBe("22")

  await page.locator("colophon-z80 h2").click()
  await element.evaluate(host => host.machine.changed())
  await expect(a).toHaveValue("33")
})
