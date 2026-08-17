import { MachineObserver } from "./machine_observer"
import { html } from "../lang"

class ControlsElement extends MachineObserver {
  watch(machine) {
    const { signal } = this

    this.innerHTML = html`
      <button type="button" data-action="start">Run</button>
      <button type="button" data-action="stop">Stop</button>
      <button type="button" data-action="step">Step</button>
      <button type="button" data-action="stepFrame">Frame</button>
    `

    this.addEventListener("click", this.onClick.bind(this), { signal })

    const showRunning = () => this.toggleAttribute("running", machine.running)
    machine.addEventListener("start", showRunning, { signal })
    machine.addEventListener("stop", showRunning, { signal })
    showRunning()
  }

  onClick(event) {
    const action = event.target.dataset.action
    if (action) {
      this.machine[action]()
    }
  }
}

ControlsElement.define("colophon-controls")
