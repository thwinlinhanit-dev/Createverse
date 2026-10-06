import { CONCEPT_MAX_LEVEL } from "@createverse/shared-types";

/**
 * Concept level derivation.
 * Source: DATA_MODEL.md §5 — levels 0 (unseen) to 4 (explained); a level never drops,
 * it only gets reinforced.
 */

export const CONCEPT_EVIDENCE_LEVELS = {
  seen: 1,
  practiced: 2,
  successful: 3,
  explained: 4,
} as const;

export type ConceptEvidenceKind = keyof typeof CONCEPT_EVIDENCE_LEVELS;

export function applyConceptEvidence(
  currentLevel: number,
  kind: ConceptEvidenceKind,
): number {
  if (!Number.isInteger(currentLevel) || currentLevel < 0) {
    throw new Error("currentLevel must be a non-negative integer");
  }
  const target = CONCEPT_EVIDENCE_LEVELS[kind];
  if (target === undefined) {
    throw new Error(`unknown evidence kind: ${String(kind)}`);
  }
  // Monotonic: only ever reinforced, clamped to the maximum level.
  return Math.min(Math.max(currentLevel, target), CONCEPT_MAX_LEVEL);
}
