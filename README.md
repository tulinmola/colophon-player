# Colophon Player

## Prologue

A colophon is written to be read. A manuscript sealed in its case can be catalogued, dated and shelved, and the note at the end of it still means nothing until someone opens the book at that page.

The [emulator](https://github.com/tulinmola/colophon-emulator) opens the boxes of the 8-bit era: it runs Amstrad CPC and ZX Spectrum games, watches them from the inside, and writes the note their authors never wrote. This is where that note is read. The player carries the emulator into a page, so the machine runs beside the account of it and anyone can hold the two against each other.

It will not stop at watching. Colophon's machine is stepped one clock at a time and its memory can be read from outside without disturbing it, so a page that can run a CPC can also halt it halfway down a scanline and ask what the beam has drawn so far. The reading room is meant to have a workbench in it.

## The element

There is no player yet, only the page that will hold one. The shape it is built toward is a single tag:

```html
<colophon-player machine="cpc464" disc="foo.dsk"></colophon-player>
```

A machine to build, a disc or a snapshot to start it from, and a canvas showing what its monitor shows.

## Building

The page is npm's. The machine is not: it is C, compiled here by Emscripten from a checkout of the emulator standing beside this one.

```sh
npm install
npm run roms:fetch       # fetch the firmware, once
npm run emulator:build   # compile the machine into src/js/vendor
npm start                # serve the page
npm run build            # write the site to dist/
npm run dist             # write the distributable colophon-player.{js,css}
npm run check            # formatting, linting and the tests
npm run test:e2e         # the page driven in a browser, needing the firmware
```

`npm run emulator:build` reads the emulator from `../colophon-emulator`, or from wherever `EMULATOR_DIR` points, and writes a module named after the commit it was built from and the host that was built with it — so a page can always say which module it is running, a build from an unclean tree cannot answer to a commit's name, and an edit to the host under `emulator/` cannot inherit one. The module is committed, and rebuilt only when the emulator moves.

The firmware images are fetched by `npm run roms:fetch` and never committed. Both machines' are distributed under the permission Amstrad gave in 1999 — it bought Sinclair's computers along with the name, so the Spectrum's ROM is covered by it as the CPC's are.

## Documentation

The player's documentation lives in `docs/`, beside the code it describes, and is gathered and published by [The Colophon Project](https://github.com/tulinmola/colophon-project). [The debugger](docs/debugger/index.en.md) sets out the panels and what each one reads; [the CPC](docs/cpc.en.md) and [the Spectrum](docs/spectrum.en.md) are the machines it builds, and the elements that build them.

## Releasing

A release is cut from a clean, committed tree: one version bump, then the push.

```sh
npm version patch        # 0.1.0 -> 0.1.1  a fix, nothing new promised
npm version minor        # 0.1.0 -> 0.2.0  new work — and, while 0.x, breaking changes
npm version major        # 0.1.0 -> 1.0.0  the day the element's shape settles

git push --follow-tags   # push the bump commit and its tag together
```

`npm version` writes the new version into `package.json`, commits it and tags the commit `vX.Y.Z`, all in one motion — pick the one bump that fits and push. The pushed tag wakes the workflow, which builds `dist/colophon-player.{js,css}`, publishes them to npm with provenance binding the version to its commit, and attaches versioned copies to the GitHub release with their integrity hashes. The workflow authenticates by trusted publishing, so the repository keeps no tokens, and build output never enters it.

The install snippet in `docs/` names an exact version, and that pin travels with the bump: `npm version` rewrites it into the same commit, and refuses to begin if it can no longer find one to rewrite.

## License

MIT, like the rest of Colophon.
