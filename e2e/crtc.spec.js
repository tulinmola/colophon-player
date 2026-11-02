import { expect, test } from "@playwright/test"
import { bootStopped } from "./machine"

const CPC_6128_TYPE_1 = { element: "colophon-cpc", attributes: 'model="cpc6128" crtc-type="1"' },
  CPC_6128_TYPE_2 = { element: "colophon-cpc", attributes: 'model="cpc6128" crtc-type="2"' }

function crtcType(element) {
  return element.evaluate(host => host.machine.crtc.type)
}

function rebootAs(element, type) {
  return element.evaluate(function (host, value) {
    return new Promise(function (resolve) {
      host.addEventListener("machine:ready", () => resolve(), { once: true })
      host.setAttribute("crtc-type", value)
    })
  }, type)
}

function shownCounters(panel) {
  return panel
    .locator(".counters label:not([hidden]) input")
    .evaluateAll(inputs => inputs.map(input => input.name))
}

test("a CPC built as a type 1 keeps of an R8 written in the panel only what that type has", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128_TYPE_1, "<colophon-crtc></colophon-crtc>"),
    r8 = page.locator('colophon-crtc input[name="r8"]')

  expect(await crtcType(element)).toBe(1)

  await r8.fill("FF")
  await r8.press("Enter")
  await expect(r8).toHaveValue("03")
})

test("the panel names the type it watches and shows the counters that type keeps", async function ({
  page
}) {
  const element = await bootStopped(page, CPC_6128_TYPE_2, "<colophon-crtc></colophon-crtc>"),
    panel = page.locator("colophon-crtc")

  await expect(panel.locator("h2")).toHaveText("CRTC 2 MC6845")
  await expect
    .poll(() => shownCounters(panel))
    .toEqual(["c0", "c9", "c4", "c3l", "c3h", "c5", "c9Ivm"])
  await expect(panel.locator('input[name="c9Ivm"]')).toBeVisible()

  await rebootAs(element, 0)

  await expect(panel.locator("h2")).toHaveText("CRTC 0 HD6845S/UM6845")
  await expect.poll(() => shownCounters(panel)).toEqual(["c0", "c9", "c4", "c3l", "c3h"])
  await expect(panel.locator('input[name="c9Ivm"]')).toBeHidden()
})
