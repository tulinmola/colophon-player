---
title: The discs
description: The two drawers the machine has, what goes into them, and what comes back out again.
order: 13
---

A disc is the one part of this machine a reader puts there. Everything else the page builds — the processor, the memory, the picture — is the machine being itself; a disc is somebody else's object pushed into a slot, and it leaves the way it came in, changed by whatever ran off it.

`<colophon-disc>` is the two drawers: drive A, which is the machine's own, and drive B, which is the connector for a second. It shows what is in each, and it is where a disc goes in, comes out, and is written back to a file.

```html
<colophon-disc></colophon-disc>
```

## What each drawer says

A drawer holds a name, which is the player's own: an image carries none, so what stands there is the file it was read from. Beside it is the disc's shape and what has become of it.

| Shown       | Read                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `40×1`      | How wide the medium is: cylinders across, sides deep.                                          |
| `protected` | The tab on the disc is over, and nothing the machine does can write to it.                     |
| `written`   | The image no longer matches what went in. It says a write landed, not that anything was saved. |

## The three controls

`+` opens the reader's own file picker and puts what it finds in that drive. `↓` writes the disc out and hands it to the browser to save. `×` takes it out. The last two are dark while the drawer is empty, because there is nothing there to write or to take.

A disc goes in the moment the picker closes, and the machine keeps running while it does. That is what a drive door is: the operating system finds a disc where a moment ago it found none, and says so on the next thing it is asked.

## When a disc is refused

An image is somebody else's file and is trusted for nothing. [The reader proves every offset lies inside it before reading it](../../emulator/machine.en.md#discs), and a defect that would make the rest unsafe refuses the whole image rather than handing back half a disc that looks whole.

A refusal is printed under the drawers in the reader's own words — `a sector's data runs past the end of the image`, `the image does not begin like a disc image` — and it leaves that drawer empty. It has to: the bytes the picker just delivered are the very bytes the disc that was in there was reading from, so the old disc cannot survive a new image being laid over it.

A disc named in [the element's own attributes](../cpc.en.md) is refused on another road. It is read while the machine is being built, so a bad one stops the building: no machine arrives, no panel begins watching, and the page stands empty with the reason thrown into the browser's console. That is what a bad snapshot does too.

One sentence there is the player's own rather than the machine's. A disc is given a megabyte of room, which is five times what a CPC's own discs need and enough for the extended images of protected ones; an image past it is refused before a byte of it is written anywhere.

## Writing a disc back

`↓` writes the disc as it stands now, [in the extended layout and always with the sector positions](../../emulator/machine.en.md#discs), so an image written here and read again is the same disc to the byte. It is offered whether or not anything was written, because a disc that was only read is still a disc worth keeping.

Two kinds of disc cannot be written out at all, and both say so instead of writing a broken image: one holding a track the format has no way to record, and one needing more room than a megabyte. A drawer with nothing in it says that too.

## The disc is not in the record

The drive and the controller rewind with everything else; [the medium does not](record.en.md#what-it-cannot-answer). A rewind therefore puts the head back where it was and leaves the bytes where they are, so a moment before a sector was written can be stood in, and the sector there will already hold what the write put in it. `written` stays lit once it has lit.

## Without a disc interface

The 664 and the 6128 have the interface built in. A 464 does not, and gets one plugged into it — with the AMSDOS ROM it brings — only when [the element is given a disc](../cpc.en.md) to start with. A machine with no interface says so under its drawers, and a disc put into one does not even turn: the motor line runs from a port only the interface answers at, so nothing can start it.
