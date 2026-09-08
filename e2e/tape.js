// A .tap is bare blocks, each opening with the two bytes saying how many
// follow: the flag, the bytes themselves, and the checksum they exclusive-or
// to. A flag of 255 makes this the headerless block a loader asks for.
export function headerlessTap(bytes) {
  const flag = 0xff,
    length = bytes.length + 2

  let checksum = flag
  for (const byte of bytes) {
    checksum ^= byte
  }

  return [length & 0xff, length >> 8, flag, ...bytes, checksum]
}

// A .tzx opens with a signature and a version, and names every block by an
// identifying byte. &10 is a block at the Spectrum ROM's timings, and &2A is
// the mark a multiload puts between its parts. A CPC's reader takes the file
// — the signature is all it asks of one — but no CPC firmware will decode a
// block timed for the other machine.
export function multiloadTzx(parts) {
  const image = [...[..."ZXTape!"].map(character => character.charCodeAt(0)), 0x1a, 1, 13]

  for (let index = 0; index < parts.length; index++) {
    if (index > 0) {
      image.push(0x2a, 0, 0, 0, 0)
    }

    const block = headerlessTap(parts[index]).slice(2),
      pause = 100

    image.push(0x10, pause & 0xff, pause >> 8, block.length & 0xff, block.length >> 8, ...block)
  }

  return image
}

export function insertTape(element, image, name = "test.tap") {
  return element.evaluate(
    (host, [bytes, given]) => host.machine.tape.insert(new Uint8Array(bytes), given),
    [image, name]
  )
}

export function deckOf(element) {
  return element.evaluate(host => ({
    loaded: host.machine.tape.loaded,
    playing: host.machine.tape.playing,
    name: host.machine.tape.name,
    length: host.machine.tape.length,
    at: host.machine.tape.at,
    problem: host.machine.tape.problem
  }))
}
