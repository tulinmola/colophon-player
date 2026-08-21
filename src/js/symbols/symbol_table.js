// A symbol file carries no extents. Without a limit the last symbol reaches
// every firmware address after it.
const REACH = 0x400

export class SymbolTable {
  #addresses = []
  #names = new Map()
  #size = 0

  get size() {
    return this.#size
  }

  add(entries) {
    for (const { name, address } of entries) {
      const named = this.#names.get(address)

      if (named) {
        named.push(name)
      } else {
        this.#names.set(address, [name])
      }

      this.#size++
    }

    this.#addresses = Array.from(this.#names.keys()).sort((one, other) => one - other)
  }

  namesAt(address) {
    return this.#names.get(address) ?? []
  }

  nearest(address) {
    const addresses = this.#addresses
    let low = 0,
      high = addresses.length

    while (low < high) {
      const middle = (low + high) >> 1

      if (addresses[middle] <= address) {
        low = middle + 1
      } else {
        high = middle
      }
    }

    const found = addresses[low - 1]

    if (found == null || address - found > REACH) {
      return null
    }

    return { name: this.#names.get(found)[0], address: found, offset: address - found }
  }

  all() {
    const listed = []

    for (const address of this.#addresses) {
      for (const name of this.#names.get(address)) {
        listed.push({ name, address })
      }
    }

    return listed
  }
}
