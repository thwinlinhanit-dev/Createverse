import {
  AssessmentSchema,
  ConceptSchema,
  ExperienceSpecSchema,
  HintLadderSchema,
  InterestSchema,
  LOCALES,
  ProjectSchema,
  SkillSchema,
  StepSchema,
} from "@createverse/shared-types";
import { z } from "zod";
import { loadPack, type Issue, type Issues, type RawPack } from "./load.ts";
import {
  collectIds,
  collectMessageKeys,
  parseArray,
  parseOne,
  requireRefs,
} from "./helpers.ts";
import { findSimplifiedChars } from "./zhHant.ts";

const LocaleCatalogSchema = z.record(z.string(), z.string());

/**
 * Validate a raw content pack. Pure — no filesystem — so tests can mutate structures.
 * Rules: DATA_MODEL.md §2.7, ARCHITECTURE.md §7, SAFETY.md §3.
 */
export function validateRawPack(raw: RawPack): Issues {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  // 1. Schema validation -----------------------------------------------------
  const concepts = parseArray(ConceptSchema, raw.concepts, "graph/concepts.json", errors);
  const skills = parseArray(SkillSchema, raw.skills, "graph/skills.json", errors);
  const interests = parseArray(InterestSchema, raw.interests, "graph/interests.json", errors);

  const projects: import("@createverse/shared-types").Project[] = [];
  raw.projects.forEach((value, index) => {
    const project = parseOne(ProjectSchema, value, `projects[${index}]`, errors);
    if (project) projects.push(project);
  });

  const steps = parseArray(StepSchema, raw.steps, "activities/steps.json", errors);
  const ladders = parseArray(HintLadderSchema, raw.ladders, "hints/ladders.json", errors);
  const assessments = parseArray(
    AssessmentSchema,
    raw.assessments,
    "assessments/assessments.json",
    errors,
  );
  const experiences = parseArray(
    ExperienceSpecSchema,
    raw.experiences,
    "experiences/experiences.json",
    errors,
  );

  const conceptIds = collectIds(concepts, "graph/concepts.json", errors, (c) => c.id);
  const skillIds = collectIds(skills, "graph/skills.json", errors, (s) => s.id);
  const interestIds = collectIds(interests, "graph/interests.json", errors, (i) => i.id);
  const stepIds = collectIds(steps, "activities/steps.json", errors, (s) => s.id);
  const ladderIds = collectIds(ladders, "hints/ladders.json", errors, (l) => l.id);
  const assessmentIds = collectIds(
    assessments,
    "assessments/assessments.json",
    errors,
    (a) => a.id,
  );
  const experienceIds = collectIds(
    experiences,
    "experiences/experiences.json",
    errors,
    (e) => e.experience_id,
  );

  // 2. Graph references ------------------------------------------------------
  for (const concept of concepts) {
    requireRefs(concept.prerequisites, conceptIds, concept.id, "prerequisites", errors);
  }

  // 3. Step references -------------------------------------------------------
  for (const step of steps) {
    requireRefs(step.concepts, conceptIds, step.id, "concepts", errors);
    requireRefs(step.skills, skillIds, step.id, "skills", errors);
    if (!step.hint_ladder) {
      errors.push({
        where: step.id,
        message: "every step needs a hint ladder with levels 1 to 4 (DATA_MODEL §2.7)",
      });
    } else if (!ladderIds.has(step.hint_ladder)) {
      errors.push({
        where: step.id,
        message: `hint_ladder "${step.hint_ladder}" does not exist`,
      });
    }
    if (step.assessment && !assessmentIds.has(step.assessment)) {
      errors.push({ where: step.id, message: `assessment "${step.assessment}" does not exist` });
    }
    if (step.experience_ref && !experienceIds.has(step.experience_ref)) {
      errors.push({
        where: step.id,
        message: `experience_ref "${step.experience_ref}" does not exist`,
      });
    }
  }

  // 4. Assessment and experience references ----------------------------------
  for (const assessment of assessments) {
    assessment.evidence.forEach((signal, index) => {
      if (signal.skill && !skillIds.has(signal.skill)) {
        errors.push({
          where: `${assessment.id}.evidence[${index}]`,
          message: `skill "${signal.skill}" does not exist`,
        });
      }
      if (signal.concept && !conceptIds.has(signal.concept)) {
        errors.push({
          where: `${assessment.id}.evidence[${index}]`,
          message: `concept "${signal.concept}" does not exist`,
        });
      }
    });
  }
  for (const experience of experiences) {
    requireRefs(
      experience.learning_objectives,
      conceptIds,
      experience.experience_id,
      "learning_objectives",
      errors,
    );
  }

  // 5. Project references, lanes, safety, review status ----------------------
  const experienceById = new Map(experiences.map((e) => [e.experience_id, e]));
  for (const project of projects) {
    requireRefs(project.interests, interestIds, project.id, "interests", errors);
    requireRefs(
      project.learning_objectives,
      conceptIds,
      project.id,
      "learning_objectives",
      errors,
    );
    requireRefs(project.required_skills, skillIds, project.id, "required_skills", errors);

    if (project.safety.risk_class === "high") {
      errors.push({
        where: `${project.id}.safety.risk_class`,
        message: "`high` risk is blocked for children (SAFETY.md §3)",
      });
    }

    for (const [stage, lane] of Object.entries(project.lanes)) {
      requireRefs(lane.steps, stepIds, project.id, `lanes.${stage}.steps`, errors);
      const experience = experienceById.get(lane.experience);
      if (!experience) {
        errors.push({
          where: `${project.id}.lanes.${stage}.experience`,
          message: `experience "${lane.experience}" does not exist`,
        });
      } else if (experience.stage !== stage) {
        errors.push({
          where: `${project.id}.lanes.${stage}.experience`,
          message: `experience "${lane.experience}" is for stage "${experience.stage}", not "${stage}"`,
        });
      }
    }

    if (project.status !== "approved") {
      warnings.push({
        where: project.id,
        message: `status is "${project.status}" — owner and native-speaker review required before the child sees it (SAFETY.md §13)`,
      });
    }
  }

  // 6. Localization completeness (DATA_MODEL.md §2.7) ------------------------
  const catalogs = new Map<string, Record<string, string>>();
  for (const locale of LOCALES) {
    const parsed = LocaleCatalogSchema.safeParse(raw.locales[locale]);
    if (!parsed.success) {
      errors.push({
        where: `locales/${locale}.json`,
        message: "missing or invalid locale catalog (expected an object of strings)",
      });
    } else {
      catalogs.set(locale, parsed.data);
    }
  }

  const keys = new Set<string>();
  const sources: unknown[] = [
    ...concepts,
    ...skills,
    ...interests,
    ...projects,
    ...steps,
    ...ladders,
    ...experiences,
  ];
  for (const source of sources) collectMessageKeys(source, keys);

  for (const [locale, catalog] of catalogs) {
    for (const key of keys) {
      const message = catalog[key];
      if (typeof message !== "string" || message.trim() === "") {
        errors.push({
          where: `locales/${locale}.json`,
          message: `missing or empty message for key "${key}"`,
        });
      }
    }
  }

  // 7. Simplified-character check for zh-Hant (P0-08; ADR-0008, SAFETY.md §13)
  const zhCatalog = catalogs.get("zh-Hant");
  if (zhCatalog) {
    for (const [key, message] of Object.entries(zhCatalog)) {
      const simplified = findSimplifiedChars(message);
      if (simplified.length > 0) {
        errors.push({
          where: "locales/zh-Hant.json",
          message: `key "${key}" contains Simplified-Chinese character(s) ${simplified
            .map((c) => `"${c}"`)
            .join(", ")} — zh-Hant must be Traditional only (ADR-0008)`,
        });
      }
    }
  }

  return { errors, warnings };
}

export function validatePack(rootDir: string): Issues & { ok: boolean } {
  const loaded = loadPack(rootDir);
  const result = validateRawPack(loaded.raw);
  const errors = [...loaded.errors, ...result.errors];
  return { ok: errors.length === 0, errors, warnings: result.warnings };
}

