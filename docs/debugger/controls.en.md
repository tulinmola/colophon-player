---
title: The controls
description: Running the machine, stopping it, and stepping it — always leaving it between instructions.
order: 4
---

`<colophon-controls>` is six buttons and the rule they all obey.

```html
<colophon-controls></colophon-controls>
```

| Button     | Read                                                        |
| ---------- | ----------------------------------------------------------- |
| `Run`      | Lets the machine run at the speed the hardware ran.         |
| `Stop`     | Stops it.                                                   |
| `Step`     | Stops it, then runs exactly one instruction.                |
| `Scanline` | Stops it, then runs to the start of the next scanline.      |
| `Row`      | Stops it, then runs to the start of the next character row. |
| `Frame`    | Stops it, then runs to the end of the frame it is in.       |

`Scanline` and `Row` follow the 6845's own counters, so a line and a row are whatever the program has made them, ruptures included — and both exist for [the screen's beam view](screen.en.md#the-beam-view), whose boundary they walk down the picture.

While the machine runs the element carries a `running` attribute, which is how the stylesheet dims the button that would do nothing. A page dressing its own controls has the same handle.

## Between instructions

A machine stopped in the middle of an instruction has a program counter belonging to no instruction anyone could name. So stopping and stepping both leave it on a boundary, and every panel reading it is reading a machine that could be described.

This is not tidiness. A snapshot records a program counter and has no way of saying that the instruction standing at it is half finished. Restored, such a machine re-executes part of an instruction it never began, corrupts something, and the firmware recovers the only way it knows — by rebooting itself, one frame later. The emulator [refuses to write a snapshot](../../emulator/machine.en.md#snapshots) from a machine caught mid-instruction rather than produce a file that looks fine and is not, and everything here that stops the machine stops it where a snapshot could be taken.
