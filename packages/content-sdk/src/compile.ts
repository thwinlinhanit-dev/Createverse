import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AssessmentSchema,
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  ConceptSchema,
  CONFIGURED_STAGES,
  ExperienceSpecSchema,
  HintLadderSchema,
  InterestSchema,
  LOCALES,
  ProjectSchema,
  SkillSchema,
  StepSchema,
  type Assessment,
  type Concept,
  type ExperienceSpec,
  type HintLadder,
  type Interest,
  type Locale,
  type Project,
  type Skill,
  type Stage,
  type Step,
} from "@createverse/shared-types";
import { loadPack, type Issue, type Issues, type RawPack } from "./load.ts";
import { validateRawPack } from "./validate.ts";
import { collectMessageKeys, parseArray, parseOne } from "./helpers.ts";

/**
 * Content compiler — ARCHITECTURE.md §7 (ADR-0007):
 *   validate → compile per (locale, stage) → static bundles in the app
 *
 * One bundle per (locale, stage) holds exactly what that combination needs:
 * the full concept/skill/interest graph, the projects that have a lane for the
 * stage, the steps/ladders/assessments/experience those lanes reference, and
 * the message keys those entities use, resolved from the locale catalog.
 *
 * Output is deterministic (everything sorted by id, messages sorted by key),
 * so a rebuild with unchanged content produces byte-identical files and the
 * app can cache them aggressively (service worker, ADR-0002).
 */

export { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION };

export interface ContentBundle {
  readonly format: typeof BUNDLE_FORMAT;
  readonly schemaVersion: typeof BUNDLE_SCHEMA_VERSION;
  readonly locale: Locale;
  readonly stage: Stage;
  readonly graph: {
    readonly concepts: readonly Concept[];
    readonly skills: readonly Skill[];
    readonly interests: readonly Interest[];
  };
  readonly projects: readonly Project[];
  readonly steps: readonly Step[];
  readonly ladders: readonly HintLadder[];
  readonly assessments: readonly Assessment[];
  readonly experiences: readonly ExperienceSpec[];
  /** Only the keys this bundle's content references, in this locale. */
  readonly messages: Readonly<Record<string, string>>;
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

interface ParsedPack {
  readonly concepts: Concept[];
  readonly skills: Skill[];
  readonly interests: Interest[];
  readonly projects: Project[];
  readonly steps: Step[];
  readonly ladders: HintLadder[];
  readonly assessments: Assessment[];
  readonly experiences: ExperienceSpec[];
}

function parsePack(raw: RawPack, errors: Issue[]): ParsedPack {
  const projects: Project[] = [];
  raw.projects.forEach((value, index) => {
    const project = parseOne(ProjectSchema, value, `projects[${index}]`, errors);
    if (project) projects.push(project);
  });
  return {
    concepts: parseArray(ConceptSchema, raw.concepts, "graph/concepts.json", errors),
    skills: parseArray(SkillSchema, raw.skills, "graph/skills.json", errors),
    interests: parseArray(InterestSchema, raw.interests, "graph/interests.json", errors),
    projects,
    steps: parseArray(StepSchema, raw.steps, "activities/steps.json", errors),
    ladders: parseArray(HintLadderSchema, raw.ladders, "hints/ladders.json", errors),
    assessments: parseArray(
      AssessmentSchema,
      raw.assessments,
      "assessments/assessments.json",
      errors,
    ),
    experiences: parseArray(
      ExperienceSpecSchema,
      raw.experiences,
      "experiences/experiences.json",
      errors,
    ),
  };
}

function messagesFor(
  sources: readonly unknown[],
  catalog: Readonly<Record<string, string>>,
): Record<string, string> {
  const keys = new Set<string>();
  for (const source of sources) collectMessageKeys(source, keys);
  const out: Record<string, string> = {};
  for (const key of [...keys].sort()) {
    const message = catalog[key];
    if (typeof message === "string") out[key] = message;
  }
  return out;
}

/** Pure: build every (locale, stage) bundle from an already-parsed pack. */
export function buildBundles(
  pack: ParsedPack,
  catalogs: Readonly<Record<string, Readonly<Record<string, string>>>>,
  stages: readonly Stage[],
): ContentBundle[] {
  const bundles: ContentBundle[] = [];
  for (const locale of LOCALES) {
    const catalog = catalogs[locale] ?? {};
    for (const stage of stages) {
      const laneProjects = pack.projects.filter((p) => p.lanes[stage] !== undefined);
      const stepIds = new Set(laneProjects.flatMap((p) => p.lanes[stage]?.steps ?? []));
      const steps = byId(pack.steps.filter((s) => stepIds.has(s.id)));
      const ladderIds = new Set(steps.map((s) => s.hint_ladder));
      const ladders = byId(pack.ladders.filter((l) => ladderIds.has(l.id)));
      const assessmentIds = new Set(
        steps.map((s) => s.assessment).filter((id): id is string => id !== undefined),
      );
      const assessments = byId(
        pack.assessments.filter((a) => assessmentIds.has(a.id)),
      );
      const experienceIds = new Set(
        laneProjects.map((p) => p.lanes[stage]?.experience).filter((id): id is string => !!id),
      );
      const experiences = pack.experiences
        .filter((e) => experienceIds.has(e.experience_id))
        .sort((a, b) => a.experience_id.localeCompare(b.experience_id));

      const messages = messagesFor(
        [
          ...pack.concepts,
          ...pack.skills,
          ...pack.interests,
          ...laneProjects,
          ...steps,
          ...ladders,
          ...assessments,
          ...experiences,
        ],
        catalog,
      );

      bundles.push({
        format: BUNDLE_FORMAT,
        schemaVersion: BUNDLE_SCHEMA_VERSION,
        locale,
        stage,
        graph: {
          concepts: byId(pack.concepts),
          skills: byId(pack.skills),
          interests: byId(pack.interests),
        },
        projects: byId(laneProjects),
        steps,
        ladders,
        assessments,
        experiences,
        messages,
      });
    }
  }
  return bundles;
}

export interface CompileResult extends Issues {
  readonly ok: boolean;
  /** Relative paths of the bundle files, sorted. Empty when compilation failed. */
  readonly files: readonly string[];
  readonly bundles: readonly ContentBundle[];
}

/**
 * Validate `rootDir` and compile bundles into `outDir` as
 * `<locale>/<stage>.json`. Nothing is written when validation fails.
 */
export function compilePack(rootDir: string, outDir: string): CompileResult {
  const loaded = loadPack(rootDir);
  const validated = validateRawPack(loaded.raw);
  const errors: Issue[] = [...loaded.errors, ...validated.errors];
  if (errors.length > 0) {
    return { ok: false, errors, warnings: validated.warnings, files: [], bundles: [] };
  }

  const parseErrors: Issue[] = [];
  const pack = parsePack(loaded.raw, parseErrors);
  if (parseErrors.length > 0) {
    // Validation passed but parsing failed — should not happen; surface it.
    return {
      ok: false,
      errors: parseErrors,
      warnings: validated.warnings,
      files: [],
      bundles: [],
    };
  }

  const catalogs: Record<string, Record<string, string>> = {};
  for (const locale of LOCALES) {
    const parsed = loaded.raw.locales[locale];
    catalogs[locale] =
      parsed !== null && typeof parsed === "object"
        ? (parsed as Record<string, string>)
        : {};
  }

  const bundles = buildBundles(pack, catalogs, [...CONFIGURED_STAGES]);
  const files: string[] = [];
  for (const bundle of bundles) {
    const file = `${bundle.locale}/${bundle.stage}.json`;
    const target = path.join(outDir, ...file.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(bundle, null, 2) + "\n", "utf8");
    files.push(file);
  }
  files.sort();

  return {
    ok: true,
    errors: [],
    warnings: validated.warnings,
    files,
    bundles,
  };
}
