/**
 * P1-09 — portfolio and artifacts (API_SPEC §5.7, DATA_MODEL §2.7).
 *
 * Test plan from TASKS_PHASE_0_1.md: upload allowlist and size-limit tests,
 * entry→artifact referential test, and the acceptance case — a completed
 * project produces an entry visible to child and parent. Role gates for the
 * eight new routes are generated in matrix.test.ts from the ROUTES table.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../src/api/middleware.ts";
import type { Db } from "../src/db/index.ts";
import { artifacts, portfolioEntries } from "../src/db/schema.ts";
import {
  auditActions,
  buildApp,
  jsonHeaders,
  openChildSession,
  readJson,
  resetLimits,
  seedChild,
  seedDevice,
  seedFamily,
  seedForeignFamily,
  type FlowState,
} from "./helpers.ts";
import { MAX_ARTIFACT_BYTES } from "../src/modules/artifacts/fileStore.ts";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BASE64 = PNG_BYTES.toString("base64");

let artifactDir: string;

interface State extends FlowState {
  childId: string;
  childToken: string;
  deviceCredential: string;
}

let app: Hono<AppEnv>;
let db: Db;
let state: State;

beforeEach(async () => {
  resetLimits();
  artifactDir = mkdtempSync(join(tmpdir(), "cv-artifacts-"));
  const testApp = buildApp({ artifactDir });
  app = testApp.app;
  db = testApp.db;
  const family = await seedFamily(app);
  const device = await seedDevice(app, family.parentToken);
  const childId = await seedChild(app, family.parentToken);
  const opened = await openChildSession(app, device.credential, childId);
  const childToken = (await readJson(opened)).session_token as string;
  state = {
    ...family,
    childId,
    childToken,
    deviceCredential: device.credential,
  };
});

afterAll(() => {
  if (artifactDir) rmSync(artifactDir, { recursive: true, force: true });
});

async function upload(token: string, overrides: Record<string, unknown> = {}): Promise<Response> {
  return await app.request("/api/v1/artifacts", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${token}` }),
    body: JSON.stringify({
      kind: "drawing",
      mime: "image/png",
      data_base64: PNG_BASE64,
      ...overrides,
    }),
  });
}

async function uploadOk(token = state.childToken): Promise<{ id: string; size: number }> {
  const res = await upload(token);
  if (res.status !== 201) throw new Error(`upload failed: ${res.status}`);
  const json = (await readJson(res)) as { id: string; size_bytes: number };
  return { id: json.id, size: json.size_bytes };
}

async function createEntry(
  token: string,
  artifactId: string,
  overrides: Record<string, unknown> = {},
): Promise<Response> {
  return await app.request("/api/v1/portfolio", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${token}` }),
    body: JSON.stringify({
      artifact_id: artifactId,
      title: "My bridge",
      skills: ["skill.bridges"],
      concepts: ["concept.load"],
      what_i_learned: "Load moves through the deck.",
      ...overrides,
    }),
  });
}

async function foreignChild(): Promise<{
  childId: string;
  token: string;
  parentToken: string;
}> {
  const foreign = await seedForeignFamily(db, new Date().toISOString());
  const res = await app.request("/api/v1/children", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${foreign.token}` }),
    body: JSON.stringify({ display_name: "Other Child", stage: "explorer", locale: "en" }),
  });
  if (res.status !== 201) throw new Error(`foreign child create failed: ${res.status}`);
  const childId = (await readJson(res)).id as string;
  const device = await seedDevice(app, foreign.token);
  const opened = await openChildSession(app, device.credential, childId);
  return {
    childId,
    token: (await readJson(opened)).session_token as string,
    parentToken: foreign.token,
  };
}

function get(url: string, token: string): Promise<Response> {
  return Promise.resolve(
    app.request(url, { method: "GET", headers: jsonHeaders({ authorization: `Bearer ${token}` }) }),
  ) as Promise<Response>;
}

function storedArtifactRows() {
  return db.select().from(artifacts).all();
}

function storedEntryRows() {
  return db.select().from(portfolioEntries).all();
}

describe("POST /artifacts (P1-09 upload)", () => {
  it("accepts an allowlisted upload, stores it, and serves it back safely", async () => {
    const res = await upload(state.childToken);
    expect(res.status).toBe(201);
    const body = (await readJson(res)) as { id: string; size_bytes: number; mime: string };
    expect(body.size_bytes).toBe(PNG_BYTES.length);
    expect(body.mime).toBe("image/png");
    expect(storedArtifactRows()).toHaveLength(1);

    const file = await get(`/api/v1/artifacts/${body.id}/file`, state.childToken);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(file.headers.get("content-disposition")).toContain("attachment");
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await file.arrayBuffer()).equals(PNG_BYTES)).toBe(true);
  });

  it("rejects a non-allowlisted type without storing anything", async () => {
    const res = await upload(state.childToken, { mime: "application/x-sh" });
    expect(res.status).toBe(422);
    expect(storedArtifactRows()).toHaveLength(0);
    expect(existsSync(artifactDir)).toBe(true); // dir may exist, but no file was written
    expect(readdirSync(artifactDir)).toHaveLength(0);
  });

  it("rejects malformed base64", async () => {
    const res = await upload(state.childToken, { data_base64: "not!!base64==" });
    expect(res.status).toBe(400);
    expect(storedArtifactRows()).toHaveLength(0);
  });

  it("rejects files over the 2 MB cap with 413", async () => {
    const oversize = Buffer.alloc(MAX_ARTIFACT_BYTES + 1, 7).toString("base64");
    const res = await upload(state.childToken, { data_base64: oversize });
    expect(res.status).toBe(413);
    expect(storedArtifactRows()).toHaveLength(0);
    expect(readdirSync(artifactDir)).toHaveLength(0);
  });

  it("rejects an SVG that could execute and accepts a safe one (SECURITY §6)", async () => {
    const malicious = await upload(state.childToken, {
      kind: "drawing",
      mime: "image/svg+xml",
      data_base64: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        "utf8",
      ).toString("base64"),
    });
    expect(malicious.status).toBe(422);

    const safe = await upload(state.childToken, {
      kind: "drawing",
      mime: "image/svg+xml",
      data_base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>').toString(
        "base64",
      ),
    });
    expect(safe.status).toBe(201);
    expect(storedArtifactRows()).toHaveLength(1);
  });
});

describe("POST /portfolio (P1-09 referential integrity)", () => {
  it("creates an entry visible to both child and parent (acceptance)", async () => {
    const artifact = await uploadOk();
    const res = await createEntry(state.childToken, artifact.id);
    expect(res.status).toBe(201);
    const created = (await readJson(res)) as {
      id: string;
      stage_at_creation: string;
      artifact: { file_url: string };
      what_i_learned: string;
    };
    expect(created.stage_at_creation).toBe("explorer"); // server-side truth
    expect(created.artifact.file_url).toContain(artifact.id);
    expect(created.what_i_learned).toContain("Load moves");

    const parentView = await get(`/api/v1/children/${state.childId}/portfolio`, state.parentToken);
    expect(parentView.status).toBe(200);
    const parentBody = (await readJson(parentView)) as { entries: { id: string }[] };
    expect(parentBody.entries.map((e) => e.id)).toContain(created.id);

    const childView = await get(`/api/v1/children/${state.childId}/portfolio`, state.childToken);
    expect(childView.status).toBe(200);
    const childBody = (await readJson(childView)) as { entries: { id: string }[] };
    expect(childBody.entries.map((e) => e.id)).toContain(created.id);
  });

  it("refuses an entry whose artifact does not exist (invariant 4)", async () => {
    const res = await createEntry(state.childToken, "art_00000000-0000-7000-8000-000000000000");
    expect(res.status).toBe(404);
    expect(storedEntryRows()).toHaveLength(0);
  });

  it("refuses an artifact belonging to another child", async () => {
    const other = await foreignChild();
    const foreignArtifact = await uploadOk(other.token);
    const res = await createEntry(state.childToken, foreignArtifact.id);
    expect(res.status).toBe(404);
    expect(storedEntryRows()).toHaveLength(0);
  });

  it("allows only one entry per artifact (409 on duplicate)", async () => {
    const artifact = await uploadOk();
    expect((await createEntry(state.childToken, artifact.id)).status).toBe(201);
    const dup = await createEntry(state.childToken, artifact.id);
    expect(dup.status).toBe(409);
    expect(storedEntryRows()).toHaveLength(1);
  });

  it("validates the body strictly", async () => {
    const artifact = await uploadOk();
    expect((await createEntry(state.childToken, "")).status).toBe(400); // missing artifact_id
    const unknown = await app.request("/api/v1/portfolio", {
      method: "POST",
      headers: jsonHeaders({ authorization: `Bearer ${state.childToken}` }),
      body: JSON.stringify({ artifact_id: artifact.id, title: "x", nope: 1 }),
    });
    expect(unknown.status).toBe(400);
    const badKind = await upload(state.childToken, { kind: "exe" });
    expect(badKind.status).toBe(400);
  });
});

describe("portfolio access and edits (P1-09)", () => {
  it("keeps a child on its own portfolio: siblings answer 404", async () => {
    const siblingId = await seedChild(app, state.parentToken, "Sibling");
    const res = await get(`/api/v1/children/${siblingId}/portfolio`, state.childToken);
    expect(res.status).toBe(404);
  });

  it("denies a parent of another family 404 on list, detail and file", async () => {
    const other = await foreignChild();
    const foreignArtifact = await uploadOk(other.token);
    const entryRes = await createEntry(other.token, foreignArtifact.id);
    const entryId = ((await readJson(entryRes)) as { id: string }).id;

    expect((await get(`/api/v1/children/${other.childId}/portfolio`, state.parentToken)).status).toBe(
      404,
    );
    expect((await get(`/api/v1/portfolio/${entryId}`, state.parentToken)).status).toBe(404);
    expect(
      (await get(`/api/v1/artifacts/${foreignArtifact.id}/file`, state.parentToken)).status,
    ).toBe(404);
    expect(
      (await get(`/api/v1/artifacts/${foreignArtifact.id}/file`, state.childToken)).status,
    ).toBe(404);
  });

  it("edits title and reflection from child and parent, strictly", async () => {
    const artifact = await uploadOk();
    const created = (await readJson(await createEntry(state.childToken, artifact.id))) as {
      id: string;
    };

    const byChild = await app.request(`/api/v1/portfolio/${created.id}`, {
      method: "PATCH",
      headers: jsonHeaders({ authorization: `Bearer ${state.childToken}` }),
      body: JSON.stringify({ title: "Bridge v2", what_i_would_improve: "Fewer piers." }),
    });
    expect(byChild.status).toBe(200);
    const edited = (await readJson(byChild)) as {
      title: string;
      what_i_would_improve: string;
      what_i_learned: string | null;
    };
    expect(edited.title).toBe("Bridge v2");
    expect(edited.what_i_would_improve).toBe("Fewer piers.");
    expect(edited.what_i_learned).toContain("Load moves"); // untouched

    const byParent = await app.request(`/api/v1/portfolio/${created.id}`, {
      method: "PATCH",
      headers: jsonHeaders({ authorization: `Bearer ${state.parentToken}` }),
      body: JSON.stringify({ what_i_learned: null }), // clearing is allowed
    });
    expect(byParent.status).toBe(200);
    expect(((await readJson(byParent)) as { what_i_learned: string | null }).what_i_learned).toBe(
      null,
    );

    const empty = await app.request(`/api/v1/portfolio/${created.id}`, {
      method: "PATCH",
      headers: jsonHeaders({ authorization: `Bearer ${state.parentToken}` }),
      body: JSON.stringify({}),
    });
    expect(empty.status).toBe(400);
  });
});

describe("portfolio deletes (P1-09)", () => {
  it("lets the parent delete an entry together with its artifact file", async () => {
    const artifact = await uploadOk();
    const created = (await readJson(await createEntry(state.childToken, artifact.id))) as {
      id: string;
    };
    const fileOnDisk = join(artifactDir, readdirSync(artifactDir)[0]!);
    expect(existsSync(fileOnDisk)).toBe(true);

    const res = await app.request(`/api/v1/portfolio/${created.id}`, {
      method: "DELETE",
      headers: jsonHeaders({ authorization: `Bearer ${state.parentToken}` }),
    });
    expect(res.status).toBe(200);
    expect(storedEntryRows()).toHaveLength(0);
    expect(storedArtifactRows()).toHaveLength(0);
    expect(existsSync(fileOnDisk)).toBe(false);
    expect(auditActions(db)).toContain("portfolio.delete");
    expect((await get(`/api/v1/artifacts/${artifact.id}/file`, state.parentToken)).status).toBe(404);
  });

  it("lets the parent delete an artifact individually, cascading its entries", async () => {
    const artifact = await uploadOk();
    await createEntry(state.childToken, artifact.id);

    const res = await app.request(`/api/v1/artifacts/${artifact.id}`, {
      method: "DELETE",
      headers: jsonHeaders({ authorization: `Bearer ${state.parentToken}` }),
    });
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { deleted: boolean; entries_deleted: number };
    expect(body).toEqual({ deleted: true, entries_deleted: 1 });
    expect(storedEntryRows()).toHaveLength(0); // invariant 4 preserved
    expect(storedArtifactRows()).toHaveLength(0);
    expect(auditActions(db)).toContain("artifact.delete");
  });

  it("refuses deletes from a child session and across families", async () => {
    const artifact = await uploadOk();
    const created = (await readJson(await createEntry(state.childToken, artifact.id))) as {
      id: string;
    };

    const byChild = await app.request(`/api/v1/portfolio/${created.id}`, {
      method: "DELETE",
      headers: jsonHeaders({ authorization: `Bearer ${state.childToken}` }),
    });
    expect(byChild.status).toBe(403);
    expect(storedEntryRows()).toHaveLength(1);

    const other = await foreignChild();
    const byForeignParent = await app.request(`/api/v1/portfolio/${created.id}`, {
      method: "DELETE",
      headers: jsonHeaders({ authorization: `Bearer ${other.parentToken}` }),
    });
    expect(byForeignParent.status).toBe(404);
    expect(storedEntryRows()).toHaveLength(1);
  });

  it("answers 404 when the file is missing on disk (ops path)", async () => {
    const artifact = await uploadOk();
    const files = readdirSync(artifactDir);
    unlinkSync(join(artifactDir, files[0]!));
    const res = await get(`/api/v1/artifacts/${artifact.id}/file`, state.parentToken);
    expect(res.status).toBe(404);
  });
});

// Sanity: rows stay scoped by child_id (used by the list query above).
describe("storage scoping", () => {
  it("stores artifact and entry rows against the owning child", async () => {
    const artifact = await uploadOk();
    await createEntry(state.childToken, artifact.id);
    const artifactRows = storedArtifactRows();
    expect(artifactRows).toHaveLength(1);
    expect(artifactRows[0]?.childId).toBe(state.childId);
    const entryRows = db
      .select()
      .from(portfolioEntries)
      .where(eq(portfolioEntries.childId, state.childId))
      .all();
    expect(entryRows).toHaveLength(1);
    expect(entryRows[0]?.artifactId).toBe(artifact.id);
  });
});
