const TICKS_PER_MILLISECOND = 4000

// A frame is 312 lines of 64µs. Running past the time owed by that much lets
// one finish, so the picture is presented whole.
const FRAME_SLACK_TICKS = 312 * 64 * 4

// A tab hidden for an hour owes an hour of emulation. The machine loses the
// time instead, as one switched off would.
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
