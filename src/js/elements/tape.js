import { bit, html, write, writeFitted } from "../lang"
import { MachineObserver } from "./machine_observer"

const NAME = 24

class TapeElement extends MachineObserver {
  #bar
  #driven
  #eject
  #head
  #name
  #picker
  #play
  #problem
  #turning

  watch(machine) {
    const { formats, driven } = machine.tapeDeck,
      reel = driven
        ? html`<label title="Whether the reel is turning, which this board decides for itself">
            REEL <output name="reel" aria-label="Reel" aria-live="off"> </output>
          </label>`
        : html`<button type="button" data-action="play" title="Turn the reel">
            <span aria-hidden="true">▶</span>
            <span aria-hidden="true">▮▮</span>
          </button>`

    this.#driven = driven

    this.innerHTML = html`
      <h2>Tape</h2>
      <div class="deck">
        <output name="name" aria-label="The tape in the deck" aria-live="off"> </output>
        <progress
          max="1"
          value="0"
          aria-label="How far through the tape the reader stands"
        ></progress>
        <label title="The level at the play head">
          HEAD <output name="head" aria-label="Head" aria-live="off"> </output>
        </label>
        ${reel}
        <button type="button" data-action="insert" title="Put a tape in the deck">
          <span aria-hidden="true">+</span>
        </button>
        <button type="button" data-action="eject" title="Take the tape out of the deck">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p role="status"></p>
      <input type="file" hidden />
    `

    this.style.setProperty("--columns", `${NAME}ch 8rem auto auto 1ch 1ch`)

    this.#name = this.querySelector('output[name="name"]')
    this.#head = this.querySelector('output[name="head"]')
    this.#turning = this.querySelector('output[name="reel"]')
    this.#bar = this.querySelector("progress")
    this.#play = this.querySelector('[data-action="play"]')
    this.#eject = this.querySelector('[data-action="eject"]')
    this.#picker = this.querySelector('input[type="file"]')
    this.#problem = this.querySelector('p[role="status"]')

    this.#picker.accept = formats

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

    const { tape } = this.machine,
      { action } = button.dataset

    if (action == "insert") {
      this.#picker.click()
      return
    }

    if (action == "eject") {
      tape.eject()
    } else if (action == "play") {
      this.#turn(tape)
    }

    this.#showProblem()
    this.machine.changed()
  }

  onChanged(event) {
    this.#insertPicked(event.target)
  }

  #turn(tape) {
    if (tape.playing) {
      tape.stop()
    } else {
      tape.play()
    }
  }

  async #insertPicked(picker) {
    const [file] = picker.files

    // The picker keeps the file it was last given, so the same tape chosen
    // twice running would not announce itself a second time.
    picker.value = ""

    if (!file) {
      return
    }

    const image = new Uint8Array(await file.arrayBuffer())

    if (!this.standing) {
      return
    }

    this.machine.tape.insert(image, file.name)
    this.#showProblem()
    this.machine.changed()
  }

  #showProblem() {
    write(this.#problem, this.machine.tape.problem ?? "")
  }

  #render(machine) {
    const { tape } = machine,
      { loaded, playing } = tape

    this.toggleAttribute("loaded", loaded)
    this.toggleAttribute("playing", playing)

    writeFitted(this.#name, loaded ? tape.name : "", NAME)
    write(this.#head, bit(tape.level))

    this.#bar.max = tape.length || 1
    this.#bar.value = tape.at

    if (this.#driven) {
      write(this.#turning, bit(playing))
    } else {
      const turning = playing ? "Stop the reel" : "Turn the reel"

      if (this.#play.title != turning) {
        this.#play.title = turning
      }

      this.#play.disabled = !loaded
    }

    this.#eject.disabled = !loaded
  }
}

TapeElement.define("colophon-tape")
