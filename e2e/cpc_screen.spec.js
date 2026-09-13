import { CPC_6128, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

test("a screen's options start from what its attributes declare", async function ({ page }) {
  await bootStopped(
    page,
    CPC_6128,
    '<colophon-cpc-screen base="&8000" width="100" height="40" rasters="2" mode="0" zoom="2" view="beam"></colophon-cpc-screen>'
  )

  const screen = page.locator("colophon-cpc-screen")

  await expect(screen.locator('input[name="base"]')).toHaveAttribute("value", "8000")
  await expect(screen.locator('input[name="width"]')).toHaveAttribute("value", "100")
  await expect(screen.locator('input[name="height"]')).toHaveAttribute("value", "40")
  await expect(screen.locator('input[name="rasters"]')).toHaveAttribute("value", "2")
  await expect(screen.locator('input[name="beam"]')).toBeChecked()
  await expect(screen.locator('input[name="heat"]')).not.toBeChecked()
  await expect(screen.locator('input[name="mode"][value="0"]')).toHaveAttribute("checked")
  await expect(screen.locator('input[name="mode"][value="0"]')).toBeChecked()
  await expect(screen.locator('input[name="zoom"][value="2"]')).toHaveAttribute("checked")
  await expect(screen.locator('input[name="zoom"][value="2"]')).toBeChecked()
  await expect(screen.locator('option[value="video"]')).toHaveAttribute("selected")
  await expect(screen.locator('select[name="reading"]')).toHaveValue("video")
})

test("a screen's view and zoom set on the element show in its switches", async function ({ page }) {
  await bootStopped(page, CPC_6128, '<colophon-cpc-screen view="beam"></colophon-cpc-screen>')

  const screen = page.locator("colophon-cpc-screen"),
    tripled = screen.locator('input[name="zoom"][value="3"]')

  await screen.locator("colophon-options > button").click()
  await screen.evaluate(function (panel) {
    panel.setAttribute("view", "heat")
    panel.setAttribute("zoom", "3")
  })
  await expect(screen.locator('input[name="beam"]')).not.toBeChecked()
  await expect(screen.locator('input[name="heat"]')).toBeChecked()
  await expect(tripled).toBeChecked()
  await expect(tripled).toHaveAttribute("checked")
  await expect(screen.locator('input[name="zoom"]:checked')).toHaveCount(1)
  await expect(screen.locator("form:popover-open")).toHaveCount(1)
})

test("a screen read linearly selects Linear, and has no rasters to set", async function ({ page }) {
  await bootStopped(page, CPC_6128, '<colophon-cpc-screen reading="linear"></colophon-cpc-screen>')

  const screen = page.locator("colophon-cpc-screen")

  await expect(screen.locator('option[value="linear"]')).toHaveAttribute("selected")
  await expect(screen.locator('select[name="reading"]')).toHaveValue("linear")
  await expect(screen.locator('input[name="rasters"]')).toHaveCount(0)
})
