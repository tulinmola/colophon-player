const HEADING = "Symbols by name:"

// Only the table sorted by name says what a symbol is: a section number or A
// is a place, E, R and S are values. The table sorted by value has them mixed.
const SYMBOL = /^(?<name>\S+)\s+(?:[0-9A-Fa-f]{2}|A):(?<address>[0-9A-Fa-f]+)/u

// https://sun.hasenbraten.de/vasm/ — listing.c writes both tables.
export function readVasm(lines) {
  const start = lines.indexOf(HEADING)

  if (start < 0) {
    return null
  }

  const defined = []

  for (let index = start + 1; index < lines.length; index++) {
    const symbol = SYMBOL.exec(lines[index])

    if (symbol) {
      defined.push({
        name: symbol.groups.name,
        address: parseInt(symbol.groups.address, 16)
      })
    }
  }

  return defined
}
