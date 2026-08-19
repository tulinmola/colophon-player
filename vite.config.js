import { defineConfig } from "vite"

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
