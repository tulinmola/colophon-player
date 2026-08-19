---
title: The machine element
description: The element that builds the machine, holds it for every panel inside it, and carries the keyboard.
order: 1
---

`<colophon-cpc>` is the only element here that owns anything. It builds a machine, holds it, and gives every panel placed inside it something to watch. It also carries the keyboard, because a machine that cannot be typed at is a machine standing at its prompt forever.

```html
<colophon-cpc model="cpc6128" snapshot="game.sna">
  <!-- panels -->
</colophon-cpc>
```

| Attribute  | Default   | Read                                                                                                                                                              |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`    | `cpc6128` | `cpc464`, `cpc664` or `cpc6128`. It settles which firmware file is read and how much memory the machine has: 64K for the first two, 128K for the last.            |
| `snapshot` | —         | A snapshot to start from, fetched relative to the page. Without one the machine boots from reset and arrives at its prompt.                                       |
| `roms`     | `/roms`   | Where the firmware is looked for. The default stands at the root of the site whatever the page's own address; a relative value here is resolved against the page. |

The element takes focus, and gives itself a `tabindex` if the page has not given it one. It cannot do that when it is constructed, because an element does not carry its attributes until it reaches the page, and `document.createElement` would break on the way.

## The keyboard

While the element itself holds focus, every key it recognises is pressed on the machine's own matrix rather than on the page. A field being edited in a panel is not the element, so a register being typed into keeps its keystrokes and the machine never sees them.

Control is a key on this machine and software reads it, so it is passed through. Command is not a key on this machine, so anything held with it is left to the browser.

Two things are handled that a plain forwarding would get wrong. The browser repeats a held key and so does the firmware, so a repeat is not pressed a second time. And the firmware reads the matrix once a frame, which means a key pressed and released between two reads was never pressed at all — a release is therefore held back until the frame after its press, or the keystroke would be lost, and any shift held with it would carry into the next one.

Focus leaving the element releases everything it was holding down.

## When the machine arrives

The module that carries the machine is fetched after the elements have reached the page, so there is a moment in which `<colophon-cpc>` is standing there holding nothing. The panels are built for it: they wait, and begin watching when the element announces that a machine has arrived. Nothing placed inside should look for one once and expect to find it.
