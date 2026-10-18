---
title: The profile
description: The machine's recent past cut into the passes of the program's own loop, the calls to a routine, or the stretches between two instructions, set side by side.
order: 15
---

The picture keeps one measure and the program keeps another. A game may draw every second frame, or every third when the screen is crowded, and a utility may keep no picture at all; what it keeps is a loop, and one pass of that loop is the unit its author worked in. `<colophon-profile>` cuts [the record](record.en.md) where an instruction the reader names runs, and again where what it began has ended, and sets the pieces side by side: each is a profiling frame, and each is drawn as long as it took.

```html
<colophon-profile start="_game_step"></colophon-profile>
```

| Attribute | Default     | Read                                                                                                       |
| --------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `start`   | —           | Where profiling frames begin: an address such as `&297E`, or a name from [the symbol file](symbols.en.md). |
| `mode`    | `pass`      | How each one ends: `pass`, `call` or `until`, [as below](#how-a-profiling-frame-ends).                     |
| `end`     | —           | Where an `until` ends: an address or a name, as `start` takes.                                             |
| `frames`  | the longest | How many frames tall the strip stands. Absent, as many as the longest profiling frame it holds took.       |
| `lines`   | `16`        | How many routines stand in view at once. The rest are scrolled to.                                         |

The fields under the heading hold `start`, `mode` and `end`, and the panel follows them where it stands. `Frames` and `Lines`, behind the three dots at the heading's right, hold `frames` and `lines`, and the panel is built again at the height asked for. The machine keeps one start and one way of ending, which every profile in it reads: a profile with no `start` of its own shows the ones another has given, and leaves `Mode` and `End` to it, and a page that gives two profiles different starts sets them against each other.

## Where a profiling frame begins

`Start` takes a name or an address, as a mark's `At` does, and committing it writes `start`: a name as it was typed, an address in hex. A name the symbols do not hold is refused, Escape returns the field to what the machine holds, and an empty field takes the attribute away.

Each time the instruction there is about to run, a profiling frame begins. A processor halted on a `HALT` fetches the instruction after it over and over and runs none of it, so those fetches begin nothing; the profiling frame begins once, when the interrupt brings the processor back to run it.

A start, a mode or an end given anew begins anew. The profiling frames cut by the old ones are dropped rather than kept beside the new, and the record cuts by the new ones only from the moment they are given: what has already run is not cut again.

## How a profiling frame ends

`Mode` holds `mode`. `End` holds `end`, and stands in the form only in an `until`: it takes a name or an address, and is committed, refused and returned as the start is.

A `pass` ends where the next begins, so the profiling frames lie end to end and every T-state between the first and the last is in one of them. The instruction to name is one the loop passes once a pass. In Abduction, `_game_step` is the routine the main loop calls each pass: a profiling frame cut at its entry holds whole calls, and its length wanders about two frames as the work done before the wait does. `&297E` is where the renderer stops waiting for the signal the interrupt raises every second frame: cut there, almost every pass lasts exactly two frames, and the few that do not fall where the game is setting up a level or its menu.

A `call` ends when the call it began with returns: when the stack pointer stands above where it stood as the start was about to run, and by no more than 15 bytes, the reach [Altirra](https://www.virtualdub.org/altirra.html) allows its own function mode, since a routine that borrows the stack pointer to move memory takes it much further and has not returned. Nothing names where a call ends, so one with several `RET`s, or one that leaves by a jump into another routine whose `RET` returns for both, ends wherever it does. A call begun again before it has returned — a routine that calls itself, or one called from an interrupt that lands in it — is counted in the outer one, and so is every interrupt that lands in it, including one the processor takes the moment it returns, since that interrupt is taken before the instruction returned to runs. A call that never comes back so far — a start reached by a jump that leaves no way back, or a routine that abandons its stack — stays open, every start after it is taken to be inside it, and the panel goes on saying that no profiling frame has ended. The start need not be reached by a `CALL`: on Abduction, `&0038` cut as calls makes a profiling frame of each of the six interrupts a frame, whichever handler the jump there leads to.

An `until` ends when the instruction at `end` is about to run, or at the next start, whichever comes first, and what runs from the end to the next start is in no profiling frame. On Abduction, `&297E` until `&2977` holds each pass's work and leaves out the wait for the signal: in the menu that work takes from about 26 milliseconds to a little over the 40 of the two frames a pass is given, as what the menu draws changes. An `until` given no end yet ends each where the next begins, as a pass does.

## The strip

One bar stands for each profiling frame the record still holds, the oldest at the left and the latest to have ended at the right, and the bars share the strip's width between them. Once shared out, the places are only ever multiplied: a running record gains one profiling frame and loses another at different moments, and a record run on from the past is cut back and fills again from the right, so the bars move along by whole places instead of all being redrawn narrower and wider. Where fewer profiling frames than places remain, the places at the left stand empty until the start, the mode or the end is given anew. The one still running has no bar until it ends.

A bar is as tall as its profiling frame took. The strip stands `frames` frames tall, ruled at each, so a bar reaching the second rule took two; one that took longer runs off the top, and a notch says so. Without `frames` the strip is as many frames tall as the longest profiling frame it holds took, rounded up to a whole frame, so nothing runs off it — and one long one, a level being loaded, flattens the rest until it leaves the record. Where the longest took less than a frame the strip is exactly as tall as it, so calls a few hundred microseconds long still stand clear of the floor. Each bar names the frame it began in — the count [the controls](controls.en.md) show as `Frame` — and how long it took in microseconds, and a pass's bar says too how many frames it spanned. The frames spanned are the frame flybacks that fell inside it, so a program keeping step with the picture reads in whole numbers, and the microseconds say exactly how close it came; a call or a stretch keeps no step with the picture, and is measured in microseconds alone.

The bar the machine is standing inside is written in white and the rest are dim, the [register](index.en.md#two-registers-and-what-they-mean) every panel keeps. Beneath the strip the panel describes that one, or, where the machine stands in none, how many there are and how long — passes in frames, and calls, stretches and passes that hold no frame flyback in microseconds.

Pressing a bar stands the machine on the instruction its profiling frame began with, as the record stands it anywhere, so every panel shows that moment, every step goes on from it, and the profiling frame is opened beneath the strip. The present is one press of [the controls'](controls.en.md) `Now` away.

## Inside a profiling frame

Beneath the summary stand the routines that ran in the profiling frame the machine is standing in, the one that took longest first: how many microseconds each spent there, and what share of the profiling frame that was. A routine is a name from [the symbols](symbols.en.md) and every instruction after it as far as [a name reaches](symbols.en.md#how-far-a-name-reaches). Code no name reaches is gathered by the 256 bytes it stands in, as `&BDxx`, and the time the processor stood halted on a `HALT` is a line of its own, `halted`; their names are written dim, because neither is a name the program was written with, and so is every figure, because the debugger worked each one out.

Nothing is counted while the machine runs. When it comes to stand in another profiling frame, the record replays that one from its first instruction to its last, setting every T-state against the instruction it belongs to, then stands the machine back where it was and puts the screen's heat back as it found it. A T-state the ULA holds the processor between two instructions is set against the first, as a step counts it. An interrupt's handler is counted like any other code, under whatever name reaches it, and the acknowledge that brings it in is set against the instruction that ran before it, or against `halted` when it wakes the processor from one. A pass of a frame or two is replayed in tens of milliseconds, and a longer one in proportion to its length. Like every replay, it is bound by [what the record cannot answer](record.en.md#what-it-cannot-answer).

The right button on a named routine offers what it offers on [a name in the symbols](symbols.en.md#what-can-be-done-with-a-name): a breakpoint at its address, and showing it in each memory panel.

## What it holds

The cuts are kept as [the stores](record.en.md#what-is-kept) are: made while the machine runs, never while the record replays a moment it already holds, and dropped past any moment the machine is run on from. Only the ones the record can still stand the machine on are drawn, which is a little over two and a half seconds.

It holds the latest 4,096 cuts, thirty-two a frame across the whole record. A pass takes one and a call or a stretch two, so a routine called more than sixteen times a frame loses its oldest calls before the record loses them, and a strip with more bars than it has room for loses the oldest at its left edge.
