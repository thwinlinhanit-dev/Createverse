/**
 * P1-06 skill-evidence replay.
 *
 * Sources: TASKS_PHASE_0_1.md P1-06, DATA_MODEL.md §5 + §2.5.
 * Scope: tag-based skills with evidence events only. No graph reasoning and
 * no mastery-rule parser (P2-04 owns rubrics).
 *
 * Invariant 3 (DATA_MODEL): replaying the same event log always reproduces
 * the same `skill_evidence` / `concept_progress` rows. Every input is an id,
 * number, or enum from the event payload — never free text — and rows are
 * emitted sorted by id, so output is byte-stable for a given log and clock.
 */
import {
  applyConceptEvidence,
  type ConceptEvidenceKind,
} from "./conceptProgress.ts";
import {
  DEFAULT_HALF_LIFE_DAYS,
  deriveSkillState,
  type EvidenceItem,
} from "./skillEvidence.ts";

export interface ReplayEvent {
  readonly type: string;
  readonly occurred_at: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ReplayAssessmentSignal {
  readonly signal: string;
  readonly skill?: string;
  readonly concept?: string;
  readonly strength: number;
}

export interface ReplayAssessment {
  readonly id: string;
  readonly version: number;
  readonly evidence: readonly ReplayAssessmentSignal[];
}

export interface SkillEvidenceRow {
  readonly skillId: string;
  readonly evidenceCount: number;
  readonly strengthTotal: number;
  readonly weightedSum: number;
  readonly level: number;
  readonly lastSeenAt: string | null;
}

export interface ConceptProgressRow {
  readonly conceptId: string;
  readonly level: number;
  readonly evidenceCount: number;
  readonly lastSeenAt: string | null;
}

export interface EvidenceReplay {
  readonly skills: readonly SkillEvidenceRow[];
  readonly concepts: readonly ConceptProgressRow[];
}

export interface ReplayOptions {
  /** Clock for decay (injected so tests and parent snapshots are pinned). */
  readonly nowMs: number;
  /** Decay half-life in days; defaults to `DEFAULT_HALF_LIFE_DAYS`. */
  readonly halfLifeDays?: number;
  /**
   * Skill id → configured level count (content `graph/skills.json`).
   * Unknown skills fall back to `DEFAULT_SKILL_LEVELS`.
   */
  readonly levelsBySkill?: Readonly<Record<string, number>>;
  /**
   * Content assessments (DATA_MODEL §2.5). Experiment and reflection events
   * carry no skill/concept tags of their own, so their signals are resolved
   * against these definitions ("experience.success", "iterations>=2",
   * "reflection.complete", ...).
   */
  readonly assessments?: readonly ReplayAssessment[];
}

/** Fallback level count when the content graph does not list a skill. */
export const DEFAULT_SKILL_LEVELS = 5;

/**
 * Strength a completed activity contributes to each skill tagged on its step
 * (DATA_MODEL §2.5 uses the same fractional magnitudes: 0.6 / 0.3). Skipped
 * attempts contribute nothing at all — exposure is not evidence.
 */
export const ACTIVITY_SKILL_STRENGTH: Readonly<Record<string, number>> = {
  success: 0.6,
  partial: 0.3,
  failed: 0.1,
  skipped: 0,
};

/** Signals fired by an event (DATA_MODEL §4 event catalogue → §2.5 signals). */
function firedSignals(event: ReplayEvent): readonly string[] {
  if (event.type === "child.experiment.executed") {
    const signals: string[] = [];
    if (event.payload["success"] === true) signals.push("experience.success");
    if (asNumber(event.payload["iterations"]) >= 2) signals.push("iterations>=2");
    return signals;
  }
  if (event.type === "child.reflection.submitted") {
    return ["reflection.complete"];
  }
  return [];
}

/**
 * Concept evidence kind for a completed step (DATA_MODEL §5):
 * intro/learn → seen; activity → practiced; experiment/challenge success →
 * demonstrated (their strength comes from the run itself); anything weaker
 * on those steps still proves exposure at minimum. A missing `step_type`
 * (events written before P1-06) is treated as a plain activity. A skipped
 * attempt is not evidence of anything — it earns no concept row.
 */
function conceptKindForActivity(
  stepType: string | undefined,
  outcome: string | undefined,
): ConceptEvidenceKind | null {
  if (outcome === "skipped") return null;
  if (stepType === "intro" || stepType === "learn") return "seen";
  const success = outcome === "success";
  const partial = outcome === "partial";
  if (stepType === "experiment" || stepType === "challenge") {
    if (success) return "successful"; // DATA_MODEL "demonstrated" = level 3
    return partial ? "practiced" : "seen";
  }
  return success || partial ? "practiced" : "seen";
}

/** Concept evidence kind for a fired assessment signal on this event type. */
function conceptKindForSignal(eventType: string): ConceptEvidenceKind {
  // A completed reflection is an explanation (DATA_MODEL §5, level 4);
  // a fired experiment signal demonstrates the concept (level 3,
  // `successful` in CONCEPT_EVIDENCE_LEVELS).
  return eventType === "child.reflection.submitted" ? "explained" : "successful";
}

interface MutableSkill {
  items: EvidenceItem[];
  strengthTotal: number;
  lastSeenAt: string | null;
}

interface MutableConcept {
  level: number;
  evidenceCount: number;
  lastSeenAt: string | null;
}

/**
 * Replay an append-only event log into skill-evidence and concept-progress
 * rows. Events are processed in `occurred_at` order (insertion order breaks
 * ties), and both derivations are commutative, so the result depends only on
 * the set of events and the injected clock — never on storage order.
 */
export function replayEvidence(
  events: readonly ReplayEvent[],
  options: ReplayOptions,
): EvidenceReplay {
  const halfLifeDays = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const levelsBySkill = options.levelsBySkill ?? {};
  const assessments = options.assessments ?? [];

  const ordered = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      a.event.occurred_at < b.event.occurred_at
        ? -1
        : a.event.occurred_at > b.event.occurred_at
          ? 1
          : a.index - b.index,
    );

  const skills = new Map<string, MutableSkill>();
  const concepts = new Map<string, MutableConcept>();

  function addSkillEvidence(skillId: string, strength: number, event: ReplayEvent): void {
    if (!Number.isFinite(strength) || strength <= 0) return;
    let row = skills.get(skillId);
    if (!row) {
      row = { items: [], strengthTotal: 0, lastSeenAt: null };
      skills.set(skillId, row);
    }
    row.items.push({ strength, atMs: Date.parse(event.occurred_at) });
    row.strengthTotal += strength;
    if (row.lastSeenAt === null || event.occurred_at > row.lastSeenAt) {
      row.lastSeenAt = event.occurred_at;
    }
  }

  function addConceptEvidence(conceptId: string, kind: ConceptEvidenceKind, event: ReplayEvent): void {
    const row = concepts.get(conceptId) ?? { level: 0, evidenceCount: 0, lastSeenAt: null };
    row.level = applyConceptEvidence(row.level, kind);
    row.evidenceCount += 1;
    if (row.lastSeenAt === null || event.occurred_at > row.lastSeenAt) {
      row.lastSeenAt = event.occurred_at;
    }
    concepts.set(conceptId, row);
  }

  for (const { event } of ordered) {
    if (event.type === "child.activity.completed") {
      const outcome = typeof event.payload["outcome"] === "string"
        ? event.payload["outcome"]
        : undefined;
      const strength = outcome !== undefined ? (ACTIVITY_SKILL_STRENGTH[outcome] ?? 0) : 0;
      for (const skillId of asStrings(event.payload["skills"])) {
        addSkillEvidence(skillId, strength, event);
      }
      const stepType = typeof event.payload["step_type"] === "string"
        ? event.payload["step_type"]
        : undefined;
      const kind = conceptKindForActivity(stepType, outcome);
      if (kind !== null) {
        for (const conceptId of asStrings(event.payload["concepts"])) {
          addConceptEvidence(conceptId, kind, event);
        }
      }
      continue;
    }

    if (event.type === "child.skill.updated") {
      const skillId = event.payload["skill_id"];
      if (typeof skillId === "string") {
        addSkillEvidence(skillId, asNumber(event.payload["delta"]), event);
      }
      continue;
    }

    const signals = firedSignals(event);
    if (signals.length === 0) continue;
    for (const assessment of assessments) {
      for (const signal of assessment.evidence) {
        if (!signals.includes(signal.signal)) continue;
        if (signal.skill !== undefined) addSkillEvidence(signal.skill, signal.strength, event);
        if (signal.concept !== undefined) {
          addConceptEvidence(signal.concept, conceptKindForSignal(event.type), event);
        }
      }
    }
  }

  const skillRows: SkillEvidenceRow[] = [...skills.entries()]
    .map(([skillId, row]) => {
      const levels = levelsBySkill[skillId] ?? DEFAULT_SKILL_LEVELS;
      const state = deriveSkillState(row.items, options.nowMs, levels, halfLifeDays);
      return {
        skillId,
        evidenceCount: row.items.length,
        strengthTotal: row.strengthTotal,
        weightedSum: state.weightedSum,
        level: state.level,
        lastSeenAt: row.lastSeenAt,
      };
    })
    .sort((a, b) => a.skillId.localeCompare(b.skillId));

  const conceptRows: ConceptProgressRow[] = [...concepts.entries()]
    .map(([conceptId, row]) => ({
      conceptId,
      level: row.level,
      evidenceCount: row.evidenceCount,
      lastSeenAt: row.lastSeenAt,
    }))
    .sort((a, b) => a.conceptId.localeCompare(b.conceptId));

  return { skills: skillRows, concepts: conceptRows };
}

export { DEFAULT_HALF_LIFE_DAYS };
export type { ConceptEvidenceKind };

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
