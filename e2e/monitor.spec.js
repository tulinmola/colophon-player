import { CPC_6128, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

test("the monitor's zoom starts from its attribute", async function ({ page }) {
  await bootStopped(page, CPC_6128, '<colophon-monitor zoom="2"></colophon-monitor>')

  const doubled = page.locator('colophon-monitor input[name="zoom"][value="2"]')

  await expect(doubled).toHaveAttribute("checked")
  await expect(doubled).toBeChecked()
})

test("the monitor's zoom set on the element shows in its switches", async function ({ page }) {
  await bootStopped(page, CPC_6128, "<colophon-monitor></colophon-monitor>")

  const monitor = page.locator("colophon-monitor"),
    tripled = monitor.locator('input[name="zoom"][value="3"]')

  await monitor.locator("colophon-options > button").click()
  await monitor.evaluate(panel => panel.setAttribute("zoom", "3"))
  await expect(tripled).toBeChecked()
  await expect(tripled).toHaveAttribute("checked")
  await expect(monitor.locator('input[name="zoom"]:checked')).toHaveCount(1)
  await expect(monitor.locator("form:popover-open")).toHaveCount(1)
})
