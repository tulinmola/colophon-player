import { hex, html, write, writeFitted } from "../lang"
import { MachineObserver } from "./machine_observer"
import { show } from "./fields"

const DEFAULT_LINES = 8

const ARMED = 1,
  ADDRESSES = 10,
  NAME = 16,
  KIND = 7,
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

function createRow(entry, name) {
  const row = document.createElement("div")

  row.className = "breakpoint"
  row.dataset.address = entry.address
  row.dataset.kind = entry.kind
  row.innerHTML = html`<input type="checkbox" aria-label="Armed" /><span class="at"></span
    ><span class="name"></span><span class="kind"></span
    ><button type="button" aria-label="Remove">×</button>`

  write(row.querySelector(".at"), span(entry))
  writeFitted(row.querySelector(".name"), name, NAME)
  write(row.querySelector(".kind"), entry.kind)

  return row
}

function parseAddress(text) {
  const digits = text.startsWith("&") ? text.slice(1) : text

  return parseInt(digits, 16)
}

class BreakpointsElement extends MachineObserver {
  #count
  #dialog
  #form
  #list
  #rows = new Map()

  watch(machine) {
    this.style.setProperty("--columns", `${ARMED}ch ${ADDRESSES}ch ${NAME}ch ${KIND}ch ${REMOVE}ch`)
    this.style.setProperty("--gap", `${GAP}ch`)
    this.style.setProperty("--lines", this.getAttribute("lines") ?? DEFAULT_LINES)

    this.innerHTML = html`
      <header>
        <h2>Breakpoints <span class="count"></span></h2>
        <button type="button" class="add" aria-label="Add a breakpoint">+</button>
      </header>
      <div class="list"></div>
      <dialog aria-label="New breakpoint">
        <form method="dialog">
          <h2>New breakpoint</h2>
          <div class="fields">
            <label title="A name or an address"
              >At<input
                name="at"
                aria-label="Name or address"
                maxlength="64"
                required
                autofocus
                pattern="&?[0-9A-Fa-f]{1,4}|[A-Za-z_.$][0-9A-Za-z_.$]{0,63}"
            /></label>
            <label title="The last address of a range"
              >To<input name="to" aria-label="To" maxlength="5" pattern="&?[0-9A-Fa-f]{1,4}"
            /></label>
            <label
              >Kind<select name="kind">
                <option value="execute">execute</option>
                <option value="read">read</option>
                <option value="write">write</option>
              </select></label
            >
            <label title="Your own word for it, shown in place of the symbol's"
              >Label<input name="label" aria-label="Label" maxlength="64"
            /></label>
          </div>
          <div class="actions">
            <button type="button" class="cancel">Cancel</button>
            <button>Add</button>
          </div>
        </form>
      </dialog>
    `

    this.#count = this.querySelector(".count")
    this.#dialog = this.querySelector("dialog")
    this.#form = this.querySelector("form")
    this.#list = this.querySelector(".list")

    const { signal } = this
    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })

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
    const target = event.target

    if (target.classList.contains("add")) {
      this.#form.reset()
      this.#dialog.showModal()
      return
    }

    if (target.classList.contains("cancel")) {
      this.#dialog.close()
      return
    }

    if (target.localName == "button" && target.closest(".breakpoint")) {
      const { address, kind } = this.#entryOf(target)

      this.machine.breakpoints.remove(address, kind)
      this.machine.changed()
    }
  }

  onInput(event) {
    const target = event.target

    if (target.name == "at" || target.name == "to") {
      target.setCustomValidity("")
    }
  }

  // preventDefault here refuses the close, not a navigation: method="dialog"
  // submits by closing.
  onSubmit(event) {
    if (!this.#form.reportValidity()) {
      event.preventDefault()
      return
    }

    const fields = this.#form.elements,
      address = this.#resolve(fields.at.value.trim()),
      to = fields.to.value.trim()

    if (address == null) {
      fields.at.setCustomValidity("unknown name")
      fields.at.reportValidity()
      event.preventDefault()
      return
    }

    const until = to ? parseAddress(to) : address

    if (until < address) {
      fields.to.setCustomValidity("ends before the start")
      fields.to.reportValidity()
      event.preventDefault()
      return
    }

    const label = fields.label.value.trim()

    this.machine.breakpoints.add(address, fields.kind.value, { until, label })
    this.machine.changed()
  }

  #entryOf(node) {
    const row = node.closest(".breakpoint")

    return { address: Number(row.dataset.address), kind: row.dataset.kind }
  }

  #resolve(text) {
    if (text.startsWith("&")) {
      return parseAddress(text)
    }

    const named = this.machine.symbols.addressOf(text)

    if (named != null) {
      return named
    }

    return /^[0-9A-Fa-f]{1,4}$/u.test(text) ? parseAddress(text) : null
  }

  #render(machine) {
    const entries = machine.breakpoints.all(),
      trap = machine.trap,
      seen = new Set()

    write(this.#count, `(${entries.length})`)

    let cursor = this.#list.firstElementChild

    for (const entry of entries) {
      const key = `${entry.address} ${entry.kind}`
      let row = this.#rows.get(key)

      if (!row) {
        const name = entry.label || describe(machine.symbols, entry.address)

        row = createRow(entry, name)
        this.#rows.set(key, row)
        this.#list.insertBefore(row, cursor)
      } else if (row == cursor) {
        cursor = cursor.nextElementSibling
      }

      seen.add(key)
      show(row.querySelector("input"), entry.enabled)
      const hit =
        trap != null &&
        trap.kind == entry.kind &&
        trap.address >= entry.address &&
        trap.address <= entry.until
      row.classList.toggle("hit", hit)
    }

    for (const [key, row] of this.#rows) {
      if (!seen.has(key)) {
        row.remove()
        this.#rows.delete(key)
      }
    }
  }
}

BreakpointsElement.define("colophon-breakpoints")
