import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCss } from "@createverse/design-tokens";
import { componentCss, fullCss } from "@createverse/ui";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, ".."); // apps/app/
const publicDir = path.resolve(appRoot, "public");

mkdirSync(publicDir, { recursive: true });
writeFileSync(path.join(publicDir, "tokens.css"), generateCss(), "utf8");
writeFileSync(path.join(publicDir, "components.css"), componentCss(), "utf8");
writeFileSync(path.join(publicDir, "app.css"), fullCss(), "utf8");
console.info(`css written: ${publicDir}`);
