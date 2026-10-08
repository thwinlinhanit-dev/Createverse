import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InputVerdict, HelpSource, SafetyStatus } from "@createverse/ai-core";
import { LOCALES, STAGES, type Locale, type Stage } from "@createverse/shared-types";

/**
 * Eval datasets for the AI mentor (TESTING.md §7, SAFETY.md §10, AI_SPEC.md §11).
 *
 * Machine-readable cases live next to this file:
 *   safety/     SAFETY.md §10 rows 1–15, every row in en + zh-Hant (row 12)
 *   pedagogy/   ai/evals/README.md pedagogy table
 *   hints/      hint-ladder behaviour, zero answer leakage before level 5
 *   injection/  prompt-injection attempts in child text (content-field
 *               injection arrives with P1-11, when content flows through)
 */

export const DATASET_NAMES = ["safety", "pedagogy", "hints", "injection"] as const;
export type DatasetName = (typeof DATASET_NAMES)[number];

export interface CaseExpectation {
  /** Verdict of the rule-based input layer for `message` (graded directly). */
  readonly inputVerdict?: InputVerdict;
  /** `HelpResult.safety` the mentor must return. */
  readonly safety?: SafetyStatus;
  /** Allowed `HelpResult.source` values. */
  readonly sources?: readonly HelpSource[];
  /** Allowed `HelpResult.textKey` values (safe messages are localization keys). */
  readonly textKeys?: readonly string[];
  /** `HelpResult.hintLevel` when a hint is served. */
  readonly hintLevel?: number;
  /** Whether the provider was invoked (proves the gate held or the live path ran). */
  readonly providerCalled?: boolean;
  /** Substrings (case-insensitive) that must appear in a live reply. */
  readonly responseIncludes?: readonly string[];
  /** Substrings that must NEVER reach the child, on top of the runner's default set. */
  readonly noLeakMarkers?: readonly string[];
}

export interface EvalCase {
  readonly id: string;
  /** Documented origin, e.g. "SAFETY.md §10 case 3". */
  readonly source: string;
  /** SAFETY.md §10 row number (safety dataset only) — used by the coverage test. */
  readonly safetyCase?: number;
  readonly mustPass: boolean;
  readonly stage: Stage;
  readonly locale: Locale;
  /** Run with the live gate open (`liveAiEnabled: true`) to exercise the path. */
  readonly live: boolean;
  readonly message?: string;
  readonly hintLevelReached?: number;
  readonly attemptCount?: number;
  /** What the mock provider replies (mock mode; seeded into recorded/ on --record). */
  readonly mockResponse?: string;
  readonly expect: CaseExpectation;
}

export interface EvalDataset {
  readonly dataset: DatasetName;
  readonly cases: readonly EvalCase[];
}

export const EVALS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const RECORDED_DIR = path.join(EVALS_DIR, "recorded");
export const RESULTS_DIR = path.join(EVALS_DIR, "results");

function fail(dataset: string, message: string): never {
  throw new Error(`eval dataset ${dataset}: ${message}`);
}

function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function validateCase(ds: DatasetName, raw: unknown, seenIds: Set<string>): EvalCase {
  if (raw === null || typeof raw !== "object") fail(ds, `case is not an object: ${String(raw)}`);
  const c = raw as Record<string, unknown>;
  if (typeof c["id"] !== "string" || c["id"].length === 0) fail(ds, "case missing id");
  if (seenIds.has(c["id"])) fail(ds, `duplicate case id: ${c["id"]}`);
  seenIds.add(c["id"]);
  if (typeof c["source"] !== "string") fail(ds, `${c["id"]}: missing source`);
  if (typeof c["mustPass"] !== "boolean") fail(ds, `${c["id"]}: mustPass must be boolean`);
  if (!isStage(c["stage"])) fail(ds, `${c["id"]}: unknown stage ${String(c["stage"])}`);
  if (!isLocale(c["locale"])) fail(ds, `${c["id"]}: unknown locale ${String(c["locale"])}`);
  if (typeof c["live"] !== "boolean") fail(ds, `${c["id"]}: live must be boolean`);
  const expect = c["expect"];
  if (expect === null || typeof expect !== "object" || Object.keys(expect).length === 0) {
    fail(ds, `${c["id"]}: missing expect`);
  }
  if (c["message"] !== undefined && typeof c["message"] !== "string") {
    fail(ds, `${c["id"]}: message must be a string`);
  }
  const e = expect as Record<string, unknown>;
  if (e["inputVerdict"] !== undefined && typeof c["message"] !== "string") {
    fail(ds, `${c["id"]}: inputVerdict requires a message`);
  }
  if (e["providerCalled"] !== undefined && typeof e["providerCalled"] !== "boolean") {
    fail(ds, `${c["id"]}: providerCalled must be boolean`);
  }
  return raw as EvalCase;
}

function loadDataset(name: DatasetName, seenIds: Set<string>): EvalDataset {
  const file = path.join(EVALS_DIR, name, "cases.json");
  if (!existsSync(file)) fail(name, `missing ${file}`);
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (parsed === null || typeof parsed !== "object") fail(name, "root must be an object");
  const cases = (parsed as { cases?: unknown }).cases;
  if (!Array.isArray(cases) || cases.length === 0) fail(name, "cases must be a non-empty array");
  return { dataset: name, cases: cases.map((c) => validateCase(name, c, seenIds)) };
}

/** Load and validate every dataset. Throws on any schema or id problem. */
export function loadAllDatasets(): EvalDataset[] {
  const seenIds = new Set<string>();
  return DATASET_NAMES.map((name) => loadDataset(name, seenIds));
}

/** Convenience: every case across all datasets, with its dataset attached. */
export function loadAllCases(): Array<EvalCase & { readonly dataset: DatasetName }> {
  return loadAllDatasets().flatMap((d) => d.cases.map((c) => ({ ...c, dataset: d.dataset })));
}

/** Directory listing used by tests to assert recorded coverage. */
export function recordedCaseIds(): Set<string> {
  if (!existsSync(RECORDED_DIR)) return new Set();
  return new Set(
    readdirSync(RECORDED_DIR)
      .filter((f) => f.endsWith(".txt"))
      .map((f) => f.slice(0, -".txt".length)),
  );
}
