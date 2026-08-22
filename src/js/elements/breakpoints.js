import { hex, html, write, writeFitted } from "../lang"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"
import { show } from "./fields"

const DEFAULT_LINES = 8

const ARMED = 1,
  ADDRESSES = 10,
  NAME = 16,
  KIND = 7,
  EDIT = 1,
  REMOVE = 1,
  GAP = 1

function describe(symbols, address) {
  const standing = symbols.nearest(address)

  if (!standing) {
    return ""
  }

  return standing.offset
    ? `${standing.name}+${hex(standing.offset, { prefix: "&" })}`
    : standing.name
}

function span(entry) {
  const from = hex(entry.address, { digits: 4 })

  return entry.until > entry.address ? `${from}-${hex(entry.until, { digits: 4 })}` : from
}

function createRow(entry) {
  const row = document.createElement("div")

  row.className = "breakpoint"
  row.dataset.address = entry.address
  row.dataset.kind = entry.kind
  row.innerHTML = html`<input type="checkbox" aria-label="Armed" /><span class="at"></span
    ><span></span><span></span
    ><button type="button" data-action="edit" title="Edit breakpoint">
      <span aria-hidden="true">✎</span></button
    ><button type="button" data-action="delete" title="Delete breakpoint">
      <span aria-hidden="true">×</span>
    </button>`

  const [armed, at, name, kind] = row.children

  return { row, armed, at, name, kind }
}

class BreakpointsElement extends MachineObserver {
  #count
  #list
  #rows = new Map()

  watch(machine) {
    this.style.setProperty(
      "--columns",
      `${ARMED}ch ${ADDRESSES}ch ${NAME}ch ${KIND}ch ${EDIT}ch ${REMOVE}ch`
    )
    this.style.setProperty("--gap", `${GAP}ch`)
    this.style.setProperty("--lines", this.getAttribute("lines") ?? DEFAULT_LINES)

    this.innerHTML = html`
      <header>
        <h2>Breakpoints <span></span></h2>
        <button type="button" data-action="add" title="Add breakpoint">
          <span aria-hidden="true">+</span>
        </button>
      </header>
      <div class="list"></div>
    `

    this.#count = this.querySelector("h2 span")
    this.#list = this.querySelector(".list")

    const { signal } = this
    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("click", this.onClick.bind(this), { signal })

    machine.addEventListener("changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  onChanged(event) {
    const target = event.target

    if (target.type == "checkbox") {
      const { address, kind } = this.#entryOf(target)

      this.machine.breakpoints.enable(address, kind, target.checked)
      this.machine.changed()
    }
  }

  onClick(event) {
    const button = event.target.closest("button")

    if (!button) {
      return
    }

    switch (button.dataset.action) {
      case "add":
        BreakpointForm.create(this.machine)
        break

      case "edit":
        BreakpointForm.create(this.machine, this.#entryOf(button))
        break

      case "delete": {
        const { address, kind } = this.#entryOf(button)

        this.machine.breakpoints.remove(address, kind)
        this.machine.changed()
        break
      }

      default:
        break
    }
  }

  #entryOf(node) {
    const row = node.closest(".breakpoint")

    return { address: Number(row.dataset.address), kind: row.dataset.kind }
  }

  #render(machine) {
    const entries = machine.breakpoints.all(),
      trap = machine.trap,
      seen = new Set()

    write(this.#count, `(${entries.length})`)

    let cursor = this.#list.firstElementChild

    for (const entry of entries) {
      const key = `${entry.address} ${entry.kind}`
      let found = this.#rows.get(key)

      if (!found) {
        found = createRow(entry)
        this.#rows.set(key, found)
        this.#list.insertBefore(found.row, cursor)
      } else if (found.row == cursor) {
        cursor = cursor.nextElementSibling
      }

      seen.add(key)
      write(found.at, span(entry))
      writeFitted(found.name, entry.label || describe(machine.symbols, entry.address), NAME)
      write(found.kind, entry.kind)
      show(found.armed, entry.enabled)

      const hit =
        trap != null &&
        trap.kind == entry.kind &&
        trap.address >= entry.address &&
        trap.address <= entry.until

      found.row.classList.toggle("hit", hit)
    }

    for (const [key, found] of this.#rows) {
      if (!seen.has(key)) {
        found.row.remove()
        this.#rows.delete(key)
      }
    }
  }
}

BreakpointsElement.define("colophon-breakpoints")
