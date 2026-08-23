---
title: The debugger
description: The panels the debugger is made of, what they share, and why none of them is built into the machine.
order: 2
---

The debugger is not one element but a collection of them, each watching one part of the machine. [`<colophon-cpc>`](../cpc.en.md) builds the machine and holds it; every panel here is placed inside it and finds it by looking upward. Keep the panels a game under study asks for and discard the rest — [a whole page](../index.en.md#carrying-it-into-a-page) is set out on the page before this one, and it is meant to be copied and cut down.

```html
<colophon-cpc model="cpc6128" snapshot="game.sna">
  <colophon-monitor zoom="1.5"></colophon-monitor>
  <colophon-controls></colophon-controls>
  <colophon-z80></colophon-z80>
</colophon-cpc>
```

## The panels

- [The monitor](monitor.en.md) — the picture as a tube would present it.
- [The screen](screen.en.md) — any region of memory read as though it were a screen.
- [The controls](controls.en.md) — run, stop, step, and the rule they all obey.
- [The Z80](z80.en.md) — the processor's registers, flags and interrupt state.
- [The CRTC](crtc.en.md) — the 6845 counting out the frame.
- [The disassembly](disassembly.en.md) — the bytes at the program counter read back as instructions.
- [The memory](memory.en.md) — the bytes themselves, as the processor sees them or as the banks hold them.
- [The symbols](symbols.en.md) — the names a program was written with, set against the addresses it runs at.
- [The breakpoints](breakpoints.en.md) — the marks a reader sets on the memory, and the machine that stops itself on reaching one.

## Nothing is added to the machine

A debugger usually works by putting apparatus inside the thing it is measuring. This one does not, because it does not have to. The machine is a step function whose every chip is a plain structure anyone may read, and the bus is the value each tick already returns. There is nothing to install and nothing to switch on: the panels read what is there anyway, and a machine with no panels watching it is the same machine running at the same speed.

The breakpoints are the one exception, and they prove the rule's shape: a trap the reader arms is observation policy, so it lives in the player's run loop and never in a chip. The machine's own step is untouched, and with nothing armed the loop skips every check, so a machine nobody is trapping still runs at the hardware's own speed.

That is why the apparatus stands out here rather than in there, and why these elements are observers and not features of the emulator. [A machine fact belongs in the machine and observation policy belongs in the host](../../emulator/observation.en.md#the-rule) is the rule the machine was built to, and this page is one thing that rule makes possible. A page of panels is one thing that can be built on a machine like that. A command line drawing a map of every write the boot made is another, and neither needs to know the other exists.

It also means the panels follow the chips rather than the machine. The processor, the 6845 and the memory are watched by elements that know only their own chip, so the day a second machine is built around the same parts, those elements come along unchanged.

## What every panel does the same way

Every panel draws on the machine's own events rather than on a clock of its own, and writes only what has changed. A selection being dragged across a dump and a value half typed into a field both survive the machine running underneath them.

A panel also follows its attributes: change one on a living page and the panel rebuilds itself around the new value, letting go of anything the old value meant — a selection over it, a focus within it. The page is the session, and it stays true when edited as easily as when it was declared. An attribute is a session fact that changes at a reader's pace; a value that moves with the machine is the machine's, and never an attribute's.

A value the reader can change is a form control, and the platform carries the editing. A change reaches the machine when the control says it is committed and at no other moment, so a half-typed value is never written and a value the control refuses is never written either. A control holding focus is left alone by the redraw. Escape returns a panel to what the machine holds, committing nothing.

None of this is done by the panel itself, which is the reason it can be relied on: it is what a form does.

## Two registers, and what they mean

The panels are written in two weights, and the difference carries meaning rather than emphasis.

Full white is where the machine is standing and what the program itself declares: the instruction under the program counter, a byte just written, a name its author wrote down. Dim is everything the debugger works out for itself and everything a reader scans past — the decoding of an instruction, the arithmetic that says how far past a name the counter has got, the addresses down the side of a dump.

So a name a symbol file gives an address is written in white and reads as the program's own word, while the same panel's account of where the counter is standing inside that routine is written dim. Both are true; only one of them was written by a person.

Red is the third voice, and it is the reader's: a breakpoint armed on an address, the mark that fired. It is neither the machine's state nor the program's word but an intention laid over both, and it is the one colour on the page that is meant to shout.

## The right button

The right button on anything a panel shows asks what may be done with it, and each panel answers for its own items: it knows what they are, which nothing outside it does. A byte in the memory knows it is an address; a name in the symbols knows the address it stands for.

What a panel offers falls into two kinds. Some of it belongs to the machine — a breakpoint is set on the machine and stays set whether or not any panel lists it — and a panel offers those directly. The rest belongs to another panel, which alone knows how to do it, and those travel as events: a panel says what it wants done and does not care who does it, or whether anyone does. A page that has not been given the panel that would answer simply sees nothing offered, which is the honest result: there is no view there to move.

What answers is not a panel either. [`<colophon-cpc>`](../cpc.en.md#what-it-brings-with-it) carries the options and the breakpoint form itself, so the road from a byte to a mark is open on every page, however few panels it was given.

Nothing is offered by the right button alone. Every one of them can be reached another way, so the menu is a shortcut and never the only road.

## Options in the heading

A panel's options ride in its heading rather than in its body, where they would cost it height and move whatever stands beneath it. They are set smaller than the heading, so that they read as options and not as part of the title, and each carries its own title against the day there are enough of them to want icons in place of words.
