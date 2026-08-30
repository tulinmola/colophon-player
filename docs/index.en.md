---
title: The player
description: The debugger that reads a machine while it runs, and the element that will carry one into any page.
order: 2
---

A colophon is written to be read, and a machine is meant to be watched. The player is where the emulator is put on a page, so that the account of a game and the game itself can be held against each other.

Today that page is a debugger. It builds a machine, runs it at the speed the hardware ran, and lets a reader stop it between instructions and ask what it holds: the registers, the bytes, the counters of the chip drawing the picture, and the picture itself. [The debugger](debugger/index.en.md) sets out each of its panels and what each one reads.

The machine it builds today is [a CPC](cpc.en.md), and the element that builds one is named for it: a second machine will stand beside it rather than replace it.

## Carrying it into a page

The debugger travels as two files, each pinned to a version that cannot change under the link: a stylesheet that dresses the page, and a module that carries the machine. A whole page is those two lines and the elements arranged beneath them.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>A machine under study</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/colophon-player@0.2.1/dist/colophon-player.css"
    />
    <script
      type="module"
      src="https://cdn.jsdelivr.net/npm/colophon-player@0.2.1/dist/colophon-player.js"
    ></script>
  </head>
  <body>
    <colophon-cpc model="cpc6128" snapshot="game.sna">
      <colophon-monitor zoom="1.5"></colophon-monitor>
      <div class="panels">
        <colophon-controls></colophon-controls>
        <colophon-z80></colophon-z80>
        <colophon-disassembly></colophon-disassembly>
      </div>
    </colophon-cpc>
  </body>
</html>
```

The stylesheet dresses the page and not only the elements: it resets the document and sets the body's colour and type, which is why the page above holds nothing else. `panels` is the one class it offers the page, and it stacks what it holds into a column beside the monitor.

The rest is files standing where the page looks for them.

```
index.html          the page above
game.sna            fetched beside the page
roms/cpc6128.rom    fetched from the root of the site
```

The snapshot is named by the `snapshot` attribute and fetched relative to the page. The firmware is looked for in `/roms` at the root of the site, whatever the page's own address; a `roms` attribute on `<colophon-cpc>` sends it elsewhere, and a relative one there is resolved against the page like any other link. Which of the three files under `roms/` is read follows from `model`.

Nothing is asked of the server but to hand files over, and any static server will do — one is needed all the same, because a browser fetches neither modules nor snapshots from a file opened off the disc.

While the version begins with a zero, any release may break what the last one promised. Pin the exact version.
