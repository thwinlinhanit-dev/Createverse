// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import axe from "axe-core";
import { resolvePreset, STAGE_NAMES } from "@createverse/design-tokens";
import { describe, expect, it } from "vitest";
import { renderButton } from "../src/Button.ts";
import {
  renderCard,
  renderChip,
  renderDialog,
  renderHintButton,
  renderParentGate,
  renderPortfolioCard,
  renderSafetyNotice,
  renderStepProgress,
  renderTabs,
} from "../src/components.ts";
import { renderIcon } from "../src/Icon.ts";
import { renderPreviewPage } from "../src/preview.ts";
import { componentCss, fullCss } from "../src/styles.ts";

/** First `selector { ... }` block of a stylesheet. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const end = css.indexOf("}", open);
  return css.slice(open + 1, end);
}

describe("renderers (DESIGN_SYSTEM.md §5, §8, §10)", () => {
  it("does not stamp data-stage on components — the app root owns the preset", () => {
    expect(renderButton({ label: "Go" })).not.toContain("data-stage");
    expect(renderCard({ label: "A", body: "B" })).not.toContain("data-stage");
    expect(renderChip({ label: "A" })).not.toContain("data-stage");
    expect(renderTabs({ tabs: ["One"], active: 0 })).not.toContain("data-stage");
    expect(renderStepProgress({ current: 1, total: 3 })).not.toContain("data-stage");
    expect(renderHintButton({ level: 1 })).not.toContain("data-stage");
    expect(renderParentGate({ reason: "r" })).not.toContain("data-stage");
    expect(renderSafetyNotice({ severity: "info", message: "m", nextStep: "n" })).not.toContain(
      "data-stage",
    );
  });

  it("emits data-stage only when a stage is passed explicitly", () => {
    expect(renderButton({ label: "Go", stage: "junior" })).toContain('data-stage="junior"');
    expect(renderCard({ label: "A", body: "B", stage: "maker" })).toContain('data-stage="maker"');
  });

  it("escapes untrusted text in every renderer", () => {
    const evil = '<script>alert(1)</script>';
    const outputs = [
      renderButton({ label: evil }),
      renderCard({ label: evil, body: evil }),
      renderChip({ label: evil }),
      renderTabs({ tabs: [evil], active: 0 }),
      renderDialog({ label: evil, body: evil, open: true }),
      renderHintButton({ level: 1, label: evil, ariaLabel: evil }),
      renderPortfolioCard({ label: evil, detail: evil, date: evil }),
      renderParentGate({ reason: evil, actionLabel: evil }),
      renderSafetyNotice({ severity: "warning", message: evil, nextStep: evil }),
      renderIcon({ name: "home", label: evil }),
    ];
    for (const html of outputs) {
      expect(html).not.toContain("<script>");
    }
  });

  it("covers button states: secondary, disabled, loading", () => {
    expect(renderButton({ label: "Go", variant: "secondary" })).toContain("cv-button--secondary");
    expect(renderButton({ label: "Go", disabled: true })).toContain(" disabled");
    const loading = renderButton({ label: "Saving", loading: true });
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain(" disabled");
  });

  it("shows selected state with an icon, not color alone", () => {
    const chip = renderChip({ label: "Stone", selected: true });
    expect(chip).toContain("cv-chip--selected");
    expect(chip).toContain('data-selected="true"');
    expect(chip).toContain("<svg");
    expect(renderChip({ label: "Stone" })).not.toContain("<svg");
  });

  it("renders the mentor hint as icon plus label with an accessible name", () => {
    const hint = renderHintButton({ level: 1 });
    expect(hint).toContain("<svg");
    expect(hint).toContain('aria-label="Get a hint"');
    expect(hint).toContain("Help");
    expect(renderHintButton({ level: 3 })).toContain('aria-label="Get hint level 3"');
    expect(renderHintButton({ level: 1, label: "提示", ariaLabel: "取得提示" })).toContain(
      'aria-label="取得提示"',
    );
  });

  it("gives every icon either an accessible name or aria-hidden", () => {
    expect(renderIcon({ name: "home", label: "Home" })).toContain('role="img"');
    expect(renderIcon({ name: "home", label: "Home" })).toContain('aria-label="Home"');
    expect(renderIcon({ name: "home" })).toContain('aria-hidden="true"');
  });

  it("labels step progress in the caller's language", () => {
    expect(renderStepProgress({ current: 2, total: 4 })).toContain('aria-label="Step 2 of 4"');
    expect(renderStepProgress({ current: 2, total: 4, label: "第 2 步，共 4 步" })).toContain(
      'aria-label="第 2 步，共 4 步"',
    );
  });

  it("pairs safety severity with an icon and a word, never color alone", () => {
    const warning = renderSafetyNotice({
      severity: "warning",
      message: "Careful",
      nextStep: "Ask a grown-up",
    });
    expect(warning).toContain("cv-safety--warning");
    expect(warning).toContain('aria-label="Warning"');
    expect(warning).toContain("<svg");
    const info = renderSafetyNotice({ severity: "info", message: "Note", nextStep: "Next" });
    expect(info).toContain('aria-label="Information"');
  });
});

describe("component stylesheet (DESIGN_SYSTEM.md §2, §8, §10)", () => {
  const css = componentCss();

  it("uses design tokens only — no raw colors", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
    expect(css).not.toMatch(/[^-]color:\s*black|[^-]color:\s*white/i);
  });

  it("gives interactive controls the preset touch target", () => {
    for (const selector of [".cv-button {", ".cv-chip {", ".cv-tabs button {", ".cv-hint {"]) {
      expect(rule(css, selector)).toContain("min-height: var(--cv-touch-target)");
    }
  });

  it("shows focus with the documented 3px ring", () => {
    expect(rule(css, ":focus-visible")).toContain("3px solid var(--cv-color-focus-ring)");
  });

  it("switches radius per preset through data-stage aliases", () => {
    expect(rule(css, '[data-stage="junior"]')).toContain("var(--cv-radius-lg)");
    expect(rule(css, '[data-stage="maker"]')).toContain("var(--cv-radius-md)");
  });

  it("honors reduced motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps preset touch targets at spec sizes (§3, §8)", () => {
    expect(resolvePreset("junior").touchTarget).toBe(64);
    expect(resolvePreset("explorer").touchTarget).toBe(56);
    for (const stage of STAGE_NAMES) {
      expect(resolvePreset(stage).touchTarget).toBeGreaterThanOrEqual(48);
    }
    expect(resolvePreset("junior").touchTarget).toBeGreaterThan(resolvePreset("maker").touchTarget);
  });

  it("ships tokens and components together in fullCss()", () => {
    const full = fullCss();
    expect(full).toContain("--cv-color-primary:");
    expect(full).toContain("--cv-elevation-1:");
    expect(full).toContain(".cv-button {");
  });
});

describe("preview page (P0-04 acceptance)", () => {
  const html = renderPreviewPage();

  it("renders every component class", () => {
    for (const cls of [
      "cv-button",
      "cv-card",
      "cv-chip",
      "cv-tabs",
      "cv-dialog",
      "cv-steps",
      "cv-hint",
      "cv-portfolio",
      "cv-parent-gate",
      "cv-safety",
      "cv-icon",
    ]) {
      expect(html).toContain(cls);
    }
  });

  it("shows all four stage presets with data-stage on the block roots", () => {
    for (const stage of STAGE_NAMES) {
      expect(html).toContain(`data-stage="${stage}"`);
    }
  });

  it("renders both languages", () => {
    expect(html).toContain('lang="zh-Hant"');
    expect(html).toContain('lang="en"');
    expect(html).toContain("開始"); // zh-Hant button label
    expect(html).toContain("Start"); // en button label
  });

  it("includes the token stylesheet and the live switcher", () => {
    expect(html).toContain("--cv-color-primary:");
    expect(html).toContain('data-set-stage="junior"');
    expect(html).toContain('data-set-lang="zh-Hant"');
    expect(html).toContain('id="pv-live"');
  });

  it("is committed and up to date — run `pnpm ui:preview` after changing components", () => {
    const previewPath = path.resolve(process.cwd(), "packages/ui/preview/index.html");
    const onDisk = readFileSync(previewPath, "utf8");
    expect(onDisk).toBe(html);
  });
});

describe("axe accessibility check (DESIGN_SYSTEM.md §8, §10)", () => {
  it("has no violations on the preview page", async () => {
    // Install the page into this jsdom document so page-level rules
    // (document-title, lang, landmarks) see a real browsing context.
    const parsed = new DOMParser().parseFromString(renderPreviewPage(), "text/html");
    document.replaceChild(document.importNode(parsed.documentElement, true), document.documentElement);
    // color-contrast needs a real rendering engine (paint/layout); jsdom cannot
    // compute it. The same guarantee is covered by the contrast-ratio tests in
    // packages/design-tokens against every token pair.
    const results = await axe.run(document, {
      rules: { "color-contrast": { enabled: false } },
      resultTypes: ["violations"],
    });
    const problems = results.violations.map((v) => `${v.id}: ${v.help}`);
    expect(problems).toEqual([]);
  });
});
