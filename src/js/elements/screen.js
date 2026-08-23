import { hex, html, writeValue } from "../lang"
import { Actions } from "./actions"
import { BreakpointForm } from "./breakpoint_form"
import { MachineObserver } from "./machine_observer"
import { Screen } from "../emulator"

const DEFAULT_PALETTE = Array.from({ length: 16 }, (_colour, pen) => pen)

const SAMPLES_PER_BYTE = 8

const HEAT_DEPTH = 16

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

function parseViews(text) {
  return new Set((text ?? "").trim().split(/\s+/u))
}

const ZOOMS = [1, 1.5, 2, 3, 4]

function renderActionZoom(zoom) {
  return html`<label class="toggle">
    <input type="radio" name="zoom" value="${zoom}" />
    ×${zoom}
  </label>`
}

class ScreenElement extends MachineObserver {
  static observedAttributes = [
    "base",
    "height",
    "label",
    "mode",
    "palette",
    "rasters",
    "view",
    "width",
    "zoom"
  ]

  #context
  #greys = null
  #heat = null
  #image
  #options
  #picture
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

    const zoom = Number(this.getAttribute("zoom") ?? 1),
      zooms = new Set([...ZOOMS, zoom]),
      views = parseViews(this.getAttribute("view"))

    this.innerHTML = html`
      <header>
        <h2></h2>
        <colophon-options label="Screen options">
          <fieldset>
            <legend>Zoom</legend>
            ${Array.from(zooms).map(renderActionZoom).join("")}
          </fieldset>
          <fieldset>
            <legend>View</legend>
            <label class="toggle" title="Divide the picture where the electron beam stands">
              <input type="checkbox" name="beam" /> Beam
            </label>
            <label class="toggle" title="Mark what was written, and how recently">
              <input type="checkbox" name="heat" /> Heat
            </label>
          </fieldset>
          <fieldset>
            <legend>Mode</legend>
            <label class="toggle">
              <input type="radio" name="mode" value="0" /> Mode 0 (2 of 16)
            </label>
            <label class="toggle">
              <input type="radio" name="mode" value="1" /> Mode 1 (4 of 4)
            </label>
            <label class="toggle">
              <input type="radio" name="mode" value="2" /> Mode 2 (8 of 2)
            </label>
          </fieldset>
          <fieldset>
            <legend>Geometry</legend>
            <div class="fields">
              <label>
                <abbr title="The address the first byte is read from">Base</abbr>
                <span class="input-group">
                  <input name="base" aria-label="Base" maxlength="4" pattern="[0-9A-Fa-f]{1,4}" />
                </span>
              </label>
              <label>
                Width <input name="width" inputmode="numeric" maxlength="2" pattern="[1-9][0-9]?" />
              </label>
              <label>
                Height
                <input name="height" inputmode="numeric" maxlength="2" pattern="[1-9][0-9]?" />
              </label>
              <label>
                Rasters
                <input name="rasters" inputmode="numeric" maxlength="2" pattern="[1-9][0-9]?" />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Record</legend>
            <colophon-recording></colophon-recording>
          </fieldset>
        </colophon-options>
      </header>
      <div class="picture">
        <canvas></canvas>
      </div>
    `

    const label = this.getAttribute("label"),
      address = hex(base, { digits: 4, prefix: "&" })
    this.querySelector("h2").textContent = label ?? `Screen ${address}`

    this.#picture = this.querySelector(".picture")

    const canvas = this.querySelector("canvas")
    canvas.width = screen.samplesPerLine
    canvas.height = screen.lines

    const context = canvas.getContext("2d"),
      image = context.createImageData(canvas.width, canvas.height)

    this.#context = context
    this.#image = image
    this.#pixels = new Uint32Array(image.data.buffer)

    const { signal } = this,
      options = this.querySelector("colophon-options")

    this.#options = options

    const chosen = options.form.elements
    chosen.zoom.value = String(zoom)
    chosen.mode.value = String(mode)
    writeValue(chosen.beam, views.has("beam"))
    writeValue(chosen.heat, views.has("heat"))
    writeValue(chosen.base, hex(base, { digits: 4 }))
    writeValue(chosen.width, String(width))
    writeValue(chosen.height, String(height))
    writeValue(chosen.rasters, String(rasters))

    this.#fitPicture()
    this.#fitViews()

    this.addEventListener("change", this.onChanged.bind(this), { signal })
    this.addEventListener("contextmenu", this.onContextMenu.bind(this), { signal })
    machine.addEventListener("machine:changed", () => this.#draw(machine), { signal })
    this.#draw(machine)
  }

  attributeChangedCallback(name) {
    if (this.machine == null) {
      super.attributeChangedCallback(name)
      return
    }

    switch (name) {
      case "view":
        this.#fitViews()
        this.#draw(this.machine)
        break

      case "zoom":
        this.#fitPicture()
        break

      default:
        super.attributeChangedCallback(name)
        break
    }
  }

  onChanged(event) {
    const control = event.target

    if (control.type == "checkbox") {
      const chosen = this.#options.form.elements,
        shown = ["beam", "heat"].filter(name => chosen[name].checked)

      this.setAttribute("view", shown.join(" "))
      return
    }

    if (!control.checkValidity()) {
      return
    }

    const value = control.name == "base" ? `&${control.value}` : control.value
    this.setAttribute(control.name, value)
  }

  onContextMenu(event) {
    if (!event.target.closest(".picture")) {
      return
    }

    const screen = this.#screen,
      box = this.#picture.getBoundingClientRect(),
      sample = Math.floor(((event.clientX - box.left) / box.width) * screen.samplesPerLine),
      line = Math.floor(((event.clientY - box.top) / box.height) * screen.lines),
      at = screen.addressAt(sample, line),
      machine = this.machine

    event.preventDefault()
    Actions.create(event, [
      { label: "Add breakpoint…", execute: () => BreakpointForm.create(machine, { address: at }) },
      { label: "Show in memory", execute: () => machine.showMemory(at, "ram") }
    ])
  }

  #fitPicture() {
    const zoom = Number(this.getAttribute("zoom") ?? 1),
      screen = this.#screen,
      picture = this.#picture

    picture.style.width = `${(screen.samplesPerLine / 2) * zoom}px`
    picture.style.height = `${screen.lines * zoom}px`
  }

  #fitViews() {
    const views = parseViews(this.getAttribute("view")),
      wanted = views.has("heat")

    this.#greys = views.has("beam") ? this.machine.greys : null

    if (wanted == (this.#heat != null)) {
      return
    }

    if (!wanted) {
      this.#heat.context.canvas.remove()
      this.#heat = null
      return
    }

    const picture = this.#context.canvas,
      layer = document.createElement("canvas")

    layer.width = picture.width
    layer.height = picture.height
    this.#picture.append(layer)

    const context = layer.getContext("2d"),
      image = context.createImageData(layer.width, layer.height)

    this.#heat = {
      context,
      idle: true,
      image,
      pixels: new Uint32Array(image.data.buffer)
    }
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
