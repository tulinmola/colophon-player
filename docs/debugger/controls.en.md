---
title: The controls
description: Running the machine, stopping it, and moving it either way by a grain — always leaving it between instructions.
order: 4
---

`<colophon-controls>` is where the machine is moved through its own time, in both directions.

```html
<colophon-controls></colophon-controls>
```

| Control                                | Read                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| ▶ / ▮▮                                 | Lets the machine run at the speed the hardware ran, or stops it.                |
| ◀ ▶                                    | Back one grain, or on by one.                                                   |
| `Instruction` `Scanline` `Row` `Frame` | Which grain the arrows take. The lit one is the answer.                         |
| Slider                                 | Stops the machine and stands it at any moment [the record](record.en.md) holds. |
| `Now`                                  | Back to the newest moment the record reached.                                   |

The keys are the first line and [the record](record.en.md) is the second: what it reads, and the slider it is read on. The panel takes a line to itself rather than standing in a column of others, and is as wide as what it holds, like every panel here.

The first key wears the machine's state as its sign: ▶ while the machine stands and ▮▮ while it runs, so it always offers whichever the machine is not doing and never stands there doing nothing. While the machine runs the element carries a `running` attribute, and while it stands anywhere but the present it carries a `rewound` one, so a page dressing its own controls has both handles.

The direction is an arrow and the grain is a word, and the grain in force is the lit one — always on the face, and changed only by pressing it.

`Scanline` and `Row` follow the 6845's own counters, so a line and a row are whatever the program has made them, ruptures included — and both exist for [the screen's beam view](screen.en.md#the-beam-view), whose boundary they walk down the picture.

The panel reads `Tick`, the machine's own count of T-states since it was built or last loaded from a snapshot; `Frame`, the count the [screen's heat](screen.en.md#the-heat-view) ages against; and `Behind`, how far back of the present the machine is standing, in milliseconds of its own time, or `now` when it is standing there.

## Both directions land in the same places

Both arrows leave the machine where a grain began, so from such a moment the two undo each other to the T-state: press ◀ then ▶ and the machine stands exactly where it stood. From anywhere else they do not, and cannot — ◀ goes to the start of the grain the machine is inside, and ▶ goes to the start of the next one.

Nothing is unwound either way. No store is put back: the machine is rebuilt from a moment [the record](record.en.md#standing-in-the-past) already holds and run forward to the one asked for. So the oldest moment the record holds is the end of the road backwards: ◀ goes dim there rather than pretending, and the slider stops where the record stops.

## Between instructions

A machine stopped in the middle of an instruction has a program counter belonging to no instruction anyone could name. So stopping and stepping both leave it on a boundary, and every panel reading it is reading a machine that could be described.

This is not tidiness. A snapshot records a program counter and has no way of saying that the instruction standing at it is half finished. Restored, such a machine re-executes part of an instruction it never began, corrupts something, and the firmware recovers the only way it knows — by rebooting itself, one frame later. The emulator [refuses to write a snapshot](../../emulator/machine.en.md#snapshots) from a machine caught mid-instruction rather than produce a file that looks fine and is not, and everything here that stops the machine stops it where a snapshot could be taken.

That rule is also what makes the two directions meet. A scanline begins halfway through an instruction as often as not, and the machine cannot be stood there — so both ◀ and ▶ leave it on the first boundary the new grain contains, which is one moment and not two.
