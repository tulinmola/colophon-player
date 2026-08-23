// Run twice by npm: `preversion` passes --check, before package.json is
// touched, so a release that would ship a stale pin stops while the tree is
// still clean; `version` then rewrites the pins into the release commit, the
// new version already being in package.json by the time it fires.
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const CHECKING = process.argv.includes("--check"),
  ROOT = resolve(fileURLToPath(import.meta.url), "../.."),
  DOCS_DIR = resolve(ROOT, "docs"),
  PIN = /colophon-player@[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?/gu

function markdownFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      const nested = markdownFiles(path)
      files.push(...nested)
    } else if (entry.name.endsWith(".md")) {
      files.push(path)
    }
  }

  return files
}

const manifestSource = readFileSync(resolve(ROOT, "package.json"), "utf8"),
  manifest = JSON.parse(manifestSource),
  pin = `colophon-player@${manifest.version}`

let pinned = 0,
  rewritten = 0

for (const path of markdownFiles(DOCS_DIR)) {
  const before = readFileSync(path, "utf8"),
    found = before.match(PIN)

  if (!found) {
    continue
  }

  pinned += found.length

  if (CHECKING) {
    continue
  }

  const after = before.replace(PIN, pin)

  if (after != before) {
    writeFileSync(path, after)
    rewritten += found.length
    console.log(`${path.slice(ROOT.length + 1)} now reads ${pin}`)
  }
}

// A restructured doc must break the release rather than ship a pin naming a
// version nobody published.
if (pinned == 0) {
  console.error(
    "no colophon-player@version found under docs/ — the install snippet moved or changed shape"
  )
  process.exit(1)
}

if (CHECKING) {
  console.log(`${pinned} pin${pinned == 1 ? "" : "s"} under docs/`)
} else {
  console.log(`${pinned} pin${pinned == 1 ? "" : "s"} at ${pin}, ${rewritten} rewritten`)
}
