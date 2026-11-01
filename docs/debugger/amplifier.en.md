---
title: The amplifier
description: What the machine's sound is plugged into — a volume control and a meter for each channel — and when the machine is heard at all.
order: 3
---

`<colophon-amplifier>` is what the machine's sound is plugged into. [The 6128's manual](https://archive.org/details/amstrad-cpc-6128-user-manual) tells its owner, in its first chapter, that "the sound can also be fed to the auxiliary input socket of your stereo system, using the socket on the computer marked STEREO", and this stands where that system stood: it takes what the machine puts out, blocks the direct current the socket carries, sets the volume, and plays it through the reader's own speakers. A machine with no amplifier inside it is not heard, as a monitor is not seen without `<colophon-monitor>`, and a machine has one amplifier: a second beside it takes nothing to play.

```html
<colophon-amplifier volume="-12"></colophon-amplifier>
```

| Attribute | Default | Read                                                                                                       |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `volume`  | `0`     | In decibels: `0` is the machine as it sounds, `12` the fader's head, and `-60` its foot, which is silence. |

It bears the heading `Amplifier`, and nothing beside it: the volume and the meters are what an amplifier holds, so they stand in its body. What each machine sounds into it is the machine's own: [a CPC's stereo socket](../cpc.en.md#the-sound), [a Spectrum's speaker](../spectrum.en.md#the-sound).

## The volume

`Volume` is a fader in decibels, as an amplifier's is and as [MAME's](https://github.com/mamedev/mame/blob/3298f2373e/src/frontend/mame/ui/ui.cpp) and [RetroArch's](https://github.com/libretro/RetroArch/blob/98860742b6/config.def.h) are, because equal steps of a fader in plain amplitude are not heard as equal steps. Its foot reads `Off` and is silence. It takes effect when the fader is let go, and eases into its new level over a few hundredths of a second, since a change of level made at once is a step in the wave and is heard as a click. The fader writes `volume`, and a page may write it too. Either is followed where the amplifier stands: nothing is rebuilt, and the sound and the meters carry on through the change. A value above the head is played and read as written, with the fader at its head; one below the foot is silence and reads `Off`, as the foot does.

`0` is the machine as it sounds, and full scale is 2.6V, above the loudest either machine makes: a Spectrum's speaker with both its bits set, 2.30V, risen from silence, overshoots by about a tenth on the way. A CPC playing one channel alone is therefore quiet, about 18dB below full scale, as its socket is beside a modern recording, and the fader's head, `+12dB`, lifts it to 6dB below. Above `0` a loud machine can be lifted past full scale, where the reader's speakers clip it; the meters read before the volume and do not show it.

## The meters

A meter stands under the fader for each channel the machine sounds: `Left` and `Right` for a CPC, one `Mono` for a Spectrum. Each reads what is played before the volume, so a machine turned down, or turned off, is still seen to sound. They read from −60dB to full scale and rise at once, and fall back 20dB in 1.7 seconds, as the digital peak meter of [IEC 60268-18](https://en.wikipedia.org/wiki/Peak_programme_meter) does. They read what was played after the direct current is blocked, so a level held still reads nothing, as it is heard as nothing.

The meters move as the machine delivers its sound, once a frame. When the machine stops, or anything else silences it, they drop to the floor at once: there is nothing after the last frame to let them fall.

## When the machine is heard

A page may make no sound until its reader has done something on it, so the machine is heard from the first key pressed on it, or the first press anywhere inside it, on a panel as much as on the picture, which counts as it is let go. A page woken is woken whole, for every machine on it, one built afterwards included.

A machine is then heard while it runs at the speed the hardware ran, and only then. Stopped, or stepped by an instruction, a line, a row or a frame, it is silent, because a stop is a moment and not a sound; stepping over a call or out of one lets it run until the call returns, and that run is heard like any other. Stood in the past, stepped back or profiled it is silent, because what [the record](record.en.md) runs again to get there was heard once already; and run faster than it ran it is silent, because it would be heard at another pitch.

It is heard about a twentieth of a second after the machine made it: the page runs the machine a frame at a time, and the sound is held that far ahead of the speakers so that the frames are heard as one sound and not as a frame's sound at a time. A page served without a secure context has no way of playing it; there the fader is disabled and the machine is silent.
