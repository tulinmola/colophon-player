// Loaded into the audio thread on its own, so it imports nothing.

// Enough lead to cover the whole frames a page delivers its runs in, and room
// for what a page delivers after a stall.
const LEAD_SECONDS = 0.05,
  CAPACITY_SECONDS = 0.25,
  // A lead this far past its mark for this long is let go down to it, as
  // jsbeeb lets it go (ExcessLeadMs and PersistentExcessSeconds,
  // src/audio-latency.js, aa0a7d7, https://github.com/mattgodbolt/jsbeeb).
  EXCESS_SECONDS = 0.05,
  EXCESS_PATIENCE_SECONDS = 0.5

// Proportional on the lead smoothed over half a second. A sound card's crystal
// "is off by tens of parts per million, a bad one by a few hundred"
// (audio/audio_driver.c, d44a83afda, https://github.com/libretro/RetroArch);
// RetroArch steers by at most 0.5% (DEFAULT_RATE_CONTROL_DELTA, config.def.h)
// and jsbeeb's worklet by 0.05% (MaxAdjustFraction,
// src/web/audio-renderer.js), and this by 0.2%.
const SMOOTHING_SECONDS = 0.5,
  MAXIMUM_ADJUSTMENT = 0.002

// The levels come in tenths of a millivolt. Full scale stands above the
// loudest a machine here reaches — a Spectrum's speaker with both its bits up,
// 2.30V, risen from silence, and the tenth a band-limited step overshoots by.
const FULL_SCALE = 26000

// A socket carries its DC, and whatever is plugged into it blocks that: here
// below hearing.
const BLOCKED_BELOW_HERTZ = 5,
  POLE = Math.exp((-2 * Math.PI * BLOCKED_BELOW_HERTZ) / sampleRate)

class AmplifierProcessor extends AudioWorkletProcessor {
  #capacity = Math.ceil(CAPACITY_SECONDS * sampleRate)
  #channels = 1
  #ended = false
  #excessFor = 0
  #first = 0
  #held = 0
  #lead = Math.round(LEAD_SECONDS * sampleRate)
  #level = [0, 0]
  #peaks = [0, 0]
  #playing = false
  #previousInput = [0, 0]
  #previousOutput = [0, 0]
  #ring = new Float32Array(this.#capacity * 2)
  #smoothed = 0

  constructor() {
    super()
    this.port.onmessage = event => this.onMessage(event.data)
  }

  onMessage(message) {
    if (message.kind == "begin") {
      this.#channels = message.channels
      this.#held = 0
      this.#playing = false
      this.#smoothed = 0
      this.#excessFor = 0
    } else if (message.kind == "samples") {
      const { samples, length } = message,
        peaks = this.#peaks.slice(0, this.#channels),
        returned = { samples, adjustment: this.#adjustment(), peaks }

      this.#peaks.fill(0)
      this.#take(samples, length)
      this.port.postMessage(returned, [samples.buffer])
    } else if (message.kind == "end") {
      this.#ended = true
    }
  }

  // A gap, where nothing was delivered, holds the last level, which the
  // coupling then lets fall to silence. A processor that has not ended is
  // kept running whether or not anything still plays through it.
  process(_inputs, outputs) {
    const [left, right] = outputs[0]

    for (let index = 0; index < left.length; index++) {
      if (!this.#playing && this.#held >= this.#lead) {
        this.#playing = true
        this.#join()
      } else if (this.#playing && this.#held == 0) {
        this.#playing = false
      }

      if (this.#playing) {
        this.#level[0] = this.#ring[this.#first * 2]
        this.#level[1] = this.#ring[this.#first * 2 + 1]
        this.#first = (this.#first + 1) % this.#capacity
        this.#held--
      }

      left[index] = this.#couple(0)
      right[index] = this.#couple(1)
      this.#peaks[0] = Math.max(this.#peaks[0], Math.abs(left[index]))
      this.#peaks[1] = Math.max(this.#peaks[1], Math.abs(right[index]))
    }

    this.#steer(left.length)
    return !this.#ended
  }

  // A machine with one channel is heard in both ears. What finds no room is
  // dropped.
  #take(samples, length) {
    const channels = this.#channels,
      frames = length / channels

    for (let frame = 0; frame < frames && this.#held < this.#capacity; frame++) {
      const at = ((this.#first + this.#held) % this.#capacity) * 2

      this.#ring[at] = samples[frame * channels]
      this.#ring[at + 1] = samples[frame * channels + channels - 1]
      this.#held++
    }
  }

  // A series capacitor into a load: one zero at DC and one pole.
  #couple(channel) {
    const level = this.#level[channel] / FULL_SCALE,
      coupled = level - this.#previousInput[channel] + POLE * this.#previousOutput[channel]

    this.#previousInput[channel] = level
    this.#previousOutput[channel] = coupled

    return coupled
  }

  // Across a seam — sound resumed after a gap, or an excess let go — the
  // coupling is told the level was already the one that follows, so the jump
  // is never heard as a step.
  #join() {
    this.#previousInput[0] = this.#ring[this.#first * 2] / FULL_SCALE
    this.#previousInput[1] = this.#ring[this.#first * 2 + 1] / FULL_SCALE
  }

  // The excess is measured on the smoothed lead, so that one delivery is not
  // taken for a lead kept, and let go from what is held now.
  #steer(frames) {
    const weight = frames / (SMOOTHING_SECONDS * sampleRate),
      excess = this.#held - this.#lead

    this.#smoothed += (this.#held - this.#smoothed) * weight

    if (this.#smoothed <= this.#lead + EXCESS_SECONDS * sampleRate || excess <= 0) {
      this.#excessFor = 0
      return
    }

    this.#excessFor += frames

    if (this.#excessFor >= EXCESS_PATIENCE_SECONDS * sampleRate) {
      this.#first = (this.#first + excess) % this.#capacity
      this.#held = this.#lead
      this.#smoothed = this.#lead
      this.#excessFor = 0
      this.#join()
    }
  }

  // Short of the lead the page is asked for more, past it for less.
  #adjustment() {
    const error = (this.#lead - this.#smoothed) / this.#lead,
      bounded = Math.max(-1, Math.min(1, error))

    return 1 + bounded * MAXIMUM_ADJUSTMENT
  }
}

registerProcessor("colophon-amplifier", AmplifierProcessor)
