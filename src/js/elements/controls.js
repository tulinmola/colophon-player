import { fields, html } from "../lang"
import { Viewer } from "./viewer"

class ControlsElement extends Viewer {
  watch(machine) {
    const { signal } = this

    this.innerHTML = html`
      <button type="button" data-field="run">Run</button>
      <button type="button" data-field="stop">Stop</button>
      <button type="button" data-field="step">Step</button>
      <button type="button" data-field="frame">Frame</button>
    `

    const buttons = fields(this)

    buttons.run.addEventListener("click", () => machine.start(), { signal })
    buttons.stop.addEventListener("click", () => machine.stop(), { signal })
    buttons.step.addEventListener("click", () => machine.step(), { signal })
    buttons.frame.addEventListener("click", () => machine.stepFrame(), { signal })

    const showRunning = () => this.toggleAttribute("running", machine.running)
    machine.addEventListener("start", showRunning, { signal })
    machine.addEventListener("stop", showRunning, { signal })
    showRunning()
  }
}

ControlsElement.define("colophon-controls")
