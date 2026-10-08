// @vitest-environment jsdom
/**
 * P1-02 ACCEPTANCE: "switching locale changes the whole shell".
 *
 * Renders the real AppShell in jsdom, flips the language through the header
 * control, and asserts that every surface — header tagline, nav, page copy —
 * comes from the catalogs in both locales (TESTING.md §9: no raw keys).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AppShell from "./App";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  window.location.hash = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

async function renderShell(): Promise<void> {
  await act(async () => {
    root.render(<AppShell />);
  });
}

/**
 * Clicks the header language control. Both language chips toggle the locale
 * (LanguageChip), and exactly one of them carries the 繁體中文 label in any
 * locale, so one selector works in both directions.
 */
async function toggleLanguage(): Promise<void> {
  const buttons = [...container.querySelectorAll("button")];
  const toggle = buttons.find((button) => button.textContent?.includes("繁體中文"));
  if (!toggle) throw new Error("language toggle not found");
  await act(async () => {
    toggle.click();
  });
}

function text(): string {
  return container.textContent ?? "";
}

describe("locale switch renders both catalogs (P1-02 acceptance)", () => {
  it("renders the whole shell from the en catalog", async () => {
    await renderShell();
    const visible = text();
    // Header, nav, and page copy — three different shell surfaces.
    expect(visible).toContain("One calm learning space");
    expect(visible).toContain("Explore");
    expect(visible).toContain("Today's challenge");
    expect(visible).toContain("Build a Bridge");
    // No zh-Hant copy while in en, and no unresolved keys anywhere.
    expect(visible).not.toContain("今天的挑戰");
    expect(visible).not.toMatch(/\b(nav|home|gate|overview)\./);
    expect(document.documentElement.lang).toBe("en");
  });

  it("switching to zh-Hant re-renders header, nav and page copy", async () => {
    await renderShell();
    await toggleLanguage();
    const visible = text();
    expect(visible).toContain("一個寧靜的學習空間");
    expect(visible).toContain("探索"); // nav label
    expect(visible).toContain("今天的挑戰");
    expect(visible).toContain("蓋一座橋");
    // The en strings are gone with the locale…
    expect(visible).not.toContain("Today's challenge");
    expect(visible).not.toContain("One calm learning space");
    // …and assistive tech follows (DESIGN_SYSTEM §8).
    expect(document.documentElement.lang).toBe("zh-Hant");
  });

  it("switching back to en restores the en catalog", async () => {
    await renderShell();
    await toggleLanguage();
    await toggleLanguage();
    expect(text()).toContain("One calm learning space");
    expect(text()).not.toContain("一個寧靜的學習空間");
    expect(document.documentElement.lang).toBe("en");
  });
});
