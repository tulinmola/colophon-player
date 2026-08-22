import { hex, html, write } from "../lang"
import { Element } from "./element"

const KINDS = ["execute", "read", "write"]

function parseAddress(text) {
  const digits = text.startsWith("&") ? text.slice(1) : text

  return parseInt(digits, 16)
}

function renderKindOption(kind) {
  return html`<option value="${kind}">${kind}</option>`
}

function addressOf(machine, text) {
  if (text.startsWith("&")) {
    return parseAddress(text)
  }

  const named = machine.symbols.addressOf(text)

  if (named != null) {
    return named
  }

  return /^[0-9A-Fa-f]{1,4}$/u.test(text) ? parseAddress(text) : null
}

function span(from, until) {
  return until > from ? hex(until, { digits: 4, prefix: "&" }) : ""
}

class BreakpointFormElement extends Element {
  breakpoint = {}
  machine = null

  #dialog
  #form
  #standing = null

  static create(machine, breakpoint = {}) {
    const form = document.createElement("colophon-breakpoint-form")

    form.machine = machine
    form.breakpoint = breakpoint
    document.body.append(form)
  }

  init() {
    this.innerHTML = html`
      <dialog aria-label="Breakpoint">
        <form method="dialog">
          <h2></h2>
          <div class="fields">
            <label title="A name or an address"
              >At<input
                name="at"
                maxlength="64"
                required
                autofocus
                pattern="&?[0-9A-Fa-f]{1,4}|[A-Za-z_.$][0-9A-Za-z_.$]{0,63}"
            /></label>
            <label title="The last address of a range"
              >To<input name="to" maxlength="5" pattern="&?[0-9A-Fa-f]{1,4}"
            /></label>
            <label
              >Kind<select name="kind">
                ${KINDS.map(renderKindOption).join("")}
              </select></label
            >
            <label title="Your own word for it, shown in place of the symbol's"
              >Label<input name="label" maxlength="64"
            /></label>
          </div>
          <div class="actions">
            <button type="button" data-action="cancel">Cancel</button>
            <button data-action="commit"></button>
          </div>
        </form>
      </dialog>
    `

    this.#dialog = this.querySelector("dialog")
    this.#form = this.querySelector("form")

    const { signal } = this
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })
    this.#dialog.addEventListener("close", () => this.remove(), { signal })

    this.#fill()
    this.#dialog.showModal()
  }

  onClick(event) {
    if (event.target.dataset.action == "cancel") {
      this.#dialog.close()
    }
  }

  onInput(event) {
    event.target.setCustomValidity("")
  }

  // preventDefault here refuses the close, not a navigation: method="dialog"
  // submits by closing.
  onSubmit(event) {
    if (!this.#save()) {
      event.preventDefault()
    }
  }

  #fill() {
    const machine = this.machine,
      fields = this.#form.elements,
      { address, kind } = this.breakpoint

    if (address != null) {
      fields.at.value = hex(address, { digits: 4, prefix: "&" })
    }

    if (kind) {
      fields.kind.value = kind
    }

    const standing = address == null ? null : machine.breakpoints.get(address, fields.kind.value)

    if (standing) {
      fields.to.value = span(standing.address, standing.until)
      fields.label.value = standing.label
    }

    this.#standing = standing
    write(this.querySelector("h2"), standing ? "Edit breakpoint" : "New breakpoint")
    write(this.querySelector("[data-action=commit]"), standing ? "Save" : "Add")
  }

  #save() {
    const form = this.#form

    if (!form.reportValidity()) {
      return false
    }

    const machine = this.machine,
      fields = form.elements,
      at = addressOf(machine, fields.at.value.trim()),
      to = fields.to.value.trim()

    if (at == null) {
      fields.at.setCustomValidity("unknown name")
      fields.at.reportValidity()
      return false
    }

    const until = to ? parseAddress(to) : at

    if (until < at) {
      fields.to.setCustomValidity("ends before the start")
      fields.to.reportValidity()
      return false
    }

    if (this.#standing) {
      machine.breakpoints.remove(this.#standing.address, this.#standing.kind)
    }

    machine.breakpoints.add(at, fields.kind.value, { until, label: fields.label.value.trim() })
    machine.changed()

    return true
  }
}

BreakpointFormElement.define("colophon-breakpoint-form")

export { BreakpointFormElement as BreakpointForm }
