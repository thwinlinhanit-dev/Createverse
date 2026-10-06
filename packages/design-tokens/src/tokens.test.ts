import { describe, expect, it } from "vitest";
import { contrastRatio, generateCss, resolvePreset, STAGE_NAMES, tokens } from "./index.ts";

const c = tokens.color;

describe("color contrast (DESIGN_SYSTEM.md §2, §8)", () => {
  const cases: ReadonlyArray<readonly [string, string, string, number]> = [
    ["text on bg", c.text, c.bg, 4.5],
    ["text on surface", c.text, c.surface, 4.5],
    ["textMuted on bg", c.textMuted, c.bg, 4.5],
    ["textMuted on surfaceAlt", c.textMuted, c.surfaceAlt, 4.5],
    ["primary on bg", c.primary, c.bg, 4.5],
    ["onPrimary on primary", c.onPrimary, c.primary, 4.5],
    ["onAccent on accent", c.onAccent, c.accent, 4.5],
    ["white on success", c.onPrimary, c.success, 4.5],
    ["white on danger", c.onPrimary, c.danger, 4.5],
    ["white on info", c.onPrimary, c.info, 4.5],
    ["warningText on bg", c.warningText, c.bg, 4.5],
    ["info on bg", c.info, c.bg, 4.5],
    ["border on bg (controls)", c.border, c.bg, 3],
    ["border on surface (controls)", c.border, c.surface, 3],
    ["focusRing on bg", c.focusRing, c.bg, 3],
    ["stress compression on bg", c.stressCompression, c.bg, 3],
    ["stress tension on bg", c.stressTension, c.bg, 3],
  ];

  for (const [name, fg, bg, minimum] of cases) {
    it(`${name} meets ${minimum}:1`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minimum);
    });
  }
});

describe("stage presets", () => {
  it("exposes the four Phase 1 presets", () => {
    expect(STAGE_NAMES).toEqual(["junior", "explorer", "maker", "parent"]);
  });

  it("gives Junior the largest text and touch targets", () => {
    const junior = resolvePreset("junior");
    const explorer = resolvePreset("explorer");
    expect(junior.fontSizeBody).toBe("24px");
    expect(junior.touchTarget).toBe(64);
    expect(junior.touchTarget).toBeGreaterThan(explorer.touchTarget);
  });

  it("rejects an unknown preset", () => {
    expect(() => resolvePreset("teen")).toThrow();
  });
});

describe("generateCss", () => {
  const css = generateCss();

  it("emits base tokens as CSS variables on :root", () => {
    expect(css).toContain(":root {");
    expect(css).toContain(`--cv-color-primary: ${tokens.color.primary};`);
    expect(css).toContain("--cv-radius-lg:");
    expect(css).toContain("--cv-motion-fast:");
  });

  it("uses the documented font stack variable", () => {
    expect(css).toContain("--cv-font: system-ui");
  });

  it("overrides tokens per stage preset", () => {
    expect(css).toContain('[data-stage="junior"] {');
    expect(css).toContain("--cv-font-size-body: 24px;");
    expect(css).toContain("--cv-touch-target: 64px;");
    expect(css).toContain('[data-stage="maker"] {');
    expect(css).toContain("--cv-font-size-body: 16px;");
  });
});
