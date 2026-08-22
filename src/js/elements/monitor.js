import { MachineObserver } from "./machine_observer"
import { html } from "../lang"

// The window the emulator crops its own screenshots to, and the reason the
// two can be compared pixel for pixel.
const CROP_LEFT = 208,
  CROP_TOP = 34,
  CROP_WIDTH = 768,
  CROP_HEIGHT = 272

const FRAMEBUFFER_WIDTH = 1024

class MonitorElement extends MachineObserver {
  #context
  #image
  #pixels

  watch(machine) {
    const zoom = Number(this.getAttribute("zoom") ?? 1),
      record = this.hasAttribute("record")

    this.innerHTML = html`
      <header>
        <h2>Monitor</h2>
        ${record ? html`<colophon-recording></colophon-recording>` : ""}
      </header>
      <canvas></canvas>
    `

    const canvas = this.querySelector("canvas")
    canvas.width = CROP_WIDTH
    canvas.height = CROP_HEIGHT
    canvas.style.width = `${(CROP_WIDTH / 2) * zoom}px`
    canvas.style.height = `${CROP_HEIGHT * zoom}px`

    const context = canvas.getContext("2d"),
      image = context.createImageData(canvas.width, canvas.height)

    this.#context = context
    this.#image = image
    this.#pixels = new Uint32Array(image.data.buffer)

    machine.addEventListener("machine:frame", () => this.#draw(machine), { signal: this.signal })
    this.#draw(machine)
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
