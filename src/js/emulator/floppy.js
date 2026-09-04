import {
  FLOPPY_AT_CYLINDERS,
  FLOPPY_AT_MODIFIED,
  FLOPPY_AT_SIDES,
  FLOPPY_AT_TRACKS,
  FLOPPY_AT_WRITE_PROTECTED,
  FLOPPY_BYTES_PER_REVOLUTION,
  FLOPPY_MAX_CYLINDERS,
  FLOPPY_MAX_SIDES,
  FLOPPY_SECTOR_AT_ANNOUNCED,
  FLOPPY_SECTOR_AT_C,
  FLOPPY_SECTOR_AT_COPIES,
  FLOPPY_SECTOR_AT_DATA_CRC_ERROR,
  FLOPPY_SECTOR_AT_DELETED,
  FLOPPY_SECTOR_AT_EXTENT,
  FLOPPY_SECTOR_AT_H,
  FLOPPY_SECTOR_AT_IDENTITY_CRC_ERROR,
  FLOPPY_SECTOR_AT_N,
  FLOPPY_SECTOR_AT_NO_DATA_FIELD,
  FLOPPY_SECTOR_AT_POSITION,
  FLOPPY_SECTOR_AT_R,
  FLOPPY_SECTOR_AT_RECORDED,
  FLOPPY_SECTOR_SIZE,
  FLOPPY_SIZE,
  FLOPPY_TRACK_AT_FILLER,
  FLOPPY_TRACK_AT_FORMATTED,
  FLOPPY_TRACK_AT_GAP,
  FLOPPY_TRACK_AT_LENGTH,
  FLOPPY_TRACK_AT_SECTORS,
  FLOPPY_TRACK_AT_SECTOR_COUNT,
  FLOPPY_TRACK_AT_UNREADABLE,
  FLOPPY_TRACK_SIZE
} from "./layout"
import { Struct } from "./struct"

const OFF_THE_MEDIUM = {
  formatted: false,
  unreadable: false,
  sectorCount: 0,
  gap: 0,
  filler: 0,
  length: 0
}

function onTheMedium(cylinder, side) {
  return cylinder < FLOPPY_MAX_CYLINDERS && side < FLOPPY_MAX_SIDES
}

export class Floppy extends Struct {
  constructor(module, pointer, capture) {
    super(module, pointer, FLOPPY_SIZE, capture)
  }

  get cylinders() {
    return this.byteAt(FLOPPY_AT_CYLINDERS)
  }

  get sides() {
    return this.byteAt(FLOPPY_AT_SIDES)
  }

  get writeProtected() {
    return this.boolAt(FLOPPY_AT_WRITE_PROTECTED)
  }

  set writeProtected(over) {
    this.putBoolAt(FLOPPY_AT_WRITE_PROTECTED, over)
  }

  get modified() {
    return this.boolAt(FLOPPY_AT_MODIFIED)
  }

  track(cylinder, side) {
    if (!onTheMedium(cylinder, side)) {
      return OFF_THE_MEDIUM
    }

    const at = this.#trackAt(cylinder, side)

    return {
      formatted: this.boolAt(at + FLOPPY_TRACK_AT_FORMATTED),
      unreadable: this.boolAt(at + FLOPPY_TRACK_AT_UNREADABLE),
      sectorCount: this.byteAt(at + FLOPPY_TRACK_AT_SECTOR_COUNT),
      gap: this.byteAt(at + FLOPPY_TRACK_AT_GAP),
      filler: this.byteAt(at + FLOPPY_TRACK_AT_FILLER),
      length: this.longAt(at + FLOPPY_TRACK_AT_LENGTH)
    }
  }

  // R does not identify a sector, since a track may announce the same number
  // twice, so the order they pass the head is the only order there is.
  sectors(cylinder, side) {
    if (!onTheMedium(cylinder, side)) {
      return []
    }

    const at = this.#trackAt(cylinder, side),
      count = this.byteAt(at + FLOPPY_TRACK_AT_SECTOR_COUNT),
      listed = []

    for (let index = 0; index < count; index++) {
      const sector = at + FLOPPY_TRACK_AT_SECTORS + index * FLOPPY_SECTOR_SIZE
      listed.push(this.#sector(sector))
    }

    return listed
  }

  // The head is under the sector whose sync it last passed, so the gap after a
  // sector belongs to it, and the last sector keeps the head across the index
  // until the first one's sync comes round again.
  static sectorUnderHead(sectors, position) {
    for (let index = 0; index < sectors.length - 1; index++) {
      if (position >= sectors[index].position && position < sectors[index + 1].position) {
        return index
      }
    }

    return sectors.length - 1
  }

  // An unformatted track still turns, and a track only keeps a length of its
  // own once a head can read it.
  trackLength(cylinder, side) {
    const track = this.track(cylinder, side)

    return track.formatted && !track.unreadable ? track.length : FLOPPY_BYTES_PER_REVOLUTION
  }

  #trackAt(cylinder, side) {
    return FLOPPY_AT_TRACKS + (cylinder * FLOPPY_MAX_SIDES + side) * FLOPPY_TRACK_SIZE
  }

  #sector(at) {
    return {
      c: this.byteAt(at + FLOPPY_SECTOR_AT_C),
      h: this.byteAt(at + FLOPPY_SECTOR_AT_H),
      r: this.byteAt(at + FLOPPY_SECTOR_AT_R),
      n: this.byteAt(at + FLOPPY_SECTOR_AT_N),
      deleted: this.boolAt(at + FLOPPY_SECTOR_AT_DELETED),
      identityCrcError: this.boolAt(at + FLOPPY_SECTOR_AT_IDENTITY_CRC_ERROR),
      dataCrcError: this.boolAt(at + FLOPPY_SECTOR_AT_DATA_CRC_ERROR),
      noDataField: this.boolAt(at + FLOPPY_SECTOR_AT_NO_DATA_FIELD),
      announced: this.longAt(at + FLOPPY_SECTOR_AT_ANNOUNCED),
      recorded: this.longAt(at + FLOPPY_SECTOR_AT_RECORDED),
      extent: this.longAt(at + FLOPPY_SECTOR_AT_EXTENT),
      copies: this.longAt(at + FLOPPY_SECTOR_AT_COPIES),
      position: this.longAt(at + FLOPPY_SECTOR_AT_POSITION)
    }
  }
}
