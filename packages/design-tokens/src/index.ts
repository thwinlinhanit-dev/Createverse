export * from "./contrast.ts";

import presetsJson from "./presets.json";
import tokensJson from "./tokens.json";

/**
 * Design tokens — DESIGN_SYSTEM.md §2.
 * Tokens live as JSON, are compiled to CSS variables (`--cv-*`), and components use
 * semantic tokens only, never raw values (§10). Stage presets override tokens via a
 * `data-stage` attribute on the app root. Phase 1 ships one light theme.
 */

export const tokens = tokensJson;
export const presets = presetsJson;

export interface StagePreset {
  readonly fontSizeBody: string;
  readonly fontSizeTitle: string;
  readonly fontSizeSmall: string;
  readonly lineHeight: number;
  readonly touchTarget: number;
}

export type StageName = keyof typeof presets;

export const STAGE_NAMES = Object.keys(presets) as StageName[];

export function resolvePreset(stage: string): StagePreset {
  if (!(stage in presets)) {
    throw new Error(`unknown stage preset: ${stage}`);
  }
  return presets[stage as StageName];
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function flatten(
  value: Record<string, unknown>,
  prefix: readonly string[],
  out: Map<string, string | number>,
): void {
  for (const [key, child] of Object.entries(value)) {
    const path = [...prefix, kebab(key)];
    if (child !== null && typeof child === "object") {
      flatten(child as Record<string, unknown>, path, out);
    } else if (typeof child === "string" || typeof child === "number") {
      out.set(path.join("-"), child);
    }
  }
}

/**
 * Compile the token JSON to CSS custom properties.
 * Base tokens on `:root`; stage presets on `[data-stage="..."]`.
 */
export function generateCss(): string {
  const vars = new Map<string, string | number>();
  flatten(tokensJson as unknown as Record<string, unknown>, [], vars);

  // DESIGN_SYSTEM.md §2.2: the font stack token is `--cv-font`, not `--cv-font-family`.
  const family = vars.get("font-family");
  vars.delete("font-family");
  if (typeof family === "string") vars.set("font", family);

  const baseLines = [...vars.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  --cv-${name}: ${value};`);

  const presetBlocks = STAGE_NAMES.map((stage) => {
    const preset = resolvePreset(stage);
    const lines = [
      `  --cv-font-size-body: ${preset.fontSizeBody};`,
      `  --cv-font-size-title: ${preset.fontSizeTitle};`,
      `  --cv-font-size-small: ${preset.fontSizeSmall};`,
      `  --cv-line-height: ${preset.lineHeight};`,
      `  --cv-touch-target: ${preset.touchTarget}px;`,
    ];
    return `[data-stage="${stage}"] {\n${lines.join("\n")}\n}`;
  });

  return [":root {", ...baseLines, "}", ...presetBlocks].join("\n") + "\n";
}
