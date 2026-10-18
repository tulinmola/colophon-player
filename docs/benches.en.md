---
title: The benches
description: Machines a reader sets up on the page itself, kept in the browser they were made in.
order: 4
---

A bench is a machine set out for study: a board of one model, and the panels standing around it. A reader makes their own on the page itself, and the browser keeps them.

```html
<colophon-benches></colophon-benches>
```

`<colophon-benches>` holds the page: the list of benches while none is open, and the bench once one is. The bench itself is a `<colophon-bench>`, holding one bench named by its number in `bench`, and knowing nothing of the list that placed it. A number means something only in the browser that made the bench, which is why it is the list that places one, having found it among the benches this browser keeps.

## Making one

The `+` beside the heading asks for a name and a machine, and the platform carries the form: Escape or Cancel abandons it, Create commits it. A name must say something, so one made of nothing but blank space is refused.

It opens at once, on the machine it was made on, with [the controls](debugger/controls.en.md) and [the monitor](debugger/monitor.en.md) and nothing else. Its name stands in its heading and in the browser's tab.

## Renaming one

The pencil beside the name opens the same form again, and Save renames the bench. The machine is shown there but cannot be changed. Renaming leaves the machine as it was, running or stopped, where it stood.

A bench is kept as it was made and named: what is done to it once open — a zoom, a stop — is gone when it is opened again.

## Removing one

The cross beside a bench in the list removes it, once the browser has asked by name whether to and been answered yes. A removed bench's number is never given to another, so an address kept for it shows the list instead.

## Where they are kept

In the browser's own storage for the page's origin — its scheme, host and port — and nowhere else: nothing about a bench leaves the browser. Another browser, another origin, or this one with its data cleared, keeps none.

A bench is opened at the page's own address with `?bench=` and the bench's number after it, so it can be bookmarked or opened beside another. A browser that keeps no bench by that number shows its list instead.

## The firmware

A bench builds its machine as any page does, so the firmware is looked for in `/roms` at the root of the site, as [the CPC](cpc.en.md) and [the Spectrum](spectrum.en.md) set out.
