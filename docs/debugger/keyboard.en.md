---
title: The keyboard
description: The matrix as the machine reads it, a line to a row and a bit to a column, each switch the reader's to hold.
order: 10
---

`<colophon-keyboard>` shows the matrix, whichever machine's it is: a CPC's ten lines of eight, read the long way round — the processor asks the 8255, which asks the sound chip, which reads the grid — or a Spectrum's eight half-rows of five, hanging off the upper address lines with nothing in between. A key pressed at the element, a gamepad's direction, a switch closed here: all of them arrive in the same grid, and this panel is where what arrived can be seen.

```html
<colophon-keyboard></colophon-keyboard>
```

## The grid

A line to a row and a bit to a column, so a switch's key number is its line times eight plus its bit — on a CPC the number `INKEY` and `KEY DEF` take — and each switch carries that number on its title. A switch under a finger stands out in white; the rest are dim.

Each switch wears the inscription of the key that closes it, and the legends are the machine's rather than the panel's: it draws as many lines as the board wires and asks the machine what is printed on each key. A position the board leaves unwired keeps its column and holds no switch, because the matrix is eight bits wide whether or not a machine uses them all — a Spectrum wires five of every eight and the other three read as released for ever.

On a CPC, line 9 is joystick 0 and wears its names in the manual's brackets, `(UP)` to `(SPARE)`, with `DEL` on its last bit; line 6 wears the letters 6, 5, R, T, G, F and B, and its title says which of joystick 1's switches each one is as well, because [on that machine the second joystick is those keys](../cpc.en.md#the-joysticks).

## Holding a switch

A switch is a checkbox, and checking one closes it in the matrix exactly as a finger would, until it is unchecked. A stopped machine can be stepped with a direction or a button held, which is how a program's reading of the joystick is walked through one instruction at a time; a running one sees the switch on its next scan.

A switch closed here is the reader's, and the focus leaving the element, which lets go of the keyboard's own keys, leaves it closed. Escape returns the panel to what the machine holds.

## What it shows and does not

The panel reads the grid and nothing before it. Keyboard clash — three switches at the corners of a rectangle conjuring the fourth — is [not modelled](../../emulator/machine.en.md#sound-and-the-keyboard), so nothing shows here that no finger closed. And what the panel shows is what stands in the record: rewind the machine and the grid is the grid of that moment, keys and joysticks alike.
