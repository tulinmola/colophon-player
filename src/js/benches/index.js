import { Cpc, Spectrum } from "../emulator"

const STORAGE_KEY = "colophon-benches"

const MACHINES = [
  { element: "colophon-cpc", models: Cpc.models, zoom: "1.5" },
  { element: "colophon-spectrum", models: Spectrum.models, zoom: "2" }
]

function write(kept) {
  const serialized = JSON.stringify(kept)

  localStorage.setItem(STORAGE_KEY, serialized)
}

function newBench(name, model) {
  const { element, zoom } = MACHINES.find(machine =>
    machine.models.some(entry => entry.model == model)
  )

  return {
    id: Date.now(),
    name,
    machine: { element, attributes: { model } },
    panels: [
      { element: "colophon-controls", attributes: {} },
      { element: "colophon-monitor", attributes: { zoom } }
    ]
  }
}

// Read afresh on every call: a list held across calls would write over a bench
// changed meanwhile in another tab.
function all() {
  const stored = localStorage.getItem(STORAGE_KEY)

  return JSON.parse(stored) ?? []
}

function find(id) {
  return all().find(bench => bench.id == id)
}

function add({ name, model }) {
  const kept = all(),
    bench = newBench(name, model)

  kept.push(bench)
  write(kept)

  return bench
}

function rename(id, name) {
  const kept = all(),
    bench = kept.find(standing => standing.id == id)

  bench.name = name
  write(kept)

  return bench
}

function remove(id) {
  const kept = all().filter(bench => bench.id != id)

  write(kept)
}

export default {
  models: MACHINES.flatMap(machine => machine.models),
  all,
  find,
  add,
  rename,
  remove
}
