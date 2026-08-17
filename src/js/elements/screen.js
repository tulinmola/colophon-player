import { hex, html } from "../lang"
import { MachineObserver } from "./machine_observer"
import { Screen } from "../emulator"

const DEFAULT_PALETTE = Array.from({ length: 16 }, (_colour, pen) => pen)

function parseHex(text) {
  const withoutPrefix = text.replace("&", "")
  return parseInt(withoutPrefix, 16)
}

class ScreenElement extends MachineObserver {
  #context
  #image
  #pixels
  #screen

  watch(machine) {
    const base = parseHex(this.getAttribute("base") ?? "&C000"),
      width = Number(this.getAttribute("width") ?? 40),
      height = Number(this.getAttribute("height") ?? 25),
      rasters = Number(this.getAttribute("rasters") ?? 8),
      mode = Number(this.getAttribute("mode") ?? 1),
      inks = this.getAttribute("palette"),
      palette = inks ? inks.trim().split(/\s+/u).map(parseHex) : DEFAULT_PALETTE

    const screen = new Screen({ base, width, height, rasters, mode, palette })
    this.#screen = screen

    this.innerHTML = html`
      <h2></h2>
      <canvas></canvas>
    `

    const label = this.getAttribute("label"),
      address = hex(base, { digits: 4, prefix: "&" })
    this.querySelector("h2").textContent = label ?? `Screen ${address}`

    const zoom = Number(this.getAttribute("zoom") ?? 1),
      canvas = this.querySelector("canvas")
    canvas.width = screen.samplesPerLine
    canvas.height = screen.lines
    canvas.style.width = `${(screen.samplesPerLine / 2) * zoom}px`
    canvas.style.height = `${screen.lines * zoom}px`

    const context = canvas.getContext("2d"),
      image = context.createImageData(canvas.width, canvas.height)

    this.#context = context
    this.#image = image
    this.#pixels = new Uint32Array(image.data.buffer)

    machine.addEventListener("changed", () => this.#draw(machine), { signal: this.signal })
    this.#draw(machine)
  }

  #draw(machine) {
    const screen = this.#screen,
      samples = screen.samples,
      palette = machine.palette

    screen.render(machine.ram)

    for (let index = 0; index < samples.length; index++) {
      this.#pixels[index] = palette[samples[index]]
    }

    this.#context.putImageData(this.#image, 0, 0)
  }
}

ScreenElement.define("colophon-screen")
