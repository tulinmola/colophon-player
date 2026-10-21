import { hex, html, resetValue, write, writeFitted, writeValue } from "../lang"
import { Actions } from "./actions"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"
import { Memory } from "./memory"

const DEFAULT_LINES = 16

const MODES = ["pass", "call", "until"],
  DEFAULT_MODE = "pass"

const NAME = 30,
  GAP = 1,
  INDENT = 1,
  FOLD = 1,
  MOST_INDENTS = 15

const COLUMNS = [
  { key: "total", label: html`Total <abbr title="microseconds">µs</abbr>`, width: 8 },
  { key: "share", label: "%", width: 6 },
  { key: "self", label: html`Self <abbr title="microseconds">µs</abbr>`, width: 8 },
  { key: "calls", label: "Calls", width: 5 },
  { key: "name", label: "Routine", width: NAME },
  { key: "at", label: "At", width: 5 }
]

function quantity(number, noun) {
  return `${number} ${noun}${number == 1 ? "" : "s"}`
}

function microsecondsOf(ticks, ticksPerMicrosecond) {
  return Math.round(ticks / ticksPerMicrosecond)
}

function describe(mode, profilingFrame, ticksPerMicrosecond) {
  const { frame, frames } = profilingFrame,
    microseconds = microsecondsOf(profilingFrame.ticks, ticksPerMicrosecond)

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
      microsecondsOf(profilingFrame.ticks, ticksPerMicrosecond)
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

function rowsOf(span) {
  const rows = []

  function visit(routine, key, depth) {
    rows.push({ routine, key, depth })

    for (const child of routine.children) {
      visit(child, `${key} ${child.reached} ${child.entry}`, depth + 1)
    }
  }

  visit(span, "span", 0)

  return rows
}

function labelOf(symbols, { entry, reached, calls }) {
  if (reached == null) {
    return { name: "profiling frame", named: false, at: "", calls: "" }
  }

  const [name] = symbols.namesAt(entry),
    address = hex(entry, { digits: 4 }),
    interrupt = reached == "interrupt"

  return {
    name: name ?? (interrupt ? "interrupt" : `&${address}`),
    named: name != null,
    at: name != null || interrupt ? address : "",
    calls: reached == "start" ? "" : String(calls)
  }
}

function createBar(tick) {
  const bar = document.createElement("button")

  bar.type = "button"
  bar.className = "bar"
  bar.dataset.action = "rewind"
  bar.dataset.tick = String(tick)

  return bar
}

// A column holds the gap its cells' padding puts before them, which the first
// does without.
function renderColumn({ width }, index) {
  return html`<col style="width: ${index == 0 ? width : width + GAP}ch" />`
}

function renderHeading({ key, label }) {
  return html`<th scope="col" class="${key}">${label}</th>`
}

function renderCell({ key }) {
  return html`<td class="${key}"></td>`
}

function createRow({ entry, reached }, key, indents) {
  const row = document.createElement("tr")

  row.className = reached == null ? "routine" : `routine ${reached}`
  row.dataset.key = key
  row.style.setProperty("--indents", indents)

  if (entry != null) {
    row.dataset.address = String(entry)
  }

  row.innerHTML = COLUMNS.map(renderCell).join("")

  const [total, share, self, calls, name, at] = row.children

  name.innerHTML = html`<button type="button" class="fold" data-action="fold"></button
    ><span></span>`

  const [fold, label] = name.children

  return { row, total, share, self, calls, fold, label, at }
}

class ProfileElement extends MachineObserver {
  static observedAttributes = ["end", "frames", "lines", "mode", "start"]

  #bars = new Map()
  #declaredFrames
  #endAddress
  #endLabel
  #form
  #replayed
  #body
  #folded = new Set()
  #rows = []
  #routines = new Map()
  #places = 0
  #startAddress
  #strip
  #summary

  watch(machine) {
    this.#declaredFrames = this.hasAttribute("frames") ? Number(this.getAttribute("frames")) : null

    const lines = Number(this.getAttribute("lines") ?? DEFAULT_LINES)

    this.style.setProperty("--gap", `${GAP}ch`)
    this.style.setProperty("--indent", `${INDENT}ch`)
    this.style.setProperty("--fold", `${FOLD}ch`)
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
      <div class="list">
        <table>
          <colgroup>
            ${COLUMNS.map(renderColumn).join("")}
          </colgroup>
          <thead>
            <tr>
              ${COLUMNS.map(renderHeading).join("")}
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `

    const [startAddress, endAddress] = this.querySelectorAll(".address")

    this.#form = this.querySelector(":scope > form")
    this.#startAddress = startAddress
    this.#endAddress = endAddress
    this.#endLabel = this.#form.elements.end.closest("label")
    this.#strip = this.querySelector(".strip")
    this.#summary = this.querySelector(".summary")
    this.#body = this.querySelector("tbody")
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
    const button = event.target.closest("button")

    if (!button) {
      return
    }

    switch (button.dataset.action) {
      case "rewind":
        this.machine.rewind(Number(button.dataset.tick))
        break

      case "fold":
        this.#fold(button.closest(".routine").dataset.key)
        break

      default:
        break
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
      { symbols } = machine,
      seen = new Set(),
      span = profilingFrame
        ? machine.profile(profilingFrame.tick, profilingFrame.tick + profilingFrame.ticks)
        : null,
      rows = span ? rowsOf(span) : []

    for (const { routine, key, depth } of rows) {
      const { ticks, totalTicks } = routine,
        { name, named, at, calls } = labelOf(symbols, routine),
        indents = Math.min(depth, MOST_INDENTS),
        total = microsecondsOf(totalTicks, ticksPerMicrosecond),
        share = (totalTicks / span.totalTicks) * 100,
        own = microsecondsOf(ticks, ticksPerMicrosecond)
      let found = this.#routines.get(key)

      if (!found) {
        found = createRow(routine, key, indents)
        this.#routines.set(key, found)
      }

      seen.add(key)
      this.#body.append(found.row)
      found.row.classList.toggle("unnamed", !named)
      found.row.classList.toggle("leaf", routine.children.length == 0)
      write(found.total, String(total))
      write(found.share, `${share.toFixed(1)}%`)
      write(found.self, String(own))
      write(found.calls, calls)
      writeFitted(found.label, name, NAME - FOLD - indents * INDENT)
      write(found.at, at)

      if (found.fold.getAttribute("aria-label") != name) {
        found.fold.setAttribute("aria-label", name)
      }
    }

    for (const [key, found] of this.#routines) {
      if (!seen.has(key)) {
        found.row.remove()
        this.#routines.delete(key)
      }
    }

    this.#rows = rows
    this.#showFolded()
  }

  #fold(key) {
    if (this.#folded.has(key)) {
      this.#folded.delete(key)
    } else {
      this.#folded.add(key)
    }

    this.#showFolded()
  }

  #showFolded() {
    let foldedAt = Infinity

    for (const { key, depth } of this.#rows) {
      if (depth <= foldedAt) {
        foldedAt = Infinity
      }

      const { row, fold } = this.#routines.get(key),
        hidden = depth > foldedAt,
        folded = this.#folded.has(key),
        expanded = String(!folded)

      if (row.hidden != hidden) {
        row.hidden = hidden
      }

      if (fold.getAttribute("aria-expanded") != expanded) {
        fold.setAttribute("aria-expanded", expanded)
      }

      if (!hidden && folded) {
        foldedAt = depth
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
