# RUNTIME_SPIKE.md — P0-07 web experience runtime spike

Status: **Partial 2026-10-06** — deterministic headless part done and covered in CI; real-device measurements still pending.
Read with: `EXPERIENCE_RUNTIME.md` (§2, §5–§8, §11–§12), `TESTING.md` (§5, §10), `TASKS_PHASE_0_1.md` (P0-07, P1-20).

## 1. What was built

- `packages/experience-runtime` — the only runtime implementation (`WebExperienceRuntime`, ADR-0006): Canvas 2D + Matter.js bridge domain behind the `ExperienceRuntime` interface.
- Bridge domain: grid world, banks, gap, riverbed, pieces connected by constraints, vehicles driving left to right at data-defined speeds.
- Fixed 1/60 s simulation steps, no `Math.random()`, no wall-clock dependence. Headless mode (no canvas) runs the identical code path synchronously for CI.
- Step overrides (§4) shallow-merge over spec constraints/ui; unknown spec condition ids and unknown override keys reject the spec with a clear error instead of silently changing behavior.
- Telemetry carries design/result numbers only — never personal data (§7).

## 2. Headless fixtures (CI, deterministic)

Covered by `packages/experience-runtime/test/bridge.test.ts` (TESTING.md §5). All fixtures use the Junior gap (3 units) and build from `content/experiences/experiences.json` semantics:

| Fixture | Design | Vehicle | Expected outcome |
|---|---|---|---|
| `exp.bridge.j` plank success | one wood plank spanning the gap | car | crosses, `bridge_holds_3s` passes, no breakage |
| no-deck failure | empty design | car | vehicle falls, `vehicle_crosses` fails |
| heavy load | one wood plank spanning the gap | truck | crosses (teaching load), recorded peak strain stays under capacity |
| supported deck | plank + pillar to the riverbed | truck | crosses, pillar takes load |
| invalid spec | unknown `success_conditions` id | — | `load()` rejects with `unknown success condition` |
| invalid override | `step_overrides` with unknown key | — | schema rejects before the run |

Determinism check: two identical runs produce identical snapshots (design, vehicle, step count, force view) and identical `run_finished` payloads.

## 3. Tuning

- Capacity constants live in `packages/experience-runtime/src/constants.ts` (EXPERIENCE_RUNTIME.md §15.2 open decision). Current values were tuned against these fixtures so a single wood plank holds the car and the truck while an empty gap always fails.
- Temporary tuning harnesses (`test/tune.test.ts`, `test/probe.test.ts`) print raw strain numbers; they are **not** part of the suite — deleted (or excluded) before the P0-07 merge so CI stays assertion-based and quiet.

## 4. Still pending (blocks P0-07 closure)

1. **Real-device measurement** (EXPERIENCE_RUNTIME.md §11, TESTING.md §5/§10): Junior bridge on the real phone and tablet — 60 fps target, 30 fps floor, bundle lazy-loaded on experiment steps only. Record device model, OS, fps, and memory-over-20-minutes here when measured.
2. **Snapshot/restore round-trip through the app layer** (HUD wiring arrives with P1-03/P1-20).
3. **Explorer/Maker lanes** (P1-20): beam, brace, wood/steel, budget, force view, test log — data-driven per §4.
4. EXPERIENCE_RUNTIME.md §15.2 stays open: confirm Matter.js as the final physics library once device numbers exist.

## 5. How to re-run

```sh
pnpm vitest run packages/experience-runtime/test/bridge.test.ts
pnpm content:validate   # the three bridge specs still validate
```