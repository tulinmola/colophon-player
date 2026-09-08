import { SPECTRUM_KEY_MATRIX, Spectrum } from "../emulator"
import { MachineElement } from "./machine_element"

const DEFAULT_MODEL = "spectrum48"

class SpectrumElement extends MachineElement {
  static observedAttributes = ["model", "roms", "snapshot", "symbols"]

  build({ signal }) {
    const model = this.getAttribute("model") ?? DEFAULT_MODEL,
      romsUrl = this.getAttribute("roms"),
      snapshotUrl = this.getAttribute("snapshot"),
      symbolsUrl = this.getAttribute("symbols"),
      options = { signal, romsUrl, snapshotUrl, symbolsUrl }

    return Spectrum.create(model, options)
  }

  keysFor(event) {
    return SPECTRUM_KEY_MATRIX[event.code]
  }
}

SpectrumElement.define("colophon-spectrum")
