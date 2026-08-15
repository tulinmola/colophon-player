// The window the emulator crops its own screenshots to, and the reason the
// two can be compared pixel for pixel.
const CROP_LEFT = 208,
  CROP_TOP = 34,
  CROP_WIDTH = 768,
  CROP_HEIGHT = 272

const FRAMEBUFFER_WIDTH = 1024

export function createScreen(canvas) {
  canvas.width = CROP_WIDTH
  canvas.height = CROP_HEIGHT

  const context = canvas.getContext("2d"),
    image = context.createImageData(CROP_WIDTH, CROP_HEIGHT),
    pixels = new Uint32Array(image.data.buffer)

  return function draw(machine) {
    const framebuffer = machine.framebuffer,
      palette = machine.palette

    for (let line = 0; line < CROP_HEIGHT; line++) {
      let sample = (CROP_TOP + line) * FRAMEBUFFER_WIDTH + CROP_LEFT,
        pixel = line * CROP_WIDTH

      for (let column = 0; column < CROP_WIDTH; column++) {
        pixels[pixel++] = palette[framebuffer[sample++]]
      }
    }

    context.putImageData(image, 0, 0)
  }
}
