import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./client-tests",
  testMatch: "mock.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "/tmp/product-test/base-mock",
  use: {
    baseURL: "http://127.0.0.1:18788",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    command: "bun run dev:mock",
    url: "http://127.0.0.1:18788",
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
