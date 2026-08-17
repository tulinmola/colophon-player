import { fields, hex, html, write } from "../lang"
import { Viewer } from "./viewer"

function bit(on) {
  return on ? "1" : "."
}

function halves(value) {
  return `${hex(value >> 8)} ${hex(value & 0xff, { prefix: "" })}`
}

function flagLetters(z80) {
  const letters = [
    z80.flagS ? "S" : ".",
    z80.flagZ ? "Z" : ".",
    z80.flagY ? "Y" : ".",
    z80.flagH ? "H" : ".",
    z80.flagX ? "X" : ".",
    z80.flagPV ? "P" : ".",
    z80.flagN ? "N" : ".",
    z80.flagC ? "C" : "."
  ]

  return letters.join(" ")
}

class Z80Element extends Viewer {
  #fields

  watch(machine) {
    this.innerHTML = html`
      <h2>Z80</h2>
      <dl class="pairs">
        <dt>A</dt>
        <dd data-field="a"></dd>
        <dt>AF'</dt>
        <dd data-field="af_"></dd>
        <dt>BC</dt>
        <dd data-field="bc"></dd>
        <dt>BC'</dt>
        <dd data-field="bc_"></dd>
        <dt>DE</dt>
        <dd data-field="de"></dd>
        <dt>DE'</dt>
        <dd data-field="de_"></dd>
        <dt>HL</dt>
        <dd data-field="hl"></dd>
        <dt>HL'</dt>
        <dd data-field="hl_"></dd>
        <dt>IX</dt>
        <dd data-field="ix"></dd>
        <dt>IY</dt>
        <dd data-field="iy"></dd>
        <dt>SP</dt>
        <dd data-field="sp"></dd>
        <dt>PC</dt>
        <dd data-field="pc"></dd>
        <dt>I</dt>
        <dd data-field="i"></dd>
        <dt>R</dt>
        <dd data-field="r"></dd>
        <dt>WZ</dt>
        <dd data-field="wz"></dd>
      </dl>
      <dl>
        <dt>F</dt>
        <dd data-field="flags"></dd>
      </dl>
      <dl class="indicators">
        <dt>IM</dt>
        <dd data-field="im"></dd>
        <dt>IFF1</dt>
        <dd data-field="iff1"></dd>
        <dt>IFF2</dt>
        <dd data-field="iff2"></dd>
        <dt>HALT</dt>
        <dd data-field="halted"></dd>
        <dt>INT</dt>
        <dd data-field="intLine"></dd>
      </dl>
    `

    this.#fields = fields(this)

    machine.addEventListener("frame", () => this.#render(machine), { signal: this.signal })
    this.#render(machine)
  }

  #render(machine) {
    const z80 = machine.z80,
      shown = this.#fields

    write(shown.a, hex(z80.a))
    write(shown.af_, halves(z80.af_))
    write(shown.bc, halves(z80.bc))
    write(shown.bc_, halves(z80.bc_))
    write(shown.de, halves(z80.de))
    write(shown.de_, halves(z80.de_))
    write(shown.hl, halves(z80.hl))
    write(shown.hl_, halves(z80.hl_))
    write(shown.ix, halves(z80.ix))
    write(shown.iy, halves(z80.iy))
    write(shown.sp, hex(z80.sp, { digits: 4 }))
    write(shown.pc, hex(z80.pc, { digits: 4 }))
    write(shown.i, hex(z80.i))
    write(shown.r, hex(z80.r))
    write(shown.wz, hex(z80.wz, { digits: 4 }))

    write(shown.flags, flagLetters(z80))

    write(shown.im, String(z80.im))
    write(shown.iff1, bit(z80.iff1))
    write(shown.iff2, bit(z80.iff2))
    write(shown.halted, bit(z80.halted))
    write(shown.intLine, bit(z80.intLine))
  }
}

Z80Element.define("colophon-z80")
