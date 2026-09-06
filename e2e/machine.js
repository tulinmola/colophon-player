import { expect } from "@playwright/test"

// Stopped, so that the test and not the clock decides when a frame is
// presented.
export async function bootStopped(page) {
  await page.goto("/")

  const element = page.locator("colophon-cpc")

  await element.evaluate(function (cpc) {
    return new Promise(function (resolve) {
      if (cpc.machine) {
        resolve()
        return
      }

      cpc.addEventListener("machine:ready", () => resolve(), { once: true })
    })
  })

  await element.evaluate(cpc => cpc.machine.stop())

  return element
}

export function pressed(element, key) {
  return element.evaluate((cpc, number) => cpc.machine.keyboard.pressed(number), key)
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
