import { html, write } from "../lang"
import { MachineObserver } from "./machine_observer"

const PLAY = "▶",
  PAUSE = "▮▮"

class ControlsElement extends MachineObserver {
  #glyph
  #toggle

  watch(machine) {
    const { signal } = this

    this.innerHTML = html`
      <h2>Controls</h2>
      <button type="button"><span aria-hidden="true"></span></button>
      <menu>
        <li><button type="button" data-action="step">Step</button></li>
        <li><button type="button" data-action="stepScanline">Scanline</button></li>
        <li><button type="button" data-action="stepRow">Row</button></li>
        <li><button type="button" data-action="stepFrame">Frame</button></li>
      </menu>
    `

    this.#toggle = this.querySelector("button")
    this.#glyph = this.#toggle.firstElementChild

    this.addEventListener("click", this.onClick.bind(this), { signal })

    const showRunning = () => this.#showRunning(machine)
    machine.addEventListener("machine:start", showRunning, { signal })
    machine.addEventListener("machine:stop", showRunning, { signal })
    showRunning()
  }

  onClick(event) {
    const button = event.target.closest("button")
    if (button) {
      this.machine[button.dataset.action]()
    }
  }

  #showRunning(machine) {
    const { running } = machine

    this.toggleAttribute("running", running)
    this.#toggle.dataset.action = running ? "stop" : "start"
    this.#toggle.title = running ? "Stop" : "Run"
    write(this.#glyph, running ? PAUSE : PLAY)
  }
}

ControlsElement.define("colophon-controls")
