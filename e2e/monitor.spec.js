import { CPC_6128, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

test("the monitor's zoom starts from its attribute", async function ({ page }) {
  await bootStopped(page, CPC_6128, '<colophon-monitor zoom="2"></colophon-monitor>')

  const doubled = page.locator('colophon-monitor input[name="zoom"][value="2"]')

  await expect(doubled).toHaveAttribute("checked")
  await expect(doubled).toBeChecked()
})
