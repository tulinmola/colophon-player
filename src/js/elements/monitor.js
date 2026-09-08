import { MachineObserver } from "./machine_observer"
import { html } from "../lang"

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
  #picture
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
    this.#picture = machine.picture
    canvas.width = this.#picture.width
    canvas.height = this.#picture.height

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
      { width, height, scale } = this.#picture,
      canvas = this.#context.canvas

    canvas.style.width = `${width * scale * zoom}px`
    canvas.style.height = `${height * zoom}px`
  }

  #draw(machine) {
    const framebuffer = machine.framebuffer,
      palette = machine.palette,
      { raster, left, top, width, height } = this.#picture

    for (let line = 0; line < height; line++) {
      let sample = (top + line) * raster + left,
        pixel = line * width

      for (let column = 0; column < width; column++) {
        this.#pixels[pixel++] = palette[framebuffer[sample++]]
      }
    }

    this.#context.putImageData(this.#image, 0, 0)
  }
}

MonitorElement.define("colophon-monitor")
