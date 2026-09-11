const KINDS = { execute: 1, read: 2, write: 4 }

export class Breakpoints {
  #entries = new Map()
  #module

  constructor(module) {
    this.#module = module
  }

  get size() {
    return this.#entries.size
  }

  all() {
    const listed = Array.from(this.#entries.values())

    return listed.sort(function (one, other) {
      return one.address - other.address || KINDS[one.kind] - KINDS[other.kind]
    })
  }

  get(address, kind) {
    return this.#entries.get(`${address} ${kind}`)
  }

  covering(address, kind) {
    for (const entry of this.#entries.values()) {
      if (entry.kind == kind && address >= entry.address && address <= entry.until) {
        return entry
      }
    }

    return null
  }

  add(address, kind, { until = address, label = "", once = false } = {}) {
    this.#entries.set(`${address} ${kind}`, { address, until, kind, label, enabled: true, once })
    this.#sync()
  }

  // A mark covering the address answers for it: one laid at its address would
  // replace it and leave with it, and one inside its range would stop a machine
  // whose mark the reader disarmed.
  addOnce(address, label) {
    if (this.covering(address, "execute") == null) {
      this.add(address, "execute", { label, once: true })
    }
  }

  remove(address, kind) {
    this.#entries.delete(`${address} ${kind}`)
    this.#sync()
  }

  removeIfOnce(address, kind) {
    if (this.get(address, kind)?.once) {
      this.remove(address, kind)
    }
  }

  enable(address, kind, enabled) {
    const entry = this.#entries.get(`${address} ${kind}`)

    entry.enabled = enabled
    this.#sync()
  }

  // Ranges overlap: a byte two of them want must survive losing one.
  #sync() {
    this.#module._player_clear_breakpoints()

    for (const { address, until, kind, enabled } of this.#entries.values()) {
      if (enabled) {
        this.#module._player_set_breakpoint(address, until, KINDS[kind])
      }
    }
  }
}
