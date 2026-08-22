import { hex, html, write } from "../lang"
import { renderInput, show } from "./fields"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"
import { Options } from "./options"

const BYTES_PER_ROW = 16,
  ROWS = 16,
  WINDOW = ROWS * BYTES_PER_ROW

function renderRow() {
  const cells = Array.from({ length: BYTES_PER_ROW }, () => html`<span></span>`)

  return html`<div class="row">
    <span class="at"></span><span class="bytes">${cells.join(" ")}</span
    ><span class="text">${cells.join("")}</span>
  </div>`
}

function character(value) {
  return value >= 32 && value < 127 ? String.fromCharCode(value) : "."
}

function createByteInput() {
  const input = document.createElement("input")

  input.maxLength = 2
  input.pattern = "[0-9A-Fa-f]{1,2}"
  input.setAttribute("aria-label", "Byte")

  return input
}

class MemoryElement extends MachineObserver {
  #base = 0
  #cells
  #characters
  #found = null
  #editing = null
  #form
  #input = createByteInput()
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
    this.#cells = Array.from(this.querySelectorAll(".bytes span"))
    this.#characters = Array.from(this.querySelectorAll(".text span"))

    const { signal } = this
    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("contextmenu", this.onContextMenu.bind(this), { signal })
    this.addEventListener("focusout", this.onFocusOut.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })
    this.addEventListener("wheel", this.onWheel.bind(this), { passive: false, signal })

    machine.addEventListener("changed", () => this.#render(), { signal })
    machine.addEventListener("memory:center", event => this.#center(event.detail.at), { signal })
    this.#moveTo(0)
  }

  onClick(event) {
    const index = this.#cells.indexOf(event.target)

    if (index >= 0) {
      this.#edit(index)
    }
  }

  onContextMenu(event) {
    const cell = this.#cells.indexOf(event.target),
      index = cell < 0 ? this.#characters.indexOf(event.target) : cell

    if (index < 0) {
      return
    }

    const inProcessorSpace = this.#form.elements.space.value == "cpu",
      at = this.#base + index,
      items = []

    if (inProcessorSpace) {
      items.push({
        label: "Add breakpoint…",
        execute: () => BreakpointForm.create(this.machine, { address: at })
      })
    }

    if (items.length > 0) {
      event.preventDefault()
      Options.create(event, items)
    }
  }

  onInput(event) {
    const input = this.#input,
      index = this.#editing

    if (event.target == input && input.value.length == 2 && input.checkValidity()) {
      this.#commit()
      this.#move(index + 1)
    }
  }

  onFocusOut(event) {
    if (event.target == this.#input) {
      this.#commit()
      this.#stop()
    }
  }

  onChanged(event) {
    if (event.target == this.#input) {
      this.#input.blur()
    } else if (event.target.name == "at" && event.target.checkValidity()) {
      this.#moveTo(parseInt(event.target.value, 16))
    } else {
      this.#moveTo(this.#base)
    }
  }

  onKeyDown(event) {
    if (event.key != "Escape") {
      return
    }

    if (this.#editing == null) {
      this.#form.reset()
    } else {
      this.#editing = null
      this.#input.blur()
    }
  }

  // A form whose only text field is this one submits on Enter, and submitting
  // navigates away from the page.
  onSubmit(event) {
    event.preventDefault()
  }

  onWheel(event) {
    event.preventDefault()
    this.#moveTo(this.#base + Math.sign(event.deltaY) * BYTES_PER_ROW)
  }

  #space() {
    const space = this.#form.elements.space.value,
      machine = this.machine,
      ram = machine.ram

    return space == "cpu"
      ? {
          size: 0x10000,
          digits: 4,
          read: at => machine.peek(at),
          write: (at, value) => machine.poke(at, value)
        }
      : {
          size: ram.length,
          digits: 5,
          read: at => ram[at],
          write: (at, value) => {
            ram[at] = value
          }
        }
  }

  #edit(index) {
    const input = this.#input

    input.blur()
    this.#editing = index
    input.value = hex(this.#space().read(this.#base + index))
    this.#cells[index].replaceChildren(input)
    input.focus()
    input.select()
  }

  #commit() {
    const input = this.#input,
      index = this.#editing

    if (index == null) {
      return
    }

    this.#editing = null

    if (input.value && input.checkValidity()) {
      this.#space().write(this.#base + index, parseInt(input.value, 16))
      this.machine.changed()
    }
  }

  #stop() {
    this.#input.remove()
    this.#render()
  }

  #move(index) {
    if (index < WINDOW) {
      this.#edit(index)
    } else {
      this.#moveTo(this.#base + BYTES_PER_ROW)
      this.#edit(WINDOW - BYTES_PER_ROW)
    }
  }

  #center(address) {
    this.#form.elements.space.value = "cpu"
    this.#moveTo(address - WINDOW / 2, address)
    this.scrollIntoView({ block: "nearest" })
  }

  #moveTo(address, marked = null) {
    const { size, digits } = this.#space(),
      last = size - WINDOW

    this.#found = marked

    this.#base = Math.min(Math.max(0, address), last) & ~(BYTES_PER_ROW - 1)
    show(this.#form.elements.at, hex(this.#base, { digits }))
    this.#render()
  }

  #render() {
    const { size, digits, read } = this.#space(),
      moved = this.#shown != `${this.#base} ${size}`

    for (let row = 0; row < ROWS; row++) {
      const at = this.#base + row * BYTES_PER_ROW

      write(this.#rows[row].querySelector(".at"), hex(at, { digits }))

      for (let column = 0; column < BYTES_PER_ROW; column++) {
        const index = row * BYTES_PER_ROW + column,
          value = read(at + column),
          node = this.#cells[index]

        const found = this.#found == at + column

        if (index != this.#editing) {
          write(node, hex(value))
          node.classList.toggle("changed", !moved && this.#previous[index] != value)
          node.classList.toggle("zero", value == 0)
        }

        node.classList.toggle("found", found)
        this.#previous[index] = value
        write(this.#characters[index], character(value))
        this.#characters[index].classList.toggle("found", found)
      }
    }

    this.#shown = `${this.#base} ${size}`
  }
}

MemoryElement.define("colophon-memory")
