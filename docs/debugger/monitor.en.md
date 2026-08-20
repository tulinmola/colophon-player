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
| `record`  | —       | Offers the mark at the heading's right that records the picture.             |

It bears the heading `Monitor` and draws once a frame, on the machine's own event.

## Recording

Press the round mark to begin and the square that takes its place to stop. Stopping writes the recording as a video in a format the browser can make. The heading and its mark stay outside it: only the monitor's picture is kept. A browser that cannot record a canvas leaves the mark disabled.

The recording is 384 by 272, the square-pixel size at which the element presents the monitor when `zoom` is `1`. Changing `zoom` changes the page and not the file.

## The window

The canvas is 768 by 272, cut from the 1024 by 312 the beam actually sweeps, at 208 across and 34 down. That is not a framing choice. It is the same window [the emulator crops its own screenshots to](../../emulator/command-line.en.md#the-picture), so a picture on the page and a picture written on the command line can be laid over one another and compared pixel for pixel — which is how the two are held to the same account.

The element presents the canvas at half its width, two samples to a displayed pixel, and the stylesheet turns smoothing off, so `zoom` enlarges without blurring.
