/**
 * Mentor transcript (P1-07): the parent-visible record of every help request.
 *
 * Sources: AI_SPEC.md §246 (log source and safety status per message),
 * §220 (parents can read transcripts), DATA_MODEL.md §6 retention (AI
 * messages 90 days). Records hold ids, enums and numbers only — never the
 * child's free text or any AI output (DATA_MODEL §6: no free text in logs;
 * Phase 1 runs with live AI off, so mentor replies are content keys).
 *
 * Kept as a device-local record rather than a progress event: events are the
 * synced learning log, this is the parent's AI visibility surface.
 */
import type { HelpSource, SafetyStatus } from "@createverse/ai-core";
import { defaultMentorStorage, type MentorStorage } from "./settings.ts";

export interface MentorTurn {
  readonly id: string;
  /** ISO-8601 UTC. */
  readonly at: string;
  readonly stepId: string;
  /** Hint level served; 0 = no hint (fallback or safety message). */
  readonly hintLevel: number;
  readonly source: HelpSource;
  readonly safety: SafetyStatus;
}

export const MENTOR_TURN_RETENTION_DAYS = 90;
export const MENTOR_TURN_LIMIT = 200;
const DAY_MS = 86_400_000;

function key(childId: string): string {
  return `cv:mentor:transcript:${childId}`;
}

function isTurn(value: unknown): value is MentorTurn {
  if (value === null || typeof value !== "object") return false;
  const turn = value as Partial<MentorTurn>;
  return (
    typeof turn.id === "string" &&
    typeof turn.at === "string" &&
    typeof turn.stepId === "string" &&
    typeof turn.hintLevel === "number" &&
    typeof turn.source === "string" &&
    typeof turn.safety === "string"
  );
}

function prune(turns: readonly MentorTurn[], nowMs: number): MentorTurn[] {
  const cutoff = nowMs - MENTOR_TURN_RETENTION_DAYS * DAY_MS;
  return turns
    .filter((turn) => {
      const atMs = Date.parse(turn.at);
      // Unparseable timestamps are dropped rather than kept forever.
      return Number.isFinite(atMs) && atMs >= cutoff;
    })
    .slice(0, MENTOR_TURN_LIMIT);
}

function read(childId: string, storage: MentorStorage, nowMs: number): MentorTurn[] {
  const raw = storage.get(key(childId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return prune(parsed.filter(isTurn), nowMs);
  } catch {
    // Corrupt record: start fresh instead of wedging the parent view.
    return [];
  }
}

interface TurnOptions {
  readonly storage?: MentorStorage;
  readonly nowMs?: number;
}

/** Append one turn (newest first, pruned to the 90-day retention window). */
export function logMentorTurn(
  childId: string,
  turn: Omit<MentorTurn, "id">,
  options: TurnOptions = {},
): MentorTurn {
  const storage = options.storage ?? defaultMentorStorage();
  const nowMs = options.nowMs ?? Date.now();
  const record: MentorTurn = {
    id: `m_${crypto.randomUUID()}`,
    at: turn.at,
    stepId: turn.stepId,
    hintLevel: turn.hintLevel,
    source: turn.source,
    safety: turn.safety,
  };
  const turns = [record, ...read(childId, storage, nowMs)].slice(0, MENTOR_TURN_LIMIT);
  storage.set(key(childId), JSON.stringify(turns));
  return record;
}

/** Newest-first turn list for the parent view, retention-pruned. */
export function listMentorTurns(
  childId: string,
  options: TurnOptions = {},
): readonly MentorTurn[] {
  const storage = options.storage ?? defaultMentorStorage();
  const nowMs = options.nowMs ?? Date.now();
  return read(childId, storage, nowMs);
}
