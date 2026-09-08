import { fileNameFrom } from "./file_name_from"

// A tape named in an element's attributes is read while the machine is being
// built, so a bad one stops the building rather than arriving half in.
export async function insertTape(machine, url, signal) {
  const response = await fetch(url, { signal }),
    bytes = new Uint8Array(await response.arrayBuffer()),
    name = fileNameFrom(url)

  if (!machine.tape.insert(bytes, name)) {
    throw new Error(`${url} is not a tape this machine can read: ${machine.tape.problem}`)
  }
}
