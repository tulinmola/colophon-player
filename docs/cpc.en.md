---
title: The CPC
description: The element that builds an Amstrad CPC, holds it for every panel watching it, and carries the keyboard and the joysticks.
order: 1
---

`<colophon-cpc>` builds a machine and holds it. It is the only element here that owns anything: the panels placed inside it find it by looking upward, and not one of them knows how to make one. It carries the keyboard and the joysticks as well, because a machine that cannot be typed at is a machine standing at its prompt forever.

The element is named for the machine rather than for its part in a page, so that [the Spectrum](spectrum.en.md) stands beside it rather than underneath it — and the panels, which watch chips and not machines, came along to that one unchanged.

```html
<colophon-cpc model="cpc6128" snapshot="game.sna">
  <!-- panels -->
</colophon-cpc>
```

| Attribute  | Default   | Read                                                                                                                                                                                                                                   |
| ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`    | `cpc6128` | `cpc464`, `cpc664` or `cpc6128`. It settles which firmware is read and how much memory the machine is built with; [the three machines](../emulator/machine.en.md#the-machines) are set out where they are built.                       |
| `snapshot` | —         | A snapshot to start from, fetched relative to the page. Without one the machine boots from reset and arrives at its prompt.                                                                                                            |
| `disc`     | —         | A disc image for drive A, fetched relative to the page. Giving one to a machine with no disc interface built in is what plugs one into it, with the AMSDOS ROM it brings.                                                              |
| `disc-b`   | —         | The same for drive B, which is the connector for a two-headed drive where A is the machine's own one-headed one.                                                                                                                       |
| `symbols`  | —         | A file of named addresses, fetched relative to the page, under which the program can be read back. [Which dialect it is in](debugger/symbols.en.md#the-files-it-reads) is settled by the file itself rather than by what it is called. |
| `roms`     | `/roms`   | Where the firmware is looked for. The default stands at the root of the site whatever the page's own address; a relative value here is resolved against the page.                                                                      |
| `joystick` | —         | `cursors` puts [joystick 0 on the cursor keys](#the-joysticks), with Z, X and C for its buttons. It is read as each key arrives, so it can be set or taken off a living page without a reboot.                                         |

Change any of these but `joystick` on a living page and the machine reboots: the one standing stops, a successor boots from the new values, and the element announces `machine:reboot` for every panel to rebuild by. A different game arrives into the same instruments as easily as an attribute is typed.

The element takes focus, and gives itself a `tabindex` if the page has not given it one. It cannot do that when it is constructed, because an element does not carry its attributes until it reaches the page, and `document.createElement` would break on the way.

## The keyboard

While the element itself holds focus, every key it recognises is pressed on the machine's own matrix rather than on the page. A field being edited in a panel is not the element, so a register being typed into keeps its keystrokes and the machine never sees them.

Control is a key on this machine and software reads it, so it is passed through. Command is not a key on this machine, so anything held with it is left to the browser.

Two things are handled that a plain forwarding would get wrong. The browser repeats a held key and so does the firmware, so a repeat is not pressed a second time. And the firmware reads the matrix once a frame, which means a key pressed and released between two reads was never pressed at all — a release is therefore held back until a frame has been presented since the press, or the keystroke would be lost, and any shift held with it would carry into the next one. That rule is the machine's rather than the keyboard's, so a joystick's switches obey it too.

Focus leaving the element lets go of every key the keyboard was holding, under the same rule. It lets go of nothing else: a gamepad has no focus to lose, and a switch closed by hand in [the keyboard panel](debugger/keyboard.en.md) is the reader's to open.

## The joysticks

On this machine a joystick is part of the keyboard. The firmware guide says so in as many words: both are scanned in the same way as keys, and the second occupies the same locations in the key matrix as certain other keys and is indistinguishable from them. Joystick 0 has matrix line 9 to itself, keys 72 to 78 in the firmware's numbering; joystick 1 lies over keys 48 to 54 of the main keyboard — 6, 5, R, T, G, F and B — so it can be played from the keyboard on any page, and always could. Each has Up, Down, Left, Right, Fire 1, Fire 2 and a Spare button, in the manual's names; the manual also warns that the main button of an ordinary joystick is Fire 2, and that is the name kept here.

A gamepad plugged into the browser is a joystick. The first the browser lists is joystick 0 and the second joystick 1, read by the standard layout the Gamepad specification defines: the directional pad or the left stick past half its travel for the directions, and the first three buttons for Fire 2, Fire 1 and Spare — the button under the thumb is the main one. The pads are read once an animation frame, just before the machine runs the frames it owes, and only while it runs: a stopped machine reads nothing, so a direction held when it stopped stays held for as long as it stands, and can be stepped under. Every machine on a page reads the same pads. A browser lists a pad only once a button has been pressed on it, so a pad that seems to do nothing wants a press first.

`joystick="cursors"` puts joystick 0 on the keyboard: the cursor keys for the directions, Z for Fire 2, X for Fire 1 and C for Spare, which is where Caprice32 and CPCEC put them. While it is set those seven keys are the joystick and nothing else, so the machine's own cursor keys are out of reach until it is taken off again. It is joystick 0 alone that is put there; joystick 1 needs no such help, being keys already.

## What it brings with it

Two things are the debugger's own rather than any page's: the actions offered by the right button, and the form that takes down a breakpoint. Each is raised on the page when it is called for and taken away when it is done with, so neither takes a place among the panels and neither has to be asked for — a page that named no panel at all still has both, because what they carry belongs to the machine and not to the furniture that lists it.

## When the machine arrives

The module that carries the machine is fetched after the elements have reached the page, so there is a moment in which `<colophon-cpc>` is standing there holding nothing. The panels are built for it: they wait, and begin watching when the element announces that a machine has arrived. Nothing placed inside should look for one once and expect to find it.

## What this machine can do

It boots its own firmware to the Ready prompt, takes what is typed at it, and runs at the speed the hardware ran — [the Gate Array holds the processor off the memory three cycles in four](../emulator/machine.en.md#timing), which is the tax that makes a CPC behave like a CPC.

It reads discs, through [the same AMSDOS ROM and the same controller the hardware had](../emulator/machine.en.md#discs), so `CAT` catalogues a disc and `RUN"` loads off one. A disc named in the attributes above is in the drive before the machine has run a tick; [the drawers](debugger/disc.en.md) are where one goes in or comes out later, and a disc goes in while the machine runs, as a disc does.

A machine loading a snapshot with a disc in the drive keeps both. The disc goes in first and the snapshot is laid over the machine after, because building a machine empties its drives and a snapshot carries nothing about them.

What it cannot do yet is set out chip by chip [where the machine is built](../emulator/machine.en.md). The two that a reader of these panels meets first: the sound chip keeps its registers and makes no sound, though the keyboard is read through it regardless, which is why typing works; and [what a version 1 snapshot cannot carry](../emulator/machine.en.md#snapshots) decides how exactly a machine can be picked up again.

## The firmware

The images are Amstrad's, [distributable with emulators by the permission Amstrad gave in 1999](../emulator/machine.en.md#the-firmware). `npm run roms:fetch` brings them down and they are never committed; where they must then stand is what `roms` says. `amsdos.rom` comes down with the other three and is read only by a machine that has the disc interface fitted.
