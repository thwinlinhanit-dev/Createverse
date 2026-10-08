import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AssessmentSchema,
  ConceptSchema,
  ExperienceSpecSchema,
  HintLadderSchema,
  InterestSchema,
  ProjectSchema,
  SkillSchema,
  StepSchema,
} from "@createverse/shared-types";
import { z } from "zod";

/**
 * JSON Schema generation for editors (P0-08): the same Zod schemas the
 * validator enforces, emitted as JSON Schema so VS Code and friends can
 * complete and lint content files while they are being written.
 *
 * Generated files live in `content/schemas/` and are committed; a test fails
 * when they drift from the Zod source (run `pnpm content:schemas`).
 */

const OPTIONS = { io: "input", unrepresentable: "any" } as const;

export function generateJsonSchemas(): Record<string, unknown> {
  const schemas: Record<string, unknown> = {
    concept: z.toJSONSchema(ConceptSchema, OPTIONS),
    skill: z.toJSONSchema(SkillSchema, OPTIONS),
    interest: z.toJSONSchema(InterestSchema, OPTIONS),
    project: z.toJSONSchema(ProjectSchema, OPTIONS),
    step: z.toJSONSchema(StepSchema, OPTIONS),
    "hint-ladder": z.toJSONSchema(HintLadderSchema, OPTIONS),
    assessment: z.toJSONSchema(AssessmentSchema, OPTIONS),
    experience: z.toJSONSchema(ExperienceSpecSchema, OPTIONS),
    "locale-catalog": z.toJSONSchema(z.record(z.string(), z.string()), OPTIONS),
  };
  for (const [name, schema] of Object.entries(schemas)) {
    if (schema !== null && typeof schema === "object" && !("$schema" in schema)) {
      (schema as Record<string, unknown>)["$schema"] =
        "https://json-schema.org/draft/2020-12/schema";
    }
    if (schema !== null && typeof schema === "object" && !("title" in schema)) {
      (schema as Record<string, unknown>)["title"] = name;
    }
  }
  return schemas;
}

/** Write `<name>.schema.json` per schema into `outDir`. Returns sorted file names. */
export function writeJsonSchemas(outDir: string): string[] {
  const schemas = generateJsonSchemas();
  mkdirSync(outDir, { recursive: true });
  const files = Object.keys(schemas).sort();
  for (const name of files) {
    writeFileSync(
      path.join(outDir, `${name}.schema.json`),
      JSON.stringify(schemas[name], null, 2) + "\n",
      "utf8",
    );
  }
  return files.map((name) => `${name}.schema.json`);
}
