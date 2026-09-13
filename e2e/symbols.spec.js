import { CPC_6128_NAMED, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

test("the symbols list each name at its address, cutting one too long for the column", async function ({
  page
}) {
  await bootStopped(page, CPC_6128_NAMED, "<colophon-symbols></colophon-symbols>")

  const cut = page.locator('.name[title="_PLY_AKG_STOPSOUNDEFFECTFROMCHANNEL"]'),
    row = page.locator("colophon-symbols .symbol").filter({ has: cut })

  await expect(row.locator(".name")).toHaveText("_PLY_AKG_STOPS…CTFROMCHANNEL")
  await expect(row.locator(".at")).toHaveText("088D")
})

test("the symbols' Lines field starts from the attribute", async function ({ page }) {
  await bootStopped(page, CPC_6128_NAMED, '<colophon-symbols lines="5"></colophon-symbols>')

  await expect(page.locator('colophon-symbols input[name="lines"]')).toHaveAttribute("value", "5")
})
