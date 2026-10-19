---
title: The CPC's joystick
description: Joystick 0 drawn under the thumbs, for a screen that is touched and has neither keys nor a pad.
order: 11
---

`<colophon-cpc-joystick>` puts a CPC's joystick under the reader's thumbs. A telephone has no cursor keys and no gamepad, only glass, and this is the stick and the buttons drawn on it: a thumb on the circle steers, a thumb on a button fires.

```html
<colophon-cpc-joystick></colophon-cpc-joystick>
```

It takes no attributes. It is joystick 0, the one with matrix line 9 to itself; [joystick 1 is keys already](../cpc.en.md#the-joysticks). It is a CPC's alone: the Spectrum here has no joystick port, and no interface that adds one is fitted to it.

## The stick

The circle stands still and the thumb moves on it. The direction held is the one the thumb points from the circle's centre, cut into eight sectors of 45°: a thumb in a diagonal one holds both its directions, as a real stick closes two of its four switches there, and a thumb resting near the centre holds none.

A thumb that slides off the circle keeps steering until it is lifted, measured from the same centre, because glass has no rim to feel and a thumb drifts. One thumb steers at a time; a second laid on the circle while the first is down is ignored.

## The buttons

Fire 1 above Fire 2, in the manual's names and the same size. Fire 2 is the main button of an ordinary joystick: [CPCWiki's account of the connector](https://www.cpcwiki.eu/index.php/Connector:Digital_joystick) has most games reading Fire 2, a few reading Fire 1, and Spare read very rarely, the AMX mouse being one thing that does. Spare is not drawn: a button on glass is one more place for a thumb to land by mistake.

A button is held for as long as the thumb that pressed it stays down, wherever it slides.

## What it closes

The switches of line 9, the same ones the first gamepad, `joystick="cursors"` and [the keyboard panel](keyboard.en.md) close. A switch is closed the moment the thumb touches, whether the machine runs or stands, so a stopped machine can be stepped with a direction held. Letting go waits for a frame to be presented since the press, as [every key does](../cpc.en.md#the-keyboard), so a tap too quick for the firmware still reaches it.

A switch the machine holds is drawn filled, its arrow or its name dark on white, so a diagonal fills two arrows. What is drawn is what the machine holds rather than what the thumbs hold: a direction the first gamepad closes is filled here too, and a release still waiting for its frame stays filled until the frame comes.

What a thumb holds is let go when it lifts, and when the system takes the touch away — a call arriving, a gesture from the edge of the screen. Everything is let go when the element leaves the page or its machine reboots. Two hands on one switch are not counted: a direction held both here and on the first gamepad opens when the first of them lets go.

## On the page

The element is drawn wherever the page places it, on a screen that is touched or not; showing it only to a finger is the page's to decide. A mouse can work it as well, but one pointer cannot steer and fire at once.

A game that asks for a key before it reads the joystick still asks for one, and glass has none to give. A snapshot taken past that question is the way in.
