---
title: The disassembly
description: The bytes at the program counter read back as instructions, under the program's own names where there are any.
order: 7
---

`<colophon-disassembly>` reads the bytes standing at the program counter back as instructions, each with its address, the bytes it is made of, and what they say.

```html
<colophon-disassembly lines="16"></colophon-disassembly>
```

| Attribute | Default | Read                                                                                                                                        |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines`   | `16`    | How tall the panel stands. It is a count of lines and not of instructions — [a label takes one of them](#sixteen-lines-whatever-they-hold). |

It reads through the processor's own view of memory, so what it shows is what the processor would fetch. Where a ROM is paged in, the ROM's instructions are what appear.

Nothing above the program counter is shown, and nothing can be. An instruction's length is only known by reading it from its first byte, so there is no way to walk backwards through a stream of them without already knowing where one of them starts. A disassembly that offered the bytes before the program counter would be guessing, and would be wrong at exactly the moment a reader most needed it to be right.

## The names

Where the machine has been given [a symbol file](symbols.en.md), a `Symbols` switch stands in the panel's heading and the listing is read back under the program's own names. Without one the switch is not there at all, and the panel is what it has always been.

An operand is written as the name of the address it holds: `CALL _renderer_init` where the file has a name for it, `CALL &25C9` where it has none. Every sixteen-bit operand a Z80 instruction carries is an address, so a jump, a call and the address a register pair is loaded from are all read the same way. A byte never is one, and is left as a number.

A name standing exactly at an instruction's address is written above it on a line of its own, the way a label is written in a source file; where two names share an address, both are written. Above the current instruction that line says one thing more: when no name begins there, it gives where the program counter is standing instead — `_renderer_init+&03`, the routine it is inside and how far past its first byte — which is what a reader wants at every instruction rather than at the rare one that begins a routine. An offset wears no colon and is written dim, because nothing is declared at it: it is the debugger's own arithmetic and not the program's word. Where the file can name nothing at all the line is not spent: it goes back to the listing.

### Sixteen lines, whatever they hold

The panel is as many lines tall as `lines` asks for, and stays that tall. A label does not add a line to it, it takes one from the listing: a panel showing two labels shows two instructions fewer. Nothing standing below it moves while a reader steps through a program, which is worth more than the instructions it costs.

A label falling on the last line keeps it, and the instruction beneath waits for the next listing. It is the more useful of the two — a reader who can see that the next routine begins here does not need the byte that begins it.

### Names too long for the panel

A name is as long as its author made it, and the longest in a real program are longer than any instruction the decoding can produce. Rather than let one widen the panel, a line too long for its column is cut in the middle, keeping its head and its tail — `CALL _rende…OutWaiting` — with the whole of it on the line's title, where hovering shows it. [The panel of symbols](symbols.en.md#narrowing-the-list) cuts its names the same way.

Names are paid for in width, and only once. Turning the switch on widens the column that holds them; turning it off returns the panel to addresses alone and to the narrower column those need. Nothing else moves with it: what an instruction is and where it stands are read from the machine either way.
