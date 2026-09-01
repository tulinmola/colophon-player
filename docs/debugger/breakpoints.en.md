---
title: The breakpoints
description: The marks a reader sets on the memory, and the machine that stops itself on reaching one.
order: 12
---

Watching a machine run is one half of debugging; the other is arranging to be there when something happens. `<colophon-breakpoints>` holds the reader's marks: addresses at which the running machine stops itself and hands the page back, with every panel already showing the moment of interest.

```html
<colophon-breakpoints lines="8"></colophon-breakpoints>
```

| Attribute | Default | Read                                                                         |
| --------- | ------- | ---------------------------------------------------------------------------- |
| `lines`   | `8`     | How many marks stand in view at once. The list keeps this height regardless. |

The three dots at the heading's right hold `lines`, and the panel is built again at the height asked for.

## The three kinds

`execute` stops the machine as the program counter arrives at the address, before the instruction there has run, so what the panels show is the moment just ahead of it.

`read` and `write` watch the address as data: the machine stops after the instruction that touched it, because stopping in the middle of one would leave a program counter belonging to no instruction anyone can name. The instruction is allowed to finish, and the stop lands on the boundary after it.

A read here means read as data — a byte copied, compared or summed. The fetch of an instruction is the machine's own step and never fires a read mark, so watching a routine for reads answers the question actually being asked: who takes this code as bytes.

## Setting one

The `+` in the panel's heading opens a small form, and the platform carries it: Escape or Cancel abandons it, Add commits it. [A byte in the memory](memory.en.md#what-can-be-done-with-a-byte) opens the same form with its address already filled in, and does so whether or not this panel is anywhere on the page — the form belongs to the debugger rather than to this panel, and the marks belong to the machine, which this panel only lists.

The pencil beside a mark opens it again for changing, every field of it, and what is saved takes the old one's place. The cross beside that takes it away.

`At` takes a name or an address: a bare word is looked up among [the symbols](symbols.en.md) first — with or without the underscore a compiler prefixes — and read as hex if no name matches, while the `&` sigil forces an address outright. `Kind` chooses what the mark watches for.

`To` stretches the mark over a span, so one mark from `&BFE2` to `&BFE9` watches every byte of a buffer at once; the stop still names the exact byte that was touched. A span that ends before it begins is refused, as is a name no symbol file gave.

`Label` is the reader's own word for the mark, and stands in the list in place of the name the symbols would offer.

Each mark in the list carries its armed dot, its addresses, its name, its kind, and a cross that removes it. The dot is a control: unchecking it holds the mark without watching for it, which is how a trap is kept for later without firing today.

## When one fires

The machine stops itself, and every panel reads the stopped machine as after any other stop: the disassembly stands at the program counter, the registers hold the moment. The mark that fired is shown in red in this panel until the machine runs again.

Stopping and resuming keep their ordinary meanings. A resumed machine steps off an execute mark before watching for it again, so Run after a trap continues the program rather than standing still on the same address forever.

## What it costs

Nothing, until one is armed. The checks live in the player's own run loop, not in any chip, and with no marks armed the loop skips them entirely: a machine nobody is trapping runs at the hardware's own speed, and the emulator underneath carries no apparatus at all.
