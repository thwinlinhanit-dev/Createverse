import { defineConfig, devices } from "@playwright/test";

/**
 * P1-13/P1-14 — accessibility + journey suites (TESTING.md §8, §9).
 *
 * Two servers under test: the real dev app (`pnpm dev` regenerates CSS and
 * content before vite, /api proxied same-origin) and the real API
 * (`backend/src/serve.ts --e2e`: fresh SQLite per run, raised rate limits).
 * The app runs on the localhost origin because WebAuthn RP IDs are hostnames.
 *
 * Projects: `chromium` (desktop) runs the axe + auth suites; `phone` and
 * `tablet` run the child journey (TESTING.md §8: "mobile and tablet
 * viewports"). Keep `pnpm check` browser-free — CI runs `pnpm test:e2e`
 * as its own job.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI === "true",
  retries: process.env.CI === "true" ? 1 : 0,
  reporter: process.env.CI === "true" ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node backend/src/serve.ts --e2e",
      url: "http://127.0.0.1:8787/api/v1/health",
      reuseExistingServer: process.env.CI !== "true",
      timeout: 60_000,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5173",
      reuseExistingServer: process.env.CI !== "true",
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      testIgnore: /journey\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "phone",
      testMatch: /journey\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet",
      testMatch: /journey\.spec\.ts/,
      // Chromium + a tablet-sized touch viewport (Playwright's iPad
      // descriptors default to WebKit, which this suite does not install).
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 1366 },
        hasTouch: true,
      },
    },
  ],
});
