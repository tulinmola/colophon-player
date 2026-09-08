import { expect } from "@playwright/test"
import { html } from "../src/js/lang"

// No file backs this address: the test fulfils it. It is on the dev server all
// the same, so the module, the stylesheet and the firmware are the real ones.
const BENCH = "/e2e-bench.html"

export const CPC_6128 = { element: "colophon-cpc", attributes: 'model="cpc6128"' }

export const SPECTRUM_48 = { element: "colophon-spectrum", attributes: 'model="spectrum48"' }

function markup({ element, attributes }, panels) {
  return html`<!doctype html>
    <html lang="en" dir="ltr">
      <head>
        <meta charset="UTF-8" />
        <title>A machine under test</title>
        <link rel="stylesheet" href="/css/index.css" />
      </head>
      <body>
        <${element} ${attributes}>${panels}</${element}>
        <script src="/js/index.js" type="module"></script>
      </body>
    </html>`
}

// Stopped, so that the test and not the clock decides when a frame is
// presented.
export async function bootStopped(page, machine, panels = "") {
  await page.route(`**${BENCH}`, function (route) {
    return route.fulfill({ contentType: "text/html", body: markup(machine, panels) })
  })

  await page.goto(BENCH)

  const element = page.locator(machine.element)

  await element.evaluate(function (host) {
    return new Promise(function (resolve) {
      if (host.machine) {
        resolve()
        return
      }

      host.addEventListener("machine:ready", () => resolve(), { once: true })
    })
  })

  await element.evaluate(host => host.machine.stop())

  return element
}

export function pressed(element, key) {
  return element.evaluate((host, number) => host.machine.keyboard.pressed(number), key)
}

export async function expectPressed(element, keys) {
  for (const key of keys) {
    await expect.poll(() => pressed(element, key), `key ${key} pressed`).toBe(true)
  }
}

export async function expectReleased(element, keys) {
  for (const key of keys) {
    await expect.poll(() => pressed(element, key), `key ${key} released`).toBe(false)
  }
}
