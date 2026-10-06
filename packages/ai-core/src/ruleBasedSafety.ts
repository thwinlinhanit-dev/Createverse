import type {
  HelpContext,
  InputVerdict,
  OutputVerdict,
  SafetyLayer,
} from "./types.ts";

/**
 * Rule-based safety layer (SAFETY.md §2: "start with rules plus a small classifier
 * prompt"). Deterministic and free — it runs before the budget guard so a blocked
 * message never costs live AI tokens.
 *
 * This is v0. The full eval set lives in `ai/evals/` (task P0-06 remainder, P1-11).
 * Every safety bug becomes a permanent test case (TESTING.md §1).
 */

const DISTRESS_PATTERNS: readonly RegExp[] = [
  /\bkill myself\b/i,
  /\bsuicide\b/i,
  /\bwant to die\b/i,
  /自殺|想不開|不想活/,
];

const PERSONAL_INFO_PATTERNS: readonly RegExp[] = [
  /\bmy name is\b/i,
  /\bi am \d{1,2} years old\b/i,
  /\bmy (house|home|school) address\b/i,
  /\bmy (mom|dad|mother|father)'s (name|phone|number)\b/i,
  /我叫|我住|我家地址|我今年/,
];

/** Unsafe content. `high` risk experiments are also blocked (SAFETY.md §3). */
const BLOCK_PATTERNS: readonly RegExp[] = [
  /\b(make|build|mix) (a |an )?(bomb|explosive)\b/i,
  /\bhow do i hurt\b/i,
  /\bpornography\b/i,
  /製造炸彈|傷害別人/,
];

/** Redirect: not allowed right now, steer back to the project. */
const REDIRECT_PATTERNS: readonly RegExp[] = [
  /\bdo my (homework|assignment)\b/i,
  /\bjust give me the answer\b/i,
  /直接給我答案|幫我寫作業/,
];

export interface RuleBasedSafetyOptions {
  readonly extraBlockPatterns?: readonly RegExp[];
}

export function createRuleBasedSafety(
  options: RuleBasedSafetyOptions = {},
): SafetyLayer {
  const blockPatterns = [...BLOCK_PATTERNS, ...(options.extraBlockPatterns ?? [])];

  return {
    checkInput(text: string, _ctx: HelpContext): InputVerdict {
      if (DISTRESS_PATTERNS.some((p) => p.test(text))) return "distress";
      if (PERSONAL_INFO_PATTERNS.some((p) => p.test(text))) return "personal_info";
      if (blockPatterns.some((p) => p.test(text))) return "block";
      if (REDIRECT_PATTERNS.some((p) => p.test(text))) return "redirect";
      return "ok";
    },

    checkOutput(_text: string, _ctx: HelpContext): OutputVerdict {
      // Answer-leak and age checks need the eval dataset (AI_SPEC.md §11, task P1-11).
      // Fail safe toward "ok" only for pre-reviewed output paths; live output still
      // passes the age/language review in later tasks. Kept explicit so it is visible.
      return "ok";
    },
  };
}
