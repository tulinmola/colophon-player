import { readNoice } from "./noi"

// A .sym is five different formats, so the dialect comes from the content.
// https://github.com/openMSX/debugger/blob/master/src/SymbolTable.cpp
export function readSymbols(text) {
  const lines = text.split(/\r?\n/u),
    first = lines.find(line => line.trim())

  return first?.startsWith("DEF ") ? readNoice(lines) : null
}
