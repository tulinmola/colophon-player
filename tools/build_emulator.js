import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { tmpdir } from "node:os"

const ROOT = resolve(fileURLToPath(import.meta.url), "../.."),
  EMULATOR_DIR = resolve(ROOT, process.env.EMULATOR_DIR ?? "../colophon-emulator"),
  VENDOR_DIR = resolve(ROOT, "src/js/vendor"),
  EXPORTS = resolve(ROOT, "emulator/exports.json"),
  HOST = resolve(ROOT, "emulator/player.c"),
  LAYOUT = resolve(ROOT, "emulator/layout.c")

function git(...args) {
  return execFileSync("git", ["-C", EMULATOR_DIR, ...args], { encoding: "utf8" }).trim()
}

function emulatorVersion() {
  const commit = git("rev-parse", "--short", "HEAD"),
    // A build from uncommitted sources must not answer to a commit's name.
    clean = spawnSync("git", ["-C", EMULATOR_DIR, "diff", "--quiet", "HEAD", "--", "src"]).status

  return clean == 0 ? commit : `${commit}-dirty`
}

function machineSources() {
  const directory = resolve(EMULATOR_DIR, "src")

  return readdirSync(directory)
    .filter(name => name.endsWith(".c"))
    .map(name => resolve(directory, name))
}

// Built for WebAssembly and run under node: a struct's offsets belong to the
// target that laid it out, not to the machine doing the building.
function writeLayout(basename) {
  const prefix = resolve(tmpdir(), "colophon-layout-"),
    directory = mkdtempSync(prefix),
    program = resolve(directory, "layout.js")

  execFileSync("emcc", [
    LAYOUT,
    "-I",
    resolve(EMULATOR_DIR, "src"),
    "-std=c99",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-o",
    program
  ])

  const layout = execFileSync("node", [program], { encoding: "utf8" })
  rmSync(directory, { recursive: true })
  writeFileSync(resolve(VENDOR_DIR, `${basename}.layout.mjs`), layout)
}

if (!existsSync(resolve(EMULATOR_DIR, "src"))) {
  console.error(`no emulator at ${EMULATOR_DIR} — set EMULATOR_DIR to your checkout`)
  process.exit(1)
}

const basename = `colophon-emulator-${emulatorVersion()}`

console.log(`==> Building ${basename} from ${EMULATOR_DIR}`)
console.log(execFileSync("emcc", ["--version"], { encoding: "utf8" }).split("\n")[0])

mkdirSync(VENDOR_DIR, { recursive: true })
execFileSync(
  "emcc",
  [
    ...machineSources(),
    HOST,
    "-I",
    resolve(EMULATOR_DIR, "src"),
    "-std=c99",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-O3",
    "-s",
    "MODULARIZE=1",
    "-s",
    "EXPORT_ES6=1",
    "-s",
    "EXPORT_NAME=ColophonEmulator",
    "-s",
    "FILESYSTEM=0",
    "-s",
    "ENVIRONMENT=web",
    "-s",
    "SINGLE_FILE=1",
    "-s",
    `EXPORTED_FUNCTIONS=@${EXPORTS}`,
    "-s",
    "EXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU32",
    "-o",
    resolve(VENDOR_DIR, `${basename}.mjs`)
  ],
  { stdio: "inherit" }
)

writeLayout(basename)

console.log(`==> Wrote src/js/vendor/${basename}.{mjs,layout.mjs}`)
console.log("==> Update the imports in src/js/emulator/{module,layout}.js if the name changed")
