import { execFileSync, spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { tmpdir } from "node:os"

const ROOT = resolve(fileURLToPath(import.meta.url), "../.."),
  EMULATOR_DIR = resolve(ROOT, process.env.EMULATOR_DIR ?? "../colophon-emulator"),
  VENDOR_DIR = resolve(ROOT, "src/js/vendor"),
  HOST_DIR = resolve(ROOT, "emulator"),
  EXPORTS = resolve(HOST_DIR, "exports.json"),
  LAYOUT = resolve(HOST_DIR, "layout.c")

// The record and a file for each machine. Read from the directory so a
// machine added and left out of a list cannot be missing from the module.
function hostSources() {
  return readdirSync(HOST_DIR)
    .filter(name => name.endsWith(".c") && resolve(HOST_DIR, name) != LAYOUT)
    .map(name => resolve(HOST_DIR, name))
    .sort()
}

// Every file the module is built from, so that none of them can change under
// a name the last build already answered to.
function hostFiles() {
  const headers = readdirSync(HOST_DIR)
    .filter(name => name.endsWith(".h"))
    .map(name => resolve(HOST_DIR, name))
    .sort()

  return [EXPORTS, LAYOUT, ...hostSources(), ...headers]
}

function git(...args) {
  return execFileSync("git", ["-C", EMULATOR_DIR, ...args], { encoding: "utf8" }).trim()
}

// The host is this repository's and the machine is the emulator's, so the
// commit alone cannot tell two builds apart: a name that outlives an edit to
// player.c is a page unable to say which module it is running.
function hostDigest() {
  const digest = createHash("sha256")

  for (const path of hostFiles()) {
    digest.update(readFileSync(path))
  }

  return digest.digest("hex").slice(0, 7)
}

function emulatorVersion() {
  const commit = git("rev-parse", "--short", "HEAD"),
    // A build from uncommitted sources must not answer to a commit's name.
    clean = spawnSync("git", ["-C", EMULATOR_DIR, "diff", "--quiet", "HEAD", "--", "src"]).status,
    machine = clean == 0 ? commit : `${commit}-dirty`

  return `${machine}-${hostDigest()}`
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
    ...hostSources(),
    "-I",
    resolve(EMULATOR_DIR, "src"),
    "-std=c99",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-O3",
    // The record reads the processor's state four million times a second, and
    // the processor is another translation unit: 1.9% with this, 14.7%
    // without, measured over 600 frames.
    "-flto",
    "-s",
    "MODULARIZE=1",
    "-s",
    "EXPORT_ES6=1",
    "-s",
    "EXPORT_NAME=ColophonEmulator",
    "-s",
    "FILESYSTEM=0",
    // Growth is not the alternative: the page takes views onto this memory
    // once, and growth would detach them.
    "-s",
    "INITIAL_MEMORY=32MB",
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
