// The firmware's key numbers for the switches of the two joysticks, from
// Appendix I of SOFT 968 and the CPC6128 User Instructions (chapter 7, part
// 11): joystick 0 is matrix line 9, and joystick 1 overlays keys 48 to 54 of
// the main keyboard, 6 5 R T G F and B. The names are the manual's, and so
// is the warning that the main button of an ordinary joystick is Fire 2.

export const JOYSTICK_MATRIX = [
  { up: 72, down: 73, left: 74, right: 75, fire2: 76, fire1: 77, spare: 78 },
  { up: 48, down: 49, left: 50, right: 51, fire2: 52, fire1: 53, spare: 54 }
]
