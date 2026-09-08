// Where a browser's physical keys sit on the Spectrum's matrix, by position
// rather than by letter. Eight half-rows of five, numbered by the address line
// that selects each, as spectrum.h numbers them; positions from "Sinclair ZX
// Specifications" (Martin Korth), https://www.problemkaputt.de/zxdocs.htm,
// Spectrum Keyboard Assignment — the same table the emulator's own legends
// come from.
//
// The arrows and delete are CAPS SHIFT and a digit, which is what their
// legends say on the case, so those keys close two switches.
//
// Caps Lock is absent, as browsers report it as a state rather than a press,
// and Tab is left to the page for moving between elements.

const keyAt = (halfRow, bit) => halfRow * 8 + bit

const CAPS_SHIFT = keyAt(0, 0),
  SYMBOL_SHIFT = keyAt(7, 1)

export const KEY_MATRIX = {
  ShiftLeft: [CAPS_SHIFT],
  ShiftRight: [CAPS_SHIFT],
  KeyZ: [keyAt(0, 1)],
  KeyX: [keyAt(0, 2)],
  KeyC: [keyAt(0, 3)],
  KeyV: [keyAt(0, 4)],

  KeyA: [keyAt(1, 0)],
  KeyS: [keyAt(1, 1)],
  KeyD: [keyAt(1, 2)],
  KeyF: [keyAt(1, 3)],
  KeyG: [keyAt(1, 4)],

  KeyQ: [keyAt(2, 0)],
  KeyW: [keyAt(2, 1)],
  KeyE: [keyAt(2, 2)],
  KeyR: [keyAt(2, 3)],
  KeyT: [keyAt(2, 4)],

  Digit1: [keyAt(3, 0)],
  Digit2: [keyAt(3, 1)],
  Digit3: [keyAt(3, 2)],
  Digit4: [keyAt(3, 3)],
  Digit5: [keyAt(3, 4)],

  Digit0: [keyAt(4, 0)],
  Digit9: [keyAt(4, 1)],
  Digit8: [keyAt(4, 2)],
  Digit7: [keyAt(4, 3)],
  Digit6: [keyAt(4, 4)],

  KeyP: [keyAt(5, 0)],
  KeyO: [keyAt(5, 1)],
  KeyI: [keyAt(5, 2)],
  KeyU: [keyAt(5, 3)],
  KeyY: [keyAt(5, 4)],

  Enter: [keyAt(6, 0)],
  KeyL: [keyAt(6, 1)],
  KeyK: [keyAt(6, 2)],
  KeyJ: [keyAt(6, 3)],
  KeyH: [keyAt(6, 4)],

  Space: [keyAt(7, 0)],
  ControlLeft: [SYMBOL_SHIFT],
  ControlRight: [SYMBOL_SHIFT],
  KeyM: [keyAt(7, 2)],
  KeyN: [keyAt(7, 3)],
  KeyB: [keyAt(7, 4)],

  Backspace: [CAPS_SHIFT, keyAt(4, 0)],
  ArrowLeft: [CAPS_SHIFT, keyAt(3, 4)],
  ArrowDown: [CAPS_SHIFT, keyAt(4, 4)],
  ArrowUp: [CAPS_SHIFT, keyAt(4, 3)],
  ArrowRight: [CAPS_SHIFT, keyAt(4, 2)]
}
