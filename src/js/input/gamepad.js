// Positions are the Standard Gamepad layout of the Gamepad specification
// (https://w3c.github.io/gamepad/#dfn-standard-gamepad): the directional pad
// is buttons 12 to 15 and the left stick is axes 0 and 1, negative towards
// the left and the top.

const DPAD_UP = 12,
  DPAD_DOWN = 13,
  DPAD_LEFT = 14,
  DPAD_RIGHT = 15

const STICK_HORIZONTAL = 0,
  STICK_VERTICAL = 1

const STICK_THRESHOLD = 0.5

function pressed(gamepad, button) {
  return gamepad.buttons[button]?.pressed ?? false
}

function pushed(gamepad, axis, sign) {
  const travel = gamepad.axes[axis] ?? 0

  return travel * sign > STICK_THRESHOLD
}

export function readGamepad(gamepad) {
  if (!gamepad) {
    return null
  }

  return {
    up: pressed(gamepad, DPAD_UP) || pushed(gamepad, STICK_VERTICAL, -1),
    down: pressed(gamepad, DPAD_DOWN) || pushed(gamepad, STICK_VERTICAL, 1),
    left: pressed(gamepad, DPAD_LEFT) || pushed(gamepad, STICK_HORIZONTAL, -1),
    right: pressed(gamepad, DPAD_RIGHT) || pushed(gamepad, STICK_HORIZONTAL, 1),
    buttons: gamepad.buttons.map(button => button.pressed)
  }
}
