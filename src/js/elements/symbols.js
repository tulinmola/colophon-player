import { hex, html, write, writeFitted, writeValue } from "../lang"
import { Actions } from "./actions"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"

const DEFAULT_LINES = 16

const ADDRESS = 5,
  NAME = 28,
  GAP = 1

const FUNNEL = html`<svg class="icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
  <path d="M1 2h10L7 6.5V11L5 9.5V6.5Z" />
</svg>`

function renderRow() {
  return html`<div class="symbol"><span class="at"></span><span class="name"></span></div>`
}

class SymbolsElement extends MachineObserver {
  static observedAttributes = ["lines"]

  #current = null
  #entries
  #count
  #form
  #options
  #rows
  #starts = new Map()

  watch(machine) {
    this.#entries = machine.symbols.all()

    this.style.setProperty("--columns", `${ADDRESS}ch ${NAME}ch`)
    this.style.setProperty("--gap", `${GAP}ch`)
    const lines = this.getAttribute("lines") ?? DEFAULT_LINES
    this.style.setProperty("--lines", lines)

    const rows = Array.from({ length: this.#entries.length }, renderRow),
      funnel = html`<label class="filter" title="Show only the names holding this"
        >${FUNNEL}<input name="filter" aria-label="Filter"
      /></label>`

    this.innerHTML = html`
      <header>
        <h2>Symbols <span></span></h2>
        <form>${funnel}</form>
        <colophon-options label="Symbols options">
          <div class="fields">
            <label>
              Lines
              <input
                name="lines"
                aria-label="Lines"
                inputmode="numeric"
                maxlength="2"
                pattern="[1-9][0-9]?"
              />
            </label>
          </div>
        </colophon-options>
      </header>
      <div class="list">${rows.join("")}</div>
    `

    this.#count = this.querySelector("h2 span")
    this.#form = this.querySelector("form:not(.options)")
    this.#rows = Array.from(this.querySelectorAll(".symbol"))

    for (let index = 0; index < this.#entries.length; index++) {
      const { name, address } = this.#entries[index],
        row = this.#rows[index]

      write(row.querySelector(".at"), hex(address, { digits: 4 }))
      writeFitted(row.querySelector(".name"), name, NAME)

      if (!this.#starts.has(address)) {
        this.#starts.set(address, index)
      }
    }

    const { signal } = this,
      options = this.querySelector("colophon-options")

    this.#options = options
    writeValue(options.form.elements.lines, String(lines))

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("contextmenu", this.onContextMenu.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })

    machine.addEventListener("machine:changed", () => this.#mark(machine), { signal })
    this.#filter()
    this.#mark(machine)
  }

  onContextMenu(event) {
    const index = this.#rows.indexOf(event.target.closest(".symbol"))

    if (index < 0) {
      return
    }

    const machine = this.machine,
      { address } = this.#entries[index]

    event.preventDefault()
    Actions.create(event, [
      { label: "Add breakpoint…", execute: () => BreakpointForm.create(machine, { address }) },
      { label: "Show in memory", execute: () => machine.showMemory(address) }
    ])
  }

  onChanged(event) {
    const control = event.target

    if (control.name == "lines" && control.checkValidity()) {
      this.setAttribute("lines", control.value)
    }
  }

  onInput() {
    this.#filter()
  }

  onKeyDown(event) {
    if (event.key != "Escape" || this.#options.contains(event.target)) {
      return
    }

    this.#form.reset()
    this.#filter()
  }

  // A form whose only text field is this one submits on Enter, and submitting
  // navigates away from the page.
  onSubmit(event) {
    event.preventDefault()
  }

  #filter() {
    const wanted = this.#form.elements.filter.value.trim().toLowerCase(),
      total = this.#rows.length
    let shown = 0

    for (let index = 0; index < this.#rows.length; index++) {
      const matches = this.#entries[index].name.toLowerCase().includes(wanted)

      this.#rows[index].hidden = !matches

      if (matches) {
        shown++
      }
    }

    write(this.#count, shown == total ? `(${total})` : `(${shown}/${total})`)
  }

  #mark(machine) {
    const standing = machine.symbols.nearest(machine.z80.pc),
      row = standing ? this.#rows[this.#starts.get(standing.address)] : null

    if (row == this.#current) {
      return
    }

    this.#current?.classList.remove("current")
    row?.classList.add("current")
    this.#current = row
  }
}

SymbolsElement.define("colophon-symbols")
