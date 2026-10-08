import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { noRawText } from "./scripts/eslint-rules/no-raw-text.mjs";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "coverage/**",
      "content/**/*.json",
      "**/*.json",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      // Node scripts (e.g. scripts/*.mjs) use Node globals.
      globals: globals.node,
    },
  },
  {
    files: ["**/sw.js"],
    languageOptions: {
      // Service worker globals (apps/app/public/sw.js — offline shell, P1-03).
      globals: globals.serviceworker,
    },
  },
  {
    files: ["**/*.ts", "**/*.mts", "**/*.cts", "**/*.tsx"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // Project rules (AGENT_OPERATING_RULES.md §6): TypeScript strict, no `any` without a comment.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    // P1-02 / ADR-0008: user-visible copy lives in packages/i18n catalogs and
    // renders through t("key"); raw strings in UI code fail the build.
    files: ["**/*.tsx"],
    plugins: {
      cv: { rules: { "no-raw-text": noRawText } },
    },
    rules: {
      "cv/no-raw-text": "error",
    },
  },
);
