# TASKS_PHASE_2_7.md — CREATEVERSE

Status: **Draft (P0-10) — created 2026-10-06; owner scope check PENDING** (APPROVAL REQUIRED: Yes).
Read with: `CREATEVERSE_BUILD_PLAN.md` §7 (epics) §8 (task template) §9 (Definition of Done),
`ROADMAP.md` §3 (phase exit criteria), `TASKS_PHASE_0_1.md` (Phases 0–1), `CURRENT_STATE.md`.

**Rules (same as TASKS_PHASE_0_1.md):** one task = one small, testable change set. Finish a task
fully (tests, docs, `CURRENT_STATE.md`, handoff report) before starting the next. Update the status
line when you touch a task. Task IDs are provisional until the owner's scope check.

Status legend: `TODO` · `IN PROGRESS` · `PARTIAL` · `DONE` · `BLOCKED`

**Global constraints that apply to every task below:**
- Phase N+1 starts only after Phase N's exit criteria are met **and the child has actually used it**
  (ROADMAP §2). DEFER-OK phases (5–7) may be skipped entirely by owner decision.
- Reuse rule (BUILD_PLAN §7): before building a studio or lab, evaluate embeddable open-source or
  free tools; build the integration and portfolio capture, not a clone. Adding a dependency needs a
  short written justification (DESIGN_SYSTEM §2.4).
- Safety/content rules: `risk_class: high` blocked for children (SAFETY §3); nothing reaches a child
  without owner + native-speaker review (SAFETY §13); live AI only per AI_SPEC §16 owner decision.
- Limits: free-tier budgets re-verified per `architecture/FREE_TIER_SPIKE.md` §5 when traffic or
  storage grows; D1 hard-fails over daily row limits.

---

# Phase 2 — Project Engine · FRONT-LOAD (content)

**Exit criteria (ROADMAP §3):** ≥3 flagship projects playable, authored mostly as data with little
new code, reviewed; authoring a new project takes a fraction of the Build a Bridge effort.

## P2-01 — Project template schema — **TODO**

GOAL: A project can be declared from a reusable template (lanes, step skeleton, hint ladder slots) so authors fill data instead of restructuring JSON.
CONTEXT: DATA_MODEL §2 entities; current `content/projects/*.project.json` is one-off.
REQUIREMENTS: template entity + instantiation validation in `shared-types`/`content-sdk`; template→project diff report; no change to the runtime-facing project shape.
ACCEPTANCE CRITERIA: a second project instantiated from the template passes `pnpm content:validate` with zero structural edits.
TEST PLAN: content-sdk tests with a template fixture (valid + missing-slot cases).
DEPENDENCIES: P1-15. APPROVAL REQUIRED: No.

## P2-02 — Challenge and experiment types — **TODO**

GOAL: Typed, data-driven challenge primitives (measure, build, test, reflect) the project runner can execute without project-specific code.
REQUIREMENTS: challenge type registry in `shared-types`; runner maps type → step behavior; unknown type fails validation.
ACCEPTANCE CRITERIA: a project using every challenge type runs through the runner with no new code.
TEST PLAN: runner unit tests per type; content-sdk rejects unknown types.
DEPENDENCIES: P1-05, P2-01. APPROVAL REQUIRED: No.

## P2-03 — Authoring workflow tools — **TODO**

GOAL: Make content production and review trackable: status workflow (draft → reviewed → approved), translation checklist, validator diff reports.
REQUIREMENTS: `pnpm content:checklist` lists per-locale missing/changed keys since last review; status field enforced (only `approved` reaches the child, SAFETY §13); validator prints per-file diffs.
ACCEPTANCE CRITERIA: checklist output is enough for a native speaker to review one pack in one sitting; CI still blocks non-approved content from shipping.
TEST PLAN: CLI fixture tests (exit codes, output shape).
DEPENDENCIES: P0-08. APPROVAL REQUIRED: No (review policy itself: owner).

## P2-04 — Evidence-based assessment v2 — **TODO**

GOAL: Rubrics as data with attempt weighting on top of `learning-core` evidence.
REQUIREMENTS: rubric schema (criteria, levels, weights); deterministic scoring; attempts weighted per DATA_MODEL §3; no graph reasoning yet (that is P6-01).
ACCEPTANCE CRITERIA: the same events replay to the same mastery rows every time.
TEST PLAN: learning-core replay tests (golden fixtures).
DEPENDENCIES: P1-06. APPROVAL REQUIRED: No.

## P2-05 — Attempts and reflection scoring — **TODO**

GOAL: Project runner records attempt counts and reflection completeness as assessment evidence.
REQUIREMENTS: attempt events already exist (P1-05); reflection non-empty counts as evidence; rubric consumes both.
ACCEPTANCE CRITERIA: completing a project with a reflection changes skill evidence deterministically.
TEST PLAN: integration test runner → events → evidence.
DEPENDENCIES: P2-04, P1-09. APPROVAL REQUIRED: No.

## P2-06 — Flagship project: Mars Rover — **TODO**

GOAL: Full project as data: three lanes, en + zh-Hant, hint ladders, assessments, safety notes, parent notes.
REQUIREMENTS: authored from the P2-01 template; status reaches `approved` only after owner + native review; terms consistent across steps/hints/UI.
ACCEPTANCE CRITERIA: a child can finish the lane for their stage; `pnpm content:validate` green; review recorded in the status field.
TEST PLAN: content validation + content checklist + playtest (TESTING §11).
DEPENDENCIES: P2-01, P2-02, P1-20 (Mars Rover physics domain is the P3-07 second domain — coordinate ordering). APPROVAL REQUIRED: Yes (content review).

## P2-07 — Flagship project: Future City — **TODO**

GOAL: Second flagship project as data (same bar as P2-06).
ACCEPTANCE CRITERIA: playable in all three lanes, both languages, reviewed.
TEST PLAN: content validation + playtest. DEPENDENCIES: P2-06. APPROVAL REQUIRED: Yes (content review).

## P2-08 — Flagship project: Make Your First Game — **TODO**

GOAL: Third flagship project; until Phase 4's Game Creator exists, uses an embeddable free tool or a simple built-in version (reuse rule).
ACCEPTANCE CRITERIA: playable end to end without Phase 4 code; portfolio capture works.
TEST PLAN: content validation + e2e smoke. DEPENDENCIES: P2-06. APPROVAL REQUIRED: Yes (content review; tool choice justification).

## P2-09 — Flagship project: Create a Song — **TODO**

GOAL: Fourth flagship project; simple built-in composition until P4-B Music Studio.
ACCEPTANCE CRITERIA: child can produce a short song artifact in-lane; offline.
TEST PLAN: content validation + artifact export test. DEPENDENCIES: P2-06. APPROVAL REQUIRED: Yes (content review).

## P2-10 — Flagship project: Build a Robot — **TODO**

GOAL: Fifth flagship project as data (same bar as P2-06).
ACCEPTANCE CRITERIA: playable in all three lanes, both languages, reviewed.
TEST PLAN: content validation + playtest. DEPENDENCIES: P2-07. APPROVAL REQUIRED: Yes (content review).

## P2-11 — Interdisciplinary linking — **TODO**

GOAL: Cross-subject concept/skill tags and a project graph so recommendations and parent summaries can reason across projects (P6 consumes this).
REQUIREMENTS: subject tag vocabulary in the graph; cross-pack prerequisite references validate; tags render in parent overview.
ACCEPTANCE CRITERIA: two packs share concepts with dangling-reference checks still green.
TEST PLAN: content-sdk graph tests (valid + dangling cases).
DEPENDENCIES: P2-01. APPROVAL REQUIRED: No.

## P2-12 — Project progression rules — **TODO**

GOAL: Data-driven project ordering (completion-based unlocks) without ever auto-promoting stage (DESIGN_SYSTEM §3: a stage never auto-promotes).
REQUIREMENTS: prerequisite field on projects; unlock evaluated locally; parent can override order.
ACCEPTANCE CRITERIA: order changes are data-only; stage never changes without the parent.
TEST PLAN: unit tests on unlock logic + content validation.
DEPENDENCIES: P2-01, P1-10. APPROVAL REQUIRED: No.

## P2-13 — Phase 2 exit playtest — **TODO**

GOAL: Run the playtest protocol over ≥3 flagship projects; measure authoring effort vs Build a Bridge.
ACCEPTANCE CRITERIA: results recorded (`docs/`), authoring-effort number written down, decision gate questions answered (which project next; live help on/off).
TEST PLAN: TESTING §11 protocol. DEPENDENCIES: P2-06…P2-12. APPROVAL REQUIRED: Yes (owner gate).

---

# Phase 3 — Experience Engine · MEDIUM

**Exit criteria:** one lab reused across difficulty levels from data only; frame-rate targets met on
real devices; still no game engine without an ADR + owner approval.

## P3-01 — Scene and state manager — **TODO**

GOAL: Scene transitions with save/restore and error containment inside the runtime.
REQUIREMENTS: scene stack in `experience-runtime`; runtime errors surface as a safe "try again" state, never a child-visible error message (AI_SPEC §13 pattern applies to runtime too); determinism preserved across transitions.
ACCEPTANCE CRITERIA: existing 8 bridge fixtures still pass; new fixtures for switch-away-and-back snapshot equality.
TEST PLAN: headless fixtures + snapshot round-trip tests.
DEPENDENCIES: P0-07. APPROVAL REQUIRED: No.

## P3-02 — Input abstraction — **TODO**

GOAL: One input layer over touch, mouse, keyboard and switch input (select → move → place).
REQUIREMENTS: DESIGN_SYSTEM §8 keyboard alternative; same actions exposed to tests; no hover-only paths (§4).
ACCEPTANCE CRITERIA: the bridge experience is completable with keyboard only, asserted in CI.
TEST PLAN: input-mapping unit tests + a headless keyboard-driven fixture.
DEPENDENCIES: P1-13. APPROVAL REQUIRED: No.

## P3-03 — Camera, viewport and rotation — **TODO**

GOAL: Pan/zoom/rotate with safe-area respect; rotation never loses state (DESIGN_SYSTEM §4).
ACCEPTANCE CRITERIA: headless fixture proves state survives viewport change; device check records fps during rotation.
TEST PLAN: fixtures + manual device pass (RUNTIME_SPIKE). DEPENDENCIES: P3-01. APPROVAL REQUIRED: No.

## P3-04 — Audio hooks — **TODO**

GOAL: Event-driven SFX through on-device synthesis; silent mode and reduced-motion respected; audio off never blocks play.
ACCEPTANCE CRITERIA: full fixture run with audio disabled produces identical simulation results.
TEST PLAN: determinism fixtures with/without audio; manual offline device pass.
DEPENDENCIES: P1-17. APPROVAL REQUIRED: No.

## P3-05 — Snapshot v2 and recovery — **TODO**

GOAL: Versioned snapshot schema with corrupt-snapshot recovery.
REQUIREMENTS: snapshot carries schema version; unknown/corrupt version → fresh start + telemetry event; migration path for v1 snapshots.
ACCEPTANCE CRITERIA: corrupted fixture bytes never crash; recovery is silent and logged.
TEST PLAN: unit tests over mutated snapshot buffers.
DEPENDENCIES: P3-01. APPROVAL REQUIRED: No.

## P3-06 — Simulation API (variables, constraints, rules) — **TODO**

GOAL: Express simulations as data: variables, constraints, rules, success/failure conditions, assessment signals (EXPERIENCE_RUNTIME §4).
REQUIREMENTS: schema in `shared-types`; validated by content-sdk; runtime interprets, never hard-codes scenes (ADR-0006).
ACCEPTANCE CRITERIA: an invalid simulation spec fails `pnpm content:validate`; a valid one runs headless deterministically.
TEST PLAN: schema tests + headless fixtures.
DEPENDENCIES: P0-07, P0-08. APPROVAL REQUIRED: No.

## P3-07 — Domain interface + second domain — **TODO**

GOAL: Extract the domain plugin interface (EXPERIENCE_RUNTIME §13) with the bridge ported and Mars Rover physics added behind it.
ACCEPTANCE CRITERIA: both domains run through the same runtime interface; determinism fixtures for both; no domain-specific branches outside domain modules.
TEST PLAN: fixture suites per domain.
DEPENDENCIES: P3-06, P2-06 (coordinate with Mars Rover content). APPROVAL REQUIRED: No (a new game engine: Yes).

## P3-08 — Assessment signals from simulations — **TODO**

GOAL: Map simulation outcomes to `AssessmentResult` → evidence events.
ACCEPTANCE CRITERIA: a known design gives a known assessment outcome in CI (same input → same result).
TEST PLAN: mapping unit tests + end-to-end fixture → evidence replay.
DEPENDENCIES: P3-06, P2-04. APPROVAL REQUIRED: No.

## P3-09 — Telemetry pipeline — **TODO**

GOAL: Runtime `TelemetryEvent` → standard event envelope → progress log, privacy-safe (no free text, no personal data; THREAT_MODEL flow map).
REQUIREMENTS: typed mapping in the app layer (ADR-0006: runtime does not know the envelope); field allowlist enforced; rate cap per step.
ACCEPTANCE CRITERIA: events round-trip into `progress_events`; a free-text field anywhere fails validation.
TEST PLAN: mapping tests + privacy allowlist test + sync round-trip.
DEPENDENCIES: P1-08. APPROVAL REQUIRED: No.

## P3-10 — First STEM lab: difficulty from data — **TODO**

GOAL: One physics lab spec generating ≥3 difficulty levels with zero code changes.
ACCEPTANCE CRITERIA: three levels produced by data only; each level passes determinism + success-condition fixtures; level choice is parent/child controlled, not automatic stage promotion.
TEST PLAN: fixture per level; content validation of the lab spec.
DEPENDENCIES: P3-06, P3-07. APPROVAL REQUIRED: No.

## P3-11 — Phase 3 exit: devices + lab playtest — **TODO**

GOAL: Frame-rate and lab playtest on the real phone and tablet; record in RUNTIME_SPIKE.
ACCEPTANCE CRITERIA: 30 fps floor met (Junior), targets met per stage; lab reused across levels proven in the write-up.
TEST PLAN: TESTING §11 device protocol. DEPENDENCIES: P3-01…P3-10. APPROVAL REQUIRED: Yes (owner gate).

---

# Phase 4 — Creative Universe · MEDIUM

**Exit criteria:** each studio produces a portfolio artifact, works offline where possible, respects
stage presets and accessibility rules, and stays within storage limits. User-created code runs in a
sandboxed iframe (SECURITY §8).

## P4-01 — Art Studio — **TODO**

GOAL: Draw, shapes, layers, export to portfolio — by integrating an open-source editor (reuse rule), not by building one.
REQUIREMENTS: tool evaluation note with justification; export pipeline → `FileStore` (R2) with type/size allowlist; works offline; Junior preset = big brushes, no precision.
ACCEPTANCE CRITERIA: a drawing lands as a portfolio artifact in both languages' UI; offline create works.
TEST PLAN: export unit tests + allowlist tests + manual preset pass.
DEPENDENCIES: P1-09, P1-16. APPROVAL REQUIRED: No (chosen dependency needs justification).

## P4-02 — Music Studio — **TODO**

GOAL: Rhythm, melody, simple composition with on-device synthesis; export audio artifact.
ACCEPTANCE CRITERIA: a 4-bar composition exports a playable artifact; silent mode still editable.
TEST PLAN: composition serialization tests + artifact export test.
DEPENDENCIES: P4-01, P1-17. APPROVAL REQUIRED: No (dependency justification if any).

## P4-03 — Coding Studio: blocks to text — **TODO**

GOAL: Block programming that reveals text syntax, running in a sandboxed iframe (SECURITY §8).
REQUIREMENTS: reuse a block library (justification required); execution only in sandboxed iframe with no network/parent-frame access; runtime budget per run; hint ladder integration points for debugging.
ACCEPTANCE CRITERIA: child code cannot touch parent frame, storage or network (asserted by tests); execution timeout enforced.
TEST PLAN: sandbox escape-attempt tests + timeout tests + a11y keyboard tests.
DEPENDENCIES: P4-01, P0-06 (hint ladder hooks). APPROVAL REQUIRED: No (security review of sandbox: required within task).

## P4-04 — Debugging hint ladders (coding) — **TODO**

GOAL: Pre-written debug hints per exercise, both languages, no answer leakage (TESTING §7 gate).
ACCEPTANCE CRITERIA: hints pass the eval-set leakage rules; content reviewed.
TEST PLAN: `pnpm ai:eval` extended with coding-hint cases. DEPENDENCIES: P4-03. APPROVAL REQUIRED: Yes (content review).

## P4-05 — Game Creator — **TODO**

GOAL: Rules, characters and scenes as data; published games run sandboxed and capture to portfolio.
ACCEPTANCE CRITERIES: a created game is playable from the portfolio entry; storage stays inside limits (FREE_TIER_SPIKE §6).
TEST PLAN: spec validation + sandbox run tests + artifact size test.
DEPENDENCIES: P4-03, P1-09. APPROVAL REQUIRED: No.

## P4-06 — Timeline animation — **TODO**

GOAL: Keyframe timeline over the existing runtime's sprites/props; export frames or short clip as artifact.
ACCEPTANCE CRITERIA: animation replays deterministically from its data; artifact within size limits.
TEST PLAN: timeline serialization + determinism tests.
DEPENDENCIES: P4-01. APPROVAL REQUIRED: No.

## P4-07 — Simple 3D builder — **TODO**

GOAL: Primitive-based modeling with an evaluated renderer dependency (justification required); offline.
ACCEPTANCE CRITERIA: a model renders at target frame rate on the reference phone; export to portfolio.
TEST PLAN: perf measurement on device + render smoke tests.
DEPENDENCIES: P4-01, P3-01. APPROVAL REQUIRED: No (dependency justification; a full engine: Yes).

## P4-08 — Phase 4 exit: artifacts and storage check — **TODO**

GOAL: Verify every studio's artifact path end to end against storage budgets.
ACCEPTANCE CRITERIA: recorded artifact sizes + R2 usage projection; offline matrix per studio documented.
TEST PLAN: artifact pipeline tests + storage math in FREE_TIER_SPIKE updated.
DEPENDENCIES: P4-01…P4-07. APPROVAL REQUIRED: Yes (owner gate).

---

# Phase 5 — Advanced STEM · DEFER-OK

**Exit criteria:** content packs reviewed and approved, simulations meet performance targets, no
`high` risk activities. Reuse rule applies to every simulation below.

## P5-01 — Robotics pack — **TODO**

GOAL: Robotics content pack + simulation (embedded or simple built-in), stages per pack.
REQUIREMENTS: `risk_class` stays `low`/`medium`; real-world extensions reviewed (SAFETY §3, §9).
ACCEPTANCE CRITERIA: pack approved; simulator meets frame-rate targets; no high risk.
TEST PLAN: content validation + safety review record + device perf.
DEPENDENCIES: P3-10, P2-03. APPROVAL REQUIRED: Yes (content + safety review).

## P5-02 — Electronics pack — **TODO**

GOAL: Circuit lab (virtual only) with difficulty levels from one spec. Same acceptance bar as P5-01.
DEPENDENCIES: P3-10. APPROVAL REQUIRED: Yes (content + safety review).

## P5-03 — Advanced physics pack — **TODO**

GOAL: Momentum, energy, fluids as labs extending the Phase 3 physics runtime. Same acceptance bar as P5-01.
DEPENDENCIES: P3-10. APPROVAL REQUIRED: Yes (content + safety review).

## P5-04 — Chemistry pack — **TODO**

GOAL: Virtual chemistry only; any real-world extension stays `low` risk or is blocked (SAFETY §3).
ACCEPTANCE CRITERIA: zero `high` risk activities; safety review explicitly covers every real-world suggestion.
TEST PLAN: content validation (high blocked) + safety review record.
DEPENDENCIES: P3-10. APPROVAL REQUIRED: Yes (safety review mandatory).

## P5-05 — Biology pack — **TODO**

GOAL: Biology content pack + simulations. Same acceptance bar as P5-01.
DEPENDENCIES: P3-10. APPROVAL REQUIRED: Yes (content + safety review).

## P5-06 — Astronomy pack — **TODO**

GOAL: Astronomy content pack + sky/orbit simulation. Same acceptance bar as P5-01.
DEPENDENCIES: P3-10. APPROVAL REQUIRED: Yes (content + safety review).

## P5-07 — Phase 5 exit — **TODO**

GOAL: All packs approved, performance targets recorded, zero high-risk items.
TEST PLAN: aggregate validation + device pass. DEPENDENCIES: P5-01…P5-06. APPROVAL REQUIRED: Yes (owner gate).

---

# Phase 6 — AI Learning Engine · DEFER-OK

**Exit criteria:** recommendations beat the fixed path in real use (engagement with learning, not
time); everything follows AI_SPEC: reviewed, capped, evaluated, parent-visible.
**Gate for all of Phase 6:** live AI provider decision (AI_SPEC §16) must be resolved; with no
provider, tasks use pre-written content only (default).

## P6-01 — Skill-graph reasoning — **TODO**

GOAL: Mastery propagation over the concept prerequisite graph (extends `learning-core`).
REQUIREMENTS: deterministic derivation by event replay (DATA_MODEL invariant 3); no data leaves the device for derivation.
ACCEPTANCE CRITERIA: replay fixtures produce stable mastery rows; concept levels never decrease (existing invariant kept).
TEST PLAN: learning-core graph tests.
DEPENDENCIES: P2-11, P2-04. APPROVAL REQUIRED: No.

## P6-02 — Difficulty adaptation — **TODO**

GOAL: Adapt next-step difficulty from evidence within the current stage; never auto-promote stage (DESIGN_SYSTEM §3).
ACCEPTANCE CRITERIA: adapter is explainable (reason codes) and unit-tested; stage changes only via parent.
TEST PLAN: adapter unit tests + property test (stage never changes).
DEPENDENCIES: P6-01. APPROVAL REQUIRED: No.

## P6-03 — Interest discovery — **TODO**

GOAL: Derive interest signals from activity choices; local first; nothing new leaves the device beyond existing events (THREAT_MODEL).
ACCEPTANCE CRITERIA: derivation covered by tests; threat model updated if any new flow appears.
TEST PLAN: derivation tests + THREAT_MODEL review checklist.
DEPENDENCIES: P6-01. APPROVAL REQUIRED: No (if a new data flow appears: Yes, privacy review).

## P6-04 — Next-project recommendations — **TODO**

GOAL: Ranked next-project suggestions with a parent-visible rationale, computed from graph + interests.
REQUIREMENTS: fallback to fixed progression when signals are thin; never engagement-bait (no urgency, SAFETY §6).
ACCEPTANCE CRITERIA: A/B against fixed path measured on learning engagement; results recorded.
TEST PLAN: ranking unit tests + experiment readout doc.
DEPENDENCIES: P6-02, P6-03, P2-12. APPROVAL REQUIRED: Yes (experiment design + success measure set by owner).

## P6-05 — AI-generated project drafts — **TODO**

GOAL: Live AI produces project **drafts** (outline, steps, hints) that humans review before use.
REQUIREMENTS: drafts land as `status: draft` only; no path from generation to child without owner + native review (SAFETY §13); provider per AI_SPEC §16; budget caps apply; eval set extended for generated content.
ACCEPTANCE CRITERIA: a generated pack fails to publish without review; `pnpm ai:eval` covers draft-review checks; zero live calls when provider off.
TEST PLAN: pipeline tests + eval additions + manual review of one generated draft.
DEPENDENCIES: P2-01, P2-03, AI_SPEC §16 decision. APPROVAL REQUIRED: Yes (live provider + review policy).

## P6-06 — Research mode (older stages) — **TODO**

GOAL: Source-citing research helper for Maker/older children behind the full safety pipeline.
REQUIREMENTS: citations required in output; input/output filtering; parent-visible transcripts; Junior/Explorer excluded.
ACCEPTANCE CRITERIA: passes eval set incl. injection cases in both languages; works degraded (no provider) by falling back to curated sources.
TEST PLAN: `pnpm ai:eval` extension + offline run.
DEPENDENCIES: P6-05, P1-11. APPROVAL REQUIRED: Yes (live provider).

## P6-07 — Parent summaries — **TODO**

GOAL: AI-assisted weekly parent summary (text), parent-visible, capped, never child-facing.
ACCEPTANCE CRITERIA: summary shows only aggregated evidence; budget recorded; parent can disable.
TEST PLAN: aggregation tests + budget tests + privacy review.
DEPENDENCIES: P6-01, P1-10. APPROVAL REQUIRED: Yes (live provider + summary review).

## P6-08 — Phase 6 exit — **TODO**

GOAL: Read out the recommendation experiment; decide keep/adjust/retire per feature.
ACCEPTANCE CRITERIA: written comparison vs fixed path on learning engagement; decision recorded in ROADMAP §9.
DEPENDENCIES: P6-04…P6-07. APPROVAL REQUIRED: Yes (owner gate).

---

# Phase 7 — Persistent Universe · DEFER-OK

**Exit criteria: owner-defined at that time. May never be needed (ROADMAP §3).**

## P7-01 — Persistent worlds — **TODO**

GOAL: Child-created worlds persist locally and sync with the existing idempotent event flow.
REQUIREMENTS: world state as versioned snapshots; sync stays idempotent (API_SPEC §1); storage rechecked against FREE_TIER_SPIKE §4 quotas.
ACCEPTANCE CRITERIA: kill-and-resume loses nothing; duplicate sync never duplicates state; quotas documented.
TEST PLAN: sync idempotency tests + storage math update.
DEPENDENCIES: P1-08, P1-05. APPROVAL REQUIRED: No (quota breach → owner, hosting gate).

## P7-02 — Interconnected projects — **TODO**

GOAL: Projects reference each other's outputs (one project's artifact feeds another).
ACCEPTANCE CRITERIA: cross-project references validate; deleting an artifact cascades per DATA_MODEL §7 rules without breaking entries (invariant 4).
TEST PLAN: graph validation + delete-cascade tests.
DEPENDENCIES: P2-11, P1-12. APPROVAL REQUIRED: No.

## P7-03 — Richer simulations within device budgets — **TODO**

GOAL: Denser scenes/particles only where frame-rate targets still hold; reduced-motion strips decoration (DESIGN_SYSTEM §2.3).
ACCEPTANCE CRITERIA: measured fps on reference devices recorded before/after.
TEST PLAN: device perf pass. DEPENDENCIES: P7-01. APPROVAL REQUIRED: No (if a game engine is needed: Yes, ADR).

## P7-04 — Family experiences — **TODO**

GOAL: Shared parent+child activities with correct role enforcement (parent actions need `parent+fresh`, API_SPEC §2).
ACCEPTANCE CRITERIA: authorization matrix tests cover every shared action; child cannot invoke parent actions.
TEST PLAN: API authorization matrix (same style as P1-01).
DEPENDENCIES: P1-01, P7-01. APPROVAL REQUIRED: No.

## P7-05 — Advanced portfolio — **TODO**

GOAL: Collections, timelines and cross-project views over existing entries/artifacts.
ACCEPTANCE CRITERIA: every entry still points to an existing artifact (DATA_MODEL invariant 4); export/delete unaffected.
TEST PLAN: referential tests + export snapshot test.
DEPENDENCIES: P7-02, P1-12. APPROVAL REQUIRED: No.

## P7-06 — Phase 7 gate — **TODO**

GOAL: Owner decides whether Phase 7 is delivered at all and defines its exit criteria.
ACCEPTANCE CRITERIA: written decision in ROADMAP §9 (go / never).
DEPENDENCIES: P7-01…P7-05 (if pursued). APPROVAL REQUIRED: Yes (owner; may be "never").

---

## Phase exit reminder

Do not start Phase N+1 until Phase N's exit criteria are met **and the child has actually used it**
(ROADMAP §2, TESTING §11). DEFER-OK phases (5, 6, 7) may be skipped by owner decision — record the
skip in ROADMAP §9.
