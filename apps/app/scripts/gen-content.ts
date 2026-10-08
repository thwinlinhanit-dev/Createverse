import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack } from "@createverse/content-sdk";

/**
 * P1-04 content delivery: compile `content/` fresh and publish the bundles
 * where the app (and its service worker) can fetch them.
 *
 * Runs before `vite` in the app's `dev` and `build` scripts, so:
 * - bad content fails the build (`compilePack` writes nothing on validation
 *   failure — P1-04 acceptance: rejected at build);
 * - the app never serves a stale bundle: output is always recompiled from the
 *   current `content/` sources (P0-08 `content/bundles/` stays the committed
 *   review artifact; this directory is generated and git-ignored).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, ".."); // apps/app/
const contentRoot = path.resolve(appRoot, "..", "..", "content");
const outDir = path.resolve(appRoot, "public", "content");

const result = compilePack(contentRoot, outDir);
if (!result.ok) {
  for (const issue of result.errors) {
    console.error(`content error [${issue.where}]: ${issue.message}`);
  }
  process.exit(1);
}

// Manifest the service worker precaches at install so the current project
// keeps working offline after the first visit (ARCHITECTURE.md §6).
const manifest = {
  format: "createverse.content-manifest",
  version: 1 as const,
  bundles: result.files.map((file) => `/content/${file}`),
};
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);
console.info(`content bundles written: ${outDir} (${result.files.join(", ")})`);
