/**
 * Parent live-AI settings and the family kill switch (P1-07).
 *
 * Sources: AI_SPEC.md §7 (caps and gates), SECURITY.md (kill switch),
 * SAFETY.md §7/§13 (Junior never gets live AI). Default is OFF: Phase 1
 * ships no provider at all (ADR-0005), so these gates decide whether a
 * future approved provider may speak — they are real, tested, and honored
 * by MentorService on every request.
 *
 * Storage is injectable so tests run without a DOM; production uses
 * localStorage (device-local parent choice, no account sync until P1-10).
 */

export type LiveAiChoice = "off" | "explorer" | "maker";

export const LIVE_AI_STORAGE_KEY = "cv:mentor:live-ai";
export const KILL_SWITCH_STORAGE_KEY = "cv:mentor:kill-switch";

/** Minimal key/value storage so the module works without a browser. */
export interface MentorStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const memory = new Map<string, string>();

export function memoryStorage(): MentorStorage {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
  };
}

/** localStorage when available (jsdom/private mode fall back to memory). */
export function defaultMentorStorage(): MentorStorage {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cv:mentor:probe", "1");
      localStorage.removeItem("cv:mentor:probe");
      return {
        get: (key) => localStorage.getItem(key),
        set: (key, value) => localStorage.setItem(key, value),
      };
    }
  } catch {
    // Private mode or disabled storage: the session keeps working in memory.
  }
  return {
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => {
      memory.set(key, value);
    },
  };
}

function isChoice(value: unknown): value is LiveAiChoice {
  return value === "off" || value === "explorer" || value === "maker";
}

/** Parent switch (`settings.ai.*`). Default: off. */
export function getLiveAiChoice(storage: MentorStorage = defaultMentorStorage()): LiveAiChoice {
  const raw = storage.get(LIVE_AI_STORAGE_KEY);
  return isChoice(raw) ? raw : "off";
}

export function setLiveAiChoice(
  choice: LiveAiChoice,
  storage: MentorStorage = defaultMentorStorage(),
): void {
  storage.set(LIVE_AI_STORAGE_KEY, choice);
}

/** SECURITY.md kill switch: an "on" value turns live AI off instantly. */
export function isKillSwitchOn(storage: MentorStorage = defaultMentorStorage()): boolean {
  return storage.get(KILL_SWITCH_STORAGE_KEY) === "on";
}

/**
 * Whether live AI may run for this stage under the parent's choice.
 * Junior is never allowed (SAFETY.md §7 / §13 decision 2), and the
 * "On for Explorer" / "On for Maker" choices allow only that stage.
 */
export function liveAiAllowsStage(choice: LiveAiChoice, stage: string): boolean {
  if (stage === "junior") return false;
  return choice === stage;
}
