---
title: The screen
description: Any region of memory read as though it were a screen, and the reason that reading can be wrong.
order: 3
---

`<colophon-screen>` reads a region of memory as though it were a screen. Nothing about it needs to match what the machine is displaying, and that is the point: a packed sprite sheet, a buffer being built off-picture, a font table — each gives up its shape the moment it is read with the geometry it was written in.

```html
<colophon-screen
  label="HUD screen"
  base="&8000"
  width="50"
  height="20"
  rasters="2"
  mode="0"
  palette="&1F &14 &04 &0E &18 &0C &0D &16 &00 &15 &07 &0F &13 &1A &0A &0B"
></colophon-screen>
```

| Attribute | Default          | Read                                                                                                   |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `base`    | `&C000`          | The address the first byte is read from.                                                               |
| `width`   | `40`             | Characters across. A character is two bytes, whatever the mode.                                        |
| `height`  | `25`             | Character rows down.                                                                                   |
| `rasters` | `8`              | Lines in a character row.                                                                              |
| `mode`    | `1`              | How a byte becomes pixels: `0` for two of sixteen colours, `1` for four of four, `2` for eight of two. |
| `palette` | pens `0` to `15` | Sixteen colour codes separated by spaces, one for each pen, in the hardware's own numbering.           |
| `label`   | the base address | The panel's heading.                                                                                   |
| `zoom`    | `1`              | Scales the picture on the page.                                                                        |
| `view`    | —                | `beam` divides the picture at the electron beam while the machine is stopped.                          |

An address and a colour code are read as hexadecimal, with or without the `&` that announces it; a count is read as a decimal number. The picture is redrawn whenever the machine reports that its state has moved, which is once a frame while it runs and after every step and every edit while it is stopped.

## What it reads and what it assumes

It reads the RAM banks directly rather than the processor's view of them, so a ROM paged in over the address makes no difference to what is shown. On a 6128 a base above `&FFFF` reaches the extension banks the processor cannot see without paging them in.

The addresses it walks are [the board's own wiring](../../emulator/core.en.md#reading-and-writing-a-machine): the low ten address lines of the 6845 land on A10 to A1, the raster line on A13 to A11, and the top two on A15 and A14. That is why a character row is scattered across eight blocks two kilobytes apart, and why a row's bytes wrap around inside their two-kilobyte slice instead of running on into the next one.

But that wiring is computed here from the attributes given, not read from the chip. So this panel is right whenever the geometry it has been handed is the geometry the 6845 is actually keeping, and wrong — quietly, and plausibly — when a program is doing something the registers would have told you about. A screen worth looking at closely is very often a screen doing exactly that. [The monitor](monitor.en.md) shows what was fetched; this shows what a formula says should have been, and the difference between them is a finding.

## The beam view

`view="beam"` divides the picture at the electron beam: colour where the beam has already passed this frame, greyscale where it has not yet reached.

Both halves are the memory of this instant — the grey is the same bytes shown by their brightness alone, not a saved copy of the frame before. So a write landing ahead of the beam appears in grey and turns to colour the moment the beam commits it to glass, and a write landing behind it appears in colour the glass will not show until the next frame. That race is what this view exists to watch, and [the controls](controls.en.md) step by scanline and by row precisely so the boundary can be walked down the picture.

The beam is placed by the 6845's own counters, and a screen claims it only while register 12 points into its own sixteen-kilobyte page. A stopped machine whose beam is elsewhere shows its picture whole and in colour, and so does a running one: sixty sweeps a second is a flicker, not a reading, so the division appears only when the machine is stopped. Stopping at the end of a frame shows everything grey, which is not a fault — the new frame has not begun, and the first step paints the first sliver of colour at the top.
