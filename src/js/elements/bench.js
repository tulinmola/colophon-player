import { escapeHtml, html, write } from "../lang"
import { BenchForm } from "./bench_form"
import { Element } from "./element"
import benches from "../benches"

function renderAttributes(attributes) {
  return Object.entries(attributes)
    .map(([name, value]) => html`${name}="${escapeHtml(value)}"`)
    .join(" ")
}

function renderPanel({ element, attributes }) {
  return html`<${element} ${renderAttributes(attributes)}></${element}>`
}

function renderMachine({ element, attributes }, panels) {
  return html`<${element} ${renderAttributes(attributes)}>
    ${panels.map(renderPanel).join("")}
  </${element}>`
}

class BenchElement extends Element {
  #bench

  init() {
    const id = this.getAttribute("bench"),
      bench = benches.find(id)

    this.innerHTML = html`
      <header>
        <h1>${escapeHtml(bench.name)}</h1>
        <button type="button" title="Edit bench"><span aria-hidden="true">✎</span></button>
      </header>
      ${renderMachine(bench.machine, bench.panels)}
    `

    this.#bench = bench

    const { signal } = this,
      edit = this.querySelector("header button")

    edit.addEventListener("click", () => BenchForm.create(this, this.#bench), { signal })
    this.addEventListener("bench:saved", this.onSaved.bind(this), { signal })
  }

  onSaved(event) {
    const saved = event.detail

    this.#bench = saved
    write(this.querySelector("h1"), saved.name)
  }
}

BenchElement.define("colophon-bench")
