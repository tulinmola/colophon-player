---
title: The memory
description: The bytes themselves, read either as the processor sees them or as the machine's own memory holds them, in rows as wide as a reader asks.
order: 12
---

`<colophon-memory>` shows the bytes: rows of them, each with its address and the text it would make if it were text. A page may hold several, each cut to the shape of what it watches — a table, a stack, a screen's line of bytes — and each named for it.

```html
<colophon-memory></colophon-memory>
<colophon-memory
  label="Game screen"
  space="ram"
  base="&C000"
  lines="8"
  width="80"
></colophon-memory>
```

| Attribute  | Default  | Read                                                                                                      |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `base`     | `&0000`  | Where the dump begins: an address such as `&C000`, or a name from [the symbol file](symbols.en.md).       |
| `space`    | `cpu`    | Which memory the address counts in, `cpu` or `ram`, as [the two spaces](#the-two-spaces) tell them apart. |
| `lines`    | `16`     | How many rows tall the panel stands.                                                                      |
| `width`    | `16`     | How many bytes a row holds.                                                                               |
| `noscroll` | absent   | Leaves the wheel to the page: the dump [does not scroll](#moving), though it can still be moved.          |
| `label`    | `Memory` | The panel's heading, and the name [the rest of the debugger](#moving) offers it under.                    |

The three dots at the heading's right hold `Lines` and `Width`, which build the panel again at the size asked for, standing where it stood, and `Scroll`, which is checked when the dump scrolls and cleared by `noscroll`. `Space` and `At` stay in the open, because they are what a reader works the panel with; `At` is `base` under another name. A dump moved by any road writes where it now stands back onto the element, so what the element carries is the markup that would declare it. A `base` or a `space` set on the element is followed where the panel stands rather than building it again, because a dump that has moved is still the same panel; so is a `noscroll`, which changes nothing but what the wheel and a run of typing do.

## The two spaces

`CPU` is what the processor can see this instant, addressed in four digits. `RAM` is the machine's own memory, addressed in as many digits as it takes: five on a 6128, where that is twice what the processor can reach at once, and four on a machine whose memory is no wider than its address space.

The two differ wherever a ROM is paged in — the processor reads the firmware, the memory underneath still holds whatever was written there — and that difference is often the answer to why a program is reading what it seems to be reading. They are also offset wherever a machine's memory does not begin at zero: a Spectrum's RAM answers from `&4000`, so its physical zero is the processor's `&4000`.

## Moving

`At` is the address the dump starts at, and the first row begins exactly there: the rows are counted from it and not from a multiple of their width, so a dump set at `&C003` reads `&C003`, `&C013` and on down. It takes a name as readily as an address and answers with the address, written with the `&` that marks it as one; a name the machine was not given is refused where it is typed. The wheel over the bytes moves the dump a row at a time, and the rows stay where they fall. Escape puts the address back to where the dump actually stands.

A dump cut to the shape of a screen or a table is read where it was put, and a reader scrolling past it wants the page to move, not the dump. `noscroll` leaves the wheel to the page for that: the dump no longer scrolls, and a run of typing ends at its last byte instead of carrying it down a row. It still moves when it is told where to go — by `At`, by `Space`, or by the rest of the debugger sending it an address — because being sent is not scrolling. It is not the disassembly's [`fixed`](disassembly.en.md#fixed), which holds a listing against the processor: nothing moves a dump but a reader, and `noscroll` refuses only the reader's moves that scroll it.

A name is the processor's: it is the address the program was built to run at, and says nothing about which bank holds it. So a name typed while the dump reads `RAM` turns it to `CPU`, rather than taking the name's number for a place in the banks.

The rest of the debugger can send a dump somewhere. [An instruction](disassembly.en.md#what-can-be-done-with-an-instruction), [a name](symbols.en.md#what-can-be-done-with-a-name) or a pixel of [the CPC's screen](screen.en.md) offers to show its address once for every memory panel in the same machine, under its label — `Show in Memory`, `Show in Game screen` — and only the panel chosen moves. A machine holding no memory panel offers none.

The dump moves to put the address in the middle of the window rather than at the top, so that what surrounds it is visible too, and its rows stay where they fall in its own width: a dump reading a screen eighty bytes to the row is still reading it that way after a pixel is sent to it. Near either end of the space there is nowhere left to move, and the address sits wherever the edge allows. Whatever sends the dump somewhere says which space its address is counted in, and the panel changes to that space rather than guessing: an instruction or a name is the processor's, a pixel is the video hardware's. The panel scrolls itself into view if it was not, and the byte it was sent to is opened for editing with its value selected, so that reading it and changing it are the same arrival.

## Editing

Click a byte and the cell becomes a field with that byte in it. Two accepted digits commit it and move to the byte after, so a run can be typed straight through without reaching for the mouse again; the last byte of the space has none after it, and the edit ends there, as it does at the last byte of a dump that does not scroll. Leaving the field commits what is standing in it. Escape abandons the edit and leaves the byte as it was.

A byte written into `RAM` goes to the bank; a byte written into `CPU` goes wherever the processor would have put it.

## What can be done with a byte

The right button on a byte asks what may be done with it, and the panel answers for its own. In `CPU` that is setting a breakpoint on the address, which opens [the breakpoint form](breakpoints.en.md#setting-one) with the address already in it. In `RAM` it is instead standing the machine on the instruction that last stored that byte, which [the record](record.en.md#where-a-byte-came-from) traces by physical address and so can only offer here. The character standing for a byte answers the same, since it is the same byte read another way.

A breakpoint is set on an address the processor can reach, which is why `RAM` is not offered one; the trace is kept against the banks themselves, which is why `CPU` is not offered that. Where a byte has neither the browser keeps its own menu.

## The marks

A byte the dump was sent to is turned inside out, foreground for background, in both columns at once. It is not a colour, because every colour here already means something: this is the debugger saying _this is the one you asked for_, and it lasts until the dump is moved again by any other means.

A byte that changed since the last redraw is lit, so a value moving under a stopped machine is visible without hunting for it. The window moving does not count as a change, or every byte would light at once. A zero is dimmed, which is what makes the shape of written data stand out from the memory around it.
