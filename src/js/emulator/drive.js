import {
  DRIVE_AT_CYLINDER,
  DRIVE_AT_FLOPPY,
  DRIVE_AT_MOTOR,
  DRIVE_AT_POSITION,
  DRIVE_AT_REVOLUTIONS,
  DRIVE_AT_SIDE,
  DRIVE_AT_SPIN_UP,
  DRIVE_SIZE,
  FLOPPY_MAX_CYLINDERS
} from "./layout"
import { Struct } from "./struct"

// A head steps as far as the medium is wide and no further, which is the whole
// of what stops it: drive.c has no mechanical stop past that.
const CYLINDERS = FLOPPY_MAX_CYLINDERS

export class Drive extends Struct {
  #floppy
  #module
  #unit

  constructor(module, pointer, unit, floppy, capture) {
    super(module, pointer, DRIVE_SIZE, capture)
    this.#module = module
    this.#unit = unit
    this.#floppy = floppy
  }

  get floppy() {
    return this.longAt(DRIVE_AT_FLOPPY) == 0 ? null : this.#floppy
  }

  get motor() {
    return this.boolAt(DRIVE_AT_MOTOR)
  }

  get side() {
    return this.byteAt(DRIVE_AT_SIDE)
  }

  // A one-headed drive takes the line and ignores it, as drive_select_side
  // does.
  set side(side) {
    this.putBoolAt(DRIVE_AT_SIDE, this.twoSided && side != 0)
  }

  get cylinder() {
    return this.byteAt(DRIVE_AT_CYLINDER)
  }

  set cylinder(cylinder) {
    this.putByteAt(DRIVE_AT_CYLINDER, Math.min(cylinder, CYLINDERS - 1))
  }

  get position() {
    return this.longAt(DRIVE_AT_POSITION)
  }

  get revolutions() {
    return this.longAt(DRIVE_AT_REVOLUTIONS)
  }

  // Microseconds from MOTOR ON to speed. Nobody has measured one for these
  // drives, so the machine runs with none until a reader sets one.
  get spinUp() {
    return this.longAt(DRIVE_AT_SPIN_UP)
  }

  set spinUp(microseconds) {
    this.putLongAt(DRIVE_AT_SPIN_UP, microseconds)
  }

  // Answered by the drive rather than stored, so none can contradict the rest.
  get ready() {
    return this.#module._player_drive_ready(this.#unit) != 0
  }

  get trackZero() {
    return this.#module._player_drive_track_zero(this.#unit) != 0
  }

  get writeProtected() {
    return this.#module._player_drive_write_protected(this.#unit) != 0
  }

  get twoSided() {
    return this.#module._player_drive_two_sided(this.#unit) != 0
  }
}
