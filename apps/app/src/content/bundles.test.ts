import { describe, expect, it } from "vitest";
import { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION } from "@createverse/shared-types";
import {
  BundleLoadError,
  bundleUrl,
  clearBundleCache,
  loadBundle,
} from "./bundles.ts";

/**
 * P1-04 acceptance: bad content is rejected at build (gen-content.ts fails)
 * AND at load (this loader refuses it with a typed error the UI turns into
 * a calm fallback — never a half-loaded project).
 */

function validBundle(locale: string, stage: string): Record<string, unknown> {
  return {
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    locale,
    stage,
    graph: { concepts: [], skills: [], interests: [] },
    projects: [],
    steps: [],
    ladders: [],
    assessments: [],
    experiences: [],
    messages: {},
  };
}

function fetchOk(body: unknown) {
  return async () => ({ ok: true, status: 200, json: async () => body });
}

describe("loadBundle", () => {
  it("builds the per-locale-stage URL", () => {
    expect(bundleUrl("en", "junior")).toBe("/content/en/junior.json");
    expect(bundleUrl("zh-Hant", "maker")).toBe("/content/zh-Hant/maker.json");
  });

  it("loads and caches a valid bundle", async () => {
    clearBundleCache();
    let calls = 0;
    const bundle = await loadBundle("en", "junior", async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => validBundle("en", "junior") };
    });
    expect(bundle.locale).toBe("en");
    expect(bundle.stage).toBe("junior");
    await loadBundle("en", "junior", fetchOk(validBundle("en", "junior")));
    expect(calls).toBe(1);
  });

  it("reports a network failure as a typed error", async () => {
    clearBundleCache();
    const failure = loadBundle("en", "junior", async () => {
      throw new Error("offline");
    });
    await expect(failure).rejects.toMatchObject({ name: "BundleLoadError", kind: "network" });
  });

  it("reports an HTTP error as a typed network error", async () => {
    clearBundleCache();
    const failure = loadBundle("en", "junior", async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    await expect(failure).rejects.toMatchObject({ kind: "network" });
  });

  it("rejects a body that is not JSON", async () => {
    clearBundleCache();
    const failure = loadBundle("en", "junior", async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    }));
    await expect(failure).rejects.toMatchObject({ kind: "invalid-json" });
  });

  it("rejects a JSON body with the wrong format marker", async () => {
    clearBundleCache();
    const failure = loadBundle(
      "en",
      "junior",
      fetchOk({ ...validBundle("en", "junior"), format: "other" }),
    );
    await expect(failure).rejects.toMatchObject({ kind: "invalid-bundle" });
  });

  it("rejects a bundle with a newer schema version instead of loading it half-right", async () => {
    clearBundleCache();
    const failure = loadBundle(
      "en",
      "junior",
      fetchOk({ ...validBundle("en", "junior"), schemaVersion: 999 }),
    );
    await expect(failure).rejects.toMatchObject({ kind: "invalid-bundle" });
  });

  it("rejects a bundle whose locale/stage does not match the request", async () => {
    clearBundleCache();
    const failure = loadBundle(
      "en",
      "junior",
      fetchOk(validBundle("zh-Hant", "junior")),
    );
    await expect(failure).rejects.toMatchObject({ kind: "locale-stage-mismatch" });
  });

  it("a failed load is not cached: the next attempt retries the fetch", async () => {
    clearBundleCache();
    await expect(
      loadBundle("en", "explorer", fetchOk({ nope: true })),
    ).rejects.toBeInstanceOf(BundleLoadError);
    const bundle = await loadBundle(
      "en",
      "explorer",
      fetchOk(validBundle("en", "explorer")),
    );
    expect(bundle.stage).toBe("explorer");
  });
});
