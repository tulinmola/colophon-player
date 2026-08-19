---
title: The disassembly
description: The bytes at the program counter read back as instructions, and why nothing above it can be shown.
order: 7
---

`<colophon-disassembly>` reads the bytes standing at the program counter back as instructions: sixteen of them, each with its address, the bytes it is made of, and what they say.

```html
<colophon-disassembly></colophon-disassembly>
```

It reads through the processor's own view of memory, so what it shows is what the processor would fetch. Where a ROM is paged in, the ROM's instructions are what appear.

Nothing above the program counter is shown, and nothing can be. An instruction's length is only known by reading it from its first byte, so there is no way to walk backwards through a stream of them without already knowing where one of them starts. A disassembly that offered the bytes before the program counter would be guessing, and would be wrong at exactly the moment a reader most needed it to be right.
