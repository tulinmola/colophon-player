import { readNoice } from "./noi"
import { readVasm } from "./vasm"

// A .sym is five different formats, so the dialect comes from the content.
// https://github.com/openMSX/debugger/blob/master/src/SymbolTable.cpp
export function readSymbols(text) {
  const lines = text.split(/\r?\n/u)

  return readNoice(lines) ?? readVasm(lines)
}
