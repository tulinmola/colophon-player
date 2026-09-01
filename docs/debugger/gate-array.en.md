---
title: The Gate Array
description: The inks, the mode, the ROMs and the interrupt counter — none of which the machine itself can read back.
order: 8
---

`<colophon-gate-array>` shows what the Gate Array is holding. The chip takes commands and answers none of them: a program that wants to know its own palette must remember having written it. So unlike every other panel here, this one shows values nothing on the machine can ask for.

```html
<colophon-gate-array></colophon-gate-array>
```

## The inks

Sixteen pens and the border, each a hardware colour code with the colour it makes beside it. These are the same codes [a screen](screen.en.md) is given to read a region by, so a palette worth declaring on the page can be read off the machine here first.

A code typed into one lands where an `INKR` write would have left it, and the picture is repainted around it. Five bits is all a code carries, and the field refuses anything wider.

The colour beside a code is the other way to set it. Pressing it opens the thirty-two the chip can make, each under the code that names it and the standing one marked, and choosing one writes that code exactly as typing it would. A few of the thirty-two stand almost on top of one another: the palette is measured off a real 40010 rather than derived from its logic, and they are distinct codes all the same.

## The mode

`MODE` is the mode the picture is being drawn in. `ASKED` is the mode as last written, which comes into force after the next line sync — the delay that a mode split is built on. While the two differ, a change is in flight and has not yet been shown.

## The ROMs

`LOWER` and `UPPER` say whether the firmware stands over `&0000` to `&3FFF` and over `&C000` to `&FFFF`. They are the answer to the difference [the memory panel](memory.en.md#the-two-spaces) reports between what the processor sees and what the banks hold.

Turning one off here pages that ROM out as a program's own write would, and what the processor reads changes under it while the bytes in the bank stay where they were.

## The interrupts

`R52` counts the line syncs since the last interrupt; the fifty-second raises one. `INT` is a request made and not yet taken — it is held until the processor acknowledges it, so a machine running with interrupts disabled shows one standing. Whether the processor is listening at all is [the Z80's](z80.en.md) to say.
