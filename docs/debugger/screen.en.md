---
title: The screen
description: Any region of memory read as though it were a screen, and the reason that reading can be wrong.
order: 3
---

`<colophon-screen>` reads a region of memory as though it were a screen. Nothing about it needs to match what the machine is displaying, and that is the point: a packed sprite sheet, a buffer being built off-picture, a font table — each gives up its shape the moment it is read with the geometry it was written in.

```html
<colophon-screen
  label="HUD screen"
  reading="video"
  base="&8000"
  width="100"
  height="40"
  rasters="2"
  mode="0"
  palette="&1F &14 &04 &0E &18 &0C &0D &16 &00 &15 &07 &0F &13 &1A &0A &0B"
></colophon-screen>
```

| Attribute | Default            | Read                                                                                                                                                                             |
| --------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reading` | `video`            | Where the bytes of a picture are: `video` for the way the machine's own video hardware reads memory, `linear` for a flat buffer, `columns` for one that runs down before across. |
| `base`    | `&C000`            | The address the first byte is read from.                                                                                                                                         |
| `width`   | `80`               | Bytes across.                                                                                                                                                                    |
| `height`  | `200`              | Scanlines down.                                                                                                                                                                  |
| `rasters` | `8`                | Lines in a character row, read by the `video` reading alone. A flat buffer has rows of one line and nothing to scatter.                                                          |
| `mode`    | `1`                | How a byte becomes pixels: `0` for two of sixteen colours, `1` for four of four, `2` for eight of two.                                                                           |
| `palette` | the machine's inks | Sixteen colour codes separated by spaces, one for each pen, in the hardware's own numbering.                                                                                     |
| `label`   | the base address   | The panel's heading.                                                                                                                                                             |
| `zoom`    | `1`                | Scales the picture on the page. It does not change a recording.                                                                                                                  |
| `view`    | —                  | Ways of showing the region, separated by spaces: `beam` divides the picture at the electron beam; `heat` marks what changed and how recently.                                    |

An address and a colour code are read as hexadecimal, with or without the `&` that announces it; a count is read as a decimal number. The picture is redrawn whenever the machine reports that its state has moved, which is once a frame while it runs and after every step and every edit while it is stopped.

Without a palette the pens are read through the Gate Array's own inks at each drawing: the machine's translation, true while it plays and fading as it fades. A declared palette is how a screen reads through a fade instead, or keeps its colours while the inks standing at a stop are another section's.

## The readings

A reading is where the bytes of a picture are, and the base, the width and the height mean what it says they mean.

`video` is the machine's own: the panel asks its video hardware for the addresses, and reads memory as the beam would. On a CPC that is [the board's wiring](#what-it-reads-and-what-it-assumes) — `base` is a display start, the lines of a character row are scattered into blocks two kilobytes apart, and a row's bytes wrap inside their block rather than running on into the next one. Another machine's video hardware answers in its own arrangement, and a page written against this reading does not change when it does.

`linear` runs the bytes straight through: `width` bytes, then the next `width`, and so on. It is what an off-picture buffer is built in, and it wraps at the end of the machine's own memory rather than at the end of the processor's view of it.

`columns` runs each column of the picture down before moving right, which is how a sprite is stored when the routine plotting it wants it that way. It wraps where `linear` does.

Only the machine's own reading is bound by what its video hardware can address, so a 6128's extension banks are reached by `linear` and by `columns` and not by `video`. And only that reading is a hardware claim: `width` and `height` are bytes and scanlines whatever it is, so a screen the 6845 could not ask for — an odd number of bytes across, a character row cut short — is drawn all the same, and is worth knowing for what it is.

## The options

The three dots at the heading's right hold the zoom, the views, the mode, the geometry and the recorder. Every setting among them is the attribute above under another name: what is set there is what the element ends up carrying, and a screen tuned until it reads can be copied off the page as the markup that would declare it.

The zoom and the views the panel follows where it stands — the picture is resized, a layer is laid on or taken away — so the menu stays open while they are turned. The reading, the base, the width, the height, the rasters and the mode read memory differently, so the panel is built again around them and the menu closes as it goes. `Rasters` stands among them only while the reading is `video`, and leaves the menu when another is chosen.

The palette is not offered there. Sixteen colour codes are a table rather than a setting, and they are declared on the page.

## Recording

`Start recording` stands under `Record` at the foot of the options; it begins a recording, and `Stop recording`, which takes its place, ends it and writes the video. While it runs the three dots are red, so a recording is never left going unnoticed. The picture alone is kept, without the heading or the options. Beam and heat views are part of that picture, so every layer seen on the page appears in the recording. A browser that cannot record a canvas leaves the item disabled.

The recording has one square pixel for every two samples across and every line down. `zoom` changes only how large the panel stands on the page; it does not change the file.

## What it reads and what it assumes

It reads the RAM banks directly rather than the processor's view of them, so a ROM paged in over the address makes no difference to what is shown.

The `video` reading's addresses are, on this machine, [the board's own wiring](../../emulator/core.en.md#reading-and-writing-a-machine): the low ten address lines of the 6845 land on A10 to A1, the raster line on A13 to A11, and the top two on A15 and A14. Three raster lines reach the bus and two of the 6845's own address lines reach nothing, so a base carries a page and an offset into a two-kilobyte block and nothing between them. The video hardware reads the base sixty-four kilobytes whatever the processor is looking at, which is why this reading stops at `&FFFF` and a `linear` one is what looks into a 6128's extension banks.

But that wiring is computed here from the attributes given, not read from the chip. So this panel is right whenever the geometry it has been handed is the geometry the 6845 is actually keeping, and wrong — quietly, and plausibly — when a program is doing something the registers would have told you about. A screen worth looking at closely is very often a screen doing exactly that. [The monitor](monitor.en.md) shows what was fetched; this shows what a formula says should have been, and the difference between them is a finding.

## The beam view

`view="beam"` divides the picture at the electron beam: colour where the beam has already passed this frame, greyscale where it has not yet reached.

Both halves are the memory of this instant — the grey is the same bytes shown by their brightness alone, not a saved copy of the frame before. So a write landing ahead of the beam appears in grey and turns to colour the moment the beam commits it to glass, and a write landing behind it appears in colour the glass will not show until the next frame. That race is what this view exists to watch, and [the controls](controls.en.md) step by scanline and by row precisely so the boundary can be walked down the picture.

The division is made of addresses rather than of geometry: the machine marks every address the 6845 has displayed from this frame, and a byte of the picture is behind the beam when its own address carries that mark. So the boundary follows a hardware scroll exactly as the picture does, it is drawn under every reading rather than only under the machine's own, and a buffer that overlaps the screen shows the beam crossing it. A region the sweep never reaches at all is shown whole and in colour, since it is neither behind the beam nor ahead of it, and so is a screen the 6845 has stopped displaying. Sixty sweeps a second is a flicker rather than a reading, so the division appears only when the machine is stopped. Once the frame's sync has passed, everything is grey — the new frame has not begun, and the first step paints the first sliver of colour at the top.

## The heat view

`view="heat"` lays a transparent picture over the first and marks on it every byte written, brightest when the store is fresh and fading as frames pass. The colour is one the Gate Array cannot make, so a mark is never mistaken for the picture underneath.

The mark is the bus's own record, not a comparison of pictures: [the tick already returns every store](../../emulator/observation.en.md#the-bus-is-already-the-tap), and the host stamps the frame it landed in, banking resolved. So a byte rewritten with the value it already held marks like any other — which is the point, because a renderer's redundant work is exactly what a comparison cannot see — and a mark's fading is exact, a count of real frames since the store. An edit is not the program writing, so it never marks: the map stays the bus's record alone, and an edited byte shows itself — in the picture, and in [the memory panel's own marks](memory.en.md#the-marks).

Ages are frames of the machine's own time, so stepping inside a frame keeps every mark at full heat, stepping a whole frame ages the map by exactly one, and running fades it at the machine's pace. The views compose: `view="beam heat"` shows fresh writes over the beam's division, and a mark in the grey is a write the glass has not yet shown.

## What can be done with a pixel

The right button on the picture answers with the byte that painted the pixel under it, which is the whole of this panel's arithmetic run backwards: the address it would have read to draw there. It offers [a breakpoint](breakpoints.en.md) at that byte, to show it in [the memory](memory.en.md#moving), and — where [the record](record.en.md#where-a-byte-came-from) still holds the store — to stand the machine on the instruction that painted it.

The address is the video hardware's own, so the dump is sent to `RAM` and not to `CPU` — the panel reads the banks the way the hardware does, and that is the space its answer is counted in. A breakpoint is set in the processor's space instead, and the two are the same number whenever the bank the screen is reading is the one the processor sees at that address, which is the ordinary arrangement and the only one a 464 has. Where a program has paged something else in, they part company, and until a mark can be set on a bank rather than on an address there is nothing better to offer.
