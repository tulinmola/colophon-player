import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(fileURLToPath(import.meta.url), "../src"),
  BENCHES = resolve(ROOT, "benches")

// Read from the directory: a bench left out of a list would still be served in
// development, and be missing from the build.
function pages() {
  const benches = readdirSync(BENCHES)
    .filter(name => name.endsWith(".html"))
    .map(name => resolve(BENCHES, name))

  return [resolve(ROOT, "index.html"), ...benches]
}

export default defineConfig(function ({ mode }) {
  const build = {
    outDir: "../dist",
    minify: false,
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0
  }

  if (mode == "dist") {
    build.lib = {
      entry: "colophon-player.js",
      formats: ["es"],
      fileName: "colophon-player",
      cssFileName: "colophon-player"
    }
  } else {
    build.rollupOptions = { input: pages() }
  }

  return {
    publicDir: mode != "dist",
    root: "./src",
    envDir: "../",
    envPrefix: "APP_",
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "sass:math";
            @use "sass:color";
            @use "sass:list";
            @use "/css/_settings.scss" as *;
          `
        }
      }
    },
    build
  }
})
