---
title: The volume
description: The panel where a reader turns a machine up or down, with a meter for each channel it sounds.
order: 3
---

Every machine is [heard by itself](../cpc.en.md#the-sound), with nothing placed inside it, and `<colophon-volume>` is where its reader turns it up or down: a fader for the machine element's `volume`, and a meter for each channel the machine sounds. It has no attributes of its own, since what it shows is the machine's, and any number of them may stand in one machine, each showing the same sound.

```html
<colophon-cpc model="cpc6128" volume="-12">
  <colophon-volume></colophon-volume>
</colophon-cpc>
```

It bears the heading `Volume`, and nothing beside it: the fader and the meters stand in its body. It is the volume of what the page plays, and not [a CPC's own VOLUME control](../cpc.en.md#the-sound), which turns only a loudspeaker that is not heard here. What each machine sounds is its own — [a CPC's stereo socket](../cpc.en.md#the-sound), [a Spectrum's speaker](../spectrum.en.md#the-sound) — and so is [when it is heard at all](../cpc.en.md#when-the-machine-is-heard).

## The fader

The fader is in decibels, as an amplifier's is and as [MAME's](https://github.com/mamedev/mame/blob/3298f2373e/src/frontend/mame/ui/ui.cpp) and [RetroArch's](https://github.com/libretro/RetroArch/blob/98860742b6/config.def.h) are, because equal steps of a fader in plain amplitude are not heard as equal steps. Its foot reads `Off` and is silence. It takes effect when the fader is let go, and eases into its new level over a few hundredths of a second, since a change of level made at once is a step in the wave and is heard as a click. The fader writes the machine element's `volume`, and a page may write it too. Either is followed where the machine stands: nothing is rebuilt, and the sound and the meters carry on through the change. While the machine is muted the fader reads `Muted` and cannot be moved. A value above the head is played and read as written, with the fader at its head; one below the foot is silence and reads `Off`, as the foot does. On a page that cannot play sound at all, the fader is disabled at its foot and reads `Off`.

`0` is the machine as it sounds, and full scale is 2.6V, above the loudest either machine makes: a Spectrum's speaker with both its bits set, 2.30V, risen from silence, overshoots by about a tenth on the way. A CPC playing one channel alone is therefore quiet, about 18dB below full scale, as its socket is beside a modern recording, and the fader's head, `+12dB`, lifts it to 6dB below. Above `0` a loud machine can be lifted past full scale, where the reader's speakers clip it; the meters read before the volume and do not show it.

## The meters

A meter stands under the fader for each channel the machine sounds: `Left` and `Right` for a CPC, one `Mono` for a Spectrum. Each reads what is played before the volume, so a machine turned down, or turned off, is still seen to sound. They read from −60dB to full scale and rise at once, and fall back 20dB in 1.7 seconds, as the digital peak meter of [IEC 60268-18](https://en.wikipedia.org/wiki/Peak_programme_meter) does. They read what was played after the direct current is blocked, so a level held still reads nothing, as it is heard as nothing.

The meters move as the machine delivers its sound, once a frame. When the machine stops, or anything else silences it, they drop to the floor at once: there is nothing after the last frame to let them fall.
