#!/usr/bin/env node
/**
 * cv-content — content toolchain CLI (task P0-08).
 *
 * Usage:
 *   node packages/content-sdk/src/cli.ts [validate] [contentDir]
 *   node packages/content-sdk/src/cli.ts build    [contentDir] [outDir]
 *   node packages/content-sdk/src/cli.ts schemas  [contentDir]
 *
 * Default contentDir: <repo>/content
 * Exit code 1 when validation or compilation fails, so CI fails on bad content.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compilePack } from "./compile.ts";
import { writeJsonSchemas } from "./jsonSchema.ts";
import { validatePack } from "./validate.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(here, "..", "..", "..", "content");

const argv = process.argv.slice(2);
const command = argv[0] === "build" || argv[0] === "schemas" || argv[0] === "validate"
  ? (argv[0] as "build" | "schemas" | "validate")
  : "validate";
const rest = command === argv[0] ? argv.slice(1) : argv;
const targetDir = rest[0] ?? defaultDir;

function report(errors: readonly { where: string; message: string }[], warnings: readonly { where: string; message: string }[]): void {
  for (const error of errors) console.error(`ERROR ${error.where}: ${error.message}`);
  for (const warning of warnings) console.warn(`WARN  ${warning.where}: ${warning.message}`);
}

if (command === "validate") {
  const result = validatePack(targetDir);
  report(result.errors, result.warnings);
  if (!result.ok) {
    console.error(
      `content invalid: ${result.errors.length} error(s), ${result.warnings.length} warning(s) — ${targetDir}`,
    );
    process.exit(1);
  }
  console.info(
    `content valid: 0 errors, ${result.warnings.length} warning(s) — ${targetDir}`,
  );
} else if (command === "build") {
  const outDir = rest[1] ?? path.join(targetDir, "bundles");
  const result = compilePack(targetDir, outDir);
  report(result.errors, result.warnings);
  if (!result.ok) {
    console.error(`content build failed: ${result.errors.length} error(s) — ${targetDir}`);
    process.exit(1);
  }
  console.info(
    `bundles built: ${result.files.length} file(s) for ` +
      `${new Set(result.bundles.map((b) => b.locale)).size} locale(s) × ` +
      `${new Set(result.bundles.map((b) => b.stage)).size} stage(s) — ${outDir}`,
  );
} else {
  const outDir = path.join(targetDir, "schemas");
  const files = writeJsonSchemas(outDir);
  console.info(`json schemas written: ${files.length} file(s) — ${outDir}`);
}
