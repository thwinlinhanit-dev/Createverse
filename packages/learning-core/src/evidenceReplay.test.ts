import { describe, expect, it } from "vitest";
import {
  ACTIVITY_SKILL_STRENGTH,
  replayEvidence,
  type ReplayAssessment,
  type ReplayEvent,
} from "./index.ts";

/**
 * P1-06 test plan: replay fixture events and compare derived rows.
 * Sources: TASKS_PHASE_0_1.md P1-06, DATA_MODEL.md §2.5 (assessment signal
 * strengths), §4 (event catalogue), §5 (concept/skill levels).
 */

// A hour after the last fixture event, so same-day decay is under 0.2%.
const NOW = Date.UTC(2026, 9, 9, 4);
const T0 = "2026-10-09T00:00:00.000Z";
const T1 = "2026-10-09T01:00:00.000Z";
const T2 = "2026-10-09T02:00:00.000Z";
const T3 = "2026-10-09T03:00:00.000Z";
const T_NOW = "2026-10-09T04:00:00.000Z"; // == NOW, zero decay

function event(
  type: string,
  payload: Readonly<Record<string, unknown>>,
  occurredAt: string,
): ReplayEvent {
  return { type, occurred_at: occurredAt, payload };
}

/** DATA_MODEL §2.5 example: assess.bridge.e2. */
const ASSESSMENT: ReplayAssessment = {
  id: "assess.bridge.e2",
  version: 1,
  evidence: [
    { signal: "experience.success", skill: "skill.experimentation", strength: 0.6 },
    { signal: "iterations>=2", skill: "skill.experimentation", strength: 0.3 },
    { signal: "reflection.complete", concept: "concept.load", strength: 0.4 },
  ],
};

/** One full bridge pass: intro → experiment run → step completion → reflection. */
function fixtureEvents(): ReplayEvent[] {
  return [
    event(
      "child.activity.completed",
      {
        step_id: "step.bridge.j1",
        outcome: "success",
        hints_used: 0,
        iterations: 1,
        concepts: ["concept.load"],
        skills: [],
        step_type: "intro",
      },
      T0,
    ),
    event(
      "child.experiment.executed",
      {
        experience_id: "exp.bridge.j",
        vehicle: "car",
        success: true,
        reasons: "",
        cost: 1,
        peak_load_ratio: 0.4,
        iterations: 2,
      },
      T1,
    ),
    event(
      "child.activity.completed",
      {
        step_id: "step.bridge.j2",
        outcome: "success",
        hints_used: 1,
        iterations: 2,
        concepts: ["concept.load"],
        skills: ["skill.experimentation"],
        step_type: "experiment",
      },
      T2,
    ),
    event(
      "child.reflection.submitted",
      { prompts: ["reflection.what_worked"], answers: 1 },
      T3,
    ),
  ];
}

describe("replayEvidence (invariant 3)", () => {
  it("rebuilds the documented §2.5 rows from a fixture log", () => {
    const rows = replayEvidence(fixtureEvents(), {
      nowMs: NOW,
      assessments: [ASSESSMENT],
    });

    // skill.experimentation: activity success 0.6 + experience.success 0.6
    // + iterations>=2 0.3, all fresh (same day → no decay yet).
    expect(rows.skills).toHaveLength(1);
    const skill = rows.skills[0]!;
    expect(skill.skillId).toBe("skill.experimentation");
    expect(skill.evidenceCount).toBe(3);
    expect(skill.strengthTotal).toBeCloseTo(1.5, 5);
    expect(skill.weightedSum).toBeCloseTo(1.5, 2); // same-day decay < 0.2%
    expect(skill.level).toBe(1); // floor(1.5), mapped to configured levels
    expect(skill.lastSeenAt).toBe(T2);

    // concept.load: intro seen (1) → experiment success demonstrated (3)
    // → reflection explained (4). Levels never drop (DATA_MODEL §5).
    expect(rows.concepts).toEqual([
      {
        conceptId: "concept.load",
        level: 4,
        evidenceCount: 3,
        lastSeenAt: T3,
      },
    ]);
  });

  it("is deterministic: same log + clock → identical rows", () => {
    const options = { nowMs: NOW, assessments: [ASSESSMENT] };
    const first = replayEvidence(fixtureEvents(), options);
    const second = replayEvidence(fixtureEvents(), options);
    expect(second).toEqual(first);
  });

  it("does not depend on storage order (replays by occurred_at)", () => {
    const options = { nowMs: NOW, assessments: [ASSESSMENT] };
    const forward = replayEvidence(fixtureEvents(), options);
    const reversed = replayEvidence([...fixtureEvents()].reverse(), options);
    expect(reversed).toEqual(forward);
  });

  it("decays older evidence as the clock advances", () => {
    const events = fixtureEvents();
    const fresh = replayEvidence(events, { nowMs: NOW, assessments: [ASSESSMENT] });
    const later = replayEvidence(events, {
      nowMs: NOW + 30 * 86_400_000, // one half-life later
      assessments: [ASSESSMENT],
    });
    const freshSkill = fresh.skills[0]!;
    const laterSkill = later.skills[0]!;
    expect(laterSkill.weightedSum).toBeCloseTo(freshSkill.weightedSum / 2, 4);
    expect(laterSkill.weightedSum).toBeLessThan(freshSkill.weightedSum);
    expect(laterSkill.level).toBe(0); // 0.75 decays below the level-1 threshold
  });

  it("maps levels from the content graph when provided", () => {
    const rows = replayEvidence(fixtureEvents(), {
      nowMs: NOW,
      assessments: [ASSESSMENT],
      levelsBySkill: { "skill.experimentation": 1 },
    });
    expect(rows.skills[0]!.level).toBe(1); // clamped to the skill's own levels

    // Without assessments the experiment/reflection signals resolve to
    // nothing: only the activity's own skill tag remains.
    const noAssessment = replayEvidence(fixtureEvents(), {
      nowMs: NOW,
      assessments: [],
    });
    expect(noAssessment.skills).toHaveLength(1);
    expect(noAssessment.skills[0]!.evidenceCount).toBe(1);
    expect(noAssessment.skills[0]!.strengthTotal).toBeCloseTo(0.6, 5);
    expect(noAssessment.skills[0]!.level).toBe(0); // 0.6 < level-1 threshold
    // The reflection concept also needs the assessment to be attributed.
    expect(noAssessment.concepts).toHaveLength(1);
    expect(noAssessment.concepts[0]!.level).toBe(3); // demonstrated, not explained
  });

  it("ignores unknown event types and malformed payloads", () => {
    const rows = replayEvidence(
      [
        event("child.project.started", { project_id: "project.bridge" }, T0),
        event("ai.hint.requested", { step_id: "step.bridge.j1", level: 1 }, T1),
        event("child.activity.completed", { outcome: "success" }, T2), // no tags
        event("child.activity.completed", { outcome: "skipped", skills: ["skill.experimentation"], concepts: ["concept.load"] }, T3),
        event("child.skill.updated", { skill_id: "skill.experimentation", delta: 0.2 }, T_NOW),
      ],
      { nowMs: NOW },
    );
    expect(rows.skills).toEqual([
      {
        skillId: "skill.experimentation",
        evidenceCount: 1,
        strengthTotal: 0.2,
        weightedSum: expect.closeTo(0.2, 5),
        level: 0,
        lastSeenAt: T_NOW,
      },
    ]);
    expect(rows.concepts).toHaveLength(0); // skipped is not evidence of seeing
  });

  it("treats legacy activity events without step_type as plain activities", () => {
    const rows = replayEvidence(
      [
        event(
          "child.activity.completed",
          { outcome: "success", concepts: ["concept.structure"], skills: [] },
          T0,
        ),
      ],
      { nowMs: NOW },
    );
    expect(rows.concepts[0]).toEqual({
      conceptId: "concept.structure",
      level: 2, // practiced
      evidenceCount: 1,
      lastSeenAt: T0,
    });
  });

  it("exposes the §2.5 activity strength table", () => {
    expect(ACTIVITY_SKILL_STRENGTH.success).toBeCloseTo(0.6, 5);
    expect(ACTIVITY_SKILL_STRENGTH.partial).toBeCloseTo(0.3, 5);
    expect(ACTIVITY_SKILL_STRENGTH.skipped).toBe(0);
  });
});
