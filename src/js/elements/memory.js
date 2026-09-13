import { escapeHtml, hex, html, write, writeValue } from "../lang"
import { Actions } from "./actions"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"

const DEFAULT_LINES = 16,
  DEFAULT_WIDTH = 16,
  DEFAULT_SPACE = "cpu"

function renderRow(width) {
  const cells = Array.from({ length: width }, () => html`<span></span>`)

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

  input.name = "byte"
  input.maxLength = 2
  input.pattern = "[0-9A-Fa-f]{1,2}"
  input.setAttribute("aria-label", "Byte")

  return input
}

function inDocumentOrder(one, other) {
  return one.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}

class MemoryElement extends MachineObserver {
  static observedAttributes = ["base", "label", "lines", "noscroll", "space", "width"]

  static #panels = new Set()

  #base = 0
  #cells
  #characters
  #found = null
  #editing = null
  #form
  #input = createByteInput()
  #label
  #lines
  #previous
  #rows
  #scrollSwitch
  #shown = null
  #width

  static showActions(machine, at, space = DEFAULT_SPACE) {
    const panels = Array.from(MemoryElement.#panels).filter(panel => panel.machine == machine)

    return panels.sort(inDocumentOrder).map(function (panel) {
      return { label: `Show in ${panel.#label}`, execute: () => panel.#center(at, space) }
    })
  }

  watch(machine) {
    const lines = Number(this.getAttribute("lines") ?? DEFAULT_LINES),
      width = Number(this.getAttribute("width") ?? DEFAULT_WIDTH),
      label = this.getAttribute("label") ?? "Memory",
      rows = Array.from({ length: lines }, () => renderRow(width))

    this.#lines = lines
    this.#width = width
    this.#label = label
    this.#previous = new Uint8Array(lines * width)
    this.#shown = null
    this.#editing = null

    this.innerHTML = html`
      <header>
        <h2>${escapeHtml(label)}</h2>
        <colophon-options label="Memory options">
          <div class="fields">
            <label>
              Lines
              <input
                name="lines"
                aria-label="Lines"
                inputmode="numeric"
                maxlength="2"
                pattern="[1-9][0-9]?"
                value="${lines}"
              />
            </label>
            <label>
              Width
              <input
                name="width"
                aria-label="Width"
                inputmode="numeric"
                maxlength="2"
                pattern="[1-9][0-9]?"
                value="${width}"
              />
            </label>
          </div>
          <label class="toggle" title="Let the wheel, and typing past the last row, move the dump">
            <input type="checkbox" name="scroll" ${this.#scrolls ? "checked" : ""} /> Scroll
          </label>
        </colophon-options>
      </header>
      <form class="fields pairs">
        <label>
          Space
          <select name="space">
            <option value="cpu">CPU</option>
            <option value="ram">RAM</option>
          </select>
        </label>
        <label>
          <abbr title="The name or the address the dump starts at">At</abbr>
          <input
            name="at"
            aria-label="At"
            maxlength="64"
            pattern="&[0-9A-Fa-f]{1,5}|[0-9A-Fa-f]{1,4}|[A-Za-z_.$][0-9A-Za-z_.$]{0,63}"
          />
        </label>
      </form>
      <div class="dump">${rows.join("")}</div>
    `

    this.#form = this.querySelector(":scope > form")
    this.#rows = Array.from(this.querySelectorAll(".row"))
    this.#cells = Array.from(this.querySelectorAll(".bytes span"))
    this.#characters = Array.from(this.querySelectorAll(".text span"))

    const { signal } = this,
      fields = this.querySelector("colophon-options").form.elements,
      dump = this.querySelector(".dump")

    this.#scrollSwitch = fields.scroll

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("contextmenu", this.onContextMenu.bind(this), { signal })
    this.addEventListener("focusout", this.onFocusOut.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("submit", this.onSubmit.bind(this), { signal })
    dump.addEventListener("wheel", this.onWheel.bind(this), { passive: false, signal })

    machine.addEventListener("machine:changed", () => this.#render(), { signal })
    MemoryElement.#panels.add(this)
    this.#follow()
  }

  attributeChangedCallback(name) {
    if (this.machine == null) {
      super.attributeChangedCallback(name)
      return
    }

    switch (name) {
      case "base":
      case "space":
        this.#follow()
        break

      case "noscroll":
        writeValue(this.#scrollSwitch, this.#scrolls)
        break

      default:
        super.attributeChangedCallback(name)
        break
    }
  }

  dispose() {
    MemoryElement.#panels.delete(this)
    super.dispose()
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
      machine = this.machine,
      at = this.#base + index,
      items = []

    if (inProcessorSpace) {
      items.push({
        label: "Add breakpoint…",
        execute: () => BreakpointForm.create(machine, { address: at })
      })
    } else if (machine.findWrite(at, machine.ticks)) {
      items.push({ label: "Rewind to the write", execute: () => machine.rewindToWriter(at) })
    }

    if (items.length > 0) {
      event.preventDefault()
      Actions.create(event, items)
    }
  }

  onInput(event) {
    const input = this.#input,
      index = this.#editing

    event.target.setCustomValidity("")

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
    const control = event.target

    switch (control.name) {
      case "byte":
        control.blur()
        break

      case "at":
        this.#commitBase(control)
        break

      case "space":
        this.#moveTo(this.#base, control.value)
        break

      case "scroll":
        this.toggleAttribute("noscroll", !control.checked)
        break

      case "lines":
      case "width":
        if (control.checkValidity()) {
          this.setAttribute(control.name, control.value)
        }
        break

      default:
        break
    }
  }

  onKeyDown(event) {
    if (event.key != "Escape") {
      return
    }

    if (this.#editing == null) {
      this.#resetAt()
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
    if (!this.#scrolls) {
      return
    }

    event.preventDefault()
    this.#moveTo(this.#base + Math.sign(event.deltaY) * this.#width)
  }

  get #scrolls() {
    return !this.hasAttribute("noscroll")
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
          digits: ram.length > 0x10000 ? 5 : 4,
          read: at => ram[at],
          write: (at, value) => machine.writeRam(at, value)
        }
  }

  #commitBase(control) {
    if (!control.checkValidity()) {
      return
    }

    const typed = control.value,
      symbols = this.machine.symbols,
      address = symbols.addressOf(typed)

    if (address == null) {
      control.setCustomValidity("unknown name")
      control.reportValidity()
      return
    }

    if (symbols.addressNamed(typed) == null) {
      this.#moveTo(address)
    } else {
      this.#turnTo("cpu")
      this.setAttribute("base", typed)
    }

    this.#resetAt()
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
    const cells = this.#cells.length,
      base = this.#base

    if (index >= cells && this.#scrolls) {
      this.#moveTo(base + this.#width)
    }

    const shifted = index - (this.#base - base)

    if (shifted < cells) {
      this.#edit(shifted)
    } else {
      this.#stop()
    }
  }

  #center(address, space) {
    const width = this.#width,
      top = address - Math.floor(this.#lines / 2) * width,
      outOfStep = (((top - this.#base) % width) + width) % width

    this.#moveTo(top - outOfStep, space)
    this.#found = address
    this.#render()
    this.scrollIntoView({ block: "nearest" })
    this.#edit(address - this.#base)
  }

  #clamp(address) {
    const { size } = this.#space()

    return Math.min(Math.max(0, address), size - this.#cells.length)
  }

  #moveTo(address, space = this.#form.elements.space.value) {
    this.#turnTo(space)

    const { digits } = this.#space(),
      base = this.#clamp(address),
      declared = hex(base, { digits, prefix: "&" })

    this.setAttribute("base", declared)
  }

  #turnTo(space) {
    if (space != (this.getAttribute("space") ?? DEFAULT_SPACE)) {
      this.setAttribute("space", space)
    }
  }

  #follow() {
    const fields = this.#form.elements,
      declared = this.getAttribute("base") ?? "&0000",
      address = this.machine.symbols.addressOf(declared)

    fields.space.value = this.getAttribute("space") ?? DEFAULT_SPACE

    const { digits } = this.#space()

    this.#found = null
    this.#base = this.#clamp(address)
    fields.at.defaultValue = hex(this.#base, { digits, prefix: "&" })

    if (document.activeElement != fields.at) {
      this.#resetAt()
    }

    this.#render()
  }

  #resetAt() {
    const at = this.#form.elements.at

    at.setCustomValidity("")
    at.value = at.defaultValue
  }

  #render() {
    const { size, digits, read } = this.#space(),
      width = this.#width,
      moved = this.#shown != `${this.#base} ${size}`

    for (let row = 0; row < this.#lines; row++) {
      const at = this.#base + row * width

      write(this.#rows[row].querySelector(".at"), hex(at, { digits }))

      for (let column = 0; column < width; column++) {
        const index = row * width + column,
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

export { MemoryElement as Memory }
