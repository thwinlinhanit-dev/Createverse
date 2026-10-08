import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { LOCALES } from "@createverse/shared-types";
import { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION, compilePack } from "../src/compile.ts";
import { generateJsonSchemas, writeJsonSchemas } from "../src/jsonSchema.ts";
import { findSimplifiedChars } from "../src/zhHant.ts";
import { loadPack } from "../src/load.ts";
import { validateRawPack } from "../src/validate.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CONTENT_DIR = path.join(ROOT, "content");

const tmpDirs: string[] = [];
function tmpDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cv-content-"));
  tmpDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe("content compiler (ARCHITECTURE.md §7, P0-08)", () => {
  const outDir = path.join(tmpDir(), "bundles");
  const result = compilePack(CONTENT_DIR, outDir);

  it("compiles 3 stages × 2 languages", () => {
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.files).toEqual([
      "en/explorer.json",
      "en/junior.json",
      "en/maker.json",
      "zh-Hant/explorer.json",
      "zh-Hant/junior.json",
      "zh-Hant/maker.json",
    ]);
    for (const file of result.files) {
      expect(existsSync(path.join(outDir, file)), file).toBe(true);
    }
  });

  it("writes bundles that carry their format and coordinate", () => {
    for (const bundle of result.bundles) {
      const onDisk = JSON.parse(
        readFileSync(path.join(outDir, bundle.locale, `${bundle.stage}.json`), "utf8"),
      ) as Record<string, unknown>;
      expect(onDisk["format"]).toBe(BUNDLE_FORMAT);
      expect(onDisk["schemaVersion"]).toBe(BUNDLE_SCHEMA_VERSION);
      expect(onDisk["locale"]).toBe(bundle.locale);
      expect(onDisk["stage"]).toBe(bundle.stage);
    }
  });

  it("includes only the stage's lane: steps, ladders, assessments, experience", () => {
    for (const bundle of result.bundles) {
      const laneStepIds = new Set(
        bundle.projects.flatMap((p) => p.lanes[bundle.stage]?.steps ?? []),
      );
      expect(laneStepIds.size).toBeGreaterThan(0);
      expect(bundle.steps.map((s) => s.id).sort()).toEqual([...laneStepIds].sort());
      const ladderIds = new Set(bundle.steps.map((s) => s.hint_ladder));
      expect(new Set(bundle.ladders.map((l) => l.id))).toEqual(ladderIds);
      for (const experience of bundle.experiences) {
        expect(experience.stage).toBe(bundle.stage);
      }
      for (const project of bundle.projects) {
        expect(project.lanes[bundle.stage]).toBeDefined();
      }
    }
  });

  it("resolves the same message keys in both locales, zh-Hant fully traditional", () => {
    const byCoord = new Map(result.bundles.map((b) => [`${b.locale}/${b.stage}`, b]));
    for (const stage of ["junior", "explorer", "maker"]) {
      const en = byCoord.get(`en/${stage}`)!;
      const zh = byCoord.get(`zh-Hant/${stage}`)!;
      expect(Object.keys(en.messages).sort()).toEqual(Object.keys(zh.messages).sort());
      for (const message of Object.values(zh.messages)) {
        expect(findSimplifiedChars(message)).toEqual([]);
      }
      // Every included step's keys resolve.
      for (const step of en.steps) {
        expect(en.messages[step.prompt_key]).toBeTruthy();
        expect(zh.messages[step.prompt_key]).toBeTruthy();
      }
    }
  });

  it("is deterministic — identical content compiles to identical bundles", () => {
    const again = compilePack(CONTENT_DIR, path.join(tmpDir(), "bundles2"));
    expect(again.ok).toBe(true);
    expect(JSON.stringify(again.bundles)).toBe(JSON.stringify(result.bundles));
  });

  it("fails without writing anything when validation fails", () => {
    const out = path.join(tmpDir(), "never-written");
    // Missing content directory → load errors.
    const failed = compilePack(path.join(tmpDir(), "does-not-exist"), out);
    expect(failed.ok).toBe(false);
    expect(failed.errors.length).toBeGreaterThan(0);
    expect(failed.files).toEqual([]);
    expect(existsSync(out)).toBe(false);
  });
});

describe("JSON schemas for editors (P0-08)", () => {
  it("generates one schema per content entity plus the locale catalog", () => {
    const schemas = generateJsonSchemas();
    expect(Object.keys(schemas).sort()).toEqual([
      "assessment",
      "concept",
      "experience",
      "hint-ladder",
      "interest",
      "locale-catalog",
      "project",
      "skill",
      "step",
    ]);
    for (const [name, schema] of Object.entries(schemas)) {
      const record = schema as Record<string, unknown>;
      expect(record["$schema"], name).toContain("json-schema.org");
      expect(typeof record["type"], name).toBe("string");
    }
  });

  it("content/schemas on disk is up to date — run `pnpm content:schemas`", () => {
    const generated = generateJsonSchemas();
    for (const [name, schema] of Object.entries(generated)) {
      const file = path.join(CONTENT_DIR, "schemas", `${name}.schema.json`);
      expect(existsSync(file), `missing ${file}`).toBe(true);
      expect(JSON.parse(readFileSync(file, "utf8")), name).toEqual(schema);
    }
  });

  it("writes schema files that round-trip", () => {
    const out = path.join(tmpDir(), "schemas");
    const files = writeJsonSchemas(out);
    expect(files.length).toBe(9);
    expect(JSON.parse(readFileSync(path.join(out, "project.schema.json"), "utf8"))).toEqual(
      generateJsonSchemas()["project"],
    );
  });
});

describe("simplified-character check for zh-Hant (P0-08, ADR-0008)", () => {
  it("flags simplified-only characters anywhere in a string", () => {
    expect(findSimplifiedChars("盖一座桥").sort()).toEqual(["桥", "盖"].sort());
    expect(findSimplifiedChars("这辆车").sort()).toEqual(["这", "辆", "车"].sort());
    expect(findSimplifiedChars("组织网络").sort()).toEqual(["织", "组", "络", "网"].sort());
  });

  it("never flags legitimate Traditional characters, including shared forms", () => {
    expect(
      findSimplifiedChars("蓋一座橋，讓玩具車越過缺口。我們在預算內完成專題，先問大人。"),
    ).toEqual([]);
    // Valid in BOTH scripts — must not be flagged (documented in zhHant.ts).
    expect(findSimplifiedChars("面積、里長、台北市、只要、復習、皇后、刮風")).toEqual([]);
  });

  it("rejects a zh-Hant catalog entry containing a simplified character", () => {
    const { raw } = loadPack(CONTENT_DIR);
    const clone = structuredClone(raw) as typeof raw;
    const zh = clone.locales["zh-Hant"] as Record<string, string>;
    zh["project.bridge.title"] = "盖一座桥";
    const result = validateRawPack(clone);
    const simplifiedError = result.errors.find((e) => e.message.includes("Simplified"));
    expect(simplifiedError).toBeDefined();
    expect(simplifiedError?.where).toContain("zh-Hant");
    expect(simplifiedError?.message).toContain("盖");
  });

  it("accepts the real zh-Hant catalog unchanged", () => {
    const { raw } = loadPack(CONTENT_DIR);
    const result = validateRawPack(raw);
    expect(result.errors.filter((e) => e.message.includes("Simplified"))).toEqual([]);
  });
});

describe("locales", () => {
  it("still ships exactly en and zh-Hant", () => {
    expect([...LOCALES]).toEqual(["en", "zh-Hant"]);
  });
});
