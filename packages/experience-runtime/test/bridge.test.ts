import { describe, expect, it } from "vitest";
import { ExperienceSpecSchema } from "@createverse/shared-types";
import {
  WebExperienceRuntime,
  type MaterialId,
  type PieceType,
  type RuntimeEvent,
} from "../src/index.ts";

const BASE_SPEC = {
  experience_id: "exp.bridge.j",
  version: 1,
  stage: "junior",
  age_range: [3, 5],
  difficulty: 1,
  learning_objectives: ["concept.force"],
  mission: {
    title_key: "exp.bridge.j.title",
    objective_key: "exp.bridge.j.objective",
  },
  seed: 42,
  variables: { gravity: 9.8 },
  constraints: {
    max_pieces: 5,
    budget: 50,
    gap_width: 3,
    piece_types: ["plank", "pillar"],
    vehicles: ["car", "truck"],
  },
  ui: {
    read_aloud: true,
    no_text_required: true,
    large_targets: true,
    force_view: false,
    test_log: false,
  },
  assessment: { success_conditions: ["vehicle_crosses", "bridge_holds_3s"] },
  telemetry: ["piece_placed", "run_finished"],
} as const;

type Placement = [PieceType, MaterialId, number, number, number, number];

const CTX = {
  mode: "headless",
  locale: "en",
  stage: "junior",
  stepId: "step.bridge.j1",
  reducedMotion: true,
  t: (key: string) => key,
} as const;

async function runFixture(design: Placement[], vehicle: string) {
  const spec = ExperienceSpecSchema.parse(BASE_SPEC);
  const rt = new WebExperienceRuntime();
  const events: RuntimeEvent[] = [];
  const unsub = rt.onEvent((event) => events.push(event));
  await rt.load(spec, CTX);
  for (const [pieceType, material, x1, y1, x2, y2] of design) {
    rt.dispatch({ kind: "place_piece", pieceType, material, x1, y1, x2, y2 });
  }
  rt.dispatch({ kind: "set_vehicle", vehicleId: vehicle });
  rt.start();
  const finished = events.find((event) => event.type === "run_finished");
  if (!finished) throw new Error("run did not finish");
  const result = {
    events,
    payload: { ...finished.payload },
    evaluate: rt.evaluate(),
    snapshot: rt.getSnapshot(),
    forceView: rt.getForceView(),
  };
  unsub();
  rt.dispose();
  return result;
}

const PLANK: Placement = ["plank", "wood", 0, 0, 3, 0];
const PILLAR: Placement = ["pillar", "wood", 1.5, 0, 1.5, 4];

describe("bridge fixtures", () => {
  it("one plank car crosses and holds", async () => {
    const r = await runFixture([PLANK], "car");
    expect(r.payload["success"]).toBe(true);
    expect(r.evaluate.passed).toBe(true);
  });
  it("no deck fails", async () => {
    const r = await runFixture([], "car");
    expect(r.payload["success"]).toBe(false);
    expect(r.evaluate.passed).toBe(false);
  });
  it("plank pillar truck holds", async () => {
    const r = await runFixture([PLANK, PILLAR], "truck");
    expect(r.payload["success"]).toBe(true);
    expect(r.evaluate.passed).toBe(true);
  });
  it("deterministic", async () => {
    const a = await runFixture([PLANK], "car");
    const b = await runFixture([PLANK], "car");
    expect(b.snapshot).toEqual(a.snapshot);
    expect(b.payload).toEqual(a.payload);
  });
  it("telemetry keys", async () => {
    const r = await runFixture([PLANK], "car");
    const f = r.events.find((e) => e.type === "run_finished");
    expect(f?.payload["cost"]).toBeDefined();
    expect(r.events.some((e) => e.type === "run_started")).toBe(true);
  });
  it("snapshot restore", async () => {
    const spec = ExperienceSpecSchema.parse(BASE_SPEC);
    const a = new WebExperienceRuntime();
    a.onEvent(() => {});
    await a.load(spec, CTX);
    a.dispatch({ kind: "place_piece", pieceType: "plank", material: "wood",
      x1: 0, y1: 0, x2: 3, y2: 0 });
    a.dispatch({ kind: "set_vehicle", vehicleId: "car" });
    a.start();
    const snap = a.getSnapshot();
    const b = new WebExperienceRuntime();
    b.onEvent(() => {});
    await b.load(spec, CTX);
    b.restore(snap);
    expect(b.getSnapshot()).toEqual(snap);
    expect(b.evaluate()).toEqual(a.evaluate());
    a.dispose();
    b.dispose();
  });
  it("rejects unknown condition", async () => {
    const spec = ExperienceSpecSchema.parse({
      ...BASE_SPEC,
      assessment: { success_conditions: ["car_flies"] },
    });
    const rt = new WebExperienceRuntime();
    await expect(rt.load(spec, CTX)).rejects.toThrow("unknown success");
    rt.dispose();
  });
  it("force view", async () => {
    const r = await runFixture([PLANK], "car");
    expect(r.forceView.length).toBe(1);
    expect(r.forceView[0]?.pieceId).toBe("p1");
  });
  it("getDesignInfo agrees with enforcement", async () => {
    const spec = ExperienceSpecSchema.parse(BASE_SPEC);
    const rt = new WebExperienceRuntime();
    rt.onEvent(() => {});
    await rt.load(spec, CTX);
    rt.dispatch({ kind: "place_piece", pieceType: "plank", material: "wood",
      x1: 0, y1: 0, x2: 3, y2: 0 });
    expect(rt.getDesignInfo()).toMatchObject({
      pieces: 1,
      maxPieces: 5,
      budget: 50,
      vehicleId: "car",
      buildEnabled: true,
    });
    expect(rt.getDesignInfo().cost).toBeGreaterThan(0);
    rt.dispose();
  });
});
