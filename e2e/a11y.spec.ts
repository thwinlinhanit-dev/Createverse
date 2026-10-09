/**
 * P1-13 — Accessibility baseline (TESTING.md §9: "axe via Playwright in CI").
 *
 * What this suite owns:
 *  - axe (WCAG 2.1 A + AA) on every key child screen, in both languages,
 *    across all three stage presets (TESTING.md §9: "per stage preset and per
 *    language").
 *  - axe on the parent gate and every parent screen.
 *  - Simple-language mode (DESIGN_SYSTEM §8): the shorter copy renders and
 *    stays axe-clean in both locales.
 *  - Keyboard-only bridge placement (DESIGN_SYSTEM §8: "keyboard alternative
 *    for experience placement"), the visible focus ring, and the "never color
 *    alone" rule (second cue = words/pattern, not a tint).
 *
 * The manual phone/tablet half of the P1-13 checklist lives in TESTING.md §9.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const CHILD_SCREENS: ReadonlyArray<{ name: string; hash: string }> = [
  { name: "home", hash: "#/" },
  { name: "explore", hash: "#explore" },
  { name: "create", hash: "#create" },
  { name: "projects", hash: "#projects" },
  { name: "me", hash: "#me" },
  { name: "project-detail", hash: "#project" },
  { name: "project-step-intro", hash: "#project/step" },
];

const PARENT_SCREENS: ReadonlyArray<{ name: string; hash: string }> = [
  { name: "overview", hash: "#parent/overview" },
  { name: "progress", hash: "#parent/progress" },
  { name: "portfolio", hash: "#parent/portfolio" },
  { name: "safety", hash: "#parent/safety" },
  { name: "settings", hash: "#parent/settings" },
];

const STAGE_LABELS = ["Junior (3–5)", "Explorer (6–8)", "Maker (8–10)"] as const;

async function expectNoAxeViolations(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? "n/a"}): ${v.help}\n    ${v.nodes
        .map(
          (n) =>
            `${n.target.join(" ")}\n      ${(n.failureSummary ?? "").replace(/\n/g, "\n      ")}`,
        )
        .join("\n    ")}`,
  );
  expect(summary, `axe violations on ${where}`).toEqual([]);
}

/** One chip always carries the 繁體中文 label and flips the locale either way. */
async function toggleLanguage(page: Page): Promise<void> {
  await page.getByRole("button", { name: "繁體中文" }).click();
}

/** Enters the parent area: hash navigation opens the gate, confirm passes it. */
async function enterParentArea(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`);
  await page.getByRole("button", { name: "Confirm with passkey" }).click();
}

/**
 * Explore → Start → detail → "Start building" → intro step → "I finished this
 * step" → the activity step that embeds the bridge lab. Fresh context each
 * test, so the progress store starts empty and the journey is deterministic.
 */
async function openLabStep(page: Page): Promise<void> {
  await page.goto("/#explore");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/#project$/);
  await page.getByRole("button", { name: "Start building" }).click();
  await expect(page).toHaveURL(/#project\/step$/);
  await page.getByRole("button", { name: "I finished this step" }).click();
  await expect(page.getByTestId("lab-canvas")).toBeVisible();
  // The runtime must be interactive before key events can place anything.
  await expect(page.getByTestId("lab-go")).toBeEnabled();
}

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  // Deterministic axe scans: with the OS reduced-motion preference the app
  // turns its color transitions off (shell.css, DESIGN_SYSTEM §2.3), so the
  // contrast check never samples a chip mid-animation after a click. This is
  // also the TESTING.md §9 "reduced motion" environment.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("axe: key child screens are clean in English", async ({ page }) => {
  for (const screen of CHILD_SCREENS) {
    await page.goto(`/${screen.hash}`);
    await expectNoAxeViolations(page, `child ${screen.name} (en)`);
  }
});

test("axe: key child screens are clean in Traditional Chinese", async ({ page }) => {
  await page.goto("/#/");
  await toggleLanguage(page);
  for (const screen of CHILD_SCREENS) {
    await page.goto(`/${screen.hash}`);
    await expectNoAxeViolations(page, `child ${screen.name} (zh-Hant)`);
  }
});

test("axe: parent gate and every parent screen are clean", async ({ page }) => {
  await page.goto("/#parent/overview");
  await expectNoAxeViolations(page, "parent gate");
  await page.getByRole("button", { name: "Confirm with passkey" }).click();
  for (const screen of PARENT_SCREENS) {
    await page.goto(`/${screen.hash}`);
    await expectNoAxeViolations(page, `parent ${screen.name} (en)`);
  }
});

test("axe: every stage preset renders clean child screens", async ({ page }) => {
  for (const stage of STAGE_LABELS) {
    await enterParentArea(page, "#parent/settings");
    await page.getByRole("button", { name: stage }).click();
    await page.goto("/#/");
    await expectNoAxeViolations(page, `home (${stage})`);
    await page.goto("/#/project/step");
    await expectNoAxeViolations(page, `step runner (${stage})`);
  }
});

test("axe: simple-language mode shows shorter copy and stays clean", async ({ page }) => {
  await enterParentArea(page, "#parent/settings");
  await page.getByRole("button", { name: "On", exact: true }).click();
  await page.goto("/#/");
  await expect(page.getByText("Keep going, or start something new.")).toBeVisible();
  await expectNoAxeViolations(page, "home (simple language, en)");
  await toggleLanguage(page);
  await expect(page.getByText("繼續，或開始新的。")).toBeVisible();
  await expectNoAxeViolations(page, "home (simple language, zh-Hant)");
});

test("keyboard: place a bridge piece with arrow keys and Enter only", async ({ page }) => {
  await openLabStep(page);
  await expectNoAxeViolations(page, "bridge lab step (en)");

  const pieces = page.getByTestId("lab-pieces");
  const before = (await pieces.textContent()) ?? "";
  // The focusable, key-handling element is the canvas wrapper (tabIndex +
  // onKeyDown); the <canvas> itself is not focusable.
  await page.getByTestId("lab-canvas-wrap").focus();
  await page.keyboard.press("Enter"); // anchor the first grid point
  await expect(page.getByTestId("lab-pending")).toBeVisible();
  await page.keyboard.press("ArrowRight"); // move the keyboard cursor
  await page.keyboard.press("Enter"); // second point places the piece
  await expect(pieces).not.toHaveText(before);
  // The placement is announced to screen readers (DESIGN_SYSTEM §8).
  await expect(page.getByTestId("lab-live")).not.toBeEmpty();
});

test("keyboard: focus is visible with the 3px focus ring", async ({ page }) => {
  await page.goto("/#/");
  await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(ring, "first Tab stop should be a real control").not.toBeNull();
  expect(ring?.outlineStyle, `outline-style on <${ring?.tag}>`).toBe("solid");
  expect(ring?.outlineWidth, `outline-width on <${ring?.tag}>`).toBe("3px");
});

test("never color-only: force view and results carry a second, written cue", async ({ page }) => {
  // The force-view toggle only ships on Explorer/Maker experiences
  // (content/experiences: ui.force_view), so preset Explorer first.
  await enterParentArea(page, "#parent/settings");
  await page.getByRole("button", { name: "Explorer (6–8)" }).click();
  await openLabStep(page);

  // Force view starts on for this experience: an alternate color scheme
  // plus a written legend (a second cue that is not just a tint).
  const force = page.getByTestId("lab-force");
  const legend = page.getByTestId("lab-force-legend");
  await expect(force).toBeVisible();
  await expect(force).toHaveAttribute("aria-pressed", "true");
  await expect(legend).toBeVisible();
  expect(((await legend.textContent()) ?? "").trim().length).toBeGreaterThan(0);
  // Toggling it off removes the legend — the legend is tied to the state,
  // not decorative text that sits around.
  await force.click();
  await expect(force).toHaveAttribute("aria-pressed", "false");
  await expect(legend).toBeHidden();

  // An empty test run fails with words and an icon, not just a red block —
  // and the result is announced politely to screen readers.
  await page.getByTestId("lab-go").click();
  const messages = page.locator(
    '[data-testid="lab-result-fail"], [data-testid="lab-error"]',
  );
  await expect(messages.first()).toBeVisible();
  expect(((await messages.first().textContent()) ?? "").trim().length).toBeGreaterThan(0);
  await expect(page.getByTestId("lab-live")).not.toBeEmpty();
});
