import { download, html, write, writeFitted, writeValue } from "../lang"
import { MachineObserver } from "./machine_observer"

const LETTERS = ["A", "B"]

const NAME = 20

const ACTIONS = [
  ["insert", "+", "Put a disc in drive"],
  ["save", "↓", "Write the disc out of drive"],
  ["eject", "×", "Take the disc out of drive"]
]

function marksOn(disc) {
  const marks = [`${disc.cylinders}×${disc.sides}`]

  if (disc.modified) {
    marks.push("written")
  }

  return marks.join(" · ")
}

function renderAction([action, sigil, meaning], letter) {
  return html`<button type="button" data-action="${action}" title="${meaning} ${letter}">
    <span aria-hidden="true">${sigil}</span>
  </button>`
}

function renderDrawer(letter, unit) {
  return html`<li data-drive="${unit}">
    <span>${letter}</span>
    <output name="name" aria-label="The disc in drive ${letter}"> </output>
    <output name="marks" aria-label="Drive ${letter}'s disc"> </output>
    <input
      type="checkbox"
      class="state"
      name="protected"
      title="The write-protect tab on drive ${letter}'s disc"
      aria-label="Drive ${letter}'s disc is write protected"
    />
    ${ACTIONS.map(action => renderAction(action, letter)).join("")}
  </li>`
}

class DiscElement extends MachineObserver {
  #drawers
  #openedFor = 0
  #picker
  #problem

  watch(machine) {
    this.innerHTML = html`
      <h2>Discs</h2>
      <ul>
        ${machine.drives.map((drive, unit) => renderDrawer(LETTERS[unit], unit)).join("")}
      </ul>
      ${
        machine.discInterface
          ? ""
          : html`<p>This machine has no disc interface: nothing reads a disc in it.</p>`
      }
      <p role="status"></p>
      <input type="file" accept=".dsk" hidden />
    `

    this.style.setProperty("--columns", `2ch ${NAME}ch auto repeat(4, 1ch)`)

    this.#drawers = Array.from(this.querySelectorAll("li"), drawer => ({
      drawer,
      name: drawer.querySelector('output[name="name"]'),
      marks: drawer.querySelector('output[name="marks"]'),
      tab: drawer.querySelector('input[name="protected"]'),
      save: drawer.querySelector('[data-action="save"]'),
      eject: drawer.querySelector('[data-action="eject"]')
    }))
    this.#picker = this.querySelector('input[type="file"]')
    this.#problem = this.querySelector('p[role="status"]')

    const { signal } = this
    this.addEventListener("click", this.onClick.bind(this), { signal })
    this.addEventListener("change", this.onChanged.bind(this), { signal })

    machine.addEventListener("machine:changed", () => this.#render(machine), { signal })
    this.#render(machine)
  }

  onClick(event) {
    const button = event.target.closest("button")

    if (!button) {
      return
    }

    const unit = Number(button.closest("li").dataset.drive),
      { action } = button.dataset

    if (action == "insert") {
      this.#openedFor = unit
      this.#picker.click()
    } else if (action == "eject") {
      this.machine.ejectDisc(unit)
      this.#showProblem()
      this.machine.changed()
    } else if (action == "save") {
      this.#save(unit)
    }
  }

  onChanged(event) {
    if (event.target.type == "file") {
      this.#insertPicked(event.target)
      return
    }

    const unit = Number(event.target.closest("li").dataset.drive)

    this.machine.drives[unit].floppy.writeProtected = event.target.checked
    this.machine.changed()
  }

  async #insertPicked(picker) {
    const [file] = picker.files

    // The picker keeps the file it was last given, so the same disc chosen
    // twice running would not announce itself a second time.
    picker.value = ""

    if (!file) {
      return
    }

    const image = new Uint8Array(await file.arrayBuffer())

    if (!this.standing) {
      return
    }

    this.machine.insertDisc(this.#openedFor, image, file.name)
    this.#showProblem()
    this.machine.changed()
  }

  #save(unit) {
    const image = this.machine.saveDisc(unit)

    this.#showProblem()

    if (image) {
      const name = this.machine.discName(unit),
        file = new Blob([image], { type: "application/octet-stream" })

      download(file, name)
    }
  }

  #showProblem() {
    write(this.#problem, this.machine.discProblem ?? "")
  }

  #render(machine) {
    for (let unit = 0; unit < this.#drawers.length; unit++) {
      const { drawer, name, marks, tab, save, eject } = this.#drawers[unit],
        disc = machine.drives[unit].floppy

      drawer.toggleAttribute("loaded", disc != null)
      writeFitted(name, disc ? machine.discName(unit) : "", NAME)
      write(marks, disc ? marksOn(disc) : "")
      writeValue(tab, disc != null && disc.writeProtected)

      tab.disabled = disc == null
      save.disabled = disc == null
      eject.disabled = disc == null
    }
  }
}

DiscElement.define("colophon-disc")
