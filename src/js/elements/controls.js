import { html, write, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

const GRAINS = [
  { key: "instruction", name: "Instruction", back: "stepBack", on: "step" },
  { key: "scanline", name: "Scanline", back: "stepBackScanline", on: "stepScanline" },
  { key: "row", name: "Row", back: "stepBackRow", on: "stepRow" },
  { key: "frame", name: "Frame", back: "stepBackFrame", on: "stepFrame" }
]

function renderGrain({ key, name }) {
  return html`<li><button type="button" class="key" data-grain="${key}">${name}</button></li>`
}

class ControlsElement extends MachineObserver {
  #at
  #back
  #behind
  #frame
  #grain = GRAINS[0]
  #now
  #on
  #run
  #tick

  watch(machine) {
    const { signal } = this

    this.innerHTML = html`
      <header>
        <h2>Controls</h2>
        <colophon-options label="Controls options">
          <label class="toggle" title="Stop where the program itself carries a BRK">
            <input type="checkbox" name="brk" /> Break instructions
          </label>
        </colophon-options>
      </header>
      <div class="transport">
        <button type="button" class="key square run">
          <span aria-hidden="true">▶</span>
          <span aria-hidden="true">▮▮</span>
        </button>
        <div class="step">
          <button type="button" class="key square" data-step="back">
            <span aria-hidden="true">◀</span>
          </button>
          <menu class="grains">${GRAINS.map(renderGrain).join("")}</menu>
          <button type="button" class="key square" data-step="on">
            <span aria-hidden="true">▶</span>
          </button>
        </div>
        <button type="button" class="key" data-action="returnToNow" title="Back to the present">
          Now
        </button>
      </div>
      <div class="scrub">
        <div class="fields counters">
          <label>Tick <output name="tick"></output></label>
          <label>Frame <output name="frame"></output></label>
          <label>Behind <output name="behind"></output></label>
        </div>
        <input type="range" name="at" aria-label="Position" step="1" />
      </div>
    `

    const transport = this.querySelector(".transport"),
      options = this.querySelector("colophon-options")

    this.#run = this.querySelector(".run")
    this.#back = this.querySelector('[data-step="back"]')
    this.#on = this.querySelector('[data-step="on"]')
    this.#at = this.querySelector('input[name="at"]')
    this.#now = this.querySelector('[data-action="returnToNow"]')
    this.#tick = this.querySelector('output[name="tick"]')
    this.#frame = this.querySelector('output[name="frame"]')
    this.#behind = this.querySelector('output[name="behind"]')

    writeValue(options.form.elements.brk, machine.breakInstructions)

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    transport.addEventListener("click", this.onClick.bind(this), { signal })

    const showRunning = () => this.#showRunning(machine)
    machine.addEventListener("machine:start", showRunning, { signal })
    machine.addEventListener("machine:stop", showRunning, { signal })
    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })

    this.#choose(this.#grain.key)
    showRunning()
    this.#render(machine)
  }

  onChanged(event) {
    const control = event.target

    if (control.name == "brk") {
      this.machine.breakInstructions = control.checked
    } else if (control.name == "at") {
      const at = Number(control.value)

      this.machine.rewind(at)
    }
  }

  onClick(event) {
    const button = event.target.closest("button")

    if (!button) {
      return
    }

    const { action, grain, step } = button.dataset

    if (grain) {
      this.#choose(grain)
    } else if (step) {
      this.machine[this.#grain[step]]()
    } else {
      this.machine[action]()
    }
  }

  #choose(key) {
    const chosen = GRAINS.find(grain => grain.key == key),
      named = chosen.name.toLowerCase()

    this.#grain = chosen

    for (const button of this.querySelectorAll("[data-grain]")) {
      const chose = button.dataset.grain == key

      button.toggleAttribute("data-on", chose)
      button.setAttribute("aria-pressed", String(chose))
    }

    this.#back.title = `Back one ${named}`
    this.#on.title = `On one ${named}`
  }

  #showRunning(machine) {
    const { running } = machine

    this.toggleAttribute("running", running)
    this.#run.dataset.action = running ? "stop" : "start"
    this.#run.title = running ? "Stop" : "Run"
  }

  #render(machine) {
    const at = machine.ticks,
      from = machine.historyFrom,
      until = machine.historyUntil,
      behind = until - at,
      milliseconds = (behind / machine.ticksPerMillisecond).toFixed(1),
      spoken = behind > 0 ? `${milliseconds} milliseconds back` : "the present",
      range = this.#at,
      dragging = document.activeElement == range

    if (!dragging) {
      if (range.min != from) {
        range.min = String(from)
      }

      if (range.max != until) {
        range.max = String(until)
      }
    }

    writeValue(range, String(at))

    if (range.getAttribute("aria-valuetext") != spoken) {
      range.setAttribute("aria-valuetext", spoken)
    }

    this.toggleAttribute("rewound", behind > 0)
    this.#now.disabled = behind <= 0
    this.#back.disabled = at <= from

    write(this.#tick, String(at))
    write(this.#frame, String(machine.frame))
    write(this.#behind, behind > 0 ? `−${milliseconds}ms` : "now")
  }
}

ControlsElement.define("colophon-controls")
