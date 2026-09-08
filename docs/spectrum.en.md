---
title: The Spectrum
description: The element that builds a ZX Spectrum, holds it for every panel watching it, and carries the keyboard.
order: 2
---

`<colophon-spectrum>` builds a machine and holds it, exactly as [`<colophon-cpc>`](cpc.en.md) does. It is the second machine, and it arrived beside the first rather than underneath it: there is no element here that builds _a machine_ in the abstract, because a machine is a board with particular chips soldered to it and the element that builds one has to know which.

What was promised of the panels held. The processor, the memory, the disassembly, the keyboard and the marks a machine stops on watch chips rather than boards, so every one of them came to this machine; what each needed was to be handed the machine's own numbers — the window its monitor paints, the legends on its keys, the width of its memory — instead of assuming a CPC's.

```html
<colophon-spectrum model="spectrum48">
  <!-- panels -->
</colophon-spectrum>
```

| Attribute  | Default      | Read                                                                                                                                                                                                                                   |
| ---------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`    | `spectrum48` | `spectrum48`, which is [the machine there is](../emulator/machine.en.md#the-machines).                                                                                                                                                 |
| `snapshot` | —            | An SNA snapshot to start from, fetched relative to the page. Without one the machine boots from reset and arrives at its prompt.                                                                                                       |
| `symbols`  | —            | A file of named addresses, fetched relative to the page, under which the program can be read back. [Which dialect it is in](debugger/symbols.en.md#the-files-it-reads) is settled by the file itself rather than by what it is called. |
| `tape`     | —            | A `.tap`, `.tzx` or `.cdt` to put in the deck, fetched relative to the page. It goes in stopped: [pressing PLAY](debugger/tape.en.md) is the reader's.                                                                                 |
| `roms`     | `/roms`      | Where the firmware is looked for. The default stands at the root of the site whatever the page's own address; a relative value here is resolved against the page.                                                                      |

Change any of these on a living page and the machine reboots, and the element announces `machine:reboot` for every panel to rebuild by — the same rule the CPC element follows, for the same reason.

The element takes focus, and gives itself a `tabindex` if the page has not given it one.

## The keyboard

Forty keys, in eight half-rows of five, each half-row selected by one of the upper address lines held low. While the element itself holds focus, every key it recognises is pressed on that matrix rather than on the page; a field being edited in a panel is not the element, so a register being typed into keeps its keystrokes.

Both shifts are keys here and software reads them, so Shift is CAPS SHIFT and Control is SYMBOL SHIFT. Command is not a key on this machine, so anything held with it is left to the browser.

Forty keys carry upwards of two hundred meanings between them, which is why the arrows and delete are not keys at all but legends printed on the digits: delete is CAPS SHIFT and `0`, and the four arrows are CAPS SHIFT and `5` to `8`. A browser key that stands for one of those closes both switches together and opens both together, which is what a finger reaching across the case does.

What arrives is the machine's business and not this element's. At the `K` cursor a letter is a keyword, so `p` typed at the start of a line is `PRINT` and not a letter — that is the firmware's doing, and the debugger neither helps it nor gets in its way.

The release rule is the CPC's, and for the same reason: the firmware reads the matrix once a frame, so a key pressed and let go between two reads was never pressed at all, and a release is held back until a frame has been presented since the press.

## What this machine can do

It boots its firmware, shows the copyright line Sinclair put in it, takes what is typed at it and runs BASIC. It runs at the speed the hardware ran, which on this machine means [the ULA stopping the processor's clock rather than asserting a wait line](../emulator/machine.en.md#the-zx-spectrum) — so what an instruction costs depends on where in the frame it began, and the debugger's tick count is the machine's own.

Every panel but the ones that watch a CPC's own chips answers here: [the controls](debugger/controls.en.md), [the monitor](debugger/monitor.en.md), [the ULA](debugger/ula.en.md), [the Z80](debugger/z80.en.md), [the disassembly](debugger/disassembly.en.md), [the memory](debugger/memory.en.md), [the keyboard](debugger/keyboard.en.md), [the tape](debugger/tape.en.md) and [the breakpoints](debugger/breakpoints.en.md). The memory panel's physical space begins where the machine's RAM begins, which on this board is `&4000`: nothing answers below it, so physical zero is the first byte the processor can write.

It loads from tape — `.tap` and `.tzx`, and the `.cdt` that is a `.tzx` under another name — and [the deck](debugger/tape.en.md) is the reader's to turn, because this machine has no motor line to turn it with. What it cannot do yet: nothing sounds, as nothing sounds on the CPC. [The screen](debugger/screen.en.md) is the CPC's alone, because reading a region of memory as a picture means reading it in that machine's own arrangement, and a Spectrum's is not the CPC's.

## The firmware

The image is Sinclair's, [distributable with emulators on the permission Amstrad gave in 1999](../emulator/machine.en.md#the-firmware), which the emulator's own fetch script records and pins by hash. `npm run roms:fetch` brings it down with the others and it is never committed; where it must then stand is what `roms` says.
