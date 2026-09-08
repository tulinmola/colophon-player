import { readSymbols } from "../symbols"

// Fetched relative to the page and given to the machine that will be read
// under them; which dialect the file is in is settled by the file itself.
export async function readSymbolFile(machine, url, signal) {
  const listed = await fetch(url, { signal }),
    text = await listed.text(),
    defined = readSymbols(text)

  if (!defined) {
    throw new Error(`${url} is not a symbol file this debugger can read`)
  }

  machine.symbols.add(defined)
}
