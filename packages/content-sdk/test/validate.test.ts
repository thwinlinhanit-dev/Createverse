import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RawPack } from "../src/load.ts";
import { loadPack } from "../src/load.ts";
import { validatePack, validateRawPack } from "../src/validate.ts";

const CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "content",
);

function mutatedPack(mutate: (raw: RawPack) => void): ReturnType<typeof validateRawPack> {
  const { raw } = loadPack(CONTENT_DIR);
  const clone = structuredClone(raw) as RawPack;
  mutate(clone);
  return validateRawPack(clone);
}

describe("validatePack (real content directory)", () => {
  const result = validatePack(CONTENT_DIR);

  it("accepts the draft Build a Bridge pack with zero errors", () => {
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("warns that draft content still needs owner and native-speaker review", () => {
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.message.includes("SAFETY.md §13"))).toBe(true);
  });
});

describe("validateRawPack (mutated packs must fail — TASKS P0-08)", () => {
  it("fails when a zh-Hant translation key is missing", () => {
    const result = mutatedPack((raw) => {
      const locales = raw.locales["zh-Hant"] as Record<string, string>;
      delete locales["project.bridge.title"];
    });
    expect(result.errors.some((e) => e.message.includes("project.bridge.title"))).toBe(
      true,
    );
    expect(result.errors.some((e) => e.where.includes("zh-Hant"))).toBe(true);
  });

  it("fails when a lane references a step that does not exist", () => {
    const result = mutatedPack((raw) => {
      const project = raw.projects[0] as { lanes: { junior: { steps: string[] } } };
      project.lanes.junior.steps.push("step.bridge.ghost");
    });
    expect(result.errors.some((e) => e.message.includes("step.bridge.ghost"))).toBe(true);
  });

  it("fails when a project carries a high risk class (SAFETY §3)", () => {
    const result = mutatedPack((raw) => {
      const project = raw.projects[0] as { safety: { risk_class: string } };
      project.safety.risk_class = "high";
    });
    expect(result.errors.some((e) => e.message.includes("high"))).toBe(true);
  });

  it("fails when a step has no hint ladder (DATA_MODEL §2.7)", () => {
    const result = mutatedPack((raw) => {
      const steps = raw.steps as Array<Record<string, unknown>>;
      delete steps[0]!["hint_ladder"];
    });
    expect(result.errors.some((e) => e.message.includes("hint ladder"))).toBe(true);
  });

  it("fails when the maker lane is missing", () => {
    const result = mutatedPack((raw) => {
      const project = raw.projects[0] as { lanes: Record<string, unknown> };
      delete project.lanes["maker"];
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("fails when a hint ladder has fewer than four levels", () => {
    const result = mutatedPack((raw) => {
      const ladders = raw.ladders as Array<{ levels: unknown[] }>;
      ladders[0]!.levels = ladders[0]!.levels.slice(0, 3);
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("fails when a lane points at an experience for the wrong stage", () => {
    const result = mutatedPack((raw) => {
      const project = raw.projects[0] as { lanes: { junior: { experience: string } } };
      project.lanes.junior.experience = "exp.bridge.m";
    });
    expect(result.errors.some((e) => e.message.includes("stage"))).toBe(true);
  });

  it("fails when a concept prerequisite does not exist", () => {
    const result = mutatedPack((raw) => {
      const concepts = raw.concepts as Array<{ prerequisites: string[] }>;
      concepts[0]!.prerequisites.push("concept.ghost");
    });
    expect(result.errors.some((e) => e.message.includes("concept.ghost"))).toBe(true);
  });

  it("reports duplicate ids", () => {
    const result = mutatedPack((raw) => {
      const skills = raw.skills as unknown[];
      skills.push(structuredClone(skills[0]));
    });
    expect(result.errors.some((e) => e.message.includes("duplicate id"))).toBe(true);
  });
});
