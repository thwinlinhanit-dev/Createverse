import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Content pack loading.
 * Layout (DATA_MODEL.md §2, ARCHITECTURE.md §7):
 *   content/graph/{concepts,skills,interests}.json
 *   content/projects/*.project.json        one project object per file
 *   content/activities/steps.json          array of steps
 *   content/hints/ladders.json             array of hint ladders
 *   content/assessments/assessments.json   array of assessments (optional file)
 *   content/experiences/experiences.json   array of experience specs (optional file)
 *   content/locales/{en,zh-Hant}.json      flat key → message maps
 */

export interface Issue {
  readonly where: string;
  readonly message: string;
}

export interface Issues {
  readonly errors: Issue[];
  readonly warnings: Issue[];
}

export interface RawPack {
  readonly concepts: unknown;
  readonly skills: unknown;
  readonly interests: unknown;
  readonly projects: readonly unknown[];
  readonly steps: readonly unknown[];
  readonly ladders: readonly unknown[];
  readonly assessments: readonly unknown[];
  readonly experiences: readonly unknown[];
  readonly locales: Record<string, unknown>;
}

export interface LoadedPack {
  readonly raw: RawPack;
  readonly errors: Issue[];
}

function readJson(file: string, into: Issue[]): unknown {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    into.push({ where: file, message: "file is missing or unreadable" });
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    into.push({
      where: file,
      message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    });
    return undefined;
  }
}

function readArrayFile(file: string, into: Issue[]): unknown[] {
  const value = readJson(file, into);
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    into.push({ where: file, message: "expected a JSON array" });
    return [];
  }
  return value;
}

function readProjectFiles(dir: string, into: Issue[]): unknown[] {
  if (!existsSync(dir)) {
    into.push({ where: dir, message: "projects directory is missing" });
    return [];
  }
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    into.push({ where: dir, message: "no project files found" });
    return [];
  }
  const projects: unknown[] = [];
  for (const name of files) {
    const value = readJson(path.join(dir, name), into);
    if (value === undefined) continue;
    if (Array.isArray(value)) projects.push(...value);
    else projects.push(value);
  }
  return projects;
}

export function loadPack(rootDir: string): LoadedPack {
  const errors: Issue[] = [];
  const graphDir = path.join(rootDir, "graph");
  const localesDir = path.join(rootDir, "locales");

  const locales: Record<string, unknown> = {};
  for (const locale of ["en", "zh-Hant"]) {
    locales[locale] = readJson(path.join(localesDir, `${locale}.json`), errors);
  }

  const raw: RawPack = {
    concepts: readJson(path.join(graphDir, "concepts.json"), errors),
    skills: readJson(path.join(graphDir, "skills.json"), errors),
    interests: readJson(path.join(graphDir, "interests.json"), errors),
    projects: readProjectFiles(path.join(rootDir, "projects"), errors),
    steps: readArrayFile(path.join(rootDir, "activities", "steps.json"), errors),
    ladders: readArrayFile(path.join(rootDir, "hints", "ladders.json"), errors),
    assessments: readArrayFile(
      path.join(rootDir, "assessments", "assessments.json"),
      errors,
    ),
    experiences: readArrayFile(
      path.join(rootDir, "experiences", "experiences.json"),
      errors,
    ),
    locales,
  };

  return { raw, errors };
}
