import type {
  AIProvider,
  AIResponse,
  BudgetGuard,
  HelpContext,
  HelpResult,
  HintSource,
  InputVerdict,
  OutputVerdict,
  SafetyEventReporter,
  SafetyFlag,
  SafetyLayer,
  SafetyStatus,
} from "./types.ts";
import { distressSeverity } from "./ruleBasedSafety.ts";

/**
 * MentorService — AI_SPEC.md §3:
 *   1. pre-written hint ladder (content)  → default, free, offline
 *   2. response cache                     → added in P1-07 (no personal data)
 *   3. live AI                            → only if allowed, capped and safe
 *   4. fallback                           → next pre-written hint or "ask a grown-up"
 *
 * SAFETY.md §7 / decision 2: Junior has no live AI chat.
 * Errors, timeouts and uncertainty always fall back — never blocking the learning flow
 * (AI_SPEC.md §13). The child is never shown an error.
 *
 * P1-11 (SAFETY.md §2 order): input safety runs **before** the budget guard
 * and before any provider — the rule-based classifier is free, so a blocked
 * message never costs live AI tokens, and Phase 1 (no provider at all)
 * still screens and flags every exchange.
 */

export interface MentorSettings {
  /** Parent switch (`child_settings.ai_mentor_enabled`). Default: off. */
  readonly liveAiEnabled?: boolean;
  /** SECURITY.md kill switch: turns live AI off instantly. */
  readonly killSwitch?: boolean;
  /** Estimated tokens for one live call (budget pre-check). Default 500. */
  readonly maxLiveTokens?: number;
}

export interface MentorOptions {
  readonly hints: HintSource;
  readonly safety: SafetyLayer;
  readonly provider?: AIProvider;
  readonly budget?: BudgetGuard;
  /** Response cache (AI_SPEC.md §3). Optional; without it, every live call hits the provider. */
  readonly cache?: ResponseCache;
  readonly settings?: MentorSettings;
  /**
   * P1-11: called once for every blocked or redirected exchange so the app
   * can write the `ai.safety.flagged` event (→ server `safety_events` row,
   * SAFETY.md §2 "every blocked or redirected exchange creates a row").
   */
  readonly onSafetyEvent?: SafetyEventReporter;
}

export const DEFAULT_LIVE_ESTIMATE_TOKENS = 500;
export const FALLBACK_TEXT_KEY = "safety.ask_grownup";

/**
 * Layer 2 of the mentor stack (AI_SPEC.md §3): a device-local cache of live
 * responses, so a repeated question costs nothing. Keys combine stage,
 * locale, step and a one-way digest of the message — the raw free text is
 * never stored (AI_SPEC.md §46 "response cache — no personal data").
 */
export interface ResponseCache {
  get(key: string): AIResponse | undefined;
  set(key: string, response: AIResponse): void;
}

/** One-way FNV-1a digest so raw free text never becomes a key. */
function digest(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

export function responseCacheKey(ctx: HelpContext): string {
  return [ctx.stage, ctx.locale, ctx.stepId, digest(ctx.message ?? "")].join("|");
}

/** Small in-memory cache with an insertion-ordered cap; never persisted. */
export function createResponseCache(maxEntries = 50): ResponseCache {
  const map = new Map<string, AIResponse>();
  return {
    get: (key) => map.get(key),
    set: (key, response) => {
      map.delete(key);
      map.set(key, response);
      while (map.size > maxEntries) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
      }
    },
  };
}

function mapInputVerdict(verdict: InputVerdict): {
  safety: SafetyStatus;
  textKey: string;
} {
  switch (verdict) {
    case "redirect":
      return { safety: "redirected", textKey: "safety.cant_help_that" };
    case "block":
      // SAFETY.md §10.3/§10.4: refuse kindly and offer the safe on-screen alternative.
      return { safety: "blocked", textKey: "safety.safe_alternative" };
    case "secrets":
      // SAFETY.md §10.6: never keep secrets — encourage talking to a grown-up.
      return { safety: "redirected", textKey: "safety.ask_grownup" };
    case "personal_info":
      return { safety: "blocked", textKey: "safety.private_info" };
    case "distress":
      return { safety: "distress", textKey: "safety.tell_grownup_now" };
    case "ok":
      return { safety: "ok", textKey: FALLBACK_TEXT_KEY };
  }
}

function mapOutputVerdict(verdict: OutputVerdict): SafetyStatus {
  return verdict === "unsafe" || verdict === "leaks_answer" ? "blocked" : "redirected";
}

/**
 * P1-11: map an input verdict to the DATA_MODEL `safety_events` fields.
 * Enum-only — never the message text (SAFETY.md §2 "no raw personal data").
 * `kind`/`severity`/`action_taken` match the §2 table columns; `source`
 * ("ai_mentor") is added by the app when it writes the flagged event.
 */
export function inputFlagFor(
  verdict: InputVerdict,
  childId: string,
  message?: string,
): SafetyFlag | null {
  switch (verdict) {
    case "ok":
      return null;
    case "block":
      return { childId, kind: "input_blocked", severity: "warn", actionTaken: "safe_alternative" };
    case "personal_info":
      return { childId, kind: "privacy", severity: "warn", actionTaken: "private_info_message" };
    case "secrets":
      return { childId, kind: "other", severity: "warn", actionTaken: "refused_secrets" };
    case "redirect":
      return { childId, kind: "other", severity: "info", actionTaken: "redirected_to_project" };
    case "distress":
      // §10.8 (someone is hurting them) escalates to high via the rules.
      return {
        childId,
        kind: "other",
        severity: distressSeverity(message ?? ""),
        actionTaken: "distress_flow",
      };
  }
}

/** P1-11: map an output verdict to `safety_events` fields (enum-only). */
export function outputFlagFor(verdict: OutputVerdict, childId: string): SafetyFlag | null {
  switch (verdict) {
    case "ok":
      return null;
    case "unsafe":
    case "leaks_answer":
      return { childId, kind: "output_blocked", severity: "warn", actionTaken: "precomputed_hint" };
    case "off_topic":
    case "too_hard":
      return { childId, kind: "other", severity: "info", actionTaken: "redirected_output" };
  }
}

function systemPromptFor(ctx: HelpContext): string {
  return [
    "You are a learning mentor for a child. Guide thinking; never do the child's work.",
    `Stage: ${ctx.stage}. Reply in: ${ctx.locale}. Current step: ${ctx.stepId}.`,
    "Order: ask, hint, smaller hint, demonstrate, explain. Never give the final solution early.",
    "Never keep secrets, never pretend to be a friend, never give medical, legal or emergency advice.",
    "If something could be unsafe, suggest asking a grown-up.",
  ].join(" ");
}

export class MentorService {
  private readonly hints: HintSource;
  private readonly safety: SafetyLayer;
  private readonly provider?: AIProvider;
  private readonly budget?: BudgetGuard;
  private readonly cache?: ResponseCache;
  private readonly settings: MentorSettings;
  private readonly onSafetyEvent?: SafetyEventReporter;

  constructor(options: MentorOptions) {
    this.hints = options.hints;
    this.safety = options.safety;
    this.provider = options.provider;
    this.budget = options.budget;
    this.cache = options.cache;
    this.settings = options.settings ?? {};
    this.onSafetyEvent = options.onSafetyEvent;
  }

  async getHelp(ctx: HelpContext): Promise<HelpResult> {
    if (ctx.message !== undefined) {
      // SAFETY.md §2 stage 1+2 run first: free, rule-based, always — even
      // with no provider configured (Phase 1) and before the budget guard.
      const verdict = await this.safety.checkInput(ctx.message, ctx);
      if (verdict !== "ok") {
        const mapped = mapInputVerdict(verdict);
        this.report(inputFlagFor(verdict, ctx.childId, ctx.message));
        return { source: "fallback", safety: mapped.safety, textKey: mapped.textKey };
      }

      if (this.canGoLive(ctx)) {
        try {
          const cacheKey = responseCacheKey(ctx);
          const cached = this.cache?.get(cacheKey);
          if (cached) {
            // Cache hit: no provider call and no tokens against the budget.
            return { source: "cache", safety: "ok", text: cached.text };
          }

          const response = await this.provider!.complete({
            systemPrompt: systemPromptFor(ctx),
            userText: ctx.message,
            stage: ctx.stage,
            locale: ctx.locale,
            maxTokens: this.settings.maxLiveTokens ?? DEFAULT_LIVE_ESTIMATE_TOKENS,
          });

          const outputVerdict = await this.safety.checkOutput(response.text, ctx);
          if (outputVerdict !== "ok") {
            // Discard the output, serve the next pre-written hint (AI_SPEC §13).
            this.report(outputFlagFor(outputVerdict, ctx.childId));
            return this.hintOrFallback(ctx, mapOutputVerdict(outputVerdict));
          }

          this.budget?.record(response.usage, { childId: ctx.childId });
          this.cache?.set(cacheKey, response);
          return { source: "live", safety: "ok", text: response.text };
        } catch {
          // Provider error or timeout: next pre-written hint, silently (AI_SPEC §13).
          return this.hintOrFallback(ctx, "ok");
        }
      }
    }

    return this.hintOrFallback(ctx, "ok");
  }

  private report(flag: SafetyFlag | null): void {
    if (flag) this.onSafetyEvent?.(flag);
  }

  private canGoLive(ctx: HelpContext): boolean {
    if (!this.provider) return false;
    if (this.settings.killSwitch === true) return false;
    if (this.settings.liveAiEnabled !== true) return false;
    if (ctx.stage === "junior") return false; // SAFETY.md §13 decision 2
    const estimate = this.settings.maxLiveTokens ?? DEFAULT_LIVE_ESTIMATE_TOKENS;
    if (this.budget && !this.budget.canSpend(estimate, { childId: ctx.childId })) {
      return false;
    }
    return true;
  }

  private async hintOrFallback(
    ctx: HelpContext,
    safety: SafetyStatus,
  ): Promise<HelpResult> {
    const hint = await this.hints.next(ctx);
    if (hint) {
      return {
        source: "precomputed",
        safety,
        textKey: hint.textKey,
        hintLevel: hint.level,
      };
    }
    return { source: "fallback", safety, textKey: FALLBACK_TEXT_KEY };
  }
}
