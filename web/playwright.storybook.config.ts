import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./stories/tests",
  testMatch: "**/*.spec.ts",
  timeout: 600_000,
  workers: 1,
  outputDir: "/tmp/open-base-storybook-test-results",
  reporter: "list",
  use: {
    reducedMotion: "reduce",
    baseURL: "http://127.0.0.1:6007",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "vp exec storybook dev --ci --host 127.0.0.1 --port 6007 --no-open --disable-telemetry",
    url: "http://127.0.0.1:6007/index.json",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
})
