import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "ai/evals/**/*.test.ts",
      "apps/*/src/**/*.test.{ts,tsx}",
      "apps/*/test/**/*.test.{ts,tsx}",
      "backend/src/**/*.test.ts",
      "backend/test/**/*.test.ts",
    ],
    environment: "node",
    reporters: ["default"],
  },
});
