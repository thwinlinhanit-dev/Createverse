#!/usr/bin/env node
/**
 * cv-content — content validation CLI (task P0-08).
 * Usage: node packages/content-sdk/src/cli.ts [contentDir]
 * Default contentDir: <repo>/content
 * Exit code 1 when validation fails, so CI fails on invalid content.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validatePack } from "./validate.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(here, "..", "..", "..", "content");
const targetDir = process.argv[2] ?? defaultDir;

const result = validatePack(targetDir);

for (const error of result.errors) {
  console.error(`ERROR ${error.where}: ${error.message}`);
}
for (const warning of result.warnings) {
  console.warn(`WARN  ${warning.where}: ${warning.message}`);
}

if (!result.ok) {
  console.error(
    `content invalid: ${result.errors.length} error(s), ${result.warnings.length} warning(s) — ${targetDir}`,
  );
  process.exit(1);
}

console.info(
  `content valid: 0 errors, ${result.warnings.length} warning(s) — ${targetDir}`,
);
