import { describe, expect, it } from "vitest";
import {
  memoryBackend,
  ProgressStore,
  uuidv7,
  type StorageBackend,
} from "./store.ts";

/**
 * Local-first progress store (P1-05 state, P1-08 event log client).
 * Covers: append-only events with idempotent replay, pause/resume across a
 * reload, the full step lifecycle, reflection privacy (no free text in
 * events), the portfolio artifact link (invariant 4), derived summary replay,
 * and the sync outbox with a missing/failing endpoint.
 */

const CHILD = "c_test";
const DEVICE = "d_test";

function testIds() {
  let n = 0;
  return (_prefix: string) =>
    `0199a1c2-0000-7000-8000-${String(n += 1).padStart(12, "0")}`;
}

async function openStore(
  backend: StorageBackend = memoryBackend(),
  now = 1_700_000_000_000,
): Promise<ProgressStore> {
  const store = new ProgressStore(CHILD, DEVICE, backend, {
    now: () => now,
    newId: testIds(),
  });
  await store.load();
  return store;
}

const BRIDGE = { id: "project.bridge", version: 1 };

describe("uuidv7", () => {
  it("is time-ordered and version/variant-tagged", () => {
    const random = (bytes: Uint8Array): void => {
      bytes.fill(0xab);
    };
    const a = uuidv7(1_700_000_000_000, random);
    const b = uuidv7(1_700_000_001_000, random);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a < b).toBe(true);
  });
});

describe("events are append-only and idempotent", () => {
  it("appends events in order and refuses an empty type", async () => {
    const store = await openStore();
    await store.appendEvent("child.project.started", { project_id: "project.bridge" }, BRIDGE);
    await store.appendEvent("child.project.completed", { project_id: "project.bridge" }, BRIDGE);
    expect(store.summary().totalEvents).toBe(2);
    await expect(store.appendEvent("", {}, null)).rejects.toThrow();
  });

  it("replaying an event_id stores it once and returns the original", async () => {
    const store = await openStore();
    const first = await store.appendEvent(
      "child.experiment.executed",
      { success: true },
      BRIDGE,
      { eventId: "0199a1c2-0000-7000-8000-000000000001" },
    );
    const replay = await store.appendEvent(
      "child.experiment.executed",
      { success: false },
      BRIDGE,
      { eventId: "0199a1c2-0000-7000-8000-000000000001" },
    );
    expect(replay).toEqual(first);
    expect(store.summary().totalEvents).toBe(1);
  });

  it("survives corrupt keys in the backend without wedging", async () => {
    const backend = memoryBackend();
    await backend.set("cv:progress:v1:c_test:events", "garbage");
    await backend.set("cv:progress:v1:c_test:hints", [1, 2, 3]);
    const store = new ProgressStore(CHILD, DEVICE, backend, { newId: testIds() });
    await store.load();
    expect(store.summary().totalEvents).toBe(0);
    await store.appendEvent("child.project.started", {}, null);
    expect(store.summary().totalEvents).toBe(1);
  });
});

describe("project lifecycle and resume", () => {
  it("starts a project once, then resumes it without a second start event", async () => {
    const store = await openStore();
    const first = await store.startProject("project.bridge", "junior", 1, [
      "step.bridge.j1",
      "step.bridge.j2",
    ]);
    expect(first.resumed).toBe(false);
    expect(first.instance.currentStepId).toBe("step.bridge.j1");
    const second = await store.startProject("project.bridge", "junior", 1, [
      "step.bridge.j1",
      "step.bridge.j2",
    ]);
    expect(second.resumed).toBe(true);
    expect(second.instance.id).toBe(first.instance.id);
    expect(store.summary().totalEvents).toBe(1);
  });

  it("pauses and resumes without data loss, across a reload", async () => {
    const backend = memoryBackend();
    const first = await openStore(backend);
    const { instance } = await first.startProject("project.bridge", "junior", 1, [
      "step.bridge.j1",
    ]);
    await first.setPosition({ projectId: "project.bridge", instanceId: instance.id, stepId: "step.bridge.j1" });
    await first.pauseProject(instance.id);

    const reloaded = new ProgressStore(CHILD, DEVICE, backend, { newId: testIds() });
    await reloaded.load();
    expect(reloaded.getPosition()).toEqual({
      projectId: "project.bridge",
      instanceId: instance.id,
      stepId: "step.bridge.j1",
    });
    const resumed = await reloaded.startProject("project.bridge", "junior", 1, ["step.bridge.j1"]);
    expect(resumed.resumed).toBe(true);
    expect(resumed.instance.state).toBe("in_progress");
  });

  it("records attempts with hints, iterations and content refs", async () => {
    const store = await openStore();
    const { instance } = await store.startProject("project.bridge", "junior", 1, ["step.bridge.j1"]);
    const attempt = await store.beginAttempt(instance.id, "step.bridge.j1");
    await store.finishAttempt(attempt.id, "success", {
      hintsUsed: 2,
      iterations: 3,
      concepts: ["concept.force"],
      skills: ["skill.experimentation"],
      content: { id: "step.bridge.j1", version: 1 },
    });
    const summary = store.summary();
    expect(summary.conceptsSeen).toEqual(["concept.force"]);
    expect(summary.skillsPracticed).toEqual(["skill.experimentation"]);
    expect(summary.hintsUsed).toBe(2);
    const project = summary.projects[0];
    expect(project?.stepsDone).toBe(1);
    expect(project?.stepsTotal).toBe(1);
    // Repeat completions do not duplicate events (idempotent step completion).
    await store.finishAttempt(attempt.id, "success", {
      hintsUsed: 2,
      iterations: 3,
      concepts: ["concept.force"],
      skills: ["skill.experimentation"],
      content: { id: "step.bridge.j1", version: 1 },
    });
    expect(store.summary().totalEvents).toBe(2);
  });

  it("counts activities and serves newest-first history", async () => {
    const store = await openStore();
    const { instance } = await store.startProject("project.bridge", "junior", 1, ["step.bridge.j1"]);
    const attempt = await store.beginAttempt(instance.id, "step.bridge.j1");
    await store.finishAttempt(attempt.id, "success", {
      hintsUsed: 0,
      iterations: 1,
      concepts: [],
      skills: [],
      content: { id: "step.bridge.j1", version: 1 },
    });
    expect(store.summary().activitiesCompleted).toBe(1);
    const recent = store.recentEvents(5);
    expect(recent.map((e) => e.type)).toEqual([
      "child.activity.completed",
      "child.project.started",
    ]);
    expect(store.recentEvents(1)).toHaveLength(1);
  });

  it("counts iterations inside an open attempt", async () => {
    const store = await openStore();
    const { instance } = await store.startProject("project.bridge", "junior", 1, ["step.bridge.j1"]);
    const attempt = await store.beginAttempt(instance.id, "step.bridge.j1");
    expect(await store.addIteration(attempt.id)).toBe(1);
    expect(await store.addIteration(attempt.id)).toBe(2);
  });
});

describe("hints, experiments, reflection, portfolio", () => {
  it("advances one hint level at a time from pre-written content only", async () => {
    const store = await openStore();
    const first = await store.recordHint("step.bridge.j2", 1);
    expect(first).toEqual({ levelReached: 1, attemptCount: 0 });
    const second = await store.recordHint("step.bridge.j2", 2);
    expect(second.levelReached).toBe(2);
    expect(store.getHintProgress("step.bridge.j2")).toEqual(second);
    expect(store.summary().hintsUsed).toBe(2);
  });

  it("records experiment numbers without personal data", async () => {
    const store = await openStore();
    const event = await store.recordExperiment(BRIDGE, {
      experienceId: "exp.bridge.j",
      vehicle: "car",
      success: true,
      reasons: "",
      cost: 0,
      peakLoadRatio: 0.42,
      iterations: 1,
    });
    expect(event.type).toBe("child.experiment.executed");
    expect(event.payload).toEqual({
      experience_id: "exp.bridge.j",
      vehicle: "car",
      success: true,
      reasons: "",
      cost: 0,
      peak_load_ratio: 0.42,
      iterations: 1,
    });
    expect(store.summary().experimentsRun).toBe(1);
  });

  it("keeps reflection free text out of the event log", async () => {
    const store = await openStore();
    const { instance } = await store.startProject("project.bridge", "junior", 1, ["step.bridge.j1"]);
    await store.submitReflection(
      instance.id,
      ["reflection.what_worked"],
      ["My secret bridge words"],
    );
    const summary = store.summary();
    expect(summary.totalEvents).toBe(2);
    const pending = store.pendingEvents();
    const reflection = pending.find((e) => e.type === "child.reflection.submitted");
    expect(reflection?.payload).toEqual({
      prompts: ["reflection.what_worked"],
      answers: 1,
    });
  });

  it("completing a project links the portfolio entry to its artifact (invariant 4)", async () => {
    const store = await openStore();
    const { instance } = await store.startProject("project.bridge", "junior", 1, ["step.bridge.j1"]);
    const entry = await store.completeProject(instance.id, {
      title: "My bridge",
      stageAtCreation: "junior",
      skills: ["skill.experimentation"],
      concepts: ["concept.force"],
      whatILearned: "Planks hold cars",
      whatIWouldImprove: "Add a pillar",
      design: { pieces: 1, vehicle: "car", success: true },
    });
    const artifacts = store.getArtifacts();
    expect(artifacts.some((a) => a.id === entry.artifactId)).toBe(true);
    expect(store.getInstance(instance.id)?.state).toBe("completed");
    const summary = store.summary();
    expect(summary.completedCount).toBe(1);
    expect(summary.portfolioCount).toBe(1);
  });
});

describe("skill evidence (P1-06, invariant 3)", () => {
  const NOW = 1_700_000_000_000;
  const ISO = new Date(NOW).toISOString();

  async function completedStep(store: ProgressStore, stepType: string): Promise<void> {
    const { instance } = await store.startProject("project.bridge", "junior", 1, [
      "step.bridge.j1",
    ]);
    const attempt = await store.beginAttempt(instance.id, "step.bridge.j1");
    await store.finishAttempt(attempt.id, "success", {
      hintsUsed: 0,
      iterations: 2,
      concepts: ["concept.load"],
      skills: ["skill.experimentation"],
      content: { id: "step.bridge.j1", version: 1 },
      stepType,
    });
  }

  it("updates skill evidence deterministically when an activity completes", async () => {
    const store = await openStore();
    await completedStep(store, "experiment");

    const rows = store.skillEvidence({ nowMs: NOW });
    expect(rows.skills).toEqual([
      {
        skillId: "skill.experimentation",
        evidenceCount: 1,
        strengthTotal: 0.6,
        weightedSum: 0.6,
        level: 0, // 0.6 < the level-1 threshold; two successes reach level 1
        lastSeenAt: ISO,
      },
    ]);
    expect(rows.concepts).toEqual([
      { conceptId: "concept.load", level: 3, evidenceCount: 1, lastSeenAt: ISO },
    ]);
    // Replaying the same log with the same clock yields identical rows.
    expect(store.skillEvidence({ nowMs: NOW })).toEqual(rows);
  });

  it("maps step types to concept levels per DATA_MODEL §5", async () => {
    const store = await openStore();
    await completedStep(store, "intro");
    const intro = store.skillEvidence({ nowMs: NOW });
    expect(intro.concepts[0]?.level).toBe(1); // seen

    const activityStore = await openStore();
    await completedStep(activityStore, "activity");
    expect(activityStore.skillEvidence({ nowMs: NOW }).concepts[0]?.level).toBe(2); // practiced
  });

  it("rebuilds the same rows after a reload (events are the source of truth)", async () => {
    const backend = memoryBackend();
    const first = await openStore(backend);
    await completedStep(first, "experiment");

    const reloaded = new ProgressStore(CHILD, DEVICE, backend, { newId: testIds() });
    await reloaded.load();
    expect(reloaded.skillEvidence({ nowMs: NOW })).toEqual(
      first.skillEvidence({ nowMs: NOW }),
    );
    expect(reloaded.summary().skillsPracticed).toEqual(["skill.experimentation"]);
  });
});

describe("lab design persistence (reload resumes the design)", () => {
  const design = {
    specId: "exp.bridge.j",
    specVersion: 1,
    design: [{ id: "p1", pieceType: "plank", material: "wood", x1: 0, y1: 0, x2: 3, y2: 0 }],
    vehicleId: "car",
    forceView: false,
    tool: "select",
  };

  it("round-trips a saved design for the same spec version", async () => {
    const backend = memoryBackend();
    const first = await openStore(backend);
    await first.setLabDesign("step.bridge.j2", design);
    const second = new ProgressStore(CHILD, DEVICE, backend, { newId: testIds() });
    await second.load();
    expect(second.getLabDesign("step.bridge.j2", "exp.bridge.j", 1)).toEqual(design);
  });

  it("refuses a design saved against another spec version (content moved on)", async () => {
    const store = await openStore();
    await store.setLabDesign("step.bridge.j2", design);
    expect(store.getLabDesign("step.bridge.j2", "exp.bridge.j", 2)).toBeNull();
    expect(store.getLabDesign("step.bridge.j2", "exp.bridge.e", 1)).toBeNull();
  });
});

describe("sync outbox (server arrives with P1-08)", () => {  it("clears confirmed events and keeps the rest", async () => {
    const store = await openStore();
    await store.appendEvent("child.project.started", {}, null);
    await store.appendEvent("child.project.completed", {}, null);
    const pending = store.pendingEvents();
    expect(pending).toHaveLength(2);
    const first = await store.sync(async () => [pending[0]!.event_id]);
    expect(first).toEqual({ synced: 1, pending: 1 });
    const second = await store.sync(async (events) => events.map((e) => e.event_id));
    expect(second).toEqual({ synced: 1, pending: 0 });
    // Local history is untouched by syncing.
    expect(store.summary().totalEvents).toBe(2);
  });

  it("exposes the sync scope for the API_SPEC §5.4 body", async () => {
    const store = await openStore();
    expect(store.syncScope()).toEqual({ childId: CHILD, deviceId: DEVICE });
  });

  it("a missing or failing endpoint keeps the outbox intact", async () => {
    const store = await openStore();
    await store.appendEvent("child.project.started", {}, null);
    const result = await store.sync(async () => {
      throw new Error("404: /api/v1/sync/events does not exist yet (P1-08)");
    });
    expect(result).toEqual({ synced: 0, pending: 1 });
    expect(store.pendingEvents()).toHaveLength(1);
  });
});

describe("safety flags (P1-11)", () => {
  it("records one enum-only ai.safety.flagged event for sync derivation", async () => {
    const store = await openStore();
    const event = await store.recordSafetyFlag({
      kind: "input_blocked",
      severity: "warn",
      actionTaken: "safe_alternative",
      stepId: "step.bridge.j1",
    });
    expect(event.type).toBe("ai.safety.flagged");
    expect(event.payload).toEqual({
      kind: "input_blocked",
      severity: "warn",
      source: "ai_mentor",
      action_taken: "safe_alternative",
      step_id: "step.bridge.j1",
    });
    // Queued for sync like every other event (outbox, P1-08).
    expect(store.summary().totalEvents).toBe(1);
  });

  it("never accepts free text alongside the flag", async () => {
    const store = await openStore();
    const event = await store.recordSafetyFlag({
      kind: "privacy",
      severity: "warn",
      actionTaken: "private_info_message",
    });
    // Payload keys are a closed set — nothing free-text-shaped can ride along.
    expect(Object.keys(event.payload).sort()).toEqual(
      ["action_taken", "kind", "severity", "source"].sort(),
    );
    expect(JSON.stringify(event.payload)).not.toContain("my name");
  });
});
