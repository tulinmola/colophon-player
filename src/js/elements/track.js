import { hex, html, write } from "../lang"
import { Floppy } from "../emulator/floppy"
import { MachineObserver } from "./machine_observer"

const UNITS = { a: 0, b: 1 }

const DEFAULT_DRIVE = "a"

const DEFAULT_LINES = 10

const FINDINGS = [
  { label: "DEL", meaning: "A deleted data address mark, not a normal one", name: "deleted" },
  { label: "IDCRC", meaning: "The identity field failed its own check", name: "identityCrcError" },
  { label: "CRC", meaning: "The data field failed its check", name: "dataCrcError" },
  { label: "NODATA", meaning: "An identity with nothing recorded behind it", name: "noDataField" }
]

function marksOn(sector) {
  const found = FINDINGS.filter(({ name }) => sector[name])

  return found.map(({ label }) => label).join(" ")
}

const COLUMNS = [
  {
    label: "C",
    meaning: "The cylinder this sector claims to sit on",
    read: sector => hex(sector.c, { prefix: "&" })
  },
  {
    label: "H",
    meaning: "The head it claims to be under",
    read: sector => hex(sector.h, { prefix: "&" })
  },
  { label: "R", meaning: "Its own number", read: sector => hex(sector.r, { prefix: "&" }) },
  { label: "N", meaning: "Its size code", read: sector => hex(sector.n, { prefix: "&" }) },
  { label: "ann", meaning: "What N counts", read: sector => String(sector.announced) },
  {
    label: "rec",
    meaning: "What one reading of it holds",
    read: sector => String(sector.recorded)
  },
  {
    label: "ext",
    meaning: "What its data field occupies on the track",
    read: sector => String(sector.extent)
  },
  { label: "cop", meaning: "Readings stored back to back", read: sector => String(sector.copies) },
  {
    label: "at",
    meaning: "Where its sync begins, in bytes from the index",
    read: sector => String(sector.position)
  },
  { label: "found", meaning: "What reading the disc found", read: marksOn }
]

function renderHeading({ label, meaning }) {
  return html`<th scope="col"><abbr title="${meaning}">${label}</abbr></th>`
}

function createRow() {
  const row = document.createElement("tr")

  row.innerHTML = COLUMNS.map(() => "<td></td>").join("")

  return row
}

function describeTrack(track) {
  if (track.unreadable) {
    return "recorded in a mode this head cannot decode"
  }

  if (!track.formatted) {
    return "unformatted"
  }

  const gap = hex(track.gap, { prefix: "&" }),
    filler = hex(track.filler, { prefix: "&" })

  return `${track.sectorCount} sectors · ${track.length} bytes · gap ${gap} · filler ${filler}`
}

class TrackElement extends MachineObserver {
  static observedAttributes = ["drive", "cylinder", "side", "lines"]

  #at
  #body
  #layout
  #pinnedCylinder
  #pinnedSide
  #rows
  #unit

  watch(machine) {
    const letter = this.getAttribute("drive") ?? DEFAULT_DRIVE,
      cylinder = this.getAttribute("cylinder"),
      side = this.getAttribute("side"),
      lines = this.getAttribute("lines") ?? DEFAULT_LINES

    this.#unit = UNITS[letter.toLowerCase()]
    this.#pinnedCylinder = cylinder == null ? null : Number(cylinder)
    this.#pinnedSide = side == null ? null : Number(side)

    this.innerHTML = html`
      <header>
        <h2>Track</h2>
        <output name="at"> </output>
      </header>
      <output name="layout"> </output>
      <div class="list">
        <table>
          <thead>
            <tr>
              ${COLUMNS.map(renderHeading).join("")}
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `

    this.style.setProperty("--lines", Number(lines))
    this.#rows = []
    this.#body = this.querySelector("tbody")

    this.#at = this.querySelector('output[name="at"]')
    this.#layout = this.querySelector('output[name="layout"]')

    machine.addEventListener("machine:changed", () => this.#render(machine), {
      signal: this.signal
    })
    this.#render(machine)
  }

  #render(machine) {
    const drive = machine.drives[this.#unit],
      disc = drive.floppy,
      cylinder = this.#pinnedCylinder ?? drive.cylinder,
      side = this.#pinnedSide ?? drive.side

    write(this.#at, `${cylinder}/${side}`)

    if (!disc) {
      write(this.#layout, "no disc")
      this.#showSectors([], -1)
      return
    }

    const sectors = disc.sectors(cylinder, side),
      // Only a head over this very track has a byte on it.
      onThisTrack = cylinder == drive.cylinder && side == drive.side,
      under = onThisTrack ? Floppy.sectorUnderHead(sectors, drive.position) : -1

    write(this.#layout, describeTrack(disc.track(cylinder, side)))
    this.#showSectors(sectors, under)
  }

  #showSectors(sectors, under) {
    while (this.#rows.length < sectors.length) {
      const row = createRow()

      this.#rows.push(row)
      this.#body.append(row)
    }

    for (let index = 0; index < this.#rows.length; index++) {
      const row = this.#rows[index],
        sector = sectors[index]

      row.hidden = sector == null

      if (!sector) {
        continue
      }

      row.ariaCurrent = index == under ? "true" : null

      for (let column = 0; column < COLUMNS.length; column++) {
        write(row.cells[column], COLUMNS[column].read(sector))
      }
    }
  }
}

TrackElement.define("colophon-track")
