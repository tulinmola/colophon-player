---
title: The CPC
description: The element that builds an Amstrad CPC, holds it for every panel watching it, and carries the keyboard.
order: 1
---

`<colophon-cpc>` builds a machine and holds it. It is the only element here that owns anything: the panels placed inside it find it by looking upward, and not one of them knows how to make one. It carries the keyboard as well, because a machine that cannot be typed at is a machine standing at its prompt forever.

A CPC is the machine there is today. The element is named for it rather than for its part in a page, so that the day a second machine arrives it stands beside this one rather than underneath it — and the panels, which watch chips and not machines, come along unchanged.

```html
<colophon-cpc model="cpc6128" snapshot="game.sna">
  <!-- panels -->
</colophon-cpc>
```

| Attribute  | Default   | Read                                                                                                                                                                                                                                      |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`    | `cpc6128` | `cpc464`, `cpc664` or `cpc6128`. It settles which firmware is read and how much memory the machine is built with; [the three machines](../emulator/machine.en.md#the-machines) are set out where they are built.                          |
| `snapshot` | —         | A snapshot to start from, fetched relative to the page. Without one the machine boots from reset and arrives at its prompt.                                                                                                               |
| `symbols`  | —         | A file of named addresses, fetched relative to the page, under which the program can be read back. [Which dialect it is in](../debugger/symbols.en.md#the-files-it-reads) is settled by the file itself rather than by what it is called. |
| `roms`     | `/roms`   | Where the firmware is looked for. The default stands at the root of the site whatever the page's own address; a relative value here is resolved against the page.                                                                         |

The element takes focus, and gives itself a `tabindex` if the page has not given it one. It cannot do that when it is constructed, because an element does not carry its attributes until it reaches the page, and `document.createElement` would break on the way.

## The keyboard

While the element itself holds focus, every key it recognises is pressed on the machine's own matrix rather than on the page. A field being edited in a panel is not the element, so a register being typed into keeps its keystrokes and the machine never sees them.

Control is a key on this machine and software reads it, so it is passed through. Command is not a key on this machine, so anything held with it is left to the browser.

Two things are handled that a plain forwarding would get wrong. The browser repeats a held key and so does the firmware, so a repeat is not pressed a second time. And the firmware reads the matrix once a frame, which means a key pressed and released between two reads was never pressed at all — a release is therefore held back until the frame after its press, or the keystroke would be lost, and any shift held with it would carry into the next one.

Focus leaving the element releases everything it was holding down.

## When the machine arrives

The module that carries the machine is fetched after the elements have reached the page, so there is a moment in which `<colophon-cpc>` is standing there holding nothing. The panels are built for it: they wait, and begin watching when the element announces that a machine has arrived. Nothing placed inside should look for one once and expect to find it.

## What this machine can do

It boots its own firmware to the Ready prompt, takes what is typed at it, and runs at the speed the hardware ran — [the Gate Array holds the processor off the memory three cycles in four](../emulator/machine.en.md#timing), which is the tax that makes a CPC behave like a CPC.

What it cannot do yet is set out chip by chip [where the machine is built](../emulator/machine.en.md). The three that a reader of these panels meets first: there is no disc controller, so a snapshot is the only way into a game; the sound chip keeps its registers and makes no sound, though the keyboard is read through it regardless, which is why typing works; and [what a version 1 snapshot cannot carry](../emulator/machine.en.md#snapshots) decides how exactly a machine can be picked up again.

## The firmware

The images are Amstrad's, [distributable with emulators by the permission Amstrad gave in 1999](../emulator/machine.en.md#the-firmware). `npm run roms:fetch` brings them down and they are never committed; where they must then stand is what `roms` says.
