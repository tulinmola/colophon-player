---
title: The CRTC
description: The 6845 counting out the frame — the counters it keeps and the registers that tell it how.
order: 6
---

`<colophon-crtc>` shows the 6845 that decides where the picture is: the three counters it is keeping right now, and the register file that tells it what to count to.

```html
<colophon-crtc></colophon-crtc>
```

## The counters

These are the chip's own state as the frame is drawn, named as the CRTC Compendium names them, which is what the people who proved this hardware on real machines call them.

| Counter | Read                                                        |
| ------- | ----------------------------------------------------------- |
| `C0`    | The character the beam stands on, counting across the line. |
| `C9`    | The scanline within the character row, which drives RA.     |
| `C4`    | The character row, counting down the frame.                 |

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

A register is written through the chip rather than into it, so a value is kept only in the bits that register actually has — exactly as much of it as a program's own write would have kept.

`R16` and `R17` are the exception. The light pen address is something the chip records rather than something a program sets, so the panel reads it and leaves it alone.

## What the machine does not act on

The panel shows the whole register file, and [the 6845 here is a type 0 with parts of it missing](../../emulator/machine.en.md#video). `R8` is stored and never read, the cursor registers are stored and no cursor is drawn, and the light pen is not implemented at all, so `R16` and `R17` stand where a reset left them. A register that a program writes and this machine ignores still shows what was written, which is worth knowing before reading anything into it.
