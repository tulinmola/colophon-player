import {
  UPD765_AT_C,
  UPD765_AT_COMMAND,
  UPD765_AT_COMMAND_RECEIVED,
  UPD765_AT_H,
  UPD765_AT_HEAD_LOADED,
  UPD765_AT_HEAD_LOAD_TIME,
  UPD765_AT_HEAD_UNLOAD_TIME,
  UPD765_AT_N,
  UPD765_AT_NON_DMA,
  UPD765_AT_PHASE,
  UPD765_AT_R,
  UPD765_AT_RESULT,
  UPD765_AT_RESULT_LENGTH,
  UPD765_AT_ST0,
  UPD765_AT_ST1,
  UPD765_AT_ST2,
  UPD765_AT_STAGE,
  UPD765_AT_STEP_TIME,
  UPD765_AT_TERMINAL_COUNT,
  UPD765_AT_TRANSFERRED,
  UPD765_AT_TRANSFER_LENGTH,
  UPD765_COMMAND_BYTES,
  UPD765_MSR_CB,
  UPD765_MSR_DIO,
  UPD765_MSR_EXM,
  UPD765_MSR_RQM,
  UPD765_PHASE_COMMAND,
  UPD765_PHASE_EXECUTION,
  UPD765_PHASE_IDLE,
  UPD765_PHASE_RESULT,
  UPD765_RESULT_BYTES,
  UPD765_SIZE,
  UPD765_ST0_ABNORMAL,
  UPD765_ST0_EC,
  UPD765_ST0_HD,
  UPD765_ST0_INVALID,
  UPD765_ST0_NORMAL,
  UPD765_ST0_NR,
  UPD765_ST0_READY_CHANGED,
  UPD765_ST0_SE,
  UPD765_ST0_US,
  UPD765_ST1_DE,
  UPD765_ST1_EN,
  UPD765_ST1_MA,
  UPD765_ST1_ND,
  UPD765_ST1_NW,
  UPD765_ST1_OR,
  UPD765_ST2_BC,
  UPD765_ST2_CM,
  UPD765_ST2_DD,
  UPD765_ST2_MD,
  UPD765_ST2_SH,
  UPD765_ST2_SN,
  UPD765_ST2_WC,
  UPD765_STAGE_CHECK,
  UPD765_STAGE_DATA,
  UPD765_STAGE_FINDING_IDENTITY,
  UPD765_STAGE_FORMAT_ENDING,
  UPD765_STAGE_FORMAT_FIELD,
  UPD765_STAGE_FORMAT_IDENTITY,
  UPD765_STAGE_FORMAT_TO_IDENTITY,
  UPD765_STAGE_LOADING_HEAD,
  UPD765_STAGE_NONE,
  UPD765_STAGE_READING_IDENTITY,
  UPD765_STAGE_SKIPPING,
  UPD765_STAGE_TO_DATA,
  UPD765_STAGE_WAITING_INDEX
} from "./layout"
import { Struct } from "./struct"

const PHASES = {
  [UPD765_PHASE_IDLE]: "idle",
  [UPD765_PHASE_COMMAND]: "command",
  [UPD765_PHASE_EXECUTION]: "execution",
  [UPD765_PHASE_RESULT]: "result"
}

const STAGES = {
  [UPD765_STAGE_NONE]: "none",
  [UPD765_STAGE_LOADING_HEAD]: "loading head",
  [UPD765_STAGE_FINDING_IDENTITY]: "finding identity",
  [UPD765_STAGE_READING_IDENTITY]: "reading identity",
  [UPD765_STAGE_TO_DATA]: "to data",
  [UPD765_STAGE_DATA]: "data",
  [UPD765_STAGE_SKIPPING]: "skipping",
  [UPD765_STAGE_CHECK]: "check",
  [UPD765_STAGE_WAITING_INDEX]: "waiting index",
  [UPD765_STAGE_FORMAT_TO_IDENTITY]: "format to identity",
  [UPD765_STAGE_FORMAT_IDENTITY]: "format identity",
  [UPD765_STAGE_FORMAT_FIELD]: "format field",
  [UPD765_STAGE_FORMAT_ENDING]: "format ending"
}

const INTERRUPT_CODES = {
  [UPD765_ST0_NORMAL]: "normal",
  [UPD765_ST0_ABNORMAL]: "abnormal",
  [UPD765_ST0_INVALID]: "invalid",
  [UPD765_ST0_READY_CHANGED]: "ready changed"
}

// IC is the top pair of bits of ST0; these two are that pair.
const INTERRUPT_CODE_BITS = UPD765_ST0_ABNORMAL | UPD765_ST0_INVALID

export class Upd765 extends Struct {
  #module

  constructor(module, pointer, capture) {
    super(module, pointer, UPD765_SIZE, capture)
    this.#module = module
  }

  get status() {
    return this.#module._player_fdc_status()
  }

  get requestForMaster() {
    return (this.status & UPD765_MSR_RQM) != 0
  }

  get directionToProcessor() {
    return (this.status & UPD765_MSR_DIO) != 0
  }

  get executionMode() {
    return (this.status & UPD765_MSR_EXM) != 0
  }

  get controllerBusy() {
    return (this.status & UPD765_MSR_CB) != 0
  }

  get phase() {
    return PHASES[this.longAt(UPD765_AT_PHASE)]
  }

  get stage() {
    return STAGES[this.longAt(UPD765_AT_STAGE)]
  }

  get command() {
    return this.bytesAt(UPD765_AT_COMMAND, UPD765_COMMAND_BYTES)
  }

  get commandReceived() {
    return this.byteAt(UPD765_AT_COMMAND_RECEIVED)
  }

  get result() {
    return this.bytesAt(UPD765_AT_RESULT, UPD765_RESULT_BYTES)
  }

  get resultLength() {
    return this.byteAt(UPD765_AT_RESULT_LENGTH)
  }

  get terminalCount() {
    return this.boolAt(UPD765_AT_TERMINAL_COUNT)
  }

  get transferred() {
    return this.longAt(UPD765_AT_TRANSFERRED)
  }

  get transferLength() {
    return this.longAt(UPD765_AT_TRANSFER_LENGTH)
  }

  get st0() {
    return this.byteAt(UPD765_AT_ST0)
  }

  get st1() {
    return this.byteAt(UPD765_AT_ST1)
  }

  get st2() {
    return this.byteAt(UPD765_AT_ST2)
  }

  get interruptCode() {
    return INTERRUPT_CODES[this.st0 & INTERRUPT_CODE_BITS]
  }

  get seekEnd() {
    return (this.st0 & UPD765_ST0_SE) != 0
  }

  get equipmentCheck() {
    return (this.st0 & UPD765_ST0_EC) != 0
  }

  get notReady() {
    return (this.st0 & UPD765_ST0_NR) != 0
  }

  get headAddress() {
    return (this.st0 & UPD765_ST0_HD) != 0
  }

  get unitSelect() {
    return this.st0 & UPD765_ST0_US
  }

  get endOfCylinder() {
    return (this.st1 & UPD765_ST1_EN) != 0
  }

  get dataError() {
    return (this.st1 & UPD765_ST1_DE) != 0
  }

  get overrun() {
    return (this.st1 & UPD765_ST1_OR) != 0
  }

  get noData() {
    return (this.st1 & UPD765_ST1_ND) != 0
  }

  get notWriteable() {
    return (this.st1 & UPD765_ST1_NW) != 0
  }

  get missingAddressMark() {
    return (this.st1 & UPD765_ST1_MA) != 0
  }

  get controlMark() {
    return (this.st2 & UPD765_ST2_CM) != 0
  }

  get dataErrorInDataField() {
    return (this.st2 & UPD765_ST2_DD) != 0
  }

  get wrongCylinder() {
    return (this.st2 & UPD765_ST2_WC) != 0
  }

  get scanHit() {
    return (this.st2 & UPD765_ST2_SH) != 0
  }

  get scanNotSatisfied() {
    return (this.st2 & UPD765_ST2_SN) != 0
  }

  get badCylinder() {
    return (this.st2 & UPD765_ST2_BC) != 0
  }

  get missingAddressMarkInDataField() {
    return (this.st2 & UPD765_ST2_MD) != 0
  }

  get c() {
    return this.byteAt(UPD765_AT_C)
  }

  get h() {
    return this.byteAt(UPD765_AT_H)
  }

  get r() {
    return this.byteAt(UPD765_AT_R)
  }

  get n() {
    return this.byteAt(UPD765_AT_N)
  }

  get stepTime() {
    return this.longAt(UPD765_AT_STEP_TIME)
  }

  set stepTime(microseconds) {
    this.putLongAt(UPD765_AT_STEP_TIME, microseconds)
  }

  get headLoadTime() {
    return this.longAt(UPD765_AT_HEAD_LOAD_TIME)
  }

  set headLoadTime(microseconds) {
    this.putLongAt(UPD765_AT_HEAD_LOAD_TIME, microseconds)
  }

  get headUnloadTime() {
    return this.longAt(UPD765_AT_HEAD_UNLOAD_TIME)
  }

  set headUnloadTime(microseconds) {
    this.putLongAt(UPD765_AT_HEAD_UNLOAD_TIME, microseconds)
  }

  get nonDma() {
    return this.boolAt(UPD765_AT_NON_DMA)
  }

  set nonDma(chosen) {
    this.putBoolAt(UPD765_AT_NON_DMA, chosen)
  }

  get headLoaded() {
    return this.boolAt(UPD765_AT_HEAD_LOADED)
  }
}
