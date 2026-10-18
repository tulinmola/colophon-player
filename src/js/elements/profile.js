import { hex, html, resetValue, write, writeFitted, writeValue } from "../lang"
import { Actions } from "./actions"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"
import { Memory } from "./memory"

const DEFAULT_LINES = 16

const MODES = ["pass", "call", "until"],
  DEFAULT_MODE = "pass"

const MICROSECONDS = 7,
  SHARE = 6,
  NAME = 28,
  ADDRESS = 5,
  GAP = 1

function quantity(number, noun) {
  return `${number} ${noun}${number == 1 ? "" : "s"}`
}

function microsecondsOf({ ticks }, ticksPerMicrosecond) {
  return Math.round(ticks / ticksPerMicrosecond)
}

function describe(mode, profilingFrame, ticksPerMicrosecond) {
  const { frame, frames } = profilingFrame,
    microseconds = microsecondsOf(profilingFrame, ticksPerMicrosecond)

  return mode == "pass"
    ? `From frame ${frame} · ${quantity(frames, "frame")} · ${microseconds} µs`
    : `From frame ${frame} · ${microseconds} µs`
}

function lengthsOf(mode, profilingFrames, ticksPerMicrosecond) {
  const spans = profilingFrames.map(profilingFrame => profilingFrame.frames),
    fewest = Math.min(...spans),
    most = Math.max(...spans)

  if (mode == "pass" && fewest > 0) {
    return fewest == most ? `${quantity(most, "frame")} each` : `${fewest} to ${most} frames`
  }

  const lengths = profilingFrames.map(profilingFrame =>
      microsecondsOf(profilingFrame, ticksPerMicrosecond)
    ),
    shortest = Math.min(...lengths),
    longest = Math.max(...lengths)

  return shortest == longest ? `${longest} µs each` : `${shortest} to ${longest} µs`
}

function summarise(mode, current, profilingFrames, ticksPerMicrosecond) {
  if (current) {
    return current
  }

  if (profilingFrames.length == 0) {
    return "No profiling frame has ended yet"
  }

  const lengths = lengthsOf(mode, profilingFrames, ticksPerMicrosecond)

  return `${quantity(profilingFrames.length, "profiling frame")}, ${lengths}`
}

// In ticks: a fraction of a frame multiplied back can fall short of the
// longest, which would then be drawn as running off the top.
function fittedTicks(longest, ticksPerFrame) {
  return longest > ticksPerFrame
    ? Math.ceil(longest / ticksPerFrame) * ticksPerFrame
    : longest || ticksPerFrame
}

function showAddress(symbols, control, beside, address) {
  const shown = address == null ? "" : hex(address, { digits: 4, prefix: "&" }),
    [name] = address == null ? [] : symbols.namesAt(address)

  writeValue(control, name ?? shown)
  write(beside, name ? shown : "")
}

function renderModeOption(mode) {
  return html`<option value="${mode}">${mode}</option>`
}

function routinesOf(symbols, { ticks, halted }) {
  const routines = new Map()

  for (let address = 0; address < ticks.length; address++) {
    const spent = ticks[address]

    if (spent == 0) {
      continue
    }

    const standing = symbols.nearest(address),
      key = standing ? standing.address : `page ${address >> 8}`
    let routine = routines.get(key)

    if (!routine) {
      routine = standing
        ? { key, name: standing.name, address: standing.address, ticks: 0 }
        : { key, name: `${hex(address >> 8, { prefix: "&" })}xx`, address: null, ticks: 0 }
      routines.set(key, routine)
    }

    routine.ticks += spent
  }

  if (halted > 0) {
    routines.set("halted", { key: "halted", name: "halted", address: null, ticks: halted })
  }

  return Array.from(routines.values()).sort((one, other) => other.ticks - one.ticks)
}

function createBar(tick) {
  const bar = document.createElement("button")

  bar.type = "button"
  bar.className = "bar"
  bar.dataset.tick = String(tick)

  return bar
}

function createRow() {
  const row = document.createElement("div")

  row.className = "routine"
  row.innerHTML = html`<span class="time"></span><span class="share"></span
    ><span class="name"></span><span class="at"></span>`

  const [time, share, name, at] = row.children

  return { row, time, share, name, at }
}

class ProfileElement extends MachineObserver {
  static observedAttributes = ["end", "frames", "lines", "mode", "start"]

  #bars = new Map()
  #declaredFrames
  #endAddress
  #endLabel
  #form
  #replayed
  #list
  #routines = new Map()
  #places = 0
  #startAddress
  #strip
  #summary

  watch(machine) {
    this.#declaredFrames = this.hasAttribute("frames") ? Number(this.getAttribute("frames")) : null

    const lines = Number(this.getAttribute("lines") ?? DEFAULT_LINES)

    this.style.setProperty("--columns", `${MICROSECONDS}ch ${SHARE}ch ${NAME}ch ${ADDRESS}ch`)
    this.style.setProperty("--gap", `${GAP}ch`)
    this.style.setProperty("--lines", lines)

    this.innerHTML = html`
      <header>
        <h2>Profile</h2>
        <colophon-options label="Profile options">
          <div class="fields">
            <label title="How many frames the strip stands for, or empty to fit the longest">
              Frames
              <input
                name="frames"
                aria-label="Frames"
                inputmode="numeric"
                maxlength="2"
                pattern="[1-9][0-9]?"
                value="${this.#declaredFrames ?? ""}"
              />
            </label>
            <label>
              Lines
              <input
                name="lines"
                aria-label="Lines"
                inputmode="numeric"
                maxlength="2"
                pattern="[1-9][0-9]?"
                value="${lines}"
              />
            </label>
          </div>
        </colophon-options>
      </header>
      <form class="fields">
        <label title="A name or an address: where each profiling frame begins">
          Start
          <input
            name="start"
            maxlength="64"
            pattern="&?[0-9A-Fa-f]{1,4}|[A-Za-z_.$][0-9A-Za-z_.$]{0,63}"
          />
        </label>
        <span class="address"></span>
        <label
          title="How each ends: a pass where the next begins, a call when it returns, and until at the address below or the next start"
        >
          Mode
          <select name="mode">
            ${MODES.map(renderModeOption).join("")}
          </select>
        </label>
        <label title="A name or an address: where each ends, in an until">
          End
          <input
            name="end"
            maxlength="64"
            pattern="&?[0-9A-Fa-f]{1,4}|[A-Za-z_.$][0-9A-Za-z_.$]{0,63}"
          />
        </label>
        <span class="address"></span>
      </form>
      <div class="strip" role="group" aria-label="Profiling frames"></div>
      <p class="summary"></p>
      <div class="list"></div>
    `

    const [startAddress, endAddress] = this.querySelectorAll(".address")

    this.#form = this.querySelector(":scope > form")
    this.#startAddress = startAddress
    this.#endAddress = endAddress
    this.#endLabel = this.#form.elements.end.closest("label")
    this.#strip = this.querySelector(".strip")
    this.#summary = this.querySelector(".summary")
    this.#list = this.querySelector(".list")
    this.#bars.clear()
    this.#routines.clear()
    this.#replayed = null
    this.#places = 0

    const { signal } = this

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("contextmenu", this.onContextMenu.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })

    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })

    if (this.hasAttribute("start")) {
      this.#follow(machine)
    }

    this.#render(machine)
  }

  attributeChangedCallback(name) {
    if (this.machine == null) {
      super.attributeChangedCallback(name)
      return
    }

    switch (name) {
      case "start":
        this.#follow(this.machine)
        this.machine.changed()
        break

      case "end":
      case "mode":
        if (this.hasAttribute("start")) {
          this.#follow(this.machine)
          this.machine.changed()
        }
        break

      default:
        super.attributeChangedCallback(name)
        break
    }
  }

  onChanged(event) {
    const control = event.target

    switch (control.name) {
      case "start":
      case "end":
        this.#commitAddress(control)
        break

      case "mode":
        this.setAttribute("mode", control.value)
        break

      case "frames":
      case "lines":
        if (control.value == "") {
          this.removeAttribute(control.name)
        } else if (control.checkValidity()) {
          this.setAttribute(control.name, control.value)
        }
        break

      default:
        break
    }
  }

  onClick(event) {
    const bar = event.target.closest(".bar")

    if (bar) {
      this.machine.rewind(Number(bar.dataset.tick))
    }
  }

  onContextMenu(event) {
    const row = event.target.closest(".routine")

    if (!row?.dataset.address) {
      return
    }

    const machine = this.machine,
      address = Number(row.dataset.address),
      showing = Memory.showActions(machine, address)

    event.preventDefault()
    Actions.create(event, [
      { label: "Add breakpoint…", execute: () => BreakpointForm.create(machine, { address }) },
      ...showing
    ])
  }

  onInput(event) {
    event.target.setCustomValidity("")
  }

  onKeyDown(event) {
    const control = event.target

    if (event.key != "Escape") {
      return
    }

    switch (control.name) {
      case "start":
      case "end":
        resetValue(control)
        break

      default:
        break
    }
  }

  #commitAddress(control) {
    const symbols = this.machine.symbols,
      typed = control.value

    if (typed == "") {
      this.removeAttribute(control.name)
      return
    }

    if (!control.checkValidity()) {
      return
    }

    const address = symbols.addressOf(typed)

    if (address == null) {
      control.setCustomValidity("unknown name")
      control.reportValidity()
      return
    }

    const named = symbols.addressNamed(typed) != null,
      declared = named ? typed : hex(address, { digits: 4, prefix: "&" })

    this.setAttribute(control.name, declared)
    resetValue(control)
  }

  #follow(machine) {
    const { symbols } = machine,
      declared = this.getAttribute("start"),
      start = declared == null ? null : symbols.addressOf(declared),
      mode = this.getAttribute("mode") ?? DEFAULT_MODE,
      end = mode == "until" ? this.getAttribute("end") : null

    machine.profiling =
      start == null ? null : { start, mode, end: end == null ? null : symbols.addressOf(end) }
  }

  #showProfiling(machine) {
    const { start, mode, end } = machine.profiling ?? {},
      { elements } = this.#form,
      declaring = this.hasAttribute("start"),
      shownMode = mode ?? this.getAttribute("mode") ?? DEFAULT_MODE,
      until = shownMode == "until"

    showAddress(machine.symbols, elements.start, this.#startAddress, start)
    showAddress(machine.symbols, elements.end, this.#endAddress, end)

    if (elements.mode.value != shownMode) {
      elements.mode.value = shownMode
    }

    if (elements.mode.disabled == declaring) {
      elements.mode.disabled = !declaring
    }

    if (this.#endLabel.hidden == until) {
      this.#endLabel.hidden = !until
      this.#endAddress.hidden = !until
    }

    if (elements.end.disabled == declaring) {
      elements.end.disabled = !declaring
    }
  }

  #showInside(machine, profilingFrame) {
    const replayed = profilingFrame ? `${profilingFrame.tick} ${profilingFrame.ticks}` : null

    if (replayed == this.#replayed) {
      return
    }

    this.#replayed = replayed

    const ticksPerMicrosecond = machine.ticksPerMillisecond / 1000,
      seen = new Set(),
      spent = profilingFrame
        ? machine.profile(profilingFrame.tick, profilingFrame.tick + profilingFrame.ticks)
        : null,
      routines = spent ? routinesOf(machine.symbols, spent) : []

    for (const { key, name, address, ticks } of routines) {
      let found = this.#routines.get(key)

      if (!found) {
        found = createRow()
        found.row.classList.toggle("unnamed", address == null)

        if (address != null) {
          found.row.dataset.address = String(address)
        }

        this.#routines.set(key, found)
      }

      seen.add(key)
      this.#list.append(found.row)
      write(found.time, String(Math.round(ticks / ticksPerMicrosecond)))
      write(found.share, `${((ticks / profilingFrame.ticks) * 100).toFixed(1)}%`)
      writeFitted(found.name, name, NAME)
      write(found.at, address == null ? "" : hex(address, { digits: 4 }))
    }

    for (const [key, found] of this.#routines) {
      if (!seen.has(key)) {
        found.row.remove()
        this.#routines.delete(key)
      }
    }
  }

  #render(machine) {
    const cuts = machine.profilingCuts(),
      ticksPerMicrosecond = machine.ticksPerMillisecond / 1000,
      standing = machine.ticks,
      profilingFrames = [],
      seen = new Set()

    for (let index = 0; index + 1 < cuts.length; index++) {
      const start = cuts[index],
        end = cuts[index + 1]

      if (!start.opens) {
        continue
      }

      profilingFrames.push({
        tick: start.tick,
        frame: start.frame,
        ticks: end.tick - start.tick,
        frames: end.frame - start.frame,
        stands: standing >= start.tick && standing < end.tick
      })
    }

    const mode = machine.profiling?.mode,
      longest = Math.max(0, ...profilingFrames.map(profilingFrame => profilingFrame.ticks)),
      stripTicks =
        this.#declaredFrames == null
          ? fittedTicks(longest, machine.ticksPerFrame)
          : this.#declaredFrames * machine.ticksPerFrame,
      stripFrames = stripTicks / machine.ticksPerFrame
    let current = null

    this.#showProfiling(machine)

    if (this.style.getPropertyValue("--frames") != String(stripFrames)) {
      this.style.setProperty("--frames", stripFrames)
    }

    if (profilingFrames.length > this.#places || profilingFrames.length == 0) {
      this.#places = profilingFrames.length
      this.style.setProperty("--places", this.#places)
    }

    for (const profilingFrame of profilingFrames) {
      const { tick, ticks, stands } = profilingFrame,
        height = String(Math.min(ticks / stripTicks, 1)),
        description = describe(mode, profilingFrame, ticksPerMicrosecond)
      let bar = this.#bars.get(tick)

      if (!bar) {
        bar = createBar(tick)
        this.#bars.set(tick, bar)
        this.#strip.append(bar)
      }

      seen.add(tick)

      if (bar.title != description) {
        bar.title = description
      }

      if (bar.style.getPropertyValue("--height") != height) {
        bar.style.setProperty("--height", height)
      }

      bar.classList.toggle("clipped", ticks > stripTicks)
      bar.classList.toggle("current", stands)

      if (stands) {
        current = description
      }
    }

    for (const [tick, bar] of this.#bars) {
      if (!seen.has(tick)) {
        bar.remove()
        this.#bars.delete(tick)
      }
    }

    const summary =
      machine.profiling == null
        ? ""
        : summarise(mode, current, profilingFrames, ticksPerMicrosecond)

    write(this.#summary, summary)

    const standingIn = profilingFrames.find(profilingFrame => profilingFrame.stands)

    this.#showInside(machine, standingIn)
  }
}

ProfileElement.define("colophon-profile")
