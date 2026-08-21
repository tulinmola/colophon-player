import { hex } from "../lang"

// The decomposition of "Decoding Z80 Opcodes" (Cristian Dinu),
// http://z80.info/decoding.htm: x, y and z cut from the opcode, p and q from
// y, and these tables read with them. src/z80.c decodes by the same cuts.
const R = ["B", "C", "D", "E", "H", "L", "(HL)", "A"]
const RP = ["BC", "DE", "HL", "SP"]
const RP2 = ["BC", "DE", "HL", "AF"]
const CC = ["NZ", "Z", "NC", "C", "PO", "PE", "P", "M"]
const ALU = ["ADD A,", "ADC A,", "SUB ", "SBC A,", "AND ", "XOR ", "OR ", "CP "]
const ROT = ["RLC", "RRC", "RL", "RR", "SLA", "SRA", "SLL", "SRL"]
const IM = ["0", "0/1", "1", "2", "0", "0/1", "1", "2"]
const ACCUMULATOR = ["RLCA", "RRCA", "RLA", "RRA", "DAA", "CPL", "SCF", "CCF"]
const INTERRUPT = ["LD I,A", "LD R,A", "LD A,I", "LD A,R", "RRD", "RLD", "NOP", "NOP"]
const BLOCK = [
  ["LDI", "CPI", "INI", "OUTI"],
  ["LDD", "CPD", "IND", "OUTD"],
  ["LDIR", "CPIR", "INIR", "OTIR"],
  ["LDDR", "CPDR", "INDR", "OTDR"]
]

function signed(value) {
  return value > 127 ? value - 256 : value
}

function hexByte(value) {
  return hex(value, { prefix: "&" })
}

export function disassemble(peek, address, nameOf = null) {
  let at = address,
    index = null,
    displacement = null

  function hexWord(value) {
    return nameOf?.(value) ?? hex(value, { digits: 4, prefix: "&" })
  }

  function next() {
    const value = peek(at & 0xffff)
    at = (at + 1) & 0xffff
    return value
  }

  function word() {
    const low = next(),
      high = next()

    return (high << 8) | low
  }

  // At most one of these per instruction, and under DD or FD followed by CB
  // it is read before the opcode that uses it.
  function offset() {
    if (displacement == null) {
      displacement = signed(next())
    }

    const magnitude = hexByte(Math.abs(displacement))
    return `(${index}${displacement < 0 ? "-" : "+"}${magnitude})`
  }

  function relative() {
    const step = signed(next())
    return hexWord((at + step) & 0xffff)
  }

  function operand(number) {
    if (!index) {
      return R[number]
    }

    switch (number) {
      case 4:
      case 5:
        return `${index}${R[number]}`
      case 6:
        return offset()
      default:
        return R[number]
    }
  }

  function pair(table, number) {
    const name = table[number]
    return index && name == "HL" ? index : name
  }

  function hl() {
    return index ?? "HL"
  }

  function relativeJumps(y) {
    switch (y) {
      case 0:
        return "NOP"
      case 1:
        return "EX AF,AF'"
      case 2:
        return `DJNZ ${relative()}`
      case 3:
        return `JR ${relative()}`
      default:
        return `JR ${CC[y - 4]},${relative()}`
    }
  }

  function indirectLoad(p, q) {
    switch (p) {
      case 0:
        return q == 0 ? "LD (BC),A" : "LD A,(BC)"
      case 1:
        return q == 0 ? "LD (DE),A" : "LD A,(DE)"
      case 2: {
        const target = hexWord(word())
        return q == 0 ? `LD (${target}),${hl()}` : `LD ${hl()},(${target})`
      }
      default: {
        const target = hexWord(word())
        return q == 0 ? `LD (${target}),A` : `LD A,(${target})`
      }
    }
  }

  function decodeX0(y, z, p, q) {
    switch (z) {
      case 0:
        return relativeJumps(y)
      case 1:
        return q == 0 ? `LD ${pair(RP, p)},${hexWord(word())}` : `ADD ${hl()},${pair(RP, p)}`
      case 2:
        return indirectLoad(p, q)
      case 3:
        return `${q == 0 ? "INC" : "DEC"} ${pair(RP, p)}`
      case 4:
        return `INC ${operand(y)}`
      case 5:
        return `DEC ${operand(y)}`
      case 6: {
        const target = operand(y)
        return `LD ${target},${hexByte(next())}`
      }
      default:
        return ACCUMULATOR[y]
    }
  }

  function load(y, z) {
    if (y == 6 && z == 6) {
      return "HALT"
    }
    // The register beside an (IX+d) stays itself: only one of the two can be
    // indexed, so the other never becomes IXH or IXL.
    if (index && (y == 6 || z == 6)) {
      const target = y == 6 ? offset() : R[y],
        source = z == 6 ? offset() : R[z]

      return `LD ${target},${source}`
    }
    return `LD ${operand(y)},${operand(z)}`
  }

  function stackAndJumps(y, p, q) {
    if (q == 0) {
      return `POP ${pair(RP2, p)}`
    }
    switch (p) {
      case 0:
        return "RET"
      case 1:
        return "EXX"
      case 2:
        return `JP (${hl()})`
      default:
        return `LD SP,${hl()}`
    }
  }

  function assortedOperations(y) {
    switch (y) {
      case 0:
        return `JP ${hexWord(word())}`
      case 2:
        return `OUT (${hexByte(next())}),A`
      case 3:
        return `IN A,(${hexByte(next())})`
      case 4:
        return `EX (SP),${hl()}`
      case 5:
        return "EX DE,HL"
      case 6:
        return "DI"
      default:
        return "EI"
    }
  }

  function decodeX3(y, z, p, q) {
    switch (z) {
      case 0:
        return `RET ${CC[y]}`
      case 1:
        return stackAndJumps(y, p, q)
      case 2:
        return `JP ${CC[y]},${hexWord(word())}`
      case 3:
        return assortedOperations(y)
      case 4:
        return `CALL ${CC[y]},${hexWord(word())}`
      case 5:
        return q == 0 ? `PUSH ${pair(RP2, p)}` : `CALL ${hexWord(word())}`
      case 6:
        return `${ALU[y]}${hexByte(next())}`
      default:
        return `RST ${hexByte(y * 8)}`
    }
  }

  function main(opcode) {
    const x = opcode >> 6,
      y = (opcode >> 3) & 7,
      z = opcode & 7,
      p = y >> 1,
      q = y & 1

    switch (x) {
      case 0:
        return decodeX0(y, z, p, q)
      case 1:
        return load(y, z)
      case 2:
        return `${ALU[y]}${operand(z)}`
      default:
        return decodeX3(y, z, p, q)
    }
  }

  function extended(opcode) {
    const x = opcode >> 6,
      y = (opcode >> 3) & 7,
      z = opcode & 7,
      p = y >> 1,
      q = y & 1

    if (x == 2 && z <= 3 && y >= 4) {
      return BLOCK[y - 4][z]
    }
    if (x != 1) {
      return "NOP"
    }

    switch (z) {
      case 0:
        return y == 6 ? "IN (C)" : `IN ${R[y]},(C)`
      case 1:
        return y == 6 ? "OUT (C),0" : `OUT (C),${R[y]}`
      case 2:
        return `${q == 0 ? "SBC" : "ADC"} HL,${RP[p]}`
      case 3: {
        const target = hexWord(word())
        return q == 0 ? `LD (${target}),${RP[p]}` : `LD ${RP[p]},(${target})`
      }
      case 4:
        return "NEG"
      case 5:
        return y == 1 ? "RETI" : "RETN"
      case 6:
        return `IM ${IM[y]}`
      default:
        return INTERRUPT[y]
    }
  }

  // Under an index prefix the register field names a copy the documentation
  // does not carry: "RLC (IX+d),B" and its like.
  function rotated(opcode) {
    const x = opcode >> 6,
      y = (opcode >> 3) & 7,
      z = opcode & 7,
      target = index ? offset() : R[z],
      copy = index && z != 6 ? `,${R[z]}` : ""

    switch (x) {
      case 0:
        return `${ROT[y]} ${target}${copy}`
      case 1:
        return `BIT ${y},${target}`
      case 2:
        return `RES ${y},${target}${copy}`
      default:
        return `SET ${y},${target}${copy}`
    }
  }

  function finish(text) {
    return { text, length: (at - address) & 0xffff }
  }

  let opcode = next()
  if (opcode == 0xdd || opcode == 0xfd) {
    index = opcode == 0xdd ? "IX" : "IY"
    opcode = next()
  }

  if (opcode == 0xcb) {
    if (index) {
      offset()
    }
    return finish(rotated(next()))
  }

  if (opcode == 0xed) {
    index = null
    return finish(extended(next()))
  }

  return finish(main(opcode))
}
