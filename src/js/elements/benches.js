import { escapeHtml, html } from "../lang"
import { BenchForm } from "./bench_form"
import { Element } from "./element"
import benches from "../benches"

function renderItem({ id, name }) {
  return html`<li>
    <a href="?bench=${id}">${escapeHtml(name)}</a>
    <button type="button" data-bench="${id}" title="Delete bench">
      <span aria-hidden="true">×</span>
    </button>
  </li>`
}

class BenchesElement extends Element {
  init() {
    const id = new URLSearchParams(location.search).get("bench"),
      bench = benches.find(id)

    if (bench) {
      this.#place(bench)
    } else {
      this.#list()
    }
  }

  #place(bench) {
    this.innerHTML = html`
      <header>
        <a href="${location.pathname}">Benches</a>
      </header>
      <colophon-bench bench="${bench.id}"></colophon-bench>
    `

    document.title = bench.name

    this.addEventListener(
      "bench:saved",
      function (event) {
        document.title = event.detail.name
      },
      { signal: this.signal }
    )
  }

  #list() {
    const kept = benches.all()

    this.innerHTML = html`
      <header>
        <h1>Benches</h1>
        <button type="button" title="New bench"><span aria-hidden="true">+</span></button>
      </header>
      <ul>
        ${kept.map(renderItem).join("")}
      </ul>
    `

    const { signal } = this,
      create = this.querySelector("header button"),
      list = this.querySelector("ul")

    create.addEventListener("click", () => BenchForm.create(this), { signal })
    list.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("bench:saved", event => location.assign(`?bench=${event.detail.id}`), {
      signal
    })
  }

  onClick(event) {
    const button = event.target.closest("button")

    if (!button) {
      return
    }

    const item = button.closest("li"),
      name = item.querySelector("a").textContent,
      question = `Delete “${name}”?`,
      confirmed = confirm(question)

    if (confirmed) {
      benches.remove(button.dataset.bench)
      item.remove()
    }
  }
}

BenchesElement.define("colophon-benches")
