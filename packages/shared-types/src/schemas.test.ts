import { describe, expect, it } from "vitest";
import {
  HintLadderSchema,
  ProgressEventSchema,
  ProjectSchema,
  SkillSchema,
  type Project,
} from "./index.ts";

const lane = { age_range: [3, 5] as [number, number], steps: ["step.bridge.j1"], experience: "exp.bridge.j" };

const validProject: Project = {
  id: "project.bridge",
  version: 1,
  status: "draft",
  title_key: "project.bridge.title",
  story_key: "project.bridge.story",
  mission_key: "project.bridge.mission",
  interests: ["interest.engineering"],
  lanes: {
    junior: lane,
    explorer: { age_range: [6, 8], steps: ["step.bridge.e1"], experience: "exp.bridge.e" },
    maker: { age_range: [8, 10], steps: ["step.bridge.m1"], experience: "exp.bridge.m" },
  },
  learning_objectives: ["concept.load"],
  required_skills: ["skill.experimentation"],
  materials: [],
  reflection_prompts: ["reflection.what_worked"],
  portfolio_artifact: { kind: "experiment_result" },
  safety: { risk_class: "low", notes_key: "project.bridge.safety" },
};

describe("ProjectSchema", () => {
  it("accepts a valid three-lane project", () => {
    expect(ProjectSchema.safeParse(validProject).success).toBe(true);
  });

  it("rejects a project without a maker lane", () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      lanes: { junior: lane, explorer: lane },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown field-free invalid risk class", () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      safety: { risk_class: "extreme", notes_key: "project.bridge.safety" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an age range where min > max", () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      lanes: {
        ...validProject.lanes,
        junior: { ...lane, age_range: [5, 3] },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("HintLadderSchema", () => {
  const base = {
    id: "hints.bridge.e2",
    version: 1,
    solution_allowed_after: 3,
    levels: [1, 2, 3, 4].map((level) => ({
      level,
      type: level === 1 ? "ask" : level === 2 ? "hint" : level === 3 ? "smaller_hint" : "demonstrate",
      text_key: `hints.bridge.e2.${level}`,
    })),
  };

  it("accepts four sequential levels", () => {
    expect(HintLadderSchema.safeParse(base).success).toBe(true);
  });

  it("rejects fewer than four levels (DATA_MODEL §2.7)", () => {
    const result = HintLadderSchema.safeParse({ ...base, levels: base.levels.slice(0, 3) });
    expect(result.success).toBe(false);
  });

  it("rejects non-sequential levels", () => {
    const result = HintLadderSchema.safeParse({
      ...base,
      levels: base.levels.map((entry) => (entry.level === 2 ? { ...entry, level: 5 } : entry)),
    });
    expect(result.success).toBe(false);
  });
});

describe("SkillSchema", () => {
  it("rejects zero skill levels", () => {
    const result = SkillSchema.safeParse({
      id: "skill.experimentation",
      version: 1,
      name_key: "skill.experimentation.name",
      levels: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("ProgressEventSchema", () => {
  const validEvent = {
    event_id: "0199a1c2-0000-7000-8000-000000000001",
    child_id: "c_1",
    device_id: "d_1",
    type: "child.project.started",
    schema_version: 1,
    occurred_at: "2026-10-06T10:00:00.000Z",
    received_at: "2026-10-06T10:00:01.000Z",
    content_id: "project.bridge",
    content_version: 1,
    payload: {},
  };

  it("accepts a valid event", () => {
    expect(ProgressEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("rejects a non-uuid event_id (sync dedupe depends on it)", () => {
    const result = ProgressEventSchema.safeParse({ ...validEvent, event_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO timestamp", () => {
    const result = ProgressEventSchema.safeParse({ ...validEvent, occurred_at: "yesterday" });
    expect(result.success).toBe(false);
  });
});
