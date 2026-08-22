---
title: The memory
description: The bytes themselves, read either as the processor sees them or as the banks hold them.
order: 8
---

`<colophon-memory>` shows the bytes: sixteen rows of sixteen, each with its address and the text it would make if it were text.

```html
<colophon-memory></colophon-memory>
```

## The two spaces

`CPU` is what the processor can see this instant, addressed in four digits. `RAM` is the banks themselves, addressed in five, and on a 6128 that is twice the memory the processor can reach at once.

The two differ wherever a ROM is paged in — the processor reads the firmware, the bank underneath still holds whatever was written there — and that difference is often the answer to why a program is reading what it seems to be reading.

## Moving

`At` is the address the dump starts at; it is rounded down to the beginning of a row. The wheel moves a row at a time. Escape puts the address back to where the dump actually stands.

The rest of the debugger can send the dump somewhere. [An instruction](disassembly.en.md#what-can-be-done-with-an-instruction) or [a name](symbols.en.md#what-can-be-done-with-a-name) offers to show its address here, and the dump moves to put it in the middle of the window rather than at the top, so that what surrounds it is visible too. Near either end of the space there is nowhere left to move, and the address sits wherever the edge allows. The panel changes to `CPU` when it is sent to, because that is the space those addresses are counted in, and scrolls itself into view if it was not.

## Editing

Click a byte and the cell becomes a field with that byte in it. Two accepted digits commit it and move to the byte after, so a run can be typed straight through without reaching for the mouse again. Leaving the field commits what is standing in it. Escape abandons the edit and leaves the byte as it was.

A byte written into `RAM` goes to the bank; a byte written into `CPU` goes wherever the processor would have put it.

## What can be done with a byte

The right button on a byte asks what may be done with it, and the panel answers for its own: today, setting a breakpoint on that address, which opens [the breakpoint form](breakpoints.en.md#setting-one) with the address already in it. The character standing for a byte answers the same, since it is the same byte read another way.

In `RAM` the panel offers nothing and the browser keeps its own menu, because a breakpoint is set on an address the processor can reach and that view is showing the banks themselves.

## The marks

A byte the dump was sent to is turned inside out, foreground for background, in both columns at once. It is not a colour, because every colour here already means something: this is the debugger saying _this is the one you asked for_, and it lasts until the dump is moved again by any other means.

A byte that changed since the last redraw is lit, so a value moving under a stopped machine is visible without hunting for it. The window moving does not count as a change, or every byte would light at once. A zero is dimmed, which is what makes the shape of written data stand out from the memory around it.
