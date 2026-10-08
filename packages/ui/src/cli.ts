import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPreviewPage } from "./preview.ts";

/**
 * `pnpm ui:preview` — regenerate `packages/ui/preview/index.html`.
 * The page is committed so it can be opened directly; a test asserts it is
 * never stale (packages/ui/test/ui.test.ts).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "..", "preview", "index.html");

mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, renderPreviewPage(), "utf8");
console.info(`preview written: ${path.normalize(target)}`);
