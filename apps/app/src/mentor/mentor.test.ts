import { describe, expect, it } from "vitest";
import {
  FALLBACK_TEXT_KEY,
  MockAIProvider,
  createBudgetGuard,
  type HelpContext,
} from "@createverse/ai-core";
import type { HintLadder } from "@createverse/shared-types";
import { createMentor } from "./mentor.ts";
import {
  KILL_SWITCH_STORAGE_KEY,
  LIVE_AI_STORAGE_KEY,
  getLiveAiChoice,
  isKillSwitchOn,
  liveAiAllowsStage,
  memoryStorage,
  setLiveAiChoice,
} from "./settings.ts";
import { logMentorTurn, listMentorTurns } from "./transcript.ts";

/**
 * P1-07 acceptance: passes the eval set (ai/evals, in `pnpm test`) and
 * works fully offline from live AI. These tests cover the app wiring:
 * content ladder through MentorService, every gate (parent switch, kill
 * switch, stage, budget), and the parent-visible transcript (AI_SPEC §246).
 */

function makeLadder(): HintLadder {
  const types = ["ask", "hint", "smaller_hint", "demonstrate", "solution"] as const;
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

const ladder = makeLadder();
const ladderFor = (stepId: string): HintLadder | undefined =>
  stepId === "step.bridge.j1" ? ladder : undefined;

function ctx(overrides: Partial<HelpContext> = {}): HelpContext {
  return {
    childId: "c_test",
    stage: "explorer",
    locale: "en",
    stepId: "step.bridge.j1",
    hintLevelReached: 0,
    attemptCount: 1,
    ...overrides,
  };
}

describe("app mentor (P1-07) — offline run with live AI off", () => {
  it("serves the content ladder's next hint with no provider configured", async () => {
    const mentor = createMentor({ stage: "explorer", ladderFor, storage: memoryStorage() });
    const result = await mentor.getHelp(ctx());
    expect(result.source).toBe("precomputed");
    expect(result.hintLevel).toBe(1);
    expect(result.textKey).toBe("hints.test.1");
    expect(result.safety).toBe("ok");
  });

  it("walks every ladder level, then falls back to 'ask a grown-up'", async () => {
    const mentor = createMentor({ stage: "explorer", ladderFor, storage: memoryStorage() });
    for (let level = 1; level <= 5; level += 1) {
      // attemptCount 3 clears the solution gate (solution_allowed_after).
      const result = await mentor.getHelp(
        ctx({ hintLevelReached: level - 1, attemptCount: 3 }),
      );
      expect(result.hintLevel).toBe(level);
    }
    const exhausted = await mentor.getHelp(
      ctx({ hintLevelReached: 5, attemptCount: 9 }),
    );
    expect(exhausted.source).toBe("fallback");
    expect(exhausted.textKey).toBe(FALLBACK_TEXT_KEY);
  });

  it("falls back for a step with no ladder instead of failing", async () => {
    const mentor = createMentor({ stage: "explorer", ladderFor, storage: memoryStorage() });
    const result = await mentor.getHelp(ctx({ stepId: "step.unknown" }));
    expect(result.source).toBe("fallback");
    expect(result.textKey).toBe(FALLBACK_TEXT_KEY);
  });

  it("stays offline for a child message even with a message in context", async () => {
    const mentor = createMentor({ stage: "explorer", ladderFor, storage: memoryStorage() });
    const result = await mentor.getHelp(ctx({ message: "why is my bridge wobbly?" }));
    expect(result.source).toBe("precomputed");
    expect(result.hintLevel).toBe(1);
  });
});

describe("live-AI gates (AI_SPEC §7, SECURITY kill switch)", () => {
  it("default settings keep a configured provider silent (parent switch off)", async () => {
    const provider = new MockAIProvider();
    const mentor = createMentor({
      stage: "explorer",
      ladderFor,
      storage: memoryStorage(),
      provider,
    });
    const result = await mentor.getHelp(ctx({ message: "why?" }));
    expect(result.source).toBe("precomputed");
    expect(provider.calls).toHaveLength(0);
  });

  it("parent opt-in allows live for that stage, but never for Junior", async () => {
    const storage = memoryStorage();
    setLiveAiChoice("explorer", storage);

    const provider = new MockAIProvider({ text: "What did the force view show?" });
    const mentor = createMentor({ stage: "explorer", ladderFor, storage, provider });
    const live = await mentor.getHelp(ctx({ message: "why is it wobbly?" }));
    expect(live.source).toBe("live");
    expect(provider.calls).toHaveLength(1);

    const juniorProvider = new MockAIProvider();
    const junior = createMentor({ stage: "junior", ladderFor, storage, provider: juniorProvider });
    const blocked = await junior.getHelp(
      ctx({ stage: "junior", message: "why is it wobbly?" }),
    );
    expect(blocked.source).toBe("precomputed");
    expect(juniorProvider.calls).toHaveLength(0);
  });

  it("each stage choice unlocks only that stage", async () => {
    const storage = memoryStorage();
    setLiveAiChoice("explorer", storage);
    const provider = new MockAIProvider();
    const mentor = createMentor({ stage: "maker", ladderFor, storage, provider });
    await mentor.getHelp(ctx({ stage: "maker", message: "why?" }));
    expect(provider.calls).toHaveLength(0);
  });

  it("the kill switch beats the parent opt-in", async () => {
    const storage = memoryStorage();
    setLiveAiChoice("explorer", storage);
    storage.set(KILL_SWITCH_STORAGE_KEY, "on");
    expect(isKillSwitchOn(storage)).toBe(true);
    const provider = new MockAIProvider();
    const mentor = createMentor({ stage: "explorer", ladderFor, storage, provider });
    const result = await mentor.getHelp(ctx({ message: "why?" }));
    expect(result.source).toBe("precomputed");
    expect(provider.calls).toHaveLength(0);
  });

  it("an exhausted budget forces the offline path", async () => {
    const storage = memoryStorage();
    setLiveAiChoice("explorer", storage);
    const budget = createBudgetGuard({
      dailyTokensPerChild: 10,
      monthlyTokensTotal: 100,
    });
    budget.record({ inputTokens: 10, outputTokens: 0 }, { childId: "c_test" });
    const provider = new MockAIProvider();
    const mentor = createMentor({
      stage: "explorer",
      ladderFor,
      storage,
      provider,
      budget,
    });
    const result = await mentor.getHelp(ctx({ message: "why?" }));
    expect(result.source).toBe("precomputed");
    expect(provider.calls).toHaveLength(0);
  });
});

describe("live-AI settings storage", () => {
  it("defaults to off and rejects corrupt stored values", () => {
    const storage = memoryStorage();
    expect(getLiveAiChoice(storage)).toBe("off");
    storage.set(LIVE_AI_STORAGE_KEY, "senior");
    expect(getLiveAiChoice(storage)).toBe("off");
    setLiveAiChoice("maker", storage);
    expect(getLiveAiChoice(storage)).toBe("maker");
  });

  it("kill switch is off unless explicitly on", () => {
    const storage = memoryStorage();
    expect(isKillSwitchOn(storage)).toBe(false);
    storage.set(KILL_SWITCH_STORAGE_KEY, "off");
    expect(isKillSwitchOn(storage)).toBe(false);
  });

  it("stage gating: Junior is never allowed; each choice unlocks only its stage", () => {
    expect(liveAiAllowsStage("explorer", "junior")).toBe(false);
    expect(liveAiAllowsStage("maker", "junior")).toBe(false);
    expect(liveAiAllowsStage("explorer", "explorer")).toBe(true);
    expect(liveAiAllowsStage("explorer", "maker")).toBe(false);
    expect(liveAiAllowsStage("off", "maker")).toBe(false);
  });
});

describe("mentor transcript (parent-visible, DATA_MODEL §6 retention)", () => {
  const NOW = Date.UTC(2026, 9, 9);

  function turn(at: string, hintLevel = 1) {
    return {
      at,
      stepId: "step.bridge.j1",
      hintLevel,
      source: "precomputed" as const,
      safety: "ok" as const,
    };
  }

  it("stores ids and enums only — never free text", () => {
    const storage = memoryStorage();
    const saved = logMentorTurn("c_test", turn(new Date(NOW).toISOString()), {
      storage,
      nowMs: NOW,
    });
    expect(Object.keys(saved).sort()).toEqual([
      "at",
      "hintLevel",
      "id",
      "safety",
      "source",
      "stepId",
    ]);
    const [first] = listMentorTurns("c_test", { storage, nowMs: NOW });
    expect(first?.id).toBe(saved.id);
    expect(first?.hintLevel).toBe(1);
  });

  it("keeps turns newest-first and prunes past the 90-day window", () => {
    const storage = memoryStorage();
    const old = new Date(NOW - 91 * 86_400_000).toISOString();
    const mid = new Date(NOW - 2 * 86_400_000).toISOString();
    const fresh = new Date(NOW - 1 * 86_400_000).toISOString();
    logMentorTurn("c_test", turn(old, 4), { storage, nowMs: NOW });
    logMentorTurn("c_test", turn(mid, 3), { storage, nowMs: NOW });
    logMentorTurn("c_test", turn(fresh, 2), { storage, nowMs: NOW });

    const turns = listMentorTurns("c_test", { storage, nowMs: NOW });
    expect(turns.map((t) => t.at)).toEqual([fresh, mid]); // old one pruned
  });

  it("caps the stored list at the retention limit", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 205; i += 1) {
      logMentorTurn("c_test", turn(new Date(NOW - i * 60_000).toISOString()), {
        storage,
        nowMs: NOW,
      });
    }
    const turns = listMentorTurns("c_test", { storage, nowMs: NOW });
    expect(turns).toHaveLength(200);
  });

  it("recovers from a corrupt record instead of wedging the parent view", () => {
    const storage = memoryStorage();
    storage.set("cv:mentor:transcript:c_test", "{not json");
    expect(listMentorTurns("c_test", { storage, nowMs: NOW })).toEqual([]);
    logMentorTurn("c_test", turn(new Date(NOW).toISOString()), {
      storage,
      nowMs: NOW,
    });
    expect(listMentorTurns("c_test", { storage, nowMs: NOW })).toHaveLength(1);
  });
});
