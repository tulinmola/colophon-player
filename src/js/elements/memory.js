import { hex, html, write } from "../lang"
import { renderInput, show } from "./fields"
import { MachineObserver } from "./machine_observer"

const BYTES_PER_ROW = 16,
  ROWS = 16,
  WINDOW = ROWS * BYTES_PER_ROW

function renderRow() {
  const bytes = Array.from({ length: BYTES_PER_ROW }, () => html`<span></span>`)

  return html`<div class="row">
    <span class="at"></span><span class="bytes">${bytes.join(" ")}</span><span class="text"></span>
  </div>`
}

function character(value) {
  return value >= 32 && value < 127 ? String.fromCharCode(value) : "."
}

class MemoryElement extends MachineObserver {
  #base = 0
  #bytes
  #form
  #previous = new Uint8Array(WINDOW)
  #rows
  #shown = null

  watch(machine) {
    this.innerHTML = html`
      <h2>Memory</h2>
      <form class="fields">
        <label
          >Space<select name="space">
            <option value="cpu">CPU</option>
            <option value="ram">RAM</option>
          </select></label
        >
        ${renderInput("At", "Address the dump starts at", ["at"], 5)}
      </form>
      <div class="dump">${Array.from({ length: ROWS }, renderRow).join("")}</div>
    `

    this.#form = this.querySelector("form")
    this.#rows = Array.from(this.querySelectorAll(".row"))
    this.#bytes = this.#rows.map(row => Array.from(row.querySelectorAll(".bytes span")))

    const { signal } = this
    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })
    this.addEventListener("wheel", this.onWheel.bind(this), { passive: false, signal })

    machine.addEventListener("changed", () => this.#render(), { signal })
    this.#moveTo(0)
  }

  onChanged(event) {
    if (event.target.name == "at" && event.target.checkValidity()) {
      this.#moveTo(parseInt(event.target.value, 16))
    } else {
      this.#moveTo(this.#base)
    }
  }

  // A form whose only text field is this one submits on Enter, and submitting
  // navigates away from the page.
  onSubmit(event) {
    event.preventDefault()
  }

  onKeyDown(event) {
    if (event.key == "Escape") {
      this.#form.reset()
    }
  }

  onWheel(event) {
    event.preventDefault()
    this.#moveTo(this.#base + Math.sign(event.deltaY) * BYTES_PER_ROW)
  }

  #space() {
    const space = this.#form.elements.space.value,
      ram = this.machine.ram

    return space == "cpu"
      ? { size: 0x10000, digits: 4, read: address => this.machine.peek(address) }
      : { size: ram.length, digits: 5, read: address => ram[address] }
  }

  #moveTo(address) {
    const { size, digits } = this.#space(),
      last = size - WINDOW

    this.#base = Math.min(Math.max(0, address), last) & ~(BYTES_PER_ROW - 1)
    show(this.#form.elements.at, hex(this.#base, { digits }))
    this.#render()
  }

  #render() {
    const { size, digits, read } = this.#space(),
      moved = this.#shown != `${this.#base} ${size}`

    for (let row = 0; row < ROWS; row++) {
      const at = this.#base + row * BYTES_PER_ROW
      let text = ""

      write(this.#rows[row].querySelector(".at"), hex(at, { digits }))

      for (let column = 0; column < BYTES_PER_ROW; column++) {
        const index = row * BYTES_PER_ROW + column,
          value = read(at + column),
          node = this.#bytes[row][column]

        write(node, hex(value))
        node.classList.toggle("changed", !moved && this.#previous[index] != value)
        node.classList.toggle("zero", value == 0)

        this.#previous[index] = value
        text += character(value)
      }

      write(this.#rows[row].querySelector(".text"), text)
    }

    this.#shown = `${this.#base} ${size}`
  }
}

MemoryElement.define("colophon-memory")
