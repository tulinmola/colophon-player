const TICKS_PER_MILLISECOND = 4000

// The slack allowed for a frame to finish beyond the time owed, so the
// picture is presented whole. A standard frame is 312 lines of 64µs; one
// that runs longer is a rupture, and is presented wherever it has reached.
const FRAME_SLACK_TICKS = 312 * 64 * 4

// Coming back to a tab that has been hidden for an hour owes an hour of
// emulation. The machine loses the time instead, as a machine switched off
// would, and the page stays answerable.
const MAXIMUM_DEBT = 80 * TICKS_PER_MILLISECOND

export function createClock(machine, draw) {
  let request = null,
    last = 0,
    debt = 0

  function onAnimationFrame(now) {
    request = requestAnimationFrame(onAnimationFrame)

    debt = Math.min(debt + (now - last) * TICKS_PER_MILLISECOND, MAXIMUM_DEBT)
    last = now

    let ran = false
    while (debt > 0) {
      debt -= machine.runUntilRetrace(Math.ceil(debt) + FRAME_SLACK_TICKS)
      ran = true
    }

    if (ran) {
      draw(machine)
    }
  }

  return {
    start() {
      last = performance.now()
      request = requestAnimationFrame(onAnimationFrame)
    },

    stop() {
      cancelAnimationFrame(request)
      request = null
    }
  }
}
