import { expect } from "@playwright/test"
import { html } from "../src/js/lang"

// No file backs this address: the test fulfils it. It is on the dev server all
// the same, so the module, the stylesheet and the firmware are the real ones.
const BENCH = "/e2e-bench.html"

export const CPC_6128 = { element: "colophon-cpc", attributes: 'model="cpc6128"' }

export const CPC_464 = { element: "colophon-cpc", attributes: 'model="cpc464"' }

export const SPECTRUM_48 = { element: "colophon-spectrum", attributes: 'model="spectrum48"' }

function markup(body) {
  return html`<!doctype html>
    <html lang="en" dir="ltr">
      <head>
        <meta charset="UTF-8" />
        <title>A machine under test</title>
        <link rel="stylesheet" href="/css/index.css" />
      </head>
      <body>
        ${body}
        <script src="/js/index.js" type="module"></script>
      </body>
    </html>`
}

export async function openPage(page, body, search = "") {
  const document = markup(body)

  await page.route(
    url => url.pathname == BENCH,
    route => route.fulfill({ contentType: "text/html", body: document })
  )

  await page.goto(`${BENCH}${search}`)
}

export function whenReady(element) {
  return element.evaluate(function (host) {
    return new Promise(function (resolve) {
      if (host.machine) {
        resolve()
        return
      }

      host.addEventListener("machine:ready", () => resolve(), { once: true })
    })
  })
}

// Stopped, so that the test and not the clock decides when a frame is
// presented.
export async function bootStopped(page, machine, panels = "") {
  const body = html`<${machine.element} ${machine.attributes}>${panels}</${machine.element}>`

  await openPage(page, body)

  const element = page.locator(machine.element)

  await whenReady(element)
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
