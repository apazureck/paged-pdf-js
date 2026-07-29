import { defineConfig, devices } from "@playwright/test";

const externalServer = process.env.PAGED_PDF_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: externalServer
    ? undefined
    : {
        command:
          "node ./node_modules/vite/bin/vite.js --config vite.demo.config.ts --host 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
});
