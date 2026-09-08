// A canvas holds its pixels as bytes in red, green, blue, alpha order, so a
// word written into one lands blue end first on a little-endian machine.
export function readColours(rgb, codes) {
  const palette = new Uint32Array(codes),
    greys = new Uint32Array(codes),
    cssColours = new Array(codes)

  for (let code = 0; code < codes; code++) {
    const value = rgb(code),
      red = (value >> 16) & 0xff,
      green = (value >> 8) & 0xff,
      blue = value & 0xff,
      // Rec. 601 luma, so a colour keeps its brightness when it loses its hue.
      luma = Math.round(0.299 * red + 0.587 * green + 0.114 * blue)

    palette[code] = 0xff000000 | (blue << 16) | (green << 8) | red
    greys[code] = 0xff000000 | (luma << 16) | (luma << 8) | luma
    cssColours[code] = `#${value.toString(16).padStart(6, "0")}`
  }

  return { palette, greys, cssColours }
}
