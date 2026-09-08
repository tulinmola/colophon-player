---
title: The tape
description: The deck a tape goes into, the reel a reader turns, and what the machine hears at the head.
order: 19
---

A tape is played, not read. Nothing here hands the machine a byte: what reaches it are the edges those bytes were recorded as, and a loader measures the time between them and decides for itself what it has heard. That is why this panel has a PLAY on it and no OPEN, and why the thing it shows moving is a reel.

`<colophon-tape>` is the deck. It shows what is in it, turns the reel, and is where a tape goes in and comes out.

```html
<colophon-tape></colophon-tape>
```

## The machine cannot stop the reel

A Spectrum has no motor line. What it writes to tape leaves by the MIC socket and no wire runs back the other way, so the machine can neither start the reel nor stop it: a reader presses PLAY and it turns until the tape runs out, until a mark on it says to stop, or until the reader stops it. Loading is therefore the thing it was in 1983 — `LOAD ""`, then PLAY, in that order, because a tape already running has played the pilot the loader is waiting to hear.

| Control | Read                                                                   |
| ------- | ---------------------------------------------------------------------- |
| ▶ / ▮▮  | Turns the reel, or stops it.                                           |
| `+`     | Opens the reader's own file picker and puts what it finds in the deck. |
| `×`     | Takes the tape out.                                                    |

The first and the last are dark while the deck is empty, because there is nothing there to turn or to take.

Beside them stands the level at the play head, `1` or `.`, which is the one bit the machine can see of all this: bit 6 of a read of port `&FE`, and the whole of what a loader has to go on. Watching it against the disassembly is watching a loader work.

## The bar is the image, not the minutes

The bar says how far into the image the head has reached, against how long the image is. A tape carries no other measure: a block records its own timings, so how long what remains will take is not known until it is played. Blocks are played in order and the bar only goes forward, so it is a fair account of the loading even though it is not a clock.

A tape at its own speed takes the minutes it took then, which is why [the controls](controls.en.md#faster-than-it-ran) carry a speed. It multiplies the machine's own time, not the record's: everything a tape does at 8× is what it does at 1×, arriving sooner.

## Which tapes it takes

`.tap` and `.tzx`, which are [the two a Spectrum's tapes came in](../../emulator/machine.en.md#the-zx-spectrum), and `.cdt`, which is a `.tzx` under [the name the CPC gave it](../../emulator/machine.en.md#the-cassette) — two formats under three names, told apart by the signature a `.tzx` opens with rather than by what the file is called. A `.tap` is bare blocks replayed at the firmware's own timings, so it carries only what the firmware's own loader can read; a `.tzx` records the timings themselves, block by block, which is what a tape that brought a loader of its own needs, and most commercial releases brought one.

The image is given two megabytes, which is a great deal more than a Spectrum's own tapes need and enough for the long ones.

## When a tape is refused

A tape is somebody else's file and is trusted for nothing. The blocks that record a waveform sample by sample, the ones that build their data from a table of symbols, and the ones that send the tape backwards — jumps, loops, calls and menus — are refused when the image is opened rather than played wrongly, because a tape whose blocks are visited out of order is one the player would silently get wrong. So is a block named by a byte the player does not know: an unknown byte says nothing about how long the block is, and a player that guessed would read everything behind it as something else.

A refusal is printed under the deck in plain words, and it is the whole tape and not one block. A tape that cannot be played leaves the deck empty, and it has to: the bytes the picker just delivered are the very bytes the tape that was in there was being read from. An image too large for the room a tape is given is refused before anything is written at all, so on that road the tape that was in the deck is still in it and still where it stood.

A tape named in [the element's own attributes](../spectrum.en.md) is refused on another road. It is read while the machine is being built, so a bad one stops the building: no machine arrives, no panel begins watching, and the page stands empty with the reason thrown into the browser's console.

## A multiload waits for PLAY

A tape can stop before it ends. [A multiload marks the point between its parts](../../emulator/machine.en.md#the-zx-spectrum), and there the reel stops where a real one would have, with the machine still running and waiting. Pressing ▶ again carries on from the block behind the mark, which is where a real deck's head would be standing — so the parts of a game arrive as the game asks for them, one press each, and the second press is the reader's.

## The reel is in the record; the tape is not

The deck and the block being played travel inside the machine's own state, so a moment stood at again finds the reel where it stood and the loader hearing what it heard. A rewind through the middle of a loading is therefore a rewind through the loading, and running forward again plays the same edges in the same order.

The bytes on the tape are not in the record, for the reason [the disc's are not](record.en.md#what-it-cannot-answer): they are a reader's object borrowed in place, and 128 copies of one would cost more than the whole record does. So a rewind puts the reel back and leaves the image where it is — and where the two have come apart, the reel is what gives way. Take one tape out and put another in, and a moment before the change stands the machine at an empty deck: where the reel stood is a fact about a tape that is no longer there, and a reel turning against bytes nobody recorded on it would be reading nothing at all.

## The CPC has no deck yet

A CPC's cassette runs from a motor line the board itself drives, which is a different deck from this one and not merely a differently labelled one: the machine starts and stops the reel, and PLAY is a thing held down rather than a thing pressed. It is not wired here yet, so a `<colophon-tape>` placed in a `<colophon-cpc>` finds no deck and fails there, as a panel placed on a machine that has not got its chip does.
