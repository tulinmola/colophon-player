import { defineConfig } from "@playwright/test"

const PORT = 5173

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  // Waited for at the module: a test builds its own page and needs no bench.
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/js/index.js`,
    reuseExistingServer: true
  }
})
