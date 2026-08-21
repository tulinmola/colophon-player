---
title: The symbols
description: The names a program was written with, set against the addresses it runs at.
order: 9
---

A program is written in names and runs as addresses. Whatever turned the one into the other wrote down what it had done, and this panel is that note read back: `<colophon-symbols>` lists every named address the machine was given, in the order they stand in memory, and marks the one the machine is inside.

```html
<colophon-symbols lines="16"></colophon-symbols>
```

| Attribute | Default | Read                                                                                                                  |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `lines`   | `16`    | How many names stand in view at once. The rest are scrolled to, and the panel keeps this height however few are left. |

The names are not the panel's. They are given to the machine by [`<colophon-cpc>`](../cpc.en.md), which fetches the file the `symbols` attribute names, and every panel that can use them draws on the same list — [the disassembly](disassembly.en.md#the-names) reads its listing back with them. A page that gives no symbol file may still place this panel, and it stands there counting nothing.

## The file it reads

The file today is the one sdld writes for the NoICE debugger, a `.noi` beside the map, which is what an SDCC build leaves behind — CPCtelera's among them. Each line is a definition and nothing else:

```
DEF _renderer_init 0x25C9
```

Which file it is is decided by the file itself rather than by what it is called. Half the assemblers in this world write a `.sym` and no two of them write the same one, so the first line that carries anything is what settles the dialect. A file in a dialect the debugger does not know is refused by name, rather than read as an empty list and quietly believed.

## What is left out

A linker names more than a program does. It defines a start and a length for every area it lays out, and a length is a count rather than a place: read as an address, the size of the code area would be written across whatever byte happens to stand at that number. Those definitions are dropped as they are read, which is why a file of five hundred and thirty-one definitions arrives as five hundred and six names.

What arrives is what the program made public. A routine the compiler kept to itself was never written down, and no file can be asked for what it does not hold.

## More than one name

Two names may stand at one address, and both are kept — a function and the alias beside it, or the C binding and the assembly entry point of the same routine. The list shows each on its own line. Where a single name must be shown, the first the file gave is the one taken.

## Narrowing the list

The funnel in the panel's heading narrows the list to the names holding what is typed beside it, matching anywhere in a name and disregarding case. The heading counts what the panel is holding — `Symbols (506)` whole, `Symbols (15/506)` narrowed — because that is a fact about the list and not a thing the reader sets. Escape empties the field and brings the rest back.

The panel does not change size as it narrows. A filter that took a panel in with every keystroke would move everything standing below it, so the list keeps its height whether it is holding five hundred names or one, and a name longer than its column is cut in the middle, keeping its head and its tail, with the whole of it on its title.

## How far a name reaches

A symbol file names one byte and says nothing about how many follow it. The extent of a routine is therefore not knowable, only guessed at from where the next name begins, and this debugger does not guess: a name is taken to reach a thousand and twenty-four bytes past its own address and no further.

That is what keeps a program's last routine from putting its name on the firmware. A machine spends much of its time in the ROM, where the file has nothing to say, and a panel that answered anyway would be wrong exactly where a reader had no way of checking it.
