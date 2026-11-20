import { defineConfig, devices } from "@playwright/test";

const allBrowsers = process.env.PW_ALL_BROWSERS === "1";

export default defineConfig({
  testDir: "tests/e2e",
  // Alle Tests teilen einen Projektordner
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
    ...(allBrowsers
      ? [
          {
            name: "firefox",
            use: {
              ...devices["Desktop Firefox"],
              // headless unter Linux gibt es kein WebGL; die CI startet Firefox dort mit xvfb
              headless: process.env.PW_FIREFOX_HEADED !== "1",
              // WebGL auch mit Software-Rendering (ohne GPU) erlauben
              launchOptions: {
                firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
              },
            },
          },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : []),
  ],
  webServer: {
    command: "node tests/e2e/serve.ts --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
