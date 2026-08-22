import { CanvasRecorder } from "../recording"
import { MachineObserver } from "./machine_observer"
import { html } from "../lang"

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a")

  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// The recorder finds its picture the way observers find their machine:
// walking up for whatever holds canvases.
function closestCanvases(element) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const canvases = node.querySelectorAll("canvas")

    if (canvases.length > 0) {
      return Array.from(canvases)
    }
  }

  return []
}

function filenameFor(label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")
  return `colophon-${slug}`
}

class RecordingElement extends MachineObserver {
  #button
  #filename
  #height
  #label
  #layers
  #recorder = null
  #width

  watch(machine) {
    this.innerHTML = html`<button type="button" disabled>●</button>`

    const layers = closestCanvases(this),
      [first] = layers,
      label = this.parentElement.querySelector("h2")?.textContent ?? "picture"

    this.#layers = layers
    this.#width = first.width / 2
    this.#height = first.height
    this.#label = label
    this.#filename = filenameFor(label)

    const button = this.querySelector("button")
    this.#button = button
    button.addEventListener("click", this.onRecord.bind(this), { signal: this.signal })

    this.#showRecording(false)
    button.disabled = !CanvasRecorder.supported
    if (button.disabled) {
      button.title = "Recording is not supported by this browser"
    }

    machine.addEventListener("machine:changed", () => this.#recorder?.capture(this.#layers), {
      signal: this.signal
    })
  }

  dispose() {
    this.#recorder?.discard()
    this.#recorder = null
    this.removeAttribute("recording")
  }

  async onRecord() {
    if (this.#recorder) {
      const recorder = this.#recorder
      this.#recorder = null
      this.#showRecording(false)
      this.#button.disabled = true

      try {
        const { blob, extension } = await recorder.stop()

        if (!this.signal.aborted) {
          download(blob, `${this.#filename}.${extension}`)
        }
      } finally {
        if (!this.signal.aborted) {
          this.#button.disabled = false
        }
      }
    } else {
      const recorder = new CanvasRecorder(this.#width, this.#height)
      recorder.start()
      recorder.capture(this.#layers)

      this.#recorder = recorder
      this.#showRecording(true)
    }
  }

  #showRecording(recording) {
    const action = recording ? `Stop recording ${this.#label}` : `Record ${this.#label}`

    this.toggleAttribute("recording", recording)
    this.#button.textContent = recording ? "■" : "●"
    this.#button.setAttribute("aria-label", action)
    this.#button.title = action
  }
}

RecordingElement.define("colophon-recording")
