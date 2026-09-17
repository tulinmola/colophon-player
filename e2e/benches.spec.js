import { expect, test } from "@playwright/test"
import { openPage, whenReady } from "./machine"

function visit(page, search = "") {
  return openPage(page, "<colophon-benches></colophon-benches>", search)
}

async function makeBench(page, name, model) {
  await page.getByRole("button", { name: "New bench" }).click()
  await page.getByLabel("Name").fill(name)
  await page.getByLabel("Machine").selectOption(model)
  await page.getByRole("button", { name: "Create" }).click()
}

async function rename(page, name) {
  await page.getByRole("button", { name: "Edit bench" }).click()
  await page.getByLabel("Name").fill(name)
  await page.getByRole("button", { name: "Save" }).click()
}

test("a bench made on the page opens on the machine it was made on", async function ({ page }) {
  await visit(page)
  await makeBench(page, "A 464 at its prompt", "cpc464")

  const machine = page.locator("colophon-cpc")

  await expect(machine).toHaveAttribute("model", "cpc464")
  await whenReady(machine)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A 464 at its prompt")
  await expect(page).toHaveTitle("A 464 at its prompt")
})

test("a bench is listed once made, and is still there after a reload", async function ({ page }) {
  await visit(page)
  await makeBench(page, "A Spectrum", "spectrum48")
  await page.getByRole("link", { name: "Benches" }).click()
  await page.reload()
  await page.getByRole("link", { name: "A Spectrum" }).click()

  await expect(page.locator("colophon-spectrum")).toHaveAttribute("model", "spectrum48")
})

test("benches made in two tabs are both kept", async function ({ context, page }) {
  const other = await context.newPage()

  await visit(page)
  await visit(other)
  await makeBench(page, "From the first", "cpc6128")
  await makeBench(other, "From the second", "spectrum48")
  await page.getByRole("link", { name: "Benches" }).click()

  await expect(page.getByRole("list").getByRole("link")).toHaveText([
    "From the first",
    "From the second"
  ])
})

test("a bench removed from the list is gone after a reload", async function ({ page }) {
  await visit(page)
  await makeBench(page, "Kept", "cpc6128")
  await page.getByRole("link", { name: "Benches" }).click()
  await makeBench(page, "Removed", "spectrum48")
  await page.getByRole("link", { name: "Benches" }).click()

  const removed = page.getByRole("listitem").filter({ hasText: "Removed" })

  page.once("dialog", dialog => dialog.accept())
  await removed.getByRole("button", { name: "Delete bench" }).click()

  const links = page.getByRole("list").getByRole("link")

  await expect(links).toHaveText(["Kept"])

  await page.reload()

  await expect(links).toHaveText(["Kept"])
})

test("a bench whose removal is not confirmed stays", async function ({ page }) {
  await visit(page)
  await makeBench(page, "Kept", "cpc6128")
  await page.getByRole("link", { name: "Benches" }).click()

  page.once("dialog", dialog => dialog.dismiss())
  await page.getByRole("button", { name: "Delete bench" }).click()
  await page.reload()

  await expect(page.getByRole("list").getByRole("link")).toHaveText(["Kept"])
})

test("a name of nothing but blank space is refused", async function ({ page }) {
  await visit(page)
  await makeBench(page, " \t ", "cpc6128")

  await expect(page.getByRole("dialog", { name: "Bench" })).toBeVisible()
  await expect(page.locator("colophon-cpc")).toHaveCount(0)
})

test("a name is shown as it was typed, markup and all", async function ({ page }) {
  await visit(page)
  await makeBench(page, "<b>bold</b>", "cpc6128")

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("<b>bold</b>")

  await page.getByRole("link", { name: "Benches" }).click()

  await expect(page.getByRole("link", { name: "<b>bold</b>" })).toBeVisible()
})

test("an address naming no bench kept here shows the list", async function ({ page }) {
  await visit(page, "?bench=7")

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Benches")
})

test("a bench renamed from its heading keeps the new name after a reload", async function ({
  page
}) {
  await visit(page)
  await makeBench(page, "Before", "cpc6128")
  await rename(page, "After")

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("After")
  await expect(page).toHaveTitle("After")

  await page.reload()

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("After")
})

test("renaming a bench leaves its machine where it stood", async function ({ page }) {
  await visit(page)
  await makeBench(page, "Before", "cpc6128")

  const machine = page.locator("colophon-cpc")

  await whenReady(machine)
  await machine.evaluate(host => host.machine.stop())

  const ticks = await machine.evaluate(host => host.machine.ticks)

  await rename(page, "After")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("After")

  expect(await machine.evaluate(host => host.machine.ticks)).toBe(ticks)
})

test("the machine a bench was made on cannot be changed", async function ({ page }) {
  await visit(page)
  await makeBench(page, "A 664", "cpc664")
  await page.getByRole("button", { name: "Edit bench" }).click()

  const chosen = page.getByLabel("Machine")

  await expect(chosen).toBeDisabled()
  await expect(chosen).toHaveValue("cpc664")
})
