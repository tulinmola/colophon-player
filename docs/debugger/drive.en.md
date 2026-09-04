---
title: The drive
description: The mechanism between the controller and the disc — the motor, the head, and the lines a controller reads.
order: 14
---

Between a controller and a disc there is a machine with moving parts, turning at a speed nothing else here keeps. `<colophon-drive>` is that mechanism: whether the motor turns, where the head stands, and what the drive is telling the controller about itself.

```html
<colophon-drive drive="a"></colophon-drive>
```

| Attribute | Default | Read                                                                                            |
| --------- | ------- | ----------------------------------------------------------------------------------------------- |
| `drive`   | `a`     | `a` for the machine's own one-headed drive, `b` for the connector for a second, two-headed one. |

## The lines

These five are the Shugart lines, and the drive answers them rather than storing them: each is worked out afresh from where the mechanism is, which is why none of them can disagree with the rest.

| Line    | Read                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| `MOTOR` | Motor on. It comes from a port of the machine's own and not from the controller, and it turns both drives at once. |
| `READY` | A disc in the drive, the motor on, and the spin-up over.                                                           |
| `TRK0`  | The head stands over cylinder zero.                                                                                |
| `WP`    | The tab on the disc in the drive.                                                                                  |
| `2SIDE` | Whether the drive has a second head at all. Drive A never does.                                                    |

## Where the head is

`Cylinder` is where the head stands, and `Side` is side select as the controller drives it — a one-headed drive takes the line and ignores it, so drive A reads `0` however it is asked.

`Position` is the byte under the head, counted from the index, against the length of the track it is turning over. It moves one byte every 32µs while the motor is on, which is 6250 of them in the 200ms a revolution takes at 300 rpm, and it is why a sector is found when its identity comes round and not before.

An empty drive has no track under its head and shows a dash. A head stepped past the disc's last cylinder does have one — an unformatted track, which still turns, and turns at a full revolution's length because that is what a head finds there.

`Turns` counts index pulses since the disc went in. A stopped machine with a spinning motor still shows the number where the last frame left it.

## Moving the head, and timing the motor

`Cylinder` and `Side` are where the head is, and both take a value: a reader may put the head over any cylinder the medium is wide without asking a program to seek there, which is how a track is looked at that nothing has read yet. A cylinder past the medium is brought back to its last one, because that is as far as a head can step. `Side` on a one-headed drive takes the value and ignores it, exactly as SIDE SELECT does — drive A will read `0` however it is asked.

`SPIN` is the spin-up: the microseconds between MOTOR ON and the disc being at speed, during which the drive is not READY. It is zero, because [no source measures one for these drives](../../emulator/machine.en.md#discs) and the machine will not invent a number. A reader who wants to know what a program does when a disc is not ready the instant the motor starts can set one — the operating system waits a whole second, which is 1000000 here.

`Position` and `Turns` are counters rather than settings, and the lines above are answered by the drive rather than stored, so none of those can be written.

## What it does not show

The spin-up. A drive takes some time to reach speed and [no source measures how long for these drives](../../emulator/machine.en.md#discs) — the operating system waits a full second, and the interface documentation says only that there is no defined minimum or maximum. So it is zero here, `READY` comes with the motor, and there is nothing to show until somebody measures one.

`INDEX` is a line too, and it is true for the one microsecond in every 200,000 that the index passes the head. A panel drawn once a frame would show it false every time it was ever looked at, so `Position` reading zero is the honest form of the same fact.
