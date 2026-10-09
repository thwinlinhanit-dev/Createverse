# TESTING.md — CREATEVERSE

Status: **Draft v0.1**
Read with: Master Spec sections 39, 40, 43; `ARCHITECTURE.md`; `DATA_MODEL.md` (section 8 invariants); `SAFETY.md` (section 10); `SECURITY.md` (section 14)

Goal: with limited AI access, **tests are the memory of the project.** A future agent or human must be able to change code safely using only the repo and a passing test suite.

---

## 1. Principles

1. **Tests ship with the change.** No task is done without them (Definition of Done).
2. **Test behavior, not implementation.** Tests should survive refactors.
3. **Deterministic by default.** Fixed seeds, fixed clocks, no network, no live AI.
4. **Fake data only.** Never real child data, real keys, or real emails.
5. **Fast first.** Most tests are unit tests that run in seconds. Slow tests run in CI and before release.
6. **Every bug becomes a test.** Every safety or security bug becomes a permanent test.
7. **Keep it cheap.** Use free tooling and free CI minutes. Avoid paid test services.

---

## 2. Test layers

```text
            few, slow, realistic
        ┌───────────────────────────┐
        │ Real-device + child play  │  manual, per phase
        ├───────────────────────────┤
        │ E2E (Playwright, mobile)  │  key journeys
        ├───────────────────────────┤
        │ AI eval + safety eval     │  mock + recorded + optional live
        ├───────────────────────────┤
        │ Integration (API + DB)    │  module boundaries, sync
        ├───────────────────────────┤
        │ Simulation tests          │  deterministic physics
        ├───────────────────────────┤
        │ Content validation        │  schema, i18n, graph
        ├───────────────────────────┤
        │ Unit (Vitest)             │  domain logic, pure functions
        └───────────────────────────┘
            many, fast, cheap
```

| Layer | Tool | Runs | What it protects |
|---|---|---|---|
| Unit | Vitest | Every commit, locally and CI | Domain logic: hint ladder, skill evidence, budget guard, i18n helpers |
| Content validation | `content-sdk validate` | Every commit touching `content/`, and CI | Schemas, translation completeness, graph references, lane coverage, Simplified-character check |
| Simulation | Vitest with the runtime in headless mode | CI | Physics outcomes, success conditions, determinism |
| Integration | Vitest + local SQLite/D1 test DB | CI | Modules, authorization, sync, derivations |
| AI eval | Eval runner in `ai/evals/` | On prompt/policy/model change, and CI with mock | Hint quality, answer leakage, safety behavior |
| E2E | Playwright, mobile and tablet viewports, virtual passkey authenticator | CI (smoke) and before release (full) | Real user journeys, offline, languages |
| Accessibility | axe via Playwright | CI | Contrast, labels, focus, structure |
| Visual regression | Playwright screenshots | CI, key screens only | Unintended layout changes in stage presets and languages |
| Performance | Lighthouse CI + custom runtime benchmarks | CI (budget check) and real devices per phase | Load time, JS size, frame rate |
| Security | Authorization matrix, dependency audit, secret scan, header check | CI | See `SECURITY.md` section 14 |
| Real-device and child play | Manual protocol (section 11) | End of each phase | What metrics cannot show |

---

## 3. Unit tests

Must cover, at minimum:

- `learning-core`: hint ladder progression (never skips levels, never gives solution before `solution_allowed_after`), skill evidence derivation, concept level rules (never decreases), mastery rules from assessments.
- `ai-core`: provider fallback order (precomputed, cache, live, fallback), budget guard (daily per-child cap, monthly cap, resets), rule-based input/output safety, no personal data in provider requests.
- `i18n`: key lookup, ICU plurals, fallback to `en`, locale selection per child.
- `content-sdk`: loaders, compilers, validators (good and bad fixtures).
- `identity`/`family`: role checks, device registration and revocation, recovery code generation and use-once behavior.
- Utilities: ids (UUIDv7 ordering), time handling (UTC), retry/backoff.

Rules: no network, no real clock (inject a clock), one behavior per test, descriptive names (`it("does not reveal the solution before level 5")`).

---

## 4. Content validation tests

`content-sdk validate` must fail the build when:

- A schema is invalid or a required field is missing.
- A `*_key` is missing in `en` or `zh-Hant`.
- A hint ladder has fewer than 4 levels, or levels are not sequential.
- A concept, skill, interest, step, assessment, experience or extension id is unknown.
- A project lacks a lane for a configured stage, or a lane step is missing.
- `risk_class` is `high`, or a physical extension lacks `requires_adult`.
- Chinese text contains Simplified-only characters (use a maintained character list, not a hand list, once available).
- A Junior step lacks `read_aloud` or has text longer than the Junior limit (set in the validator, for example 20 words in English).
- An experience `step_overrides` entry points to an unknown step.

Plus **snapshot tests** of the compiled bundles for one project per stage and language, so accidental content changes show in review.

---

## 5. Simulation tests (experience runtime)

Goal: the bridge simulation behaves the same every time, on every device.

- **Determinism:** same `(spec, seed, inputs)` produces the same result. Test in headless mode with fixed time steps.
- **Success and failure fixtures:** known designs with known outcomes. Examples: single plank over a 3-unit gap with the car succeeds; same plank with the truck fails; plank plus center pillar with the truck succeeds; Maker design under budget succeeds; one over budget fails the `cost<=budget` condition.
- **Constraints:** piece limits, budget limits, allowed pieces and vehicles per step override.
- **Telemetry:** the right events are emitted with the right payloads (runs, iterations, cost, max stress).
- **Assessment signals:** the runtime emits the signals listed in `BUILD_A_BRIDGE_CONTENT.md`.
- **Save/restore:** a snapshot restored mid-run continues identically.
- **Tolerance:** physics libraries can differ across platforms in tiny ways. Success conditions must have margins so tests do not flake. Record the margin in the spec, not in the test.

---

## 6. Integration tests (API + database)

Run against a local SQLite database with migrations applied (and against D1 locally in CI where practical).

- **Authorization matrix:** parent of family A cannot read family B; child X cannot read child Y; child cannot call parent endpoints; revoked device cannot sync. One test per endpoint, generated from the route table so new endpoints cannot skip it.
- **Sync:** posting the same event twice stores it once; events for another child are rejected; out-of-order events are accepted and derived state is correct; large batches respect limits.
- **Replay equivalence (invariant 3):** replaying all events for a child reproduces `skill_evidence`, `concept_progress` and `project_instances`.
- **Invariants 1 to 6** in `DATA_MODEL.md` section 8, each as a test.
- **Deletion and export:** export contains everything listed; delete removes all child-linked rows and files after the grace period; audit rows contain no personal content.
- **Budget and AI:** a capped family gets pre-written hints with no provider call; AI-off children never produce `ai_messages`; Junior never reaches the live provider path.
- **Migrations:** apply all migrations to a database with realistic fixture data and verify nothing is lost.

---

## 7. AI evaluation

Lives in `ai/evals/`. Three modes so tests are free and repeatable:

| Mode | Provider | Use |
|---|---|---|
| `mock` | Scripted responses | Unit and integration. Tests the pipeline logic (filters, fallbacks, budget) |
| `recorded` | Saved real responses | CI regression for prompt and policy changes |
| `live` | Real provider, manual run, capped spend | Before release and when prompts or models change |

**Datasets**
- `hints/`: for each step, expected behavior at each hint level, including "no solution leakage".
- `safety/`: the 15 cases in `SAFETY.md` section 10, in both languages, per stage.
- `pedagogy/`: sample questions with rubric (guides thinking, correct physics, age-appropriate length).
- `injection/`: prompt-injection attempts in child text and in content fields.

**Metrics** (Master Spec section 40): correctness, age appropriateness, pedagogical quality, agency preservation, safety, consistency, hallucination rate, hint quality, difficulty calibration, answer leakage.

**Gates**
- All `must-pass` safety cases pass, or the release is blocked.
- Answer-leakage rate on the hint dataset is zero before level 5.
- A prompt, policy, or model change requires a recorded-mode run, and a live run before release.
- Evaluation outputs are saved in `ai/evals/results/` (summary only, no personal data).

Grading approach: rule-based checks first (cheap, deterministic). Use an AI judge only for pedagogy rubric items, and spot-check its grades by hand.

---

## 8. End-to-end tests (Playwright)

Run on mobile (phone) and tablet viewports. Use a **virtual WebAuthn authenticator** for passkeys.

**Smoke (every CI run)**
1. Parent registers with a passkey, creates a child profile, registers the device.
2. Child opens the profile, starts Build a Bridge, completes the first step, sees progress saved.

**Full journeys (before release, per phase)**
- Parent setup, then child journey for **each stage** (Junior, Explorer, Maker): login, choose project, complete all lane steps, use at least one hint, finish, portfolio entry appears.
- **Both languages:** the same journeys in `en` and `zh-Hant`. Check no raw keys appear and Chinese text wraps correctly.
- **Offline:** load the app, go offline, complete a step, return online, verify sync and no duplicate events.
- **Parent controls:** disable AI mentor, set a time limit, change allowed risk class, verify behavior in the child app.
- **Safety flow:** a scripted distress message produces a parent notice and a safety event (mock provider).
- **Budget exhausted:** the mentor falls back to pre-written hints.
- **Export and delete:** run and verify.
- **Recovery:** use a recovery code to regain access.

Test hygiene: stable `data-testid` attributes, no fixed sleeps (wait on conditions), isolated test families created via a test-only seeding path that does not exist in production builds.

---

## 9. Accessibility and localization tests

- **axe** checks on each key screen, per stage preset and per language.
- Keyboard/focus order, visible focus, labels for icon buttons (labels exist in both languages).
- **Contrast** checks on tokens for every stage preset and theme.
- **Touch targets:** at least 48 px, and at least 64 px in the Junior preset. Test with computed sizes.
- **Reduced motion:** with the preference set, non-essential animation is off.
- **Text scaling:** at 200% text size, no clipped or overlapping UI on phone layout.
- **Not color-only:** the bridge force view has a second cue (pattern or label), checked in a screenshot test.
- **Read-aloud:** the wrapper picks the right voice for `en` and `zh-TW`/`zh-HK`, and shows a helpful parent notice when no voice is installed.
- **i18n completeness:** build fails on missing keys. Pseudo-localization (long strings) run to detect layout breaks.
- **CJK rendering:** font stack check for Traditional Chinese on target devices, and line breaking.

### 9.1 Automated suite (P1-13)

`pnpm test:e2e` runs `e2e/a11y.spec.ts` (Playwright + `@axe-core/playwright`) against the real dev server; CI runs it as the `a11y` job after `pnpm check`:

- axe (WCAG 2.1 A + AA) — seven key child screens in en + zh-Hant, parent gate + all five parent screens, home + step runner under all three stage presets, simple-language mode in both locales.
- keyboard-only bridge placement (canvas wrap focus → Arrow keys → Enter → piece placed and announced), the 3px focus ring on first Tab, and the never-color-only rule (force-view written legend, icon + words on failed runs).
- Scans emulate `reducedMotion: "reduce"` so shell.css turns chip color transitions off — contrast is measured in a settled state.

### 9.2 Manual device checklist (P1-13 — run on the real phone + tablet)

- [ ] Text scaling at 200%: no clipped or overlapping UI on any key screen (phone layout).
- [ ] Touch targets ≥48 px (≥64 px in Junior), including the lab tray chips on the bridge step.
- [ ] VoiceOver/TalkBack: step change, new hint and lab result are announced (live regions); parent gate announces as a dialog; labels correct in both languages.
- [ ] Read-aloud picks the right voice for `en` and `zh-TW`/`zh-HK`; parent notice shows when no voice is installed.
- [ ] Simple-language mode (parent Settings) visibly shortens copy, in both languages.
- [ ] With the system reduced-motion preference set, transitions are off.
- [ ] No color-only cues in device screenshots (force view has its written legend; success/fail show icon + words).
- [ ] PWA installs and the shell works offline.

---

## 10. Performance tests

Targets come from `ARCHITECTURE.md` section 13. Revise after measuring.

| Check | Where | Pass |
|---|---|---|
| Initial JS (gzipped) | CI bundle-size check | Under 250 KB for the shell |
| First load, mid-range phone on throttled 4G | Lighthouse CI | App usable under 3 s |
| Interaction latency | Playwright traces | Under 100 ms |
| Experience frame rate | Runtime benchmark, headless proxy in CI, **real devices per phase** | 60 fps target, 30 fps floor |
| Memory growth over a 20-minute session | Manual on real device | No steady growth |
| Offline start | Playwright offline mode | Shell and current project load with no network |
| Worker CPU per request | Local timing plus platform metrics | Under the 10 ms free-tier limit for hot paths. Auth and sync measured in P0-09 |
| D1 usage | Metrics review | Well under free daily row limits |

---

## 11. Real-device and child-play protocol

Metrics cannot tell you whether a three-year-old understands a screen. Do this at the end of each phase.

**Devices:** the real phone and the real tablet the child uses. Note model and OS version.

**Session protocol (10 to 20 minutes, a grown-up present)**
1. Let the child use it with no instructions. Observe and take notes. Do not rescue quickly.
2. Record: where they hesitate, what they tap by mistake, what they ignore, what makes them smile, when they ask for help, when they lose interest.
3. Check: Can a Junior child complete a step without reading? Do the spoken prompts work in each language? Are touch targets big enough for small hands?
4. Ask the child (age-appropriate) to explain what they built.
5. Afterward, write findings as tasks. Fix the top three issues before the next phase.

**Evidence to keep:** short notes and screenshots in `docs/product/playtests/` (no video of the child stored in the repo).

Success for Phase 1: the child completes a full project lane unaided, wants to try again or change the design, and the parent understands the dashboard.

---

## 12. Security tests

See `SECURITY.md` section 14. In CI:

- Authorization matrix (section 6).
- Dependency audit, secret scan, lockfile check.
- Header and CSP check against a built preview.
- Input fuzz on sync and upload endpoints.
- Prompt-injection cases from the AI eval set.

---

## 13. CI pipeline and gates

```text
install (lockfile) → typecheck → lint → unit → content validate → simulation
→ integration → AI eval (mock + recorded) → build → e2e smoke → a11y
→ bundle size / Lighthouse → security (audit, secrets, headers) → report
```

**Merge gates:** all of the above green, no skipped tests without a linked task, documentation updated, handoff report included.
**Release gates (additionally):** full e2e in both languages and all stages, live AI eval run (if AI behavior changed), real-device check on phone and tablet, restore drill for any migration, owner approval.

Keep CI fast: cache dependencies, run independent jobs in parallel, run the full e2e suite only on release branches and nightly.

---

## 14. Flaky tests and coverage

- A flaky test is a bug. Fix it or quarantine it with a linked task within one working week. Never retry-until-green silently.
- Coverage is a signal, not a goal. Targets: 90%+ on `learning-core`, `ai-core`, `content-sdk`, `identity`, budget and safety code; 70%+ elsewhere. Critical modules need meaningful assertions, not just execution.
- Mutation-style spot checks (break the code on purpose) for hint-ladder, budget guard and authorization rules before release.

---

## 15. Test data and environments

- Fixtures live in `tests/fixtures/`. Use generated fake families and children with obviously fake names.
- A test-only seeding command creates families and events. It is excluded from production builds.
- Never copy production data into tests. Never put real keys in CI logs.
- Environments: local (SQLite), CI (SQLite/D1 local), optional staging on the free tier, production.

---

## 16. Test plan template (use in every task)

```text
TEST PLAN
- Unit: <what behavior, which file>
- Integration: <what endpoint/module, which invariants>
- Simulation / content / AI eval: <which datasets or fixtures>
- E2E / a11y / perf: <which journey or screen>
- Manual: <device, steps>
- Regression added for: <bug or risk>
```
