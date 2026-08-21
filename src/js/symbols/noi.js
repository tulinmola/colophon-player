// The linker defines s_<area> and l_<area> for every area, and .__. for its
// own pair. An l_ is a length, not an address.
const AREA = /^(?:\.__\.|[sl]_)/u

const DEFINITION = /^DEF\s+(?<name>\S+)\s+(?<address>\S+)$/u

// sdld writes this for NoICE under -j, one definition a line.
// https://manpages.ubuntu.com/manpages/bionic/man1/sdld.1.html
export function readNoice(lines) {
  const first = lines.find(line => line.trim())

  if (!first?.startsWith("DEF ")) {
    return null
  }

  const defined = []

  for (const line of lines) {
    const definition = DEFINITION.exec(line)

    if (definition && !AREA.test(definition.groups.name)) {
      defined.push({ name: definition.groups.name, address: Number(definition.groups.address) })
    }
  }

  return defined
}
