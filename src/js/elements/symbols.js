import { hex, html, write, writeFitted } from "../lang"
import { MachineObserver } from "./machine_observer"
import { renderFilter } from "./fields"

const DEFAULT_LINES = 16

const ADDRESS = 5,
  NAME = 28,
  GAP = 1

function renderRow() {
  return html`<div class="symbol"><span class="at"></span><span class="name"></span></div>`
}

class SymbolsElement extends MachineObserver {
  #current = null
  #entries
  #count
  #form
  #rows
  #starts = new Map()

  watch(machine) {
    this.#entries = machine.symbols.all()

    this.style.setProperty("--columns", `${ADDRESS}ch ${NAME}ch`)
    this.style.setProperty("--gap", `${GAP}ch`)
    this.style.setProperty("--lines", this.getAttribute("lines") ?? DEFAULT_LINES)

    const rows = Array.from({ length: this.#entries.length }, renderRow),
      funnel = renderFilter("Filter", "Show only the names holding this", "filter")

    this.innerHTML = html`
      <header>
        <h2>Symbols <span></span></h2>
        <form>${funnel}</form>
      </header>
      <div class="list">${rows.join("")}</div>
    `

    this.#count = this.querySelector("h2 span")
    this.#form = this.querySelector("form")
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

    const { signal } = this
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })

    machine.addEventListener("changed", () => this.#mark(machine), { signal })
    this.#filter()
    this.#mark(machine)
  }

  onInput() {
    this.#filter()
  }

  onKeyDown(event) {
    if (event.key == "Escape") {
      this.#form.reset()
      this.#filter()
    }
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
