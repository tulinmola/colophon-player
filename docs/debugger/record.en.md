---
title: The record
description: The last few seconds of the machine, kept as whole machines and the stores between them, and what a debugger can ask of them.
order: 5
---

A machine that has gone wrong went wrong a moment ago, and by the time anyone notices, the moment has been overwritten by the ones after it. The record keeps those moments, so that the question can be asked late and still answered.

This is not a panel and has no element of its own. It is the machine's recent past, kept by the host that runs it: what [the controls](controls.en.md) move the machine through, and what [the screen](screen.en.md) and [the memory](memory.en.md) reach into to say where a byte came from.

## What is kept

Every standard frame's worth of ticks, the record keeps a whole machine: the processor mid-instruction, every part wired to it, and the whole of RAM. It keeps 128 of them, a little over two and a half seconds, at 132,400 bytes each. Alongside them it keeps the last 524,288 stores the processor made, each with the address the byte landed at and the instruction that sent it. The module asks the page for 32MB when it loads and never grows, and this record is three quarters of it.

Nothing is added to the machine to do this. Every store crosses the pins the tick already returns, which is [the tap the emulator was built around](../../emulator/observation.en.md#the-bus-is-already-the-tap), and the state kept a frame apart is a structure copy of memory the host already owns. The one thing the record asks of the machine on every tick is whether it stands between instructions, which is what stamps a store with the instruction that made it — and which the module is built with link-time optimisation for, because the processor is another file and the question is asked four million times a second. Over 600 frames the whole record costs 1.9% of the machine's speed; built without that flag it costs 14.7%.

## Standing in the past

A moment is reached by loading the state before the one that holds it and running the machine forward to the tick asked for. That is why nothing is undone and no store is ever put back: the machine is not walked backwards, it is built again from a moment it has already been.

Running forward is also what paints the picture. A state does not carry the framebuffer — it would be two and a half times the size of the machine it belongs to — so a seek starts far enough back to run a whole frame's worth of ticks, and the beam sweeps over every sample of the raster on the way. Far enough back is a walk and not a step: a value written from outside is kept as a state of its own wherever the machine happened to be, and two of those stand closer together than the cadence does. The [map of writes](screen.en.md#the-heat-view) is not carried either, and is cleared before the replay refills it, so the heat over a rewound picture shows the stores the replay passed and not the ones before it.

The machine is left between instructions, for the reason [the controls](controls.en.md#between-instructions) leave it there: a program counter halfway through an instruction belongs to no instruction any panel could name. So the moment landed on is the first boundary at or after the one asked for, which is at most a couple of dozen T-states later and never earlier.

Going back a grain is the same act twice. The record keeps whole machines and the stores between them; the length of an instruction, of a scanline, of a character row is none of those, because each is whatever the program has made it. So where a grain began can only be learnt by standing the machine further back and running at it — once to find it, once to stop on it. How far back to stand is not guessed at either: the states are searched newest first, one span at a time, so a program that has stopped finishing frames is walked back over as many spans as the record holds rather than given up on.

## The history a rewind leaves

Rewinding does not spend the record. The machine can be scrubbed back and forth across the whole of it, and `Now` returns it to where it was.

What spends it is going on. The moment the machine runs from a rewound position, or is edited there, everything the record held past that moment is dropped: the history it describes is no longer the one the machine is in. A [register written into](z80.en.md), an [ink changed](gate-array.en.md), a byte poked into memory, a key pressed — each reaches the machine without a tick passing, so each is kept as a state of its own, because no replay of the ticks around it would ever arrive at the machine now standing there.

## Where a byte came from

The right button on a pixel in [the screen](screen.en.md#what-can-be-done-with-a-pixel), or on a byte in [the memory](memory.en.md#what-can-be-done-with-a-byte) read as the banks hold it, offers `Rewind to the write`. It stands the machine on the instruction that stored that byte, with the store still to come — so the next ▶ makes the write happen again, under a program counter that names the instruction responsible.

Asked again from there, it walks back to the store before that one, and again to the one before that, for as far back as the machine can be stood. A quiet program stores rarely enough that the trace remembers further than the states reach; a store the states cannot reach is a moment nothing could stand the machine on, so it is not offered as an answer. A pixel is a byte, a byte is a store, and a store is an instruction.

Only physical addresses are traced, the video hardware's own view of memory, which is why the offer stands over a screen and over the memory's `RAM` reading and not over the processor's own space. A byte the processor sees at &4000 is in a bank that could only be named by walking the paging backwards.

## What it cannot answer

The record starts where the machine did, and forgets from the far end as it fills; a question about a moment older than the window has no answer here. It holds what the processor stored, so a byte changed by anything else — a snapshot loaded over it, a reader's own edit — has no instruction to name and is not in the trace.

The picture is the one thing replayed rather than kept, and it is replayed on an assumption: that a standard frame's worth of ticks sweeps the beam over the whole raster once. A program that reprograms the 6845 into a frame of another length breaks that assumption, and a moment landed on inside such a frame can show samples the replay never reached. Every other panel is exact there, because every other panel reads state the record carries.
