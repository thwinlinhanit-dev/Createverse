# EXPERIENCE_RUNTIME.md — CREATEVERSE

Status: **Draft v0.1 for owner review** (replaces GAME_ENGINE.md in the Master Spec, per ADR-0006)
Read with: Master Spec sections 7, 8, 29, 30; `ARCHITECTURE.md` section 8; `DATA_MODEL.md` section 2.6; `BUILD_A_BRIDGE_CONTENT.md`; `TESTING.md` section 5

The experience runtime runs interactive, simulation-style activities (the bridge builder first). It is a **web runtime**, not a game engine. It sits behind an interface so a different runtime could replace it later.

---

## 1. Purpose and boundary

```text
LEARNING OS            what should the child learn and why?
LEARNING ENGINE        how should the path adapt?            (later)
EXPERIENCE SPEC        what should the child experience?     (data)
EXPERIENCE RUNTIME     how is it rendered and simulated?     (this document)
TELEMETRY + ASSESSMENT what did the child do and understand?
```

The runtime:
- Loads an **experience spec** (data) plus per-step **overrides**.
- Simulates and renders it.
- Emits **telemetry** and evaluates **success conditions**.
- Knows nothing about accounts, hints, curriculum, AI, or the database.

Educational logic stays in content data, not in scene code. If a learning rule can be expressed as data, it must be.

---

## 2. Interface

```ts
type RuntimeMode = "interactive" | "headless";

interface RuntimeContext {
  mode: RuntimeMode;
  locale: "en" | "zh-Hant";
  stage: "junior" | "explorer" | "maker";
  stepId: string;                       // selects step_overrides
  reducedMotion: boolean;
  t: (key: string) => string;           // localization for any in-canvas labels
  now?: () => number;                   // injected clock for tests
}

interface ExperienceRuntime {
  load(spec: ExperienceSpec, ctx: RuntimeContext): Promise<void>;
  mount(canvas: HTMLCanvasElement | null): void;      // null in headless mode
  start(): void;                        // run the simulation (the "Go" button)
  reset(): void;                        // back to build mode, keep the design
  pause(): void;
  resume(): void;
  dispatch(cmd: RuntimeCommand): void;  // setTool, setVehicle, undo, redo, toggleForceView, ...
  getSnapshot(): ExperienceSnapshot;
  restore(snapshot: ExperienceSnapshot): void;
  evaluate(): AssessmentResult;         // checks success conditions
  onEvent(cb: (e: RuntimeEvent) => void): Unsubscribe;   // UI bridge + telemetry
  dispose(): void;
}
```

Implementations: `WebExperienceRuntime` (canvas 2D, Matter.js) now. Others (native, 3D, engine) may be added later without changing callers.

---

## 3. Experience spec

Fields (see `DATA_MODEL.md` section 2.6 and the three specs in `BUILD_A_BRIDGE_CONTENT.md`):

| Field | Meaning |
|---|---|
| `experience_id`, `version`, `stage`, `age_range`, `difficulty` | Identity and targeting |
| `learning_objectives` | Concept ids (for assessment and telemetry tagging) |
| `mission` | Title and objective keys |
| `seed` | Seed for any randomness. Prefer no randomness at all |
| `variables` | Physics values: gravity, vehicle masses |
| `constraints` | Gap width, pieces allowed, materials with cost and strength, vehicles, piece limit, budget, snap |
| `ui` | `read_aloud`, `no_text_required`, `large_targets`, `force_view`, `test_log` |
| `step_overrides` | Per-step changes to constraints and presets (section 4) |
| `assessment` | `success_conditions` and optional `score` |
| `telemetry` | Which measurements to emit |

Specs are validated by `content-sdk` (task P0-08). The runtime rejects an invalid spec with a clear error and never runs it.

---

## 4. Step overrides

One spec serves several steps. For the active `stepId`:

1. Start from the spec's `constraints` and `ui`.
2. Shallow-merge `step_overrides[stepId]` over them. **Override wins.**
3. Special override keys:
   - `preset`: load a ready-made design (for example `simple_plank_bridge`, `two_example_designs`) instead of an empty build area.
   - `build_enabled: false`: the child tests only, cannot place pieces.
   - `vehicle` or `vehicles`: which vehicle is used or testable.
   - `max_pieces`, `budget`, `pieces`, `force_view`: tighter or looser limits.
   - `bonus_vehicle`: optional extra vehicle (reported as a signal, never required).
4. Unknown override keys are a validation error.

Presets live in `content/` as data (`presets/*.json`), not in code.

---

## 5. Bridge domain model (first domain)

Coordinates use a **grid**. One unit equals one grid cell. Everything snaps to the grid (always for Junior and Explorer, optional for Maker).

| Concept | Definition |
|---|---|
| World | Left bank, right bank, gap of `gap_width` units, water below (visual and failure area) |
| Anchor points | Valid attachment points on banks and on existing pieces |
| Piece | Defined by two endpoints on the grid, a `type` and a `material`. Types: `plank`, `pillar`, `beam`, `brace` |
| Material | `wood` and `steel` with `cost` (per unit length) and `strength` multiplier. Junior and Explorer use wood only and show no cost |
| Cost | Sum over pieces of material cost times piece length. Compared with `budget` when present |
| Vehicle | `car`, `truck`, `train` with masses from `variables`. Drives left to right at a fixed speed |
| Joint | Connection between pieces or to a bank. Breaks when its load ratio exceeds 1 |

**Physics approach (Matter.js):**
- Pieces are rigid bodies connected by constraints at anchor points. Banks are static.
- Fixed time step (1/60 s) with a fixed number of solver iterations. No dependence on wall-clock time or frame rate.
- **Load ratio** for a piece or joint = measured load divided by its capacity (`strength` times a base value per piece type). Above 1 it breaks and is removed.
- Capacity constants are defined once in data and tuned so fixtures behave as documented (section 8).

**Force view (Maker, and the Explorer load comparison):**
- Matter.js does not give axial stress directly. Use **strain** as the proxy: compare a piece's current length with its rest length.
  - Shortened = compression (blue, diagonal stripes).
  - Lengthened = tension (orange, dots).
  - Intensity scales with the load ratio.
- This is a teaching model, not an engineering analysis. Keep the language honest in content ("shows roughly where parts are squeezed or stretched").
- Always render the pattern and a text legend, never color alone.

---

## 6. Success conditions

Evaluated by `evaluate()` from `assessment.success_conditions` (applied after step overrides).

| Condition | Definition |
|---|---|
| `vehicle_crosses` | The vehicle's center passes the target line on the far bank while supported, and the vehicle did not fall into the water |
| `bridge_holds_Ns` | After the vehicle reaches the far bank, no piece has broken and the bridge stays in place for N seconds. N is 3 for Junior and 5 for Explorer and Maker |
| `cost<=budget` | Total cost is at most the budget (only when a budget applies) |
| `pieces<=max` | Piece count is within the limit (enforced at build time too) |

Derived signals for assessment (see the signals table in `BUILD_A_BRIDGE_CONTENT.md`):
`experience.success`, `experience.success_with_constraint`, `iterations>=N`, `experiment.runs>=N`, `force_view.opened`, `test_log_entries>=N`, `bonus_vehicle.crossed`.

**Margins:** success fixtures must pass with at least 20 percent margin (peak load ratio at most 0.8), so tiny numeric differences between devices cannot flip a result. Record margins in the spec, not in tests.

---

## 7. Telemetry and the UI bridge

The runtime emits `RuntimeEvent`s. The app (not the runtime) maps them into the standard event envelope (`ARCHITECTURE.md` section 6).

| Runtime event | Payload (key fields) | Becomes app event |
|---|---|---|
| `ready` | spec id and version | none |
| `piece_placed` / `piece_removed` | type, material, endpoints | counted in `iterations` and `pieces_used` |
| `run_started` | design hash, vehicle | `child.experiment.executed` (start) |
| `run_finished` | success, reasons, cost, peak load ratio, max bend | `child.experiment.executed` (result) |
| `design_changed_after_run` | what changed | `iterations` |
| `test_log_entry` | text reference | `test_log_entries` |
| `force_view_toggled` | on or off | `force_view.opened` |
| `bonus_vehicle_crossed` | vehicle | `bonus_vehicle.crossed` |
| `error` | code | operational log only |

Telemetry contains **no personal data**, only design and result numbers.

**UI bridge:** the HUD (Go, Try again, pieces left, coins, vehicle chooser, force view toggle, undo and redo, test log) is **DOM**, not canvas, for accessibility and localization. The canvas draws the world only. Commands go app to runtime through `dispatch`. Events go runtime to app through `onEvent`.

---

## 8. Determinism and fixtures

- Same `(spec, seed, step overrides, inputs)` gives the same result, in headless mode and on devices, within the margins above.
- Inputs are recorded as an ordered list of commands with step counts, not timestamps.
- A **mid-run snapshot** is stored as the design plus the simulation step count. Restoring replays the run deterministically to that step. This avoids serializing physics-engine internals.
- No `Math.random()` or `Date.now()` in simulation code. The clock and any randomness are injected.

**Required fixtures (headless tests):**

| Fixture | Expected |
|---|---|
| Junior: one plank, car | Crosses and holds |
| Junior: one plank, truck, no pillar | Fails (plank breaks or bends too far) |
| Junior: plank plus center pillar, truck | Crosses and holds |
| Explorer: pillar plus two-brace triangle, 6 pieces, truck | Crosses and holds with at most 6 pieces |
| Maker: design under budget, truck | Success and cost at most budget |
| Maker: same design, 60 coin budget | `cost<=budget` fails |
| Maker: steel only at the stressed middle, train bonus | Bonus signal emitted |
| Invalid override key | Spec rejected with a clear error |

---

## 9. Input and stage presets

| Aspect | Junior | Explorer | Maker |
|---|---|---|---|
| Placement | Drag a piece from a big tray. Pieces snap to glowing anchor points. No precision needed | Drag with snap to grid. Undo | Drag with optional snap. Undo and redo |
| Pieces | Plank, pillar | Plank, pillar, beam, brace | Beam, pillar, brace, in wood or steel |
| Limits | 3 pieces | 10 pieces (6 in the challenge) | Piece and budget limits |
| Help | Pre-written hints, spoken | Pre-written hints | Hints plus force view and test log |
| Feedback | Big, gentle, spoken | Short text | What happened and why |

All stage differences come from the spec, `ui` flags and overrides, not from separate code paths per stage.

---

## 10. Accessibility

- **Keyboard and switch alternative:** select a piece, move among anchor points with arrow keys, place with Enter, run with a labeled button. Required, not optional.
- **Screen reader:** a live region announces results in the child's language ("Your bridge held for 5 seconds", "The beam broke in the middle").
- **Not color alone:** patterns plus legend for force view. Success and failure also show an icon and words.
- **Reduced motion:** no camera shake or particles. Vehicles still move, since that is the experiment.
- **Large targets:** per preset (64 px in Junior).
- **Read-aloud:** HUD labels and step prompts can be read by the app's read-aloud feature.
- **No time pressure:** the child can build as long as they like.

---

## 11. Rendering and performance

| Rule | Detail |
|---|---|
| Rendering | Canvas 2D, simple vector shapes, no external image assets, no web fonts inside the canvas |
| Pixel ratio | Cap `devicePixelRatio` at 2 |
| Loop | Fixed-step physics, render on animation frame. When idle (build mode, nothing moving) render only on change |
| Memory | Pool objects. No per-frame allocations. Cap pieces (at most 25) |
| Visibility | Pause when the tab is hidden |
| Battery | Avoid unnecessary redraws. Offer a lower-quality mode if the frame rate falls under the floor |
| Targets | 60 fps target, 30 fps floor on the real phone and tablet. Memory stable over 20 minutes |
| Bundle | The runtime and physics library load lazily, only on experiment steps |

**If targets are missed:** simplify the physics (fewer solver iterations, fewer bodies), reduce visual effects, then reconsider. A game engine is a last resort and needs an ADR and owner approval (ADR-0006).

---

## 12. Error handling

- Invalid spec: refuse to run and show the child a calm message and the parent a clear error in logs.
- Physics instability (NaN, runaway bodies): reset the run, emit `error`, show "Let's try that again."
- Never crash the app. The runtime is isolated from the rest of the UI by an error boundary.

---

## 13. Extending the runtime

Phase 1 ships one **domain**: the bridge. Later domains (Mars rover, future city simulation, robot builder) plug in through a domain interface:

```ts
interface ExperienceDomain {
  id: string;                                   // "bridge"
  buildWorld(spec: ExperienceSpec, overrides: StepOverrides): World;
  handleCommand(world: World, cmd: RuntimeCommand): void;
  step(world: World): void;                     // fixed-step update
  render(world: World, ctx: CanvasRenderingContext2D): void;
  evaluate(world: World, conditions: string[]): AssessmentResult;
  telemetry(world: World): TelemetryEvent[];
}
```

Adding a domain means: a spec schema, a domain module, fixtures, and docs. It never means a new runtime. If a future experience needs real 3D, add a `ThreeExperienceRuntime` (Three.js plus a physics library) behind the same `ExperienceRuntime` interface, after an ADR and owner approval.

---

## 14. Tasks and tests

- Spike and Junior bridge: **P0-07**. Explorer and Maker features: **P1-20**. Hardening, simulation API and the first reusable lab: Phase 3.
- Tests: `TESTING.md` section 5 (determinism, fixtures, constraints, telemetry, snapshot and restore) plus device measurements.
- Spike results go in `docs/architecture/RUNTIME_SPIKE.md`. Update this document with what the spike teaches.

---

## 15. Open decisions

1. Final physics library (Matter.js assumed). Confirm in P0-07 if it meets determinism and performance.
2. Capacity constants per piece type (tune with fixtures).
3. Whether the test log accepts voice notes later (needs a separate privacy review).
