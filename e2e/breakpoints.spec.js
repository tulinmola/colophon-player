import { CPC_6128, SPECTRUM_48, bootStopped } from "./machine"
import { expect, test } from "@playwright/test"

// Both firmwares answer the interrupt here, and both are interrupted every
// frame, so a frame stepped from anywhere crosses it.
const INTERRUPT_HANDLER = 0x38

// Where each firmware keeps the variables it writes on that interrupt: a
// CPC's jumpblock and system area, a Spectrum's system variables.
const MACHINES = [
  ["a CPC", CPC_6128, 0xb100, 0xbfff],
  ["a Spectrum", SPECTRUM_48, 0x5c00, 0x5cff]
]

// A reader who sets a mark and steps a grain means to be stopped by it, so a
// step honours the marks a run honours.
for (const [name, machine, from, until] of MACHINES) {
  test(`stepping a frame stops ${name} on an execute breakpoint`, async function ({ page }) {
    const element = await bootStopped(page, machine)

    const trap = await element.evaluate(function (host, address) {
      host.machine.runFrames(150)
      host.machine.breakpoints.add(address, "execute")
      host.machine.stepFrame()

      return host.machine.trap
    }, INTERRUPT_HANDLER)

    expect(trap).toEqual({ kind: "execute", address: INTERRUPT_HANDLER })
  })

  test(`stepping a frame stops ${name} on a write watch`, async function ({ page }) {
    const element = await bootStopped(page, machine)

    const trap = await element.evaluate(
      function (host, [at, to]) {
        host.machine.runFrames(150)
        host.machine.breakpoints.add(at, "write", { until: to })
        host.machine.stepFrame()

        return host.machine.trap
      },
      [from, until]
    )

    expect(trap?.kind).toBe("write")
    expect(trap.address).toBeGreaterThanOrEqual(from)
    expect(trap.address).toBeLessThanOrEqual(until)
  })
}
