// @vitest-environment jsdom
/**
 * FR-40 parent overview: the concepts/skills cards render the P1-06 evidence
 * rows replayed from the event log, with numeric levels (allowed here — the
 * child's Me screen keeps "no levels", PRODUCT_SPEC §Me).
 *
 * Renders the real shell at #parent/overview, passes the parent gate, and
 * asserts the derived rows in both locales (TESTING.md §9: no raw keys).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AppShell from "../../App";
import {
  getProgressStore,
  resetProgressStores,
} from "../../progress/useProgress.ts";

const CHILD = "child-placeholder"; // DEFAULT_PROFILE.id (AppContext)

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  resetProgressStores();
  window.location.hash = "#parent/overview";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  resetProgressStores();
});

function text(): string {
  return container.textContent ?? "";
}

function button(label: string): HTMLElement {
  // ui Chip is a <span role="button">; gate/nav controls are real buttons.
  const found = [...container.querySelectorAll<HTMLElement>("button, [role='button']")].find(
    (b) => b.textContent?.includes(label),
  );
  if (!found) throw new Error(`button not found: ${label}`);
  return found;
}

/** Two successful experiment-step completions (strength 0.6 each). */
async function seedEvidence(): Promise<void> {
  const { store, ready } = getProgressStore(CHILD);
  await ready;
  for (const stepId of ["step.bridge.j1", "step.bridge.j2"]) {
    await store.appendEvent(
      "child.activity.completed",
      {
        step_id: stepId,
        outcome: "success",
        hints_used: 0,
        iterations: 1,
        concepts: ["concept.load"],
        skills: ["skill.experimentation"],
        step_type: "experiment",
      },
      { id: "project.bridge", version: 1 },
    );
  }
}

async function renderThroughGate(): Promise<void> {
  await act(async () => {
    root.render(<AppShell />);
  });
  // The parent area is route-guarded (P1-03); confirm opens it.
  await act(async () => {
    button("Confirm with passkey").click();
  });
}

/** Deep-link navigation, exactly what the shell's hashchange listener sees. */
async function goTo(hash: string): Promise<void> {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

describe("parent overview shows P1-06 evidence rows (FR-40)", () => {
  it("renders skill and concept rows with numeric levels in en", async () => {
    await seedEvidence();
    await renderThroughGate();
    const visible = text();
    expect(visible).toContain("Skills developing");
    // 0.6 + 0.6 = 1.2 → level 1 of 5; two replayed evidence entries.
    expect(visible).toContain("level 1 of 5, 2 evidence entries");
    // Experiment success → concept demonstrated (DATA_MODEL §5: level 3).
    expect(visible).toContain("level 3 of 4");
  });

  it("switches the rows to zh-Hant with the locale", async () => {
    await seedEvidence();
    await renderThroughGate();
    // The parent header carries no language chip; Settings owns it (Layout).
    await goTo("#parent/settings");
    await act(async () => {
      button("繁體中文").click();
    });
    await goTo("#parent/overview");
    const visible = text();
    expect(visible).toContain("第 1 級（共 5 級），2 筆證據");
    expect(visible).toContain("第 3 級（共 4 級）");
  });

  it("keeps the descriptive fallback when there is no evidence yet", async () => {
    await renderThroughGate();
    const visible = text();
    expect(visible).toContain("I can test a bridge"); // overview.skills.body
    expect(visible).not.toContain("level "); // no fabricated rows
  });
});
