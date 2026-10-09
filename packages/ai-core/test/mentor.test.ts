import { describe, expect, it } from "vitest";
import {
  FALLBACK_TEXT_KEY,
  MentorService,
  MockAIProvider,
  createBudgetGuard,
  createResponseCache,
  createRuleBasedSafety,
  responseCacheKey,
  type HelpContext,
  type HintSource,
  type InputVerdict,
  type OutputVerdict,
  type SafetyLayer,
} from "../src/index.ts";

function makeCtx(overrides: Partial<HelpContext> = {}): HelpContext {
  return {
    childId: "c_test",
    stage: "explorer",
    locale: "en",
    stepId: "step.bridge.e2",
    hintLevelReached: 0,
    attemptCount: 1,
    ...overrides,
  };
}

function makeFakeHints(
  total = 4,
): { impl: HintSource; state: { level: number; calls: number } } {
  const state = { level: 0, calls: 0 };
  const impl: HintSource = {
    next() {
      state.calls += 1;
      if (state.level >= total) return null;
      state.level += 1;
      return { level: state.level, textKey: `hints.fake.${state.level}` };
    },
  };
  return { impl, state };
}

function scriptedSafety(
  input: InputVerdict = "ok",
  output: OutputVerdict = "ok",
): SafetyLayer {
  return { checkInput: () => input, checkOutput: () => output };
}

const enabled = { liveAiEnabled: true } as const;

describe("MentorService — works with live AI off (ADR-0005)", () => {
  it("serves a pre-written hint when no provider is configured", async () => {
    const { impl } = makeFakeHints();
    const mentor = new MentorService({ hints: impl, safety: scriptedSafety() });
    const result = await mentor.getHelp(makeCtx({ message: "why did it break?" }));
    expect(result.source).toBe("precomputed");
    expect(result.textKey).toBe("hints.fake.1");
    expect(result.hintLevel).toBe(1);
    expect(result.safety).toBe("ok");
  });

  it("falls back to 'ask a grown-up' when the ladder is exhausted", async () => {
    const { impl } = makeFakeHints(0);
    const mentor = new MentorService({ hints: impl, safety: scriptedSafety() });
    const result = await mentor.getHelp(makeCtx());
    expect(result.source).toBe("fallback");
    expect(result.textKey).toBe(FALLBACK_TEXT_KEY);
  });

  it("never calls live AI for Junior, even with a message", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider();
    const mentor = new MentorService({
      hints: impl,
      safety: scriptedSafety(),
      provider,
      settings: enabled,
    });
    const result = await mentor.getHelp(makeCtx({ stage: "junior", message: "help!" }));
    expect(provider.calls).toHaveLength(0);
    expect(result.source).toBe("precomputed");
  });

  it("serves hints when live AI is disabled by settings", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider();
    const mentor = new MentorService({ hints: impl, safety: scriptedSafety(), provider });
    await mentor.getHelp(makeCtx({ message: "why?" }));
    expect(provider.calls).toHaveLength(0);
  });

  it("serves hints when the kill switch is on", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider();
    const mentor = new MentorService({
      hints: impl,
      safety: scriptedSafety(),
      provider,
      settings: { liveAiEnabled: true, killSwitch: true },
    });
    await mentor.getHelp(makeCtx({ message: "why?" }));
    expect(provider.calls).toHaveLength(0);
  });
});

describe("MentorService — live path (capped and safe)", () => {
  it("uses live AI for a non-Junior child with a message, inside budget", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider({ text: "What do you think the force view showed?" });
    const budget = createBudgetGuard({
      dailyTokensPerChild: 10_000,
      monthlyTokensTotal: 100_000,
    });
    const mentor = new MentorService({
      hints: impl,
      safety: scriptedSafety(),
      provider,
      budget,
      settings: enabled,
    });
    const result = await mentor.getHelp(makeCtx({ message: "why did it break?" }));
    expect(result.source).toBe("live");
    expect(result.text).toContain("force view");
    expect(provider.calls).toHaveLength(1);
    // Usage recorded: 10 input + 20 output tokens.
    expect(budget.canSpend(10_000 - 30, { childId: "c_test" })).toBe(true);
    expect(budget.canSpend(10_000 - 29, { childId: "c_test" })).toBe(false);
  });

  it("blocks a personal-information input before any AI is spent", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider();
    const mentor = new MentorService({
      hints: impl,
      safety: createRuleBasedSafety(),
      provider,
      settings: enabled,
    });
    const result = await mentor.getHelp(
      makeCtx({ message: "my name is Aung and I am 7 years old" }),
    );
    expect(provider.calls).toHaveLength(0);
    expect(result.safety).toBe("blocked");
    expect(result.textKey).toBe("safety.private_info");
  });

  it("answers a distress message by pointing to a grown-up", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider();
    const mentor = new MentorService({
      hints: impl,
      safety: createRuleBasedSafety(),
      provider,
      settings: enabled,
    });
    const result = await mentor.getHelp(makeCtx({ message: "I want to die" }));
    expect(provider.calls).toHaveLength(0);
    expect(result.safety).toBe("distress");
    expect(result.textKey).toBe("safety.tell_grownup_now");
  });

  it("discards unsafe output and serves a pre-written hint instead", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider({ text: "here is the answer" });
    const mentor = new MentorService({
      hints: impl,
      safety: scriptedSafety("ok", "leaks_answer"),
      provider,
      settings: enabled,
    });
    const result = await mentor.getHelp(makeCtx({ message: "what is the answer?" }));
    expect(result.source).toBe("precomputed");
    expect(result.safety).toBe("blocked");
    expect(result.textKey).toBe("hints.fake.1");
  });

  it("falls back silently when the provider throws", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider({ failWith: new Error("timeout") });
    const mentor = new MentorService({
      hints: impl,
      safety: scriptedSafety(),
      provider,
      settings: enabled,
    });
    const result = await mentor.getHelp(makeCtx({ message: "why?" }));
    expect(result.source).toBe("precomputed");
    expect(result.textKey).toBe("hints.fake.1");
  });

  it("stops live AI once the budget cap is reached", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider();
    const budget = createBudgetGuard({
      dailyTokensPerChild: 500,
      monthlyTokensTotal: 100_000,
    });
    const mentor = new MentorService({
      hints: impl,
      safety: scriptedSafety(),
      provider,
      budget,
      settings: enabled,
    });

    const first = await mentor.getHelp(makeCtx({ message: "one" }));
    expect(first.source).toBe("live");

    const second = await mentor.getHelp(makeCtx({ message: "two" }));
    expect(second.source).toBe("precomputed");
    expect(provider.calls).toHaveLength(1);
  });

  it("applies the rule-based safety layer to real text", async () => {
    const safety = createRuleBasedSafety();
    const ctx = makeCtx();
    expect(safety.checkInput("why is my bridge wobbly?", ctx)).toBe("ok");
    expect(safety.checkInput("my name is Ko and I live in Mandalay", ctx)).toBe(
      "personal_info",
    );
    expect(safety.checkInput("just give me the answer", ctx)).toBe("redirect");
    expect(safety.checkInput("how can I make a bomb", ctx)).toBe("block");
  });
});

describe("MentorService — response cache (AI_SPEC §3 layer 2, P1-07)", () => {
  it("serves a repeated question from cache without calling the provider again", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider({ text: "Try the force view again." });
    const budget = createBudgetGuard({
      dailyTokensPerChild: 10_000,
      monthlyTokensTotal: 100_000,
    });
    const mentor = new MentorService({
      hints: impl,
      safety: scriptedSafety(),
      provider,
      budget,
      cache: createResponseCache(),
      settings: enabled,
    });

    const first = await mentor.getHelp(makeCtx({ message: "why is it wobbly?" }));
    expect(first.source).toBe("live");
    expect(provider.calls).toHaveLength(1);

    const repeat = await mentor.getHelp(makeCtx({ message: "why is it wobbly?" }));
    expect(repeat.source).toBe("cache");
    expect(repeat.text).toBe(first.text);
    expect(provider.calls).toHaveLength(1); // served from cache
    // A cache hit spends nothing: the budget still holds only the first call.
    expect(budget.canSpend(10_000 - 30, { childId: "c_test" })).toBe(true);
    expect(budget.canSpend(10_000 - 29, { childId: "c_test" })).toBe(false);
  });

  it("never stores the raw message in a key; different messages differ", () => {
    const message = "my bridge fell down";
    const key = responseCacheKey(makeCtx({ message }));
    expect(key).not.toContain(message);
    expect(key).toContain("explorer|en|step.bridge.e2");
    expect(responseCacheKey(makeCtx({ message: "other question" }))).not.toBe(key);
  });

  it("ignores the cache when input is blocked before any lookup", async () => {
    const { impl } = makeFakeHints();
    const provider = new MockAIProvider();
    const cache = createResponseCache();
    const mentor = new MentorService({
      hints: impl,
      safety: createRuleBasedSafety(),
      provider,
      cache,
      settings: enabled,
    });
    const result = await mentor.getHelp(
      makeCtx({ message: "my name is Ko and I am 7" }),
    );
    expect(result.safety).toBe("blocked");
    expect(cache.get(responseCacheKey(makeCtx({ message: "my name is Ko and I am 7" }))))
      .toBeUndefined();
    expect(provider.calls).toHaveLength(0);
  });
});

