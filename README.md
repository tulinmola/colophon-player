# Colophon Player

## Prologue

A colophon is written to be read. A manuscript sealed in its case can be catalogued, dated and shelved, and the note at the end of it still means nothing until someone opens the book at that page.

[Colophon](https://github.com/tulinmola/colophon-emulator) opens the boxes of the 8-bit era: it runs Amstrad CPC games, watches them from the inside, and writes the note their authors never wrote. This is where that note is read. The player carries the emulator into a page, so the machine runs beside the account of it and anyone can hold the two against each other.

It will not stop at watching. Colophon's machine is stepped one clock at a time and its memory can be read from outside without disturbing it, so a page that can run a CPC can also halt it halfway down a scanline and ask what the beam has drawn so far. The reading room is meant to have a workbench in it.

## The element

There is no player yet, only the page that will hold one. The shape it is built toward is a single tag:

```html
<colophon-player machine="cpc464" snapshot="foo.sna"></colophon-player>
```

A machine to build, a snapshot to start it from, and a canvas showing what its monitor shows.

## Building

The page is npm's. The machine is not: it is C, compiled here by Emscripten from a checkout of the emulator standing beside this one.

```sh
npm install
npm run roms:fetch       # fetch the firmware, once
npm run emulator:build   # compile the machine into src/js/vendor
npm start                # serve the page
npm run build            # write the site to dist/
npm run check            # formatting, linting and the tests
```

`npm run emulator:build` reads the emulator from `../colophon-emulator`, or from wherever `EMULATOR_DIR` points, and writes a module named after the commit it was built from — so a page can always say which machine it is running, and a build from an unclean tree cannot answer to a commit's name. The module is committed, and rebuilt only when the emulator moves.

A CPC 464 boots on the page and stops at its Ready prompt, which is the whole of it today. Those are the same pixels the emulator's own screenshot writes — all 208,896 of them, compared one by one against `build/emulator boot --machine cpc464 --no-double`.

## The machine

The player can do whatever the emulator can do that day, and the emulator is young. A CPC boots to its prompt, takes what is typed at it, and runs at the right speed. There is no disc controller yet, so a snapshot is the only way into a game. The sound chip keeps its registers and makes no sound. And a version 1 snapshot carries no CRTC counters, so a machine resumed from one restarts its frame instead of continuing mid-raster.

The firmware images are Amstrad's, distributable with emulators by the permission Amstrad gave in 1999. They are fetched, never committed.

## License

MIT, like the rest of Colophon.
