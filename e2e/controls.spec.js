import { SPECTRUM_48, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

test("the speed chosen in the controls is the speed the machine runs at", async function ({
  page
}) {
  const element = await bootStopped(page, SPECTRUM_48, "<colophon-controls></colophon-controls>")

  expect(await element.evaluate(host => host.machine.speed)).toBe(1)

  await page.locator("colophon-controls colophon-options button").click()
  await page.locator('colophon-controls select[name="speed"]').selectOption("8")

  expect(await element.evaluate(host => host.machine.speed)).toBe(8)
})
