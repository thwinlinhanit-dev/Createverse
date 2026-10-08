import { describe, expect, it } from "vitest";
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  ContentBundleSchema,
  ExperienceSpecSchema,
  HintLadderSchema,
  ProgressEventSchema,
  ProjectSchema,
  SkillSchema,
  type ContentBundle,
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

describe("ExperienceSpecSchema", () => {
  const validSpec = {
    experience_id: "exp.test",
    version: 1,
    stage: "explorer",
    age_range: [6, 8],
    difficulty: 2,
    learning_objectives: ["concept.force"],
    mission: { title_key: "exp.test.title", objective_key: "exp.test.objective" },
    constraints: { max_pieces: 10, budget: 100, gap_width: 3 },
    assessment: { success_conditions: ["vehicle_crosses"] },
  };

  it("accepts a minimal spec with bridge constraints", () => {
    expect(ExperienceSpecSchema.safeParse(validSpec).success).toBe(true);
  });

  it("rejects unknown step_override keys (EXPERIENCE_RUNTIME §4)", () => {
    const result = ExperienceSpecSchema.safeParse({
      ...validSpec,
      step_overrides: {
        "step.bridge.e2": { max_pieces: 6, sneaky_key: true },
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts known step_override keys", () => {
    const result = ExperienceSpecSchema.safeParse({
      ...validSpec,
      step_overrides: {
        "step.bridge.e2": { build_enabled: false, vehicle: "truck", force_view: true },
      },
    });
    expect(result.success).toBe(true);
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

describe("ContentBundleSchema (P1-04 runtime loader gate)", () => {
  const validBundle: ContentBundle = {
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    locale: "en",
    stage: "junior",
    graph: {
      concepts: [
        {
          id: "concept.force",
          version: 1,
          name_key: "concept.force.name",
          prerequisites: [],
          tags: ["physics"],
        },
      ],
      skills: [
        {
          id: "skill.experimentation",
          version: 1,
          name_key: "skill.experimentation.name",
          levels: 5,
        },
      ],
      interests: [
        {
          id: "interest.engineering",
          version: 1,
          name_key: "interest.engineering.name",
          parent: null,
        },
      ],
    },
    projects: [validProject],
    steps: [
      {
        id: "step.bridge.j1",
        version: 1,
        type: "intro",
        status: "draft",
        prompt_key: "step.bridge.j1.prompt",
        concepts: [],
        skills: [],
        extensions: [],
      },
    ],
    ladders: [
      {
        id: "hints.bridge.j1",
        version: 1,
        solution_allowed_after: 3,
        levels: [
          { level: 1, type: "ask", text_key: "hints.bridge.j1.1" },
          { level: 2, type: "hint", text_key: "hints.bridge.j1.2" },
          { level: 3, type: "smaller_hint", text_key: "hints.bridge.j1.3" },
          { level: 4, type: "demonstrate", text_key: "hints.bridge.j1.4" },
        ],
        status: "draft",
      },
    ],
    assessments: [],
    experiences: [],
    messages: { "step.bridge.j1.prompt": "Look at the gap." },
  };

  it("accepts a valid bundle", () => {
    expect(ContentBundleSchema.safeParse(validBundle).success).toBe(true);
  });

  it("rejects a bundle with the wrong format marker (stale cache, wrong file)", () => {
    const result = ContentBundleSchema.safeParse({ ...validBundle, format: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects a bundle with a newer schema version (needs an upgrader, not a silent load)", () => {
    const result = ContentBundleSchema.safeParse({
      ...validBundle,
      schemaVersion: BUNDLE_SCHEMA_VERSION + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bundle whose locale or stage does not match the file it came from", () => {
    // The loader checks this separately too; the schema pins the value sets.
    expect(
      ContentBundleSchema.safeParse({ ...validBundle, locale: "fr" }).success,
    ).toBe(false);
    expect(
      ContentBundleSchema.safeParse({ ...validBundle, stage: "inventor" }).success,
    ).toBe(false);
  });
});
