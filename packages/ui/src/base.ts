/**
 * Base component props. Styling comes from design tokens only
 * (DESIGN_SYSTEM.md §2, §10) — no inline hex values, no per-preset logic.
 */

export type StagePresetName = "junior" | "explorer" | "maker" | "parent";

export interface CvComponentProps {
  readonly stage?: StagePresetName;
  readonly label: string;
}

export function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function dataStage(stage: StagePresetName | undefined): {
  "data-stage"?: StagePresetName;
} {
  return stage ? { "data-stage": stage } : {};
}
