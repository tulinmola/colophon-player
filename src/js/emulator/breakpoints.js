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

  add(address, kind, { until = address, label = "" } = {}) {
    this.#entries.set(`${address} ${kind}`, { address, until, kind, label, enabled: true })
    this.#sync()
  }

  remove(address, kind) {
    this.#entries.delete(`${address} ${kind}`)
    this.#sync()
  }

  enable(address, kind, enabled) {
    const entry = this.#entries.get(`${address} ${kind}`)

    entry.enabled = enabled
    this.#sync()
  }

  // The whole table is laid again rather than the one entry unset, because
  // ranges overlap and a byte two of them want must survive losing one.
  #sync() {
    this.#module._player_clear_breakpoints()

    for (const { address, until, kind, enabled } of this.#entries.values()) {
      if (enabled) {
        this.#module._player_set_breakpoint(address, until, KINDS[kind])
      }
    }
  }
}
