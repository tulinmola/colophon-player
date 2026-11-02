---
title: The CRTC
description: The 6845 counting out the frame — the counters it keeps and the registers that tell it how.
order: 8
---

`<colophon-crtc>` shows the 6845 that decides where the picture is: which of the five it is, the counters it is keeping right now, and the register file that tells it what to count to.

```html
<colophon-crtc></colophon-crtc>
```

## The type

The heading names the chip by its type, numbered as the CRTC Compendium numbers the five, and then by its part: `CRTC 0 HD6845S/UM6845`, `CRTC 1 UM6845R`, `CRTC 2 MC6845`, `CRTC 3 Amstrad 40489` or `CRTC 4 Amstrad 40226`. The type is [the machine's own](../cpc.en.md), given when it is built, and the panel shows the counters that type keeps and no others.

## The counters

These are the chip's own state as the frame is drawn, named as the CRTC Compendium names them, which is what the people who proved this hardware on real machines call them.

| Counter  | Kept by       | Read                                                                                                                                              |
| -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C0`     | Every type    | The character the beam stands on, counting across the line.                                                                                       |
| `C9`     | Every type    | The scanline within the character row, from which RA is made — save on a type 2 in Interlace Video Mode.                                          |
| `C4`     | Every type    | The character row, counting down the frame.                                                                                                       |
| `C3l`    | Every type    | The characters a line sync has run.                                                                                                               |
| `C3h`    | Every type    | The lines a frame sync has run.                                                                                                                   |
| `C5`     | Types 1 and 2 | The lines that pad a frame out past its last row, which the other three count on `C9` instead.                                                    |
| `C9.IVM` | Type 2        | The count RA is made from in Interlace Video Mode, doubled, with the frame's parity in its low bit, while `C9` goes on counting the row's height. |

[How each type counts](../../emulator/machine.en.md#video) is set out where the chip is built.

## The registers

| Register | Read                                                            |
| -------- | --------------------------------------------------------------- |
| `R0`     | Horizontal total                                                |
| `R1`     | Horizontal displayed                                            |
| `R2`     | Horizontal sync position                                        |
| `R3`     | Sync widths: horizontal in the low nibble, vertical in the high |
| `R4`     | Vertical total                                                  |
| `R5`     | Vertical total adjust                                           |
| `R6`     | Vertical displayed                                              |
| `R7`     | Vertical sync position                                          |
| `R8`     | Interlace and skew                                              |
| `R9`     | Maximum raster address                                          |
| `R10`    | Cursor start raster                                             |
| `R11`    | Cursor end raster                                               |
| `R12`    | Display start address, high                                     |
| `R13`    | Display start address, low                                      |
| `R14`    | Cursor address, high                                            |
| `R15`    | Cursor address, low                                             |
| `R16`    | Light pen address, high                                         |
| `R17`    | Light pen address, low                                          |

## Editing

The counters and `R0` to `R15` are all editable, on the same terms as [the processor's registers](z80.en.md): committed only when the field says so, refused values never written, Escape putting everything back to the machine.

A register is masked as the chip masks a write, so a value is kept only in the bits that register has on the type the machine was built with — exactly as much of it as a program's own write would have kept. Types 1 and 2, [having no skew](../../emulator/machine.en.md#video), keep only the two interlace bits of `R8`. It is a value laid in, though, not a write landing on a character, so it sets nothing going: a program's write can let a sync through, make a last line or move a counter where it lands, and the panel's does none of that.

`R16` and `R17` are the exception. The light pen address is something the chip records rather than something a program sets, so the panel reads it and leaves it alone.

## What the machine does not act on

The panel shows the whole register file of [the type the machine was built with](../cpc.en.md), and [type 0 here has parts missing, and the other four are type 0 with exceptions of their own](../../emulator/machine.en.md#video). The cursor registers are stored and no cursor is drawn; the cursor's skew in `R8` is stored too on types 0, 3 and 4, the three that keep it, and nothing reads it. Types 1 and 2 keep the high nibble of `R3` and never read it, [the length of their frame sync being fixed](../../emulator/machine.en.md#video). The light pen is not implemented at all, so `R16` and `R17` stand where a reset left them. A register that a program writes and this machine ignores still shows what was written, which is worth knowing before reading anything into it.
