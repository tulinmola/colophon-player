---
title: The disassembly
description: The bytes the processor runs read back as instructions, following the program counter or fixed where a reader puts them, under the program's own names where there are any.
order: 11
---

`<colophon-disassembly>` reads the bytes standing at the program counter back as instructions, each with its address, the bytes it is made of, and what they say. It can be set anywhere else too, and a page may hold several: one following the processor, and others fixed on the routines a reader wants to see it reach.

```html
<colophon-disassembly lines="16"></colophon-disassembly>
<colophon-disassembly label="Game step" base="_game_step" lines="8" fixed></colophon-disassembly>
```

| Attribute | Default             | Read                                                                                                                                        |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines`   | `16`                | How tall the panel stands. It is a count of lines and not of instructions — [a label takes one of them](#sixteen-lines-whatever-they-hold). |
| `base`    | the program counter | Where the listing begins: an address such as `&022B`, or a name from [the symbol file](symbols.en.md).                                      |
| `fixed`   | absent              | Keeps the listing where it begins, however the processor moves.                                                                             |
| `label`   | `Disassembly`       | The panel's heading, which is what tells several of them apart.                                                                             |

The three dots at the heading's right hold `Lines`, `Base` and `Fixed`. `Lines` builds the panel again at the height asked for, beginning where `base` says. `Base` and `Fixed` move nothing but the listing, and are the reader's to change while the machine runs: the attributes say where a panel starts, and the reader takes it from there. `Base` always shows where the listing begins now, and takes a name as readily as an address; a name the machine was not given is refused where it is typed.

It reads through the processor's own view of memory, so what it shows is what the processor would fetch. Where a ROM is paged in, the ROM's instructions are what appear: a listing fixed on a routine in the lowest sixteen kilobytes of a CPC shows the firmware whenever the firmware is paged in over it.

## Following the processor

A listing that is not fixed keeps the program counter in view. When the processor moves to an instruction the listing does not show — a step, a stop at a breakpoint, a step back, a rewind, a jump — the listing turns to it as a page is turned, and that instruction becomes the first line. While the program counter stays among the lines shown, nothing moves, so a loop that fits in the panel is stepped through without the listing moving under the reader.

Of the machine's changes, only the processor's moving turns the page. A byte written into memory or an ink changed redraws the lines where they stand, so a reader who has scrolled away is not pulled back by an edit.

A `base` is only where the listing begins. It holds until the processor moves somewhere the listing does not show, and then the listing follows it.

## The instruction the processor stands on

The line the processor stands on is marked, and only when it stands exactly on one. A stopped machine always stands between instructions — [the controls](controls.en.md#between-instructions) see to that — so there the mark is always true. A running machine is drawn at the end of each frame wherever the processor happens to be, which is almost always partway through an instruction; the program counter then points into the middle of one, names no line, and the mark is left off rather than put near.

## Fixed

A fixed listing stays where it was put, and the processor is marked as it passes through. That is what several panels on one page are for: one following, and others watching the routines that matter. The wheel still moves a fixed listing; nothing else does.

## Scrolling

The wheel moves the listing an instruction at a time, either way. A few turns of it and the processor is out of sight, so the `⌖` in the heading brings the listing back to the program counter, fixed or not, with the instruction the processor stands on as its first line.

Down is certain. An instruction's length is read from its first byte, so the next begins where it ends.

Up is not, because that length is only known by reading from an instruction's start, and the start is what is being looked for. So the listing reads back the way it reads forward: it starts thirty-two bytes above its first line, reads on from there, and keeps a reading that arrives exactly at the first line. Readings from different starts fall into step within a few instructions, but one that starts close may arrive by another path — `21 34 12` read from its second byte arrives as `INC (HL)` and `LD (DE),A`, where the processor runs a single `LD HL,&1234`. The reading that starts farthest back has had the most room to fall into step, and it is the one taken.

Where no reading arrives, the listing steps back a single byte. Nothing above such a line can be read as instructions running into it, so whatever stands there is data, or code reached only by a jump.

Neither direction is proof. Past an instruction that never goes on to the next byte, what follows is bytes, read as instructions because that is all a listing can do with them: a CPC's firmware jumpblock is a column of `RST &08`, each followed by the two bytes of an address that the firmware reads and the processor never runs, and the listing writes those as `CP &93` and `DEC (HL)`. Where a reader knows where code begins, `base` says so.

## The instruction with no datasheet

One pair of bytes is read back under a name no datasheet gives it. `ED FF` is undefined on a Z80, which runs it as two idle microseconds and nothing else; [WinAPE](http://www.winape.net/help/debug.html) made it the mark a program carries to stop a debugger, and called it `BRK`. The listing writes it that way whether or not [the controls](controls.en.md#the-mark-the-program-carries) are set to stop on one, because the bytes say what they say either way.

## The names

Where the machine has been given [a symbol file](symbols.en.md), a `Symbols` switch stands among the panel's options and the listing is read back under the program's own names. Without one the switch is not there at all, and the panel is what it has always been.

An operand is written as the name of the address it holds: `CALL _renderer_init` where the file has a name for it, `CALL &25C9` where it has none. Every sixteen-bit operand a Z80 instruction carries is an address, so a jump, a call and the address a register pair is loaded from are all read the same way. A byte never is one, and is left as a number.

A name standing exactly at an instruction's address is written above it on a line of its own, the way a label is written in a source file; where two names share an address, both are written. Above the first instruction of the listing that line says one thing more: when no name begins there, it gives where that instruction stands instead — `_renderer_init+&03`, the routine it is inside and how far past its first byte — which is what a reader wants wherever a listing begins rather than only where a routine does. An offset wears no colon and is written dim, because nothing is declared at it: it is the debugger's own arithmetic and not the program's word. Where the file can name nothing at all the line is not spent: it goes back to the listing.

### Sixteen lines, whatever they hold

The panel is as many lines tall as `lines` asks for, and stays that tall. A label does not add a line to it, it takes one from the listing: a panel showing two labels shows two instructions fewer. Nothing standing below it moves while a reader steps through a program, which is worth more than the instructions it costs.

A label falling on the last line keeps it, and the instruction beneath waits for the next listing. It is the more useful of the two — a reader who can see that the next routine begins here does not need the byte that begins it.

### Names too long for the panel

A name is as long as its author made it, and the longest in a real program are longer than any instruction the decoding can produce. Rather than let one widen the panel, a line too long for its column is cut in the middle, keeping its head and its tail — `CALL _rende…OutWaiting` — with the whole of it on the line's title, where hovering shows it. [The panel of symbols](symbols.en.md#narrowing-the-list) cuts its names the same way.

Names are paid for in width, and only once. Turning the switch on widens the column that holds them; turning it off returns the panel to addresses alone and to the narrower column those need. Nothing else moves with it: what an instruction is and where it stands are read from the machine either way.

## The marks down the side

The column at the left of the listing carries [the breakpoints](breakpoints.en.md) standing on the instructions in view, in the same three states the panel of breakpoints uses: nothing where there is no mark, a filled circle where one is armed, an open one where a mark stands but is not being watched for. Clicking it arms or disarms, exactly as it does there; it is the same control.

Only marks that stop the machine on reaching an instruction are shown. A watch on the same byte is a fact about data rather than about execution, and a filled circle beside a line has meant _the machine stops here_ for as long as there have been debuggers. Where a mark is a span, every instruction it covers wears it, and arming from any of them arms the one mark.

## What can be done with an instruction

The right button on a row opens [the breakpoint form](breakpoints.en.md#setting-one) with the instruction's address already in it. What kind of mark it is, and how far it reaches, are the form's to answer.

It also offers to show that address in [the memory](memory.en.md#moving), which is how the bytes an instruction stands on are read as bytes.
