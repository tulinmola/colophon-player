---
title: The profile
description: The machine's recent past cut into the passes of the program's own loop, the calls to a routine, or the stretches between two instructions, set side by side.
order: 16
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
| `lines`   | `16`        | How many lines the list stands, its column headings among them. The rest are scrolled to.                  |

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

A program's time is spent one routine inside another, and beneath the summary the profiling frame the machine is standing in is laid out that way. Its first line is the profiling frame itself, the whole of its time. Under it stand the routine it began in, every interrupt taken during it, and whatever was called or jumped to once that routine had returned; under each routine stand the ones it reached, the longest first, each a step further in. A routine that reached others carries a triangle before its name, and pressing it folds them away beneath it, or unfolds them again. Everything stands unfolded at first, and a routine folded stays folded in every profiling frame opened after, wherever the same calls reach it.

| Column     | Read                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `Total µs` | The time spent in the routine and in every routine it reached.                   |
| `%`        | That time's share of the profiling frame.                                        |
| `Self µs`  | The time spent in the routine alone, halted on a `HALT` included.                |
| `Calls`    | How many times the routine was reached this way in the profiling frame.          |
| `Routine`  | The name from [the symbols](symbols.en.md) that stands at its first instruction. |
| `At`       | The address of its first instruction, unless `Routine` already is one.           |

A routine is where the processor went, never where a name happens to stand. A call is seen when the processor stores its own program counter on the stack, as a `CALL`, an `RST` and the acknowledge of an interrupt each do, and the routine called is the address it went to next. A return is an instruction that raised the stack pointer by one word and went where that word said; it ends the call whose return address that was, and every call made after it. Arriving at a name by any other way, by a jump or by running on into it, makes a routine of its own under the one left, marked with an arrow; it shares that routine's return and ends with it, and a jump back to the first instruction of a routine already passed through on the way returns to it, as a loop to its own start does. A name the processor never arrives at — one given to a variable, a table, or the operand of an instruction the program rewrites — never becomes a routine. A routine with no name at its first instruction is written as its address, dim, because no name the program was written with stands there, and so is every figure, because the debugger worked each one out.

An interrupt stands under the profiling frame and not under the routine it happened to interrupt, so that a routine's time is the work it did and not the moment it was caught in. It is seen by the acknowledge on the processor's pins, `M1` with `IORQ`, and is written `interrupt` unless a name stands where it went. A named handler reached through a jump, as Abduction's six are through `&0038`, stands under it as a routine of its own.

What runs after the routine the profiling frame began in has returned is the profiling frame's own, and is its `Self`. In a `call` that is nothing; in a `pass` begun at a routine's entry it is the loop that calls it.

Calls are read from the stack, and a program that does not keep its stack the way calls do is read as well as it can be. A routine that rewrites its return address and returns somewhere else ends the latest call whose return address the stack has risen past. One that takes its return address off the stack and goes on without returning — to read parameters stored after its `CALL` — stays open, and its caller's code is counted in it, until its caller returns or another call stores its return address where that one lay. A routine that calls through another that only jumps, as SDCC calls through a function pointer with `___sdcc_call_hl`, shows that one as the routine called, and the real one, where it has a name, as a jump under it. Addresses are the processor's, so two banks' code at the same address is one routine. A profiling frame holds 4,096 routines and calls 256 deep; past either, a call is counted in its caller.

Nothing is counted while the machine runs. When it comes to stand in another profiling frame, the record replays that one from its first instruction to its last, setting every T-state against the routine running, then stands the machine back where it was and puts the screen's heat back as it found it. A T-state the ULA holds the processor between two instructions is set against the first, as a step counts it, and so is the acknowledge that brings an interrupt in. A pass of a frame or two is replayed in tens of milliseconds, and a longer one in proportion to its length. Like every replay, it is bound by [what the record cannot answer](record.en.md#what-it-cannot-answer).

The right button on a routine offers what it offers on [a name in the symbols](symbols.en.md#what-can-be-done-with-a-name): a breakpoint at its first instruction, and showing it in each memory panel.

## What it holds

The cuts are kept as [the stores](record.en.md#what-is-kept) are: made while the machine runs, never while the record replays a moment it already holds, and dropped past any moment the machine is run on from. Only the ones the record can still stand the machine on are drawn, which is a little over two and a half seconds.

It holds the latest 4,096 cuts, thirty-two a frame across the whole record. A pass takes one and a call or a stretch two, so a routine called more than sixteen times a frame loses its oldest calls before the record loses them, and a strip with more bars than it has room for loses the oldest at its left edge.
