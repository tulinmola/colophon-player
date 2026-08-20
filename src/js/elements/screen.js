import { hex, html } from "../lang"
import { MachineObserver } from "./machine_observer"
import { Screen } from "../emulator"

const DEFAULT_PALETTE = Array.from({ length: 16 }, (_colour, pen) => pen)

const SAMPLES_PER_CHARACTER = 16

function parseHex(text) {
  const withoutPrefix = text.replace("&", "")
  return parseInt(withoutPrefix, 16)
}

// Rec. 601 luma, so a colour keeps its brightness when it loses its hue.
function greyPalette(palette) {
  const greys = new Uint32Array(palette.length)

  for (let code = 0; code < palette.length; code++) {
    const colour = palette[code],
      red = colour & 0xff,
      green = (colour >> 8) & 0xff,
      blue = (colour >> 16) & 0xff,
      luma = Math.round(0.299 * red + 0.587 * green + 0.114 * blue)

    greys[code] = 0xff000000 | (luma << 16) | (luma << 8) | luma
  }

  return greys
}

class ScreenElement extends MachineObserver {
  #beam = null
  #context
  #greys
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

    if (this.getAttribute("view") == "beam") {
      this.#beam = { bank: base >> 14, columns: width, height, rasters }
      this.#greys = greyPalette(machine.palette)
    }

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

    const scanned = this.#scannedSamples(machine)

    for (let index = 0; index < scanned; index++) {
      this.#pixels[index] = palette[samples[index]]
    }

    for (let index = scanned; index < samples.length; index++) {
      this.#pixels[index] = this.#greys[samples[index]]
    }

    this.#context.putImageData(this.#image, 0, 0)
  }

  #scannedSamples(machine) {
    const beam = this.#beam,
      total = this.#screen.samples.length

    if (beam == null || machine.running) {
      return total
    }

    const crtc = machine.crtc,
      bank = (crtc.registers[12] >> 4) & 3,
      row = crtc.c4

    if (bank != beam.bank || row >= beam.height) {
      return total
    }

    const samplesPerLine = this.#screen.samplesPerLine

    if (crtc.c9 >= beam.rasters) {
      return (row + 1) * beam.rasters * samplesPerLine
    }

    const line = row * beam.rasters + crtc.c9,
      column = Math.min(crtc.c0, beam.columns)

    return line * samplesPerLine + column * SAMPLES_PER_CHARACTER
  }
}

ScreenElement.define("colophon-screen")
