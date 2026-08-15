import { defineConfig } from "vite"

export default defineConfig(function () {
  return {
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
    build: {
      outDir: "../dist",
      minify: false,
      emptyOutDir: true,
      target: "es2022",
      assetsInlineLimit: 0
    }
  }
})
