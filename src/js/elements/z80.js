import { hex, html, writeValue } from "../lang"
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

function renderAbbreviation(label, meaning) {
  return meaning ? html`<abbr title="${meaning}">${label}</abbr>` : label
}

// aria-label is what keeps the sigil and any sibling control from being read
// out as part of the name.
function renderRegister(label, meaning, names, digits = 2) {
  const controls = names.map(function (name, index) {
    const next = names[index + 1],
      announced = names.length > 1 ? name.toUpperCase().replace("_", " shadow") : label

    return html`<input
      name="${name}"
      aria-label="${announced}"
      maxlength="${digits}"
      pattern="[0-9A-Fa-f]{1,${digits}}"
      ${next ? `data-next="${next}"` : ""}
    />`
  })

  return html`<label
    >${renderAbbreviation(label, meaning)}<span class="input-group"
      >${controls.join("&nbsp;")}</span
    ></label
  >`
}

function renderLine(label, meaning, name) {
  return html`<label
    >${renderAbbreviation(label, meaning)}<output
      name="${name}"
      aria-label="${label}"
      aria-live="off"
    ></output
  ></label>`
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
            renderRegister("AF", "Accumulator and flags", ["a", "f"]),
            renderRegister("AF'", "Shadow AF", ["a_", "f_"]),
            renderRegister("BC", null, ["b", "c"]),
            renderRegister("BC'", "Shadow BC", ["b_", "c_"]),
            renderRegister("DE", null, ["d", "e"]),
            renderRegister("DE'", "Shadow DE", ["d_", "e_"]),
            renderRegister("HL", null, ["h", "l"]),
            renderRegister("HL'", "Shadow HL", ["h_", "l_"])
          ].join("")}
        </div>
        <div class="fields">
          <span class="name">${renderAbbreviation("F", "Flags")}</span>
          <span class="flags">${FLAGS.map(renderFlag).join("")}</span>
        </div>
        <div class="fields pairs">
          ${[
            renderRegister("IX", "Index register IX", ["ixh", "ixl"]),
            renderRegister("IY", "Index register IY", ["iyh", "iyl"]),
            renderRegister("SP", "Stack pointer", ["sp"], 4),
            renderRegister("PC", "Program counter", ["pc"], 4),
            renderRegister("I", "Interrupt vector", ["i"]),
            renderRegister("R", "Memory refresh", ["r"]),
            renderRegister("WZ", "Internal address latch (MEMPTR)", ["wz"], 4)
          ].join("")}
        </div>
        <div class="fields indicators">
          ${[
            renderMode("IM", "Interrupt mode", "im"),
            renderState("IFF1", "Interrupt enable flip-flop 1", "iff1"),
            renderState("IFF2", "Interrupt enable flip-flop 2", "iff2"),
            renderState("HALT", "Stopped on HALT until an interrupt", "halted"),
            renderLine("INT", "Interrupt line, driven by the Gate Array", "intLine")
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

    writeValue(field.a, hex(z80.a))
    writeValue(field.f, hex(z80.f))
    writeValue(field.b, hex(z80.b))
    writeValue(field.c, hex(z80.c))
    writeValue(field.d, hex(z80.d))
    writeValue(field.e, hex(z80.e))
    writeValue(field.h, hex(z80.h))
    writeValue(field.l, hex(z80.l))
    writeValue(field.ixh, hex(z80.ixh))
    writeValue(field.ixl, hex(z80.ixl))
    writeValue(field.iyh, hex(z80.iyh))
    writeValue(field.iyl, hex(z80.iyl))
    writeValue(field.i, hex(z80.i))
    writeValue(field.r, hex(z80.r))

    writeValue(field.a_, hex(z80.a_))
    writeValue(field.f_, hex(z80.f_))
    writeValue(field.b_, hex(z80.b_))
    writeValue(field.c_, hex(z80.c_))
    writeValue(field.d_, hex(z80.d_))
    writeValue(field.e_, hex(z80.e_))
    writeValue(field.h_, hex(z80.h_))
    writeValue(field.l_, hex(z80.l_))

    writeValue(field.sp, hex(z80.sp, { digits: 4 }))
    writeValue(field.pc, hex(z80.pc, { digits: 4 }))
    writeValue(field.wz, hex(z80.wz, { digits: 4 }))

    for (const [flag] of FLAGS) {
      writeValue(field[flag], z80[flag])
    }
    writeValue(field.iff1, z80.iff1)
    writeValue(field.iff2, z80.iff2)
    writeValue(field.halted, z80.halted)

    writeValue(field.im, String(z80.im))
    writeValue(field.intLine, bit(z80.intLine))
  }
}

Z80Element.define("colophon-z80")
