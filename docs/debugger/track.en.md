---
title: The track
description: The medium under the head — the sectors as they pass it, and the disagreements a protected disc is built out of.
order: 16
---

A disc is not a file, and the moment it matters that it is not is when a program is protected. `<colophon-track>` reads one track the way a head finds it: the sectors in the order they come round, what each announces about itself, and what is really recorded behind that announcement.

```html
<colophon-track drive="a"></colophon-track>
```

| Attribute  | Default    | Read                                                                                                  |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `drive`    | `a`        | Which drive's disc to read.                                                                           |
| `cylinder` | the head's | Stand on one cylinder and stay there while the head moves off it. Absent, the panel follows the head. |
| `side`     | the head's | The same for the side.                                                                                |
| `lines`    | `10`       | How many sectors are shown before the list scrolls.                                                   |

Beside the heading is the cylinder and side being read, which is worth watching when the panel follows the head and worth checking when it does not. Above the list is the track itself: how many sectors are on it, how many bytes one revolution takes, and the gap and filler a formatter left. A track that was never written says `unformatted`; one recorded at a rate or in a mode these controllers cannot decode says so instead, because the two are not the same thing — the second keeps its room on the disc and simply holds nothing a head can find.

## The columns

The order is the only order there is. `R` does not identify a sector, because a track may announce the same number twice, so the list is the order they pass under the head and the position column is what fixes them in place.

| Column | Read                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `C`    | The cylinder this sector claims to sit on, which may not be the one it is on.                                                    |
| `H`    | The head it claims to be under.                                                                                                  |
| `R`    | Its own number.                                                                                                                  |
| `N`    | Its size code: 128 << N bytes, and 32K from eight up, [which is how the chip itself counts](../../emulator/machine.en.md#discs). |
| `ann`  | What `N` announces, in bytes.                                                                                                    |
| `rec`  | What one reading of it actually holds.                                                                                           |
| `ext`  | What its data field occupies on the track, which is the length it was written with.                                              |
| `cop`  | Readings stored back to back. Above one where the field was found to be unstable.                                                |
| `at`   | Where its sync begins, in bytes from the index.                                                                                  |

The sector the head has reached is written in full white; the rest of the track is dim. A sector holds the head from its own sync until the next one's, so the gap after a sector belongs to it, and the last sector holds it across the index until the first one's sync comes round again — exactly one is lit for every byte of a revolution. Only a head on this very track has a byte under it, so a panel pinned to a cylinder the head has left shows none of them lit.

## What reading it found

The last column is what a reading of the disc discovered, and a sector on a sound disc says nothing there at all. It is written in full white, because it is the disc's own word about itself and not the debugger's working.

| Mark     | Read                                           |
| -------- | ---------------------------------------------- |
| `DEL`    | A deleted data address mark, not a normal one. |
| `IDCRC`  | The identity field failed its own check.       |
| `CRC`    | The data field failed its check.               |
| `NODATA` | An identity with nothing recorded behind it.   |

These are the disc's own terms and not a controller's. An image records the status bytes some controller once reported, and [the reader translates them back into the findings behind them](../../emulator/machine.en.md#discs) — so nothing here has to be read with a datasheet open. What the controller then makes of them is [the controller's own panel](upd765.en.md).

## Where a protection lives

The interesting discs are the ones whose columns disagree. A sector announcing `ann` 512 and holding `rec` 256 is one that lies about its size. One with `cop` above one reads differently on each revolution, and a loader that reads it twice and compares is asking a question a copy cannot answer. `NODATA` is an identity with nothing behind it at all, and `CRC` a field that was recorded wrong on purpose.

None of these disagreements is corrected anywhere between the image and this panel, because correcting them is exactly what would break the disc. A protected disc is built out of them.

`ext` is where the rest of the track hides. A field's extent is what it occupies on the disc, and a controller told to read past the end of a sector reads whatever comes next — the check bytes, the gap, the next sector's sync — which is what some protections are looking for. A sector whose `ext` is longer than its `rec` has room on the track that no reading of it fills.
