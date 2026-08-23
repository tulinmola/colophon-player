import { MachineObserver } from "./machine_observer"
import { html } from "../lang"

// The window the emulator crops its own screenshots to, and the reason the
// two can be compared pixel for pixel.
const CROP_LEFT = 208,
  CROP_TOP = 34,
  CROP_WIDTH = 768,
  CROP_HEIGHT = 272

const FRAMEBUFFER_WIDTH = 1024

const ZOOMS = [1, 1.5, 2, 3, 4]

function renderActionZoom(zoom) {
  return html`<label class="toggle">
    <input type="radio" name="zoom" value="${zoom}" />
    ×${zoom}
  </label>`
}

class MonitorElement extends MachineObserver {
  static observedAttributes = ["zoom"]

  #context
  #image
  #pixels

  watch(machine) {
    const zoom = Number(this.getAttribute("zoom") ?? 1),
      zooms = new Set([...ZOOMS, zoom])

    this.innerHTML = html`
      <header>
        <h2>Monitor</h2>
        <colophon-options label="Monitor options">
          <fieldset>
            <legend>Zoom</legend>
            ${Array.from(zooms).map(renderActionZoom).join("")}
          </fieldset>
          <fieldset>
            <legend>Record</legend>
            <colophon-recording></colophon-recording>
          </fieldset>
        </colophon-options>
      </header>
      <canvas></canvas>
    `

    const canvas = this.querySelector("canvas")
    canvas.width = CROP_WIDTH
    canvas.height = CROP_HEIGHT

    const context = canvas.getContext("2d"),
      image = context.createImageData(canvas.width, canvas.height)

    this.#context = context
    this.#image = image
    this.#pixels = new Uint32Array(image.data.buffer)

    const { signal } = this,
      options = this.querySelector("colophon-options")

    options.form.elements.zoom.value = String(zoom)
    this.#fitCanvas()

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    machine.addEventListener("machine:frame", () => this.#draw(machine), { signal })
    this.#draw(machine)
  }

  attributeChangedCallback(name) {
    if (this.machine == null) {
      super.attributeChangedCallback(name)
      return
    }

    switch (name) {
      case "zoom":
        this.#fitCanvas()
        break

      default:
        super.attributeChangedCallback(name)
        break
    }
  }

  onChanged(event) {
    this.setAttribute("zoom", event.target.value)
  }

  #fitCanvas() {
    const zoom = Number(this.getAttribute("zoom") ?? 1),
      canvas = this.#context.canvas

    canvas.style.width = `${(CROP_WIDTH / 2) * zoom}px`
    canvas.style.height = `${CROP_HEIGHT * zoom}px`
  }

  #draw(machine) {
    const framebuffer = machine.framebuffer,
      palette = machine.palette

    for (let line = 0; line < CROP_HEIGHT; line++) {
      let sample = (CROP_TOP + line) * FRAMEBUFFER_WIDTH + CROP_LEFT,
        pixel = line * CROP_WIDTH

      for (let column = 0; column < CROP_WIDTH; column++) {
        this.#pixels[pixel++] = palette[framebuffer[sample++]]
      }
    }

    this.#context.putImageData(this.#image, 0, 0)
  }
}

MonitorElement.define("colophon-monitor")
