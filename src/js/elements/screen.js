import { hex, html } from "../lang"
import { MachineObserver } from "./machine_observer"
import { Screen } from "../emulator"

const DEFAULT_PALETTE = Array.from({ length: 16 }, (_colour, pen) => pen)

const SAMPLES_PER_BYTE = 8

const HEAT_DEPTH = 16

// A colour the Gate Array cannot make, so a mark is never mistaken for the
// picture underneath; the alpha fades a mark out as the write it reports ages.
function heatTints() {
  const tints = new Uint32Array(HEAT_DEPTH)

  for (let age = 0; age < HEAT_DEPTH; age++) {
    const alpha = Math.round(210 - (190 * age) / HEAT_DEPTH)
    tints[age] = (alpha << 24) | (0x8c << 8) | 0xff
  }

  return tints
}

const HEAT_TINTS = heatTints()

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
  #context
  #greys = null
  #heat = null
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

    const views = new Set((this.getAttribute("view") ?? "").trim().split(/\s+/u))

    if (views.has("beam")) {
      this.#greys = greyPalette(machine.palette)
    }

    const record = this.hasAttribute("record")

    this.innerHTML = html`
      <header>
        <h2></h2>
        ${record ? html`<colophon-recording></colophon-recording>` : ""}
      </header>
      <div class="picture">
        <canvas></canvas>
      </div>
    `

    const label = this.getAttribute("label"),
      address = hex(base, { digits: 4, prefix: "&" })
    this.querySelector("h2").textContent = label ?? `Screen ${address}`

    const zoom = Number(this.getAttribute("zoom") ?? 1),
      picture = this.querySelector(".picture")
    picture.style.width = `${(screen.samplesPerLine / 2) * zoom}px`
    picture.style.height = `${screen.lines * zoom}px`

    const canvas = this.querySelector("canvas")
    canvas.width = screen.samplesPerLine
    canvas.height = screen.lines

    const context = canvas.getContext("2d"),
      image = context.createImageData(canvas.width, canvas.height)

    this.#context = context
    this.#image = image
    this.#pixels = new Uint32Array(image.data.buffer)

    if (views.has("heat")) {
      const layer = document.createElement("canvas")
      layer.width = canvas.width
      layer.height = canvas.height
      picture.append(layer)

      const layerContext = layer.getContext("2d"),
        layerImage = layerContext.createImageData(layer.width, layer.height)

      this.#heat = {
        context: layerContext,
        idle: true,
        image: layerImage,
        pixels: new Uint32Array(layerImage.data.buffer)
      }
    }

    machine.addEventListener("changed", () => this.#draw(machine), { signal: this.signal })
    this.#draw(machine)
  }

  #draw(machine) {
    const screen = this.#screen,
      samples = screen.samples,
      palette = machine.palette,
      pixels = this.#pixels

    screen.render(machine.ram, machine.writes)

    if (this.#greys == null || machine.running) {
      for (let index = 0; index < samples.length; index++) {
        pixels[index] = palette[samples[index]]
      }
    } else {
      const crtc = machine.crtc,
        registers = crtc.registers
      screen.sweep({
        latch: crtc.vma_,
        column: crtc.c0,
        raster: crtc.c9,
        row: crtc.c4,
        width: registers[1],
        vsync: registers[7]
      })

      const swept = screen.swept,
        greys = this.#greys

      let sample = 0
      for (let index = 0; index < swept.length; index++) {
        const colours = swept[index] ? palette : greys

        for (let end = sample + SAMPLES_PER_BYTE; sample < end; sample++) {
          pixels[sample] = colours[samples[sample]]
        }
      }
    }

    this.#context.putImageData(this.#image, 0, 0)

    if (this.#heat) {
      this.#drawHeat(machine)
    }
  }

  // A mark is the frame a byte was last stored to, straight off the bus, so
  // a write of the value already there marks like any other. A stamp of zero
  // is a byte never written, and stays cold.
  #drawHeat(machine) {
    const heat = this.#heat,
      written = this.#screen.written,
      frame = machine.frame

    let hot = false
    for (let index = 0; index < written.length; index++) {
      const stamp = written[index]

      if (stamp != 0 && frame - stamp < HEAT_DEPTH) {
        hot = true
        break
      }
    }

    if (!hot) {
      if (!heat.idle) {
        heat.idle = true
        heat.pixels.fill(0)
        heat.context.putImageData(heat.image, 0, 0)
      }
      return
    }

    heat.idle = false

    const pixels = heat.pixels
    pixels.fill(0)
    for (let index = 0; index < written.length; index++) {
      const stamp = written[index],
        age = frame - stamp

      if (stamp != 0 && age < HEAT_DEPTH) {
        const offset = index * SAMPLES_PER_BYTE
        pixels.fill(HEAT_TINTS[age], offset, offset + SAMPLES_PER_BYTE)
      }
    }

    heat.context.putImageData(heat.image, 0, 0)
  }
}

ScreenElement.define("colophon-screen")
