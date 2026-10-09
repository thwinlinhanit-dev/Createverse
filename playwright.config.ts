import { defineConfig, devices } from "@playwright/test";

/**
 * P1-13 — Accessibility baseline (TESTING.md §9: "axe via Playwright in CI").
 *
 * The suite drives the real app dev server (`pnpm dev` regenerates CSS and
 * content before starting vite) and runs axe against key screens per language
 * and stage preset. Keep this separate from `pnpm check` (vitest): Playwright
 * needs a browser download, so CI runs it as its own step.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI === "true",
  retries: process.env.CI === "true" ? 1 : 0,
  reporter: process.env.CI === "true" ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: process.env.CI !== "true",
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
