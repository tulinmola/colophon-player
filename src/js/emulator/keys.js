// Where a browser's physical keys sit on the CPC's matrix, by position
// rather than by letter, so a machine reading line 6 bit 5 gets the key under
// the finger that would have pressed F. Positions from "Reading the keyboard
// and Joysticks" (Kevin Thacker's cpctech),
// https://cpctech.cpcwiki.de/docs/keyboard.html — the same table the
// emulator's own character legends come from.
//
// Absent on purpose: Tab, which the page needs for moving between elements,
// and Caps Lock, which browsers report as a state rather than a press.

const keyAt = (line, bit) => line * 8 + bit

export const MATRIX = {
  ArrowUp: keyAt(0, 0),
  ArrowRight: keyAt(0, 1),
  ArrowDown: keyAt(0, 2),
  ArrowLeft: keyAt(1, 0),

  // the CPC's CLR
  Delete: keyAt(2, 0),
  BracketLeft: keyAt(2, 1),
  Enter: keyAt(2, 2),
  BracketRight: keyAt(2, 3),
  ShiftLeft: keyAt(2, 5),
  ShiftRight: keyAt(2, 5),
  Backslash: keyAt(2, 6),
  ControlLeft: keyAt(2, 7),
  ControlRight: keyAt(2, 7),

  // the CPC's ^, in the same place along the row
  Equal: keyAt(3, 0),
  Minus: keyAt(3, 1),
  // the CPC's @, which no other position can reach
  Backquote: keyAt(3, 2),
  KeyP: keyAt(3, 3),
  Semicolon: keyAt(3, 4),
  Quote: keyAt(3, 5),
  Slash: keyAt(3, 6),
  Period: keyAt(3, 7),

  Digit0: keyAt(4, 0),
  Digit9: keyAt(4, 1),
  KeyO: keyAt(4, 2),
  KeyI: keyAt(4, 3),
  KeyL: keyAt(4, 4),
  KeyK: keyAt(4, 5),
  KeyM: keyAt(4, 6),
  Comma: keyAt(4, 7),

  Digit8: keyAt(5, 0),
  Digit7: keyAt(5, 1),
  KeyU: keyAt(5, 2),
  KeyY: keyAt(5, 3),
  KeyH: keyAt(5, 4),
  KeyJ: keyAt(5, 5),
  KeyN: keyAt(5, 6),
  Space: keyAt(5, 7),

  Digit6: keyAt(6, 0),
  Digit5: keyAt(6, 1),
  KeyR: keyAt(6, 2),
  KeyT: keyAt(6, 3),
  KeyG: keyAt(6, 4),
  KeyF: keyAt(6, 5),
  KeyB: keyAt(6, 6),
  KeyV: keyAt(6, 7),

  Digit4: keyAt(7, 0),
  Digit3: keyAt(7, 1),
  KeyE: keyAt(7, 2),
  KeyW: keyAt(7, 3),
  KeyS: keyAt(7, 4),
  KeyD: keyAt(7, 5),
  KeyC: keyAt(7, 6),
  KeyX: keyAt(7, 7),

  Digit1: keyAt(8, 0),
  Digit2: keyAt(8, 1),
  Escape: keyAt(8, 2),
  KeyQ: keyAt(8, 3),
  KeyA: keyAt(8, 5),
  KeyZ: keyAt(8, 7),

  // the CPC's DEL
  Backspace: keyAt(9, 7),

  Numpad0: keyAt(1, 7),
  Numpad1: keyAt(1, 5),
  Numpad2: keyAt(1, 6),
  Numpad3: keyAt(0, 5),
  Numpad4: keyAt(2, 4),
  Numpad5: keyAt(1, 4),
  Numpad6: keyAt(0, 4),
  Numpad7: keyAt(1, 2),
  Numpad8: keyAt(1, 3),
  Numpad9: keyAt(0, 3),
  NumpadEnter: keyAt(0, 6),
  NumpadDecimal: keyAt(0, 7)
}
