import { escapeHtml, html } from "../lang"
import { Element } from "./element"
import benches from "../benches"

// Kept out of the markup: Prettier drops the backslash from one inside html``.
const NAME_PATTERN = ".*\\S.*"

function renderModelOption({ model, name }, chosen) {
  return html`<option value="${model}" ${model == chosen ? "selected" : ""}>${name}</option>`
}

class BenchFormElement extends Element {
  bench = null

  #dialog
  #form

  static create(host, bench) {
    const form = document.createElement("colophon-bench-form")

    form.bench = bench
    host.append(form)
  }

  init() {
    const { bench } = this,
      editing = bench != null,
      chosen = bench?.machine.attributes.model,
      options = benches.models.map(entry => renderModelOption(entry, chosen)).join("")

    this.innerHTML = html`
      <dialog aria-label="Bench">
        <form method="dialog">
          <h2>${editing ? "Edit bench" : "New bench"}</h2>
          <div class="fields">
            <label>
              Name
              <input
                name="name"
                value="${editing ? escapeHtml(bench.name) : ""}"
                maxlength="64"
                required
                autofocus
                pattern="${NAME_PATTERN}"
              />
            </label>
            <label>
              Machine
              <select name="model" ${editing ? "disabled" : ""}>
                ${options}
              </select>
            </label>
          </div>
          <div class="actions">
            <button type="button" data-action="cancel">Cancel</button>
            <button>${editing ? "Save" : "Create"}</button>
          </div>
        </form>
      </dialog>
    `

    this.#dialog = this.querySelector("dialog")
    this.#form = this.querySelector("form")

    const { signal } = this

    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })
    this.#dialog.addEventListener("close", () => this.remove(), { signal })

    this.#dialog.showModal()
  }

  onClick(event) {
    if (event.target.dataset.action == "cancel") {
      this.#dialog.close()
    }
  }

  onSubmit() {
    const saved = this.#save(),
      announced = new CustomEvent("bench:saved", { bubbles: true, detail: saved })

    this.dispatchEvent(announced)
  }

  #save() {
    const fields = this.#form.elements,
      name = fields.name.value.trim()

    if (this.bench) {
      return benches.rename(this.bench.id, name)
    }

    return benches.add({ name, model: fields.model.value })
  }
}

BenchFormElement.define("colophon-bench-form")

export { BenchFormElement as BenchForm }
