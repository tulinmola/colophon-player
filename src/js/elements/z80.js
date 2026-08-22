import { hex, html } from "../lang"
import { renderAbbreviation, renderInput, renderOutput, show } from "./fields"
import { MachineObserver } from "./machine_observer"

const FLAGS = [
  ["flagS", "S", "Sign"],
  ["flagZ", "Z", "Zero"],
  ["flagY", "Y", "Undocumented, bit 5 of F"],
  ["flagH", "H", "Half carry"],
  ["flagX", "X", "Undocumented, bit 3 of F"],
  ["flagPV", "P", "Parity/overflow"],
  ["flagN", "N", "Add/subtract"],
  ["flagC", "C", "Carry"]
]

function bit(on) {
  return on ? "1" : "."
}

function renderMode(label, meaning, name) {
  return html`<label
    >${renderAbbreviation(label, meaning)}<span class="input-group"
      ><input name="${name}" aria-label="${label}" maxlength="1" pattern="[0-2]" /></span
  ></label>`
}

function renderState(label, meaning, name) {
  return html`<label
    >${renderAbbreviation(label, meaning)}<input
      type="checkbox"
      class="state"
      name="${name}"
      aria-label="${label}"
  /></label>`
}

function renderFlag([field, letter, meaning]) {
  return html`<label
    ><input
      type="checkbox"
      name="${field}"
      aria-label="${letter}"
    />${renderAbbreviation(letter, meaning)}</label
  >`
}

class Z80Element extends MachineObserver {
  #form

  watch(machine) {
    this.innerHTML = html`
      <h2>Z80</h2>
      <form>
        <div class="fields pairs">
          ${[
            renderInput("AF", "Accumulator and flags", ["a", "f"]),
            renderInput("AF'", "Shadow AF", ["a_", "f_"]),
            renderInput("BC", null, ["b", "c"]),
            renderInput("BC'", "Shadow BC", ["b_", "c_"]),
            renderInput("DE", null, ["d", "e"]),
            renderInput("DE'", "Shadow DE", ["d_", "e_"]),
            renderInput("HL", null, ["h", "l"]),
            renderInput("HL'", "Shadow HL", ["h_", "l_"])
          ].join("")}
        </div>
        <div class="fields">
          <span class="name">${renderAbbreviation("F", "Flags")}</span>
          <span class="flags">${FLAGS.map(renderFlag).join("")}</span>
        </div>
        <div class="fields pairs">
          ${[
            renderInput("IX", "Index register IX", ["ixh", "ixl"]),
            renderInput("IY", "Index register IY", ["iyh", "iyl"]),
            renderInput("SP", "Stack pointer", ["sp"], 4),
            renderInput("PC", "Program counter", ["pc"], 4),
            renderInput("I", "Interrupt vector", ["i"]),
            renderInput("R", "Memory refresh", ["r"]),
            renderInput("WZ", "Internal address latch (MEMPTR)", ["wz"], 4)
          ].join("")}
        </div>
        <div class="fields indicators">
          ${[
            renderMode("IM", "Interrupt mode", "im"),
            renderState("IFF1", "Interrupt enable flip-flop 1", "iff1"),
            renderState("IFF2", "Interrupt enable flip-flop 2", "iff2"),
            renderState("HALT", "Stopped on HALT until an interrupt", "halted"),
            renderOutput("INT", "Interrupt line, driven by the Gate Array", "intLine")
          ].join("")}
        </div>
      </form>
    `

    this.#form = this.querySelector("form")

    const { signal } = this
    this.addEventListener("focusin", this.onFocusIn.bind(this), { signal })
    this.addEventListener("input", this.onInput.bind(this), { signal })
    this.addEventListener("keydown", this.onKeyDown.bind(this), { signal })
    this.addEventListener("change", this.onChanged.bind(this), { signal })

    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  onFocusIn(event) {
    if (event.target.type == "text") {
      event.target.select()
    }
  }

  onInput(event) {
    const input = event.target,
      next = input.dataset.next

    if (next && input.value.length == input.maxLength && input.checkValidity()) {
      const target = this.#form.elements[next]
      target.focus()
      target.select()
    }
  }

  // Reset puts every value back to the machine's and raises no change event,
  // so nothing is committed.
  onKeyDown(event) {
    if (event.key == "Escape") {
      this.#form.reset()
    }
  }

  onChanged(event) {
    const input = event.target,
      z80 = this.machine.z80

    if (input.type == "checkbox") {
      z80[input.name] = input.checked
    } else {
      if (input.checkValidity()) {
        z80[input.name] = parseInt(input.value, 16)
      }
      input.blur()
    }

    this.machine.changed()
  }

  #render(machine) {
    const z80 = machine.z80,
      field = this.#form.elements

    show(field.a, hex(z80.a))
    show(field.f, hex(z80.f))
    show(field.b, hex(z80.b))
    show(field.c, hex(z80.c))
    show(field.d, hex(z80.d))
    show(field.e, hex(z80.e))
    show(field.h, hex(z80.h))
    show(field.l, hex(z80.l))
    show(field.ixh, hex(z80.ixh))
    show(field.ixl, hex(z80.ixl))
    show(field.iyh, hex(z80.iyh))
    show(field.iyl, hex(z80.iyl))
    show(field.i, hex(z80.i))
    show(field.r, hex(z80.r))

    show(field.a_, hex(z80.a_))
    show(field.f_, hex(z80.f_))
    show(field.b_, hex(z80.b_))
    show(field.c_, hex(z80.c_))
    show(field.d_, hex(z80.d_))
    show(field.e_, hex(z80.e_))
    show(field.h_, hex(z80.h_))
    show(field.l_, hex(z80.l_))

    show(field.sp, hex(z80.sp, { digits: 4 }))
    show(field.pc, hex(z80.pc, { digits: 4 }))
    show(field.wz, hex(z80.wz, { digits: 4 }))

    for (const [flag] of FLAGS) {
      show(field[flag], z80[flag])
    }
    show(field.iff1, z80.iff1)
    show(field.iff2, z80.iff2)
    show(field.halted, z80.halted)

    show(field.im, String(z80.im))
    show(field.intLine, bit(z80.intLine))
  }
}

Z80Element.define("colophon-z80")
