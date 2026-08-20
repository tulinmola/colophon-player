---
title: The monitor
description: The picture as a tube would present it, cropped to the window the emulator's own screenshots are cut to.
order: 2
---

`<colophon-monitor>` shows what the monitor showed: the beam's output as a tube presents it, borders and all. Nothing in it is a reconstruction of what a program meant to draw — it is the picture that left the machine.

```html
<colophon-monitor zoom="1.5"></colophon-monitor>
```

| Attribute | Default | Read                                                             |
| --------- | ------- | ---------------------------------------------------------------- |
| `zoom`    | `1`     | Scales the picture on the page. It does not touch what is drawn. |

It draws once a frame, on the machine's own event, and it carries no heading of its own: the element is a canvas and nothing else.

## The window

The canvas is 768 by 272, cut from the 1024 by 312 the beam actually sweeps, at 208 across and 34 down. That is not a framing choice. It is the same window [the emulator crops its own screenshots to](../../emulator/command-line.en.md#the-picture), so a picture on the page and a picture written on the command line can be laid over one another and compared pixel for pixel — which is how the two are held to the same account.

The element presents the canvas at half its width, two samples to a displayed pixel, and the stylesheet turns smoothing off, so `zoom` enlarges without blurring.
