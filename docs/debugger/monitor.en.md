---
title: The monitor
description: The picture as a tube would present it, cropped to the window the emulator's own screenshots are cut to.
order: 2
---

`<colophon-monitor>` shows what the monitor showed: the beam's output as a tube presents it, borders and all. Nothing in it is a reconstruction of what a program meant to draw — it is the picture that left the machine.

```html
<colophon-monitor zoom="1.5"></colophon-monitor>
```

| Attribute | Default | Read                                                                         |
| --------- | ------- | ---------------------------------------------------------------------------- |
| `zoom`    | `1`     | Scales the picture on the page. It does not touch what is drawn or recorded. |

It bears the heading `Monitor` and draws once a frame, on the machine's own event.

The three dots at the heading's right offer the zoom and the recorder. The zoom the element follows where it stands: the canvas is presented at a new size and nothing is redrawn, so the menu stays open and a recording under way is not disturbed.

## Recording

`Start recording` stands under `Record` at the foot of the options; it begins, and `Stop recording`, which takes its place, ends it and writes the video in a format the browser can make. While it runs the three dots are red, so a recording is never left going unnoticed. Only the monitor's picture is kept: the heading and the options stay outside it. A browser that cannot record a canvas leaves the item disabled.

The recording is 384 by 272, the square-pixel size at which the element presents the monitor when `zoom` is `1`. Changing `zoom` changes the page and not the file.

## The window

The canvas is 768 by 272, cut from the 1024 by 312 the beam actually sweeps, at 208 across and 34 down. That is not a framing choice. It is the same window [the emulator crops its own screenshots to](../../emulator/command-line.en.md#the-picture), so a picture on the page and a picture written on the command line can be laid over one another and compared pixel for pixel — which is how the two are held to the same account.

The element presents the canvas at half its width, two samples to a displayed pixel, and the stylesheet turns smoothing off, so `zoom` enlarges without blurring.
