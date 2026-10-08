# ADR-0006: Web-only experience runtime behind an interface (no game engine)

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15). Replaces the Master Spec's GAME_ENGINE section.
Date: 2026-10-06 (recorded from the approved architecture).

## Context

Experiences (bridge builder first) need physics, but a game engine brings licenses, a second toolchain, binary builds and maintenance burden that contradict the budget and the agent-maintained constraint. The Master Spec originally assumed a game engine; EXPERIENCE_RUNTIME.md replaced it.

## Decision

- One `ExperienceRuntime` interface (`packages/experience-runtime`); the only implementation is `WebExperienceRuntime` — Canvas 2D rendering with Matter.js physics.
- Experiences are **data-driven**: the runtime loads an `ExperienceSpec` (constraints, success conditions, telemetry) and per-step overrides; educational logic never lives in scene code.
- Headless mode (no canvas) runs the same code path for deterministic simulation tests in CI.
- Stage presets change inputs, text and controls — never the simulation itself.

## Alternatives considered

- **Unity / Unreal / Godot** — rejected: license and build complexity, no web reuse, second toolchain; a game engine is a last resort requiring a new ADR and owner approval.
- **Three.js + Rapier now** — deferred: only if a spike proves 2D web physics cannot meet frame-rate targets on the real devices (EXPERIENCE_RUNTIME.md §11 fallback ladder).
- **Embedding an existing open-source bridge game** — rejected as a core dependency: the experience must be data-driven, localized and instrumented; reuse rule still applies to studios (BUILD_PLAN §7).

## Consequences

- One runtime, replaceable later without changing callers (native/3D runtimes plug in behind the same interface).
- Physics quality is bounded by Matter.js; if targets are missed, simplify (fewer bodies, fewer iterations) before reconsidering this ADR.
- Determinism (fixed timestep, injected clock, no `Math.random`) is testable in CI headless mode (EXPERIENCE_RUNTIME.md §8).
