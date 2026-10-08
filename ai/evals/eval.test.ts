import { describe, expect, it } from "vitest";
import { DATASET_NAMES, loadAllCases, loadAllDatasets } from "./datasets.ts";
import { LADDER_MAX_LEVEL, runEval } from "./runner.ts";

/**
 * The eval gates (TESTING.md §7, SAFETY.md §10). These run inside `pnpm test`,
 * so a prompt, policy or safety-rule change that breaks a must-pass case turns
 * CI red. Recorded mode is the regression baseline for prompt changes.
 */

describe("AI mentor eval set", () => {
  it("mock mode: every case passes, zero answer leakage", async () => {
    const { summary } = await runEval("mock");
    expect(summary.failures).toEqual([]);
    expect(summary.mustPassFailed).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.total).toBeGreaterThanOrEqual(40);
  });

  it("recorded mode: replays recorded outputs, every case passes", async () => {
    const { summary } = await runEval("recorded");
    expect(summary.failures).toEqual([]);
    expect(summary.failed).toBe(0);
  });

  it("grades solution leakage only at the final ladder level", () => {
    expect(LADDER_MAX_LEVEL).toBe(5);
  });
});

describe("dataset coverage", () => {
  it("loads all four datasets with unique ids", () => {
    const datasets = loadAllDatasets();
    expect(datasets.map((d) => d.dataset)).toEqual([...DATASET_NAMES]);
    const ids = loadAllCases().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every SAFETY.md §10 row in both languages (row 12)", () => {
    const safety = loadAllDatasets().find((d) => d.dataset === "safety");
    expect(safety).toBeDefined();
    // Row 12 ("Traditional Chinese on every case above") is satisfied by the
    // zh-Hant variant of each row rather than by a case of its own.
    const rowsWithCases = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15];
    for (const row of rowsWithCases) {
      const locales = (safety?.cases ?? [])
        .filter((c) => c.safetyCase === row)
        .map((c) => c.locale)
        .sort();
      expect(locales, `SAFETY.md §10 case ${row}`).toEqual(["en", "zh-Hant"]);
    }
  });

  it("marks every SAFETY.md must-pass row as mustPass", () => {
    const mustPassRows = [1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15];
    const safety = loadAllDatasets().find((d) => d.dataset === "safety");
    for (const c of safety?.cases ?? []) {
      if (c.safetyCase !== undefined) {
        expect(c.mustPass, `case ${c.safetyCase}-${c.locale}`).toBe(
          mustPassRows.includes(c.safetyCase),
        );
      }
    }
  });
});
