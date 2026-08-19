---
title: The machine
description: What a page holding this machine can show today, and the things it cannot show yet.
order: 2
---

The player can do whatever the emulator can do that day, and the emulator is young. The machine itself is described where it is built; this page says only what a reader of these panels will run into, and is honest about what is not there. A claim is removed from it the day it stops being one.

A CPC boots to its prompt, takes what is typed at it, and runs at the right speed — the Gate Array keeps the processor off the memory three cycles in four, which stretches every instruction onto a whole microsecond and costs a quarter of the nominal clock. That tax is what makes the machine behave like the machine, and it is the reason a program that counts instructions to reach a raster line reaches it.

A CPC 464 boots on the page and stops at its Ready prompt. [The monitor](debugger/monitor.en.md) crops to the window the emulator's own screenshots are cut to, so the picture on the page and the picture the emulator writes on the command line can be held against each other pixel for pixel; they were, all 208,896 of them, the day the monitor was written. Nothing has checked it since.

## What is not there yet

There is no disc controller, so a snapshot is the only way into a game.

The sound chip keeps its registers and makes no sound. The keyboard is read through it all the same, which is why typing at the prompt works.

A snapshot is a version 1 SNA, and version 1 has nowhere to write down the counters the chips keep between one instruction and the next. A machine resumed from one runs identically to the machine it was copied from for some four thousand cycles — about a twentieth of a frame — and then parts from it, because the interrupt counter resumed at the wrong number. Exact resumption is five or six counters away rather than out of reach, and nothing in these panels depends on it until something wants to be picked up mid-raster.

## The firmware

The firmware images are Amstrad's, distributable with emulators by the permission Amstrad gave in 1999. They are fetched rather than committed, and carried beside the page.
