// The hashes, the terms and the reasoning are the emulator's: its own script
// holds the pins and the record of Amstrad's 1999 permission. Keeping a
// second copy of them here would only give them somewhere to drift apart.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const ROOT = resolve(fileURLToPath(import.meta.url), "../.."),
  EMULATOR_DIR = resolve(ROOT, process.env.EMULATOR_DIR ?? "../colophon-emulator"),
  ROMS_DIR = resolve(ROOT, "src/public/roms")

if (!existsSync(resolve(EMULATOR_DIR, "src"))) {
  console.error(`no emulator at ${EMULATOR_DIR} — set EMULATOR_DIR to your checkout`)
  process.exit(1)
}

execFileSync("sh", [resolve(EMULATOR_DIR, "tools/fetch-roms.sh")], { stdio: "inherit" })

const fetched = resolve(EMULATOR_DIR, "roms")

mkdirSync(ROMS_DIR, { recursive: true })
for (const name of readdirSync(fetched)) {
  if (name.endsWith(".rom")) {
    copyFileSync(resolve(fetched, name), resolve(ROMS_DIR, name))
  }
}

console.log(`roms are in ${ROMS_DIR}`)
