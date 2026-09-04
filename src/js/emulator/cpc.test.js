import { beforeEach, describe, expect, it } from "vitest"
import { Cpc } from "./cpc"
import { Floppy } from "./floppy"
import { createModule } from "./module"

const RAM_SIZE = 0x20000

const HEADER = 256,
  TRACK_HEADER = 256,
  SECTOR_ENTRY = 8

const AT_CYLINDERS = 0x30,
  AT_SIDES = 0x31,
  AT_TRACK_LENGTH = 0x32,
  AT_TRACK_CYLINDER = 0x10,
  AT_TRACK_SIDE = 0x11,
  AT_TRACK_SIZE_CODE = 0x14,
  AT_TRACK_SECTORS = 0x15,
  AT_TRACK_GAP = 0x16,
  AT_TRACK_FILLER = 0x17,
  AT_SECTOR_LIST = 0x18

const FIRST_SECTOR = 0xc1

// As floppy.h counts them: the medium's width, one revolution, and the gap,
// sync and index mark a track opens with.
const FLOPPY_CYLINDERS = 102,
  BYTES_A_REVOLUTION = 6250,
  PREAMBLE = 146

function ascii(text) {
  return Array.from(text, character => character.charCodeAt(0))
}

// An image in the original layout — one length for every track and one
// allotment for every sector — laid out as "Disk image file format" (Kevin
// Thacker's cpctech) sets it out: https://cpctech.cpcwiki.de/docs/dsk.html
function discImage({ cylinders = 1 } = {}) {
  const sides = 1,
    sectors = 9,
    sizeCode = 2,
    announced = 128 << sizeCode,
    trackLength = TRACK_HEADER + sectors * announced,
    image = new Uint8Array(HEADER + cylinders * sides * trackLength),
    gap = 0x52,
    filler = 0xe5

  image.set(ascii("MV - CPCEMU Disk-File\r\nDisk-Info\r\n"), 0)
  image[AT_CYLINDERS] = cylinders
  image[AT_SIDES] = sides
  image[AT_TRACK_LENGTH] = trackLength & 0xff
  image[AT_TRACK_LENGTH + 1] = trackLength >> 8

  let at = HEADER
  for (let cylinder = 0; cylinder < cylinders; cylinder++) {
    for (let side = 0; side < sides; side++) {
      image.set(ascii("Track-Info\r\n"), at)
      image[at + AT_TRACK_CYLINDER] = cylinder
      image[at + AT_TRACK_SIDE] = side
      image[at + AT_TRACK_SIZE_CODE] = sizeCode
      image[at + AT_TRACK_SECTORS] = sectors
      image[at + AT_TRACK_GAP] = gap
      image[at + AT_TRACK_FILLER] = filler

      for (let index = 0; index < sectors; index++) {
        const entry = at + AT_SECTOR_LIST + index * SECTOR_ENTRY

        image[entry] = cylinder
        image[entry + 1] = side
        image[entry + 2] = FIRST_SECTOR + index
        image[entry + 3] = sizeCode
      }

      image.fill(filler, at + TRACK_HEADER, at + trackLength)
      at += trackLength
    }
  }

  return image
}

// Never ticked, so it needs no firmware: what is under test is the road an
// image travels, not anything that runs off one.
async function bootMachine() {
  const module = await createModule()

  module._player_boot(RAM_SIZE, true)

  return new Cpc(module, RAM_SIZE, true)
}

describe("a disc in a drive", function () {
  let cpc = null

  beforeEach(async function () {
    cpc = await bootMachine()
  })

  it("lays an image over the medium and puts it in the drive", function () {
    expect(cpc.insertDisc(0, discImage(), "test.dsk")).toBe(true)
    expect(cpc.discProblem).toBe(null)
    expect(cpc.discName(0)).toBe("test.dsk")

    const disc = cpc.drives[0].floppy

    expect(disc.cylinders).toBe(1)
    expect(disc.sides).toBe(1)
    expect(disc.writeProtected).toBe(false)
    expect(disc.modified).toBe(false)
  })

  it("reads the sectors in the order they pass the head", function () {
    cpc.insertDisc(0, discImage(), "test.dsk")

    const disc = cpc.drives[0].floppy,
      track = disc.track(0, 0),
      sectors = disc.sectors(0, 0)

    expect(track.formatted).toBe(true)
    expect(track.unreadable).toBe(false)
    expect(track.sectorCount).toBe(9)
    expect(track.gap).toBe(0x52)
    expect(track.filler).toBe(0xe5)

    expect(sectors.map(sector => sector.r)).toEqual([
      0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9
    ])
    // One whole sector, to prove every offset in the generated map.
    expect(sectors[0]).toEqual({
      c: 0,
      h: 0,
      r: FIRST_SECTOR,
      n: 2,
      deleted: false,
      identityCrcError: false,
      dataCrcError: false,
      noDataField: false,
      announced: 512,
      recorded: 512,
      extent: 512,
      copies: 1,
      position: PREAMBLE
    })
  })

  it("answers a cylinder past the disc, and one past the medium, as unformatted", function () {
    cpc.insertDisc(0, discImage(), "test.dsk")

    const disc = cpc.drives[0].floppy

    // Inside the medium, where a head can really step, but past this disc.
    expect(disc.track(41, 0).formatted).toBe(false)
    expect(disc.sectors(41, 0)).toEqual([])

    // Past the medium altogether, which only a pinned panel can ask for.
    expect(disc.track(FLOPPY_CYLINDERS, 0).formatted).toBe(false)
    expect(disc.sectors(FLOPPY_CYLINDERS, 0)).toEqual([])

    // An unformatted track still turns, so a head over one has a length.
    expect(disc.trackLength(41, 0)).toBe(BYTES_A_REVOLUTION)
  })

  it("refuses what is not a disc image, in the reader's own words", function () {
    expect(cpc.insertDisc(0, new Uint8Array(512), "rubbish.dsk")).toBe(false)
    expect(cpc.discProblem).toBe("the image does not begin like a disc image")
    expect(cpc.drives[0].floppy).toBe(null)
    expect(cpc.discName(0)).toBe("")
  })

  it("refuses an image with no room for it before writing anything", function () {
    const capacity = cpc.discCapacity

    cpc.insertDisc(0, discImage(), "good.dsk")
    expect(cpc.insertDisc(0, new Uint8Array(capacity + 1), "huge.dsk")).toBe(false)

    // The buffer the disc in the drive is borrowing must not have been
    // touched, so that disc is still there and still readable.
    expect(cpc.drives[0].floppy).not.toBe(null)
    expect(cpc.discName(0)).toBe("good.dsk")
    expect(cpc.drives[0].floppy.sectors(0, 0)).toHaveLength(9)
  })

  it("takes a disc out again, and leaves the medium where it was", function () {
    cpc.insertDisc(0, discImage(), "test.dsk")
    cpc.ejectDisc(0)

    expect(cpc.drives[0].floppy).toBe(null)

    // The eject is on the record, so a moment before it can still be stood
    // at: the medium and its name have to still be there when it is.
    expect(cpc.discName(0)).toBe("test.dsk")
  })

  it("hands back an image of the disc that goes into another drive", function () {
    cpc.insertDisc(0, discImage({ cylinders: 2 }), "test.dsk")

    const written = cpc.saveDisc(0)

    expect(cpc.discProblem).toBe(null)
    expect(written.length).toBeGreaterThan(0)

    // A copy and not a window onto the module's memory, which owns exactly its
    // own buffer where a view would sit in the whole 32MB of it.
    expect(written.byteLength).toBe(written.buffer.byteLength)
    expect(cpc.insertDisc(1, written, "again.dsk")).toBe(true)
    expect(cpc.drives[1].floppy.sectors(1, 0)).toEqual(cpc.drives[0].floppy.sectors(1, 0))
  })

  it("refuses to write a drive with nothing in it", function () {
    expect(cpc.saveDisc(1)).toBe(null)
    expect(cpc.discProblem).toBe("there is no disc in that drive to write")
  })
})

// The head is under the sector whose sync it last passed. Positions are the
// ones a formatter leaves: the preamble, then each sector after the one before.
describe("which sector the head is under", function () {
  const sectors = [{ position: 146 }, { position: 802 }, { position: 1458 }]

  it("finds the sector the head stands in", function () {
    expect(Floppy.sectorUnderHead(sectors, 146)).toBe(0)
    expect(Floppy.sectorUnderHead(sectors, 801)).toBe(0)
    expect(Floppy.sectorUnderHead(sectors, 802)).toBe(1)
    expect(Floppy.sectorUnderHead(sectors, 1458)).toBe(2)
    expect(Floppy.sectorUnderHead(sectors, 6249)).toBe(2)
  })

  it("gives the preamble to the last sector, which the head has not left", function () {
    // Before the first sector's sync the head is still past the last one, the
    // index having come round between them.
    expect(Floppy.sectorUnderHead(sectors, 0)).toBe(2)
    expect(Floppy.sectorUnderHead(sectors, 145)).toBe(2)
  })

  it("finds nothing on a track with no sectors", function () {
    expect(Floppy.sectorUnderHead([], 0)).toBe(-1)
  })
})

describe("the drive and the controller at rest", function () {
  let cpc = null

  beforeEach(async function () {
    cpc = await bootMachine()
  })

  it("answers the lines a controller reads", function () {
    const [a, b] = cpc.drives

    expect(a.ready).toBe(false)
    expect(a.trackZero).toBe(true)
    expect(a.writeProtected).toBe(false)

    // Drive A is the machine's own one-headed drive; B takes a two-headed one.
    expect(a.twoSided).toBe(false)
    expect(b.twoSided).toBe(true)

    cpc.insertDisc(0, discImage(), "test.dsk")

    // A disc alone is not READY: the motor is the machine's to turn.
    expect(a.ready).toBe(false)
    expect(a.motor).toBe(false)
    expect(a.cylinder).toBe(0)
    expect(a.revolutions).toBe(0)
  })

  it("shows a controller waiting for a command", function () {
    const fdc = cpc.fdc

    expect(fdc.phase).toBe("idle")
    expect(fdc.stage).toBe("none")

    // RQM alone: the chip wants a byte and nothing is in progress.
    expect(fdc.requestForMaster).toBe(true)
    expect(fdc.controllerBusy).toBe(false)
    expect(fdc.directionToProcessor).toBe(false)
    expect(fdc.executionMode).toBe(false)

    expect(fdc.interruptCode).toBe("normal")
    expect(fdc.terminalCount).toBe(false)
  })
})
