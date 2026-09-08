const TEXT = new TextDecoder()

// A null pointer is the host saying it has no problem to report.
export function readProblem(module, at) {
  if (at == 0) {
    return null
  }

  const heap = module.HEAPU8

  let end = at
  while (heap[end] != 0) {
    end++
  }

  return TEXT.decode(heap.subarray(at, end))
}
