import { describe, expect, it } from "vitest";
import type { HintLadder } from "@createverse/shared-types";
import {
  advance,
  applyConceptEvidence,
  deriveSkillState,
  getNextHint,
  isSolutionAllowed,
  skillLevelFromWeight,
  weightedEvidenceSum,
} from "./index.ts";

function makeLadder(types: HintLadder["levels"][number]["type"][]): HintLadder {
  return {
    id: "hints.test",
    version: 1,
    solution_allowed_after: 3,
    status: "draft",
    levels: types.map((type, index) => ({
      level: index + 1,
      type,
      text_key: `hints.test.${index + 1}`,
    })),
  } as HintLadder;
}

describe("hint ladder progression", () => {
  it("walks levels one at a time, never skipping", () => {
    const ladder = makeLadder(["ask", "hint", "smaller_hint", "demonstrate"]);
    const seen: number[] = [];
    let progress = { levelReached: 0, attemptCount: 1 };
    for (let i = 0; i < 4; i += 1) {
      const hint = getNextHint(ladder, progress);
      if (hint) seen.push(hint.level);
      progress = advance(progress);
    }
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it("returns null when the ladder is exhausted", () => {
    const ladder = makeLadder(["ask", "hint", "smaller_hint", "demonstrate"]);
    expect(getNextHint(ladder, { levelReached: 4, attemptCount: 9 })).toBeNull();
  });

  it("never offers the solution before solution_allowed_after attempts", () => {
    const ladder = makeLadder(["ask", "hint", "smaller_hint", "demonstrate", "solution"]);
    expect(getNextHint(ladder, { levelReached: 4, attemptCount: 2 })).toBeNull();
    expect(isSolutionAllowed(ladder, 2)).toBe(false);
  });

  it("offers the solution once attempts reach the gate", () => {
    const ladder = makeLadder(["ask", "hint", "smaller_hint", "demonstrate", "solution"]);
    const hint = getNextHint(ladder, { levelReached: 4, attemptCount: 3 });
    expect(hint?.type).toBe("solution");
    expect(isSolutionAllowed(ladder, 3)).toBe(true);
  });

  it("rejects negative progress instead of silently corrupting state", () => {
    const ladder = makeLadder(["ask", "hint", "smaller_hint", "demonstrate"]);
    expect(() => getNextHint(ladder, { levelReached: -1, attemptCount: 0 })).toThrow();
    expect(() => getNextHint(ladder, { levelReached: 0, attemptCount: -1 })).toThrow();
  });
});

describe("concept progress", () => {
  it("never decreases, only reinforces", () => {
    let level = 0;
    level = applyConceptEvidence(level, "seen");
    expect(level).toBe(1);
    level = applyConceptEvidence(level, "successful");
    expect(level).toBe(3);
    level = applyConceptEvidence(level, "seen"); // weaker evidence must not lower it
    expect(level).toBe(3);
    level = applyConceptEvidence(level, "explained");
    expect(level).toBe(4);
  });

  it("clamps at the maximum level 4", () => {
    expect(applyConceptEvidence(4, "explained")).toBe(4);
  });

  it("throws on unknown evidence kinds", () => {
    expect(() => applyConceptEvidence(0, "guessed" as never)).toThrow();
  });
});

describe("skill evidence", () => {
  const NOW = Date.UTC(2026, 9, 6);

  it("sums fresh evidence", () => {
    const items = [
      { strength: 1, atMs: NOW },
      { strength: 0.6, atMs: NOW },
    ];
    expect(weightedEvidenceSum(items, NOW)).toBeCloseTo(1.6, 5);
    expect(skillLevelFromWeight(1.6, 5)).toBe(1);
  });

  it("decays old evidence by the half-life", () => {
    const items = [{ strength: 1, atMs: NOW - 30 * 86_400_000 }];
    expect(weightedEvidenceSum(items, NOW, 30)).toBeCloseTo(0.5, 5);
    expect(skillLevelFromWeight(0.5, 5)).toBe(0);
  });

  it("never exceeds the skill's configured levels", () => {
    const items = [
      { strength: 1, atMs: NOW },
      { strength: 1, atMs: NOW },
      { strength: 1, atMs: NOW },
      { strength: 1, atMs: NOW },
      { strength: 1, atMs: NOW },
      { strength: 1, atMs: NOW },
    ];
    const state = deriveSkillState(items, NOW, 5);
    expect(state.level).toBe(5);
    expect(state.weightedSum).toBeCloseTo(6, 5);
  });

  it("returns level 0 with no evidence", () => {
    expect(deriveSkillState([], NOW, 5)).toEqual({ weightedSum: 0, level: 0 });
  });

  it("clamps out-of-range strengths instead of inflating levels", () => {
    expect(weightedEvidenceSum([{ strength: 5, atMs: NOW }], NOW)).toBeCloseTo(1, 5);
    expect(weightedEvidenceSum([{ strength: -3, atMs: NOW }], NOW)).toBeCloseTo(0, 5);
  });

  it("rejects an invalid half-life", () => {
    expect(() => weightedEvidenceSum([], NOW, 0)).toThrow();
  });
});
