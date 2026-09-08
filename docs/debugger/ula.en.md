---
title: The ULA
description: The one chip a Spectrum keeps its video department in, counting out the frame and holding the border.
order: 8
---

`<colophon-ula>` shows the Ferranti uncommitted logic array, which on a Spectrum is the whole board but the processor and the memory. It counts out the frame, reads the screen, turns bytes into pixels, raises the interrupt, holds the border colour and drives the speaker — so where a CPC's video wants [two panels](crtc.en.md), this machine wants one.

```html
<colophon-ula></colophon-ula>
```

It bears the heading `ULA Ferranti 5C102E` and redraws whenever the machine says something changed.

## What it shows

`Frame T-state` is the chip's own clock: T-states since the interrupt, which is the unit every published timing for this machine is given in, and the reason a Spectrum program's speed is a property of where in the frame it began. `Border` is the three bits of the last write to port `&FE`.

Both are editable, so a frame can be stood at a chosen T-state and a border set from the panel. Writing the frame T-state moves the beam with it: the chip's line and column are worked out from it rather than kept beside it, so they cannot be set to disagree.

`Line` and `Column` are where the beam stands, `Frame` is frames since reset — `FLASH` swaps ink and paper on its bit 4 — and `EAR` and `MIC` are the two bits of that same port write that reach the sockets. `EAR` is what the speaker follows; `MIC` is what the machine writes to tape, and [it goes nowhere here](../../emulator/machine.en.md#the-zx-spectrum).

## What it cannot show

The chip fetches ahead of the beam through a pipeline the emulator collapses into a single T-state, and [that pipeline is what a floating-bus read observes](../../emulator/machine.en.md#the-zx-spectrum). So the value an unattached port returns is not among the things this panel can be asked for, because it is not among the things the chip is modelled as holding.
