# TASKS_PHASE_0_1.md — CREATEVERSE

Status: **Reconstructed 2026-10-06** from `CREATEVERSE_BUILD_PLAN.md` §7 and `ROADMAP.md` (the original file was referenced everywhere but missing from the repo).
Read with: `CREATEVERSE_BUILD_PLAN.md` (§8 = task template, §9 = Definition of Done), `AGENT_OPERATING_RULES.md`, `CURRENT_STATE.md`.

**Rules:** one task = one small, testable change set. Read the linked docs before acting. Finish a task fully (tests, docs, `CURRENT_STATE.md`, handoff report) before starting the next. Update the status line of a task when you touch it.

Status legend: `TODO` · `IN PROGRESS` · `PARTIAL` · `DONE` · `BLOCKED`

Task fields (BUILD_PLAN §8): TASK ID / TITLE / GOAL / CONTEXT / REQUIREMENTS / NON-GOALS / INPUTS / OUTPUTS / FILES EXPECTED TO CHANGE / ACCEPTANCE CRITERIA / TEST PLAN / SECURITY CONSIDERATIONS / PERFORMANCE CONSIDERATIONS / DOCUMENTATION REQUIRED / DEPENDENCIES / APPROVAL REQUIRED.

---

# Phase 0 — Discovery · FRONT-LOAD

## P0-01 — Repo scaffold — **DONE (2026-10-06)**

GOAL: Monorepo per ARCHITECTURE.md §4 with lint, typecheck, test runner, content validation, and one green `pnpm check`.
REQUIREMENTS: pnpm workspaces; TypeScript strict; ESLint (typescript-eslint); Vitest at the root; packages `shared-types`, `learning-core`, `ai-core`, `content-sdk`, `design-tokens`; root scripts `typecheck`, `lint`, `test`, `content:validate`, `check`; CI (install from lockfile → typecheck → lint → test → content validate); `.gitignore` excludes `node_modules`, `dist`, `.env*`.
ACCEPTANCE CRITERIA: `pnpm check` green locally and in CI.
TEST PLAN: `pnpm check` runs the full chain; CI proves it on a clean clone.
DEPENDENCIES: none. APPROVAL REQUIRED: No.

## P0-02 — Core docs set — **DONE as drafts; owner review PENDING**

GOAL: The full doc set exists, cross-referenced, and reviewed by the owner.
DONE: PRODUCT_SPEC, ARCHITECTURE, DATA_MODEL, API_SPEC, SAFETY, SECURITY, TESTING, ROADMAP, AGENT_OPERATING_RULES, DESIGN_SYSTEM, AI_SPEC, EXPERIENCE_RUNTIME, CREATEVERSE_BUILD_PLAN present; INDEX.md and CURRENT_STATE.md created.
REMAINING: owner review of every "Draft v0.1" document; record the outcome in each document's Status line. APPROVAL REQUIRED: Yes (owner).

## P0-03 — Technology ADR files — **DONE (2026-10-06, uncommitted)**

GOAL: One ADR file per approved decision, in `docs/decisions/ADR-XXXX-title.md`.
DONE: `docs/decisions/ADR-0001-typescript-pnpm-monorepo.md` through `ADR-0008-icu-i18n-en-zh-hant.md` plus `docs/decisions/README.md`; each file has Context, Decision, Alternatives, Consequences, Status.
REMAINING: none — task text above still says "TODO" because the files were written without updating this backlog line. No doc contradictions found in this pass.
ACCEPTANCE CRITERIA: 8 files exist; INDEX.md updated; no contradiction with ARCHITECTURE.md.
TEST PLAN: doc review only. APPROVAL REQUIRED: Yes (decisions already owner-approved; files must not change them).

## P0-04 — Design tokens + base components — **DONE (2026-10-06)**

GOAL: Color/type/spacing/radius/motion tokens; button, card, chip, tabs, dialog; a preview page rendering every component in every preset and both languages.
CONTEXT: `packages/design-tokens` exists (tokens JSON, stage presets, CSS variable generation, contrast tests). DESIGN_SYSTEM.md §2 and §10 are the spec.
DONE (2026-10-06): `packages/ui` components + token-only CSS with app-root `data-stage` preset switching, self-authored SVG icon set, generated preview page (`pnpm ui:preview`, committed + freshness test) covering all 4 presets × en + zh-Hant, axe/touch-target/escape tests (22). REMAINING: none for P0-04 — screenshot snapshots land with P1-16.
ACCEPTANCE CRITERIA: preview page shows all components in junior/explorer/maker/parent presets, en + zh-Hant, WCAG AA contrast, 48 px (64 px Junior) targets.
DEPENDENCIES: P0-01. APPROVAL REQUIRED: No (major redesign later: Yes).

## P0-05 — Privacy and safety threat model — **DONE (draft, 2026-10-06, uncommitted; owner review PENDING)**

GOAL: Map child data flows end to end, including exactly what could ever be sent to an AI provider.
DONE: `docs/architecture/THREAT_MODEL.md` (Draft v0.1) with the device → sync → DB → AI-provider flow map, per-flow threats cross-referenced to SECURITY.md §3, the permanent "never sent to AI" list, retention confirmation items, and privacy-review checklist.
OUTPUTS: `docs/architecture/THREAT_MODEL.md`.
ACCEPTANCE CRITERIA: every table in DATA_MODEL.md §6 appears in the flow map; the owner can answer "what leaves the device" from the doc alone.
DEPENDENCIES: P0-02. APPROVAL REQUIRED: Yes (owner review).


## P0-06 — AI mentor prototype — **DONE (2026-10-06)**

GOAL: One hint-ladder conversation through the provider interface, plus pre-generated fallback. Works with the provider on and off.
CONTEXT: AI_SPEC.md §3 (interfaces), SAFETY.md §2 (pipeline). Budget rules in CREATEVERSE_BUILD_PLAN.md §5.
DONE: `packages/ai-core` — `MentorService.getHelp()` (precomputed ladder → cache → live → fallback), `BudgetGuard` (daily per-child + monthly caps), `MockAIProvider`, safety-layer interface, Junior-no-live-chat rule. Unit tests cover AI-off behavior, budget blocks, provider failure fallback.
DONE (2026-10-06): versioned prompts (`ai/prompts/mentor.system.md` v0.1) and policy (`ai/policies/mentor.policy.md` v0.1); eval runner in `ai/evals/` with mock and recorded modes — 51 cases (SAFETY §10 rows 1–15 in both languages, S1–S7, pedagogy, hint-leak, injection), run via `pnpm ai:eval` and inside `pnpm test` (TESTING.md §7, SAFETY.md §10). ai-core gained `secrets` verdict, unsafe→`safety.safe_alternative` mapping, new input patterns and an output instruction-leak filter. REMAINING: live/recorded-from-real-provider runs wait on the AI_SPEC §16 provider decision.
ACCEPTANCE CRITERIA: mentor answers from content with zero live AI; live path only when enabled, allowed by stage, and inside budget.
DEPENDENCIES: P0-03. APPROVAL REQUIRED: choosing the live provider: Yes.

## P0-07 — Web experience runtime spike — **PARTIAL (headless done in CI; device run pending)**

GOAL: One Experience Spec (Junior bridge) running in the browser with physics; success/fail conditions evaluated; telemetry emitted.
DONE: `packages/experience-runtime` (`WebExperienceRuntime`, Canvas 2D + Matter.js, ADR-0006) with the bridge domain, fixed-step headless mode, step overrides, success conditions, telemetry, snapshot/restore, instability guard; wired into `tsconfig.base.json` paths; `test/bridge.test.ts` (8 deterministic headless fixtures: pass/fail/support/determinism/telemetry/snapshot/invalid-spec/force-view); `docs/architecture/RUNTIME_SPIKE.md` records fixtures, tuning, and pending device work.
REQUIREMENTS: `packages/experience-runtime` with `ExperienceRuntime` interface + `WebExperienceRuntime` (Canvas 2D + Matter.js), headless mode for tests, bridge domain v0 (place pieces, gap, toy car, hold-for-time success condition), snapshot/restore, telemetry callbacks. Results go in `docs/architecture/RUNTIME_SPIKE.md` and feed back into EXPERIENCE_RUNTIME.md.
ACCEPTANCE CRITERIA: Junior bridge runs on the real phone and tablet at the 30 fps floor; deterministic headless runs in CI.
DEPENDENCIES: P0-03. APPROVAL REQUIRED: No (a game engine later: Yes).

## P0-08 — Content schema + validator — **DONE (2026-10-06)**

GOAL: Validation for learning content with invalid content failing CI.
DONE: `packages/content-sdk` — Zod schemas from shared-types, pack loader, checks: schema validity, graph references, lane coverage per stage, hint-ladder completeness, i18n key completeness (en + zh-Hant), draft status. CLI `cv-content validate`. Draft bridge content under `content/`.
DONE (2026-10-06): bundle compiler (`pnpm content:build` → deterministic `content/bundles/<locale>/<stage>.json`, 3 stages × 2 languages, nothing written on validation failure), Simplified-character check for zh-Hant enforced in validation (`zhHant.ts`), JSON Schema generation for editors (`pnpm content:schemas` → committed `content/schemas/`, drift-tested). REMAINING: none — acceptance met (`pnpm content:validate` still fails on missing keys/dangling ids/missing lanes).
ACCEPTANCE CRITERIA: `pnpm content:validate` fails on any missing translation key, dangling id, or missing lane; bundles compile for 3 stages × 2 languages.
DEPENDENCIES: P0-01. APPROVAL REQUIRED: No.

## P0-09 — Free-tier and auth feasibility spike — **DONE locally (2026-10-06); on-platform step PENDING owner account**

GOAL: Prove Hono on Workers + D1 fits the free tier for passkey verification, event batch insert, and sync; check artifact storage options.
REQUIREMENTS: measure CPU time for (a) WebAuthn verification, (b) 50-event idempotent batch insert, (c) sync read; document storage options and prices; written result; ADR-0003 addendum; fallback decision (small VPS) if limits fail.
DONE (2026-10-06): `docs/architecture/FREE_TIER_SPIKE.md` (measurements, current free-tier limits, storage options + prices, capacity math, VPS fallback triggers) + ADR-0003 addendum + reproducible `scripts/free-tier-bench.mjs` — WebAuthn verify 0.32 ms CPU, 50-event idempotent batch 0.15 ms CPU, sync read 0.16 ms CPU, all ≪ the 10 ms Workers budget. REMAINING: on-platform CPU confirmation (deploy spike Worker, real passkey ceremony) — blocked on owner approval to create the Cloudflare account.
DEPENDENCIES: P0-03. APPROVAL REQUIRED: Yes (hosting decision gate, ROADMAP §6).

## P0-10 — Backlog expansion for Phases 2–7 — **DONE draft (2026-10-06); owner scope check PENDING**

GOAL: Expand the epics in CREATEVERSE_BUILD_PLAN.md §7 into tasks in the §8 format.
REQUIREMENTS: every epic (P2-A..P7) gets tasks with acceptance criteria, test plan, dependencies; stored in `docs/TASKS_PHASE_2_7.md`.
DEPENDENCIES: P0-02. APPROVAL REQUIRED: Yes (owner scope check).

---

# Phase 1 — Private Family Alpha · FRONT-LOAD

Scope note (BUILD_PLAN §7): ONE project (Build a Bridge) across all three lanes and both languages before authoring a second project.

## P1-01 — Identity and family — **DONE (2026-10-08)**

GOAL: Parent sign-up, parent-created child profiles, strong auth (passkey-first per SECURITY.md §16.1).
REQUIREMENTS: users, families, sessions, devices; audit log rows for login/logout/failed login/device register/revoke; a child cannot self-register; step-up (`parent+fresh`) for sensitive actions (API_SPEC §2).
DONE (2026-10-08): `backend/` — Hono + Drizzle/SQLite API (ADR-0003) covering the API_SPEC §5.1–5.3/§5.11 subset: one-time `setup/bootstrap`; WebAuthn passkey register/login and step-up via the dual-mode `POST /auth/fresh` (empty body → challenge, assertion → verify); sessions with SHA-256-hashed tokens, 12 h TTL and a 5-minute `fresh_at` step-up window; devices with a hashed credential returned exactly once (revoke kills the device's sessions); parent-created child profiles + `child_settings` with optional PIN (5 failed attempts → 15-min lockout) and `POST /children/:id/open` at role=device scoped to the device's family; family info. Strict-Zod bodies (unknown fields → 400), 64 KB cap, API_SPEC §3 error envelope, auth rate limit 10/min/IP + 120/min/session, same-origin CORS incl. preflight, `Cache-Control: no-store`. 10-table identity schema + generated migration (`backend/migrations`), deviations documented in DATA_MODEL §3.1 and the schema header. Audit rows for all 14 auth actions with ids/enums only. Tests: `backend/test/{matrix,auth,audit}.test.ts` — authorization matrix generated from `ROUTES` (5 credential scenarios × 18 routes), cross-family 404 denial, child cannot self-register, step-up enforced + challenge replay rejected, PIN lockout/recovery, revoked device and its sessions dead, foreign-Origin 403, strict-Zod/oversize/unknown-route envelopes, 429 rate limit, audit coverage and personal-data absence. `pnpm check` green (160 tests).
TEST PLAN: authorization matrix on every auth endpoint; audit rows asserted. **Covered** — matrix is generated from the route table (a new endpoint cannot skip a row); audit assertions in `audit.test.ts`.
ACCEPTANCE CRITERIA: audit log written for every auth action; cross-family access denied by test. **Met** — both asserted in `pnpm test`.
DEPENDENCIES: P0-*.
REMAINING: real-browser/phone passkey ceremony and on-platform Workers CPU numbers fold into P0-09; the backend is not deployed yet (hosting needs the owner's Cloudflare approval).

## P1-02 — Localization foundation — **DONE (2026-10-08)**

GOAL: `t("key")` everywhere, en + zh-Hant switching per child, no hard-coded UI strings.
REQUIREMENTS: ICU message catalogs in `packages/i18n`, locale from the child profile, lint rule blocking raw strings in UI code.
DONE (2026-10-08): `packages/i18n` — ~160-key ICU catalogs (`messages.en.ts` is the source of truth; `messages.zhHant.ts` is typed `Record<MessageKey, string>` so a missing or invented key fails typecheck, with runtime parity/placeholder checks too), `createTranslator(locale)` with ICU plural/select/placeholder via `intl-messageformat` (compiled-message cache), runtime fallback to `en`, unknown key returns the key. App wiring: `useT()` in `apps/app/src/i18n.ts` binds the translator to the child profile language — the app's only locale source (ADR-0008, no Accept-Language); header/chrome, parent gate, all 10 pages and the fallback/error screens render `t("key")`; nav labels are typed `MessageKey`s in `routes.ts`; brand stays an invariant constant. Real ICU in the shell: greeting `select` on time of day, overview completed-projects `plural` incl. the `=0` branch. Lint: `cv/no-raw-text` (`scripts/eslint-rules/no-raw-text.mjs`, registered in `eslint.config.js` for every `.tsx`) blocks raw JSX text, strings reaching JSX containers/attributes, and raw values under text-bearing object keys (`label`, `title`, …) — while allowing `t()`/call arguments and code-valued attributes (className, id, role, aria IDREFs, SVG attrs, icon names).
TEST PLAN: lint fails on a raw string fixture; locale switch renders both catalogs. **Covered** — `apps/app/test/no-raw-text.test.ts` (7 fixtures through ESLint's `Linter` with the shipped rule + config) and `apps/app/src/locale.test.tsx` (3 jsdom render tests: en, switch to zh-Hant, switch back).
ACCEPTANCE CRITERIA: lint fails on a raw string; switching locale changes the whole shell. **Met** — verified end-to-end: `npx eslint` on a temporary raw-string probe exits 1 (probe deleted afterwards); the render test asserts header tagline, nav labels and page copy flip together with `<html lang>`.
DEPENDENCIES: P1-01.
REMAINING: content strings stay key-based and are validated separately (ADR-0007 / P1-04); `docs/product/LANGUAGE_STYLE.md` and native-speaker review of catalog wording remain owner-side follow-ups (SAFETY.md §13).

## P1-03 — Child app shell — **PARTIAL (shell DONE 2026-10-08; device install pending)**

GOAL: One PWA (`apps/app`) with route-guarded child and parent areas; Home, Explore, Create, Projects, Me navigation.
REQUIREMENTS: installable, offline shell via service worker, keyboard + touch accessible, reduced motion, stage presets applied via `data-stage`.
DONE (2026-10-08): `apps/app` React + Vite PWA — hash router with child area (Home/Explore/Create/Projects/Me) and parent area (Overview/Progress/Portfolio/Safety/Settings) behind a route gate with dialog semantics, focus trap and Escape/"Not now" exit; manifest + generated icons + `sw.js` v2 that precaches the shell and the assets its HTML references at install (verified: with the preview server killed, the production build renders and routes fully from cache); `data-stage` preset switching from the header/Settings; bilingual en + zh-Hant everywhere incl. nav labels and `document.documentElement.lang`; nav is a fixed bottom bar under 600 px and a bar under the header above (never absent — DESIGN_SYSTEM §4); token-only shell CSS (gate scrim via `color-mix`), no raw `rgba`; `user-scalable=no` removed so text scales to 200 %; `aria-current="page"` on the active nav item; icons render as real inline SVG (no markup-as-text) with visible labels as the accessible name; disabled state used for features that arrive with P1-09/P1-12. `pnpm check` green (typecheck, lint, 131 tests incl. preview freshness + axe, content validation).
REMAINING: install on the real phone and tablet (needs the physical devices); Playwright mobile/tablet viewport suite (verified locally with agent-browser at 390 px and 1280 px instead); offline smoke test passed locally against the production build with the server stopped.
ACCEPTANCE CRITERIA: app installs on the real phone and tablet; shell works offline. Offline ✓ local; device install PENDING.
TEST PLAN: Playwright mobile/tablet viewports; offline shell smoke test.
DEPENDENCIES: P0-04. APPROVAL REQUIRED: No.

## P1-04 — Content loader — **DONE (2026-10-08)**

GOAL: Load curriculum and projects from compiled bundles with validation.
REQUIREMENTS: bundle loader, runtime validation of bundle shape, graceful handling of a missing or corrupt bundle.
DONE: `apps/app/scripts/gen-content.ts` compiles `content/` before dev/build and fails the build on validation errors; bundles publish to `apps/app/public/content/{locale}/{stage}.json` with a manifest for service-worker precaching; `apps/app/src/content/bundles.ts` fetches and revalidates bundles at load and raises typed errors for network, invalid JSON, invalid bundle, or locale/stage mismatch; `useBundle.ts` turns those errors into calm fallback UI. `sw.js` precaches bundles from the manifest while preserving offline install on failure.
TEST PLAN: unit tests with corrupt bundle fixtures; bad content rejected at build and at load.
ACCEPTANCE CRITERIA: bad content rejected at build and at load; progress references `(content_id, version)`.
DEPENDENCIES: P0-08.

## P1-05 — Project runner — **DONE (2026-10-08)**

GOAL: State machine: story → learn → experiment → create → reflect → portfolio.
REQUIREMENTS: pause/resume across sessions; domain events per DATA_MODEL §3 (`child.project.started`, `child.activity.completed`, ...); works fully offline.
DONE: `apps/app/src/progress/store.ts` local-first IndexedDB-backed progress store with append-only UUIDv7 events, idempotent replay, pause/resume instances, attempts with hints/iterations/content refs, reflection answers excluded from events, lab design snapshots keyed by spec id/version, portfolio artifact linkage, derived summary replay, and a P1-08-ready sync outbox; `ProjectDetail.tsx` entry (start/continue/first-unfinished step + draft notice) and `StepRunner.tsx` (step/lab/reflect/portfolio, bridge lab success or move-on-after-3-tries, calm load-error fallback); `recentEvents()` returns newest-first history with insertion-order tie-break under frozen/coarse clocks.
TEST PLAN: kill the app mid-step and resume; events asserted append-only.
ACCEPTANCE CRITERIA: a project can be paused and resumed without data loss; events are append-only.
DEPENDENCIES: P1-04.

## P1-06 — Skill evidence v0 — **TODO**

GOAL: Tag-based skills with evidence events (no graph reasoning yet).
REQUIREMENTS: use `learning-core` derivations; evidence rows rebuilt by replaying events (DATA_MODEL invariant 3).
TEST PLAN: replay fixture events and compare derived rows.
ACCEPTANCE CRITERIA: completing activities updates skill evidence deterministically.
DEPENDENCIES: P1-05.

## P1-07 — AI mentor service — **TODO**

GOAL: Full MentorService in the app: hint ladder, age-aware tone, safety pipeline v0, cached + pre-generated fallback.
REQUIREMENTS: wire ai-core to content hint ladders; live AI only if parent-enabled, stage-allowed (not Junior), and inside budget; transcripts parent-visible; kill switch honored.
TEST PLAN: eval set (mock + recorded) plus an offline run with live AI off.
ACCEPTANCE CRITERIA: passes the eval set; works fully offline from live AI.
DEPENDENCIES: P0-06.

## P1-08 — Progress log — **TODO**

GOAL: Timestamped, traceable learning events queryable per child.
REQUIREMENTS: events stored append-only, scoped by family and child; resumable sync client-side in IndexedDB, then `POST /sync/events` idempotent by `event_id` (API_SPEC §1, ARCHITECTURE.md §6).
TEST PLAN: duplicate push deduped; events queryable per child; cross-child query denied.
ACCEPTANCE CRITERIA: events queryable per child; retries never duplicate rows.
DEPENDENCIES: P1-05.

## P1-09 — Portfolio — **TODO**

GOAL: Create and view portfolio entries with reflection fields (DATA_MODEL §2.7, PRODUCT_SPEC §3).
REQUIREMENTS: artifact upload with type allowlist and size limit (API_SPEC §4); every entry points to an existing artifact (DATA_MODEL invariant 4); parent can delete artifacts individually.
TEST PLAN: upload allowlist and size-limit tests; entry→artifact referential test.
ACCEPTANCE CRITERIA: a completed project produces an entry visible to child and parent.
DEPENDENCIES: P1-05.

## P1-10 — Parent overview — **TODO**

GOAL: Concepts, skills, projects, interests, struggles, next suggestions; time and content controls.
REQUIREMENTS: learning-first composition (DESIGN_SYSTEM §7); no screen-time-first dashboard; controls enforced server-side (API_SPEC §6.4).
TEST PLAN: overview endpoint scoped by family; settings change requires step-up.
ACCEPTANCE CRITERIA: overview reads as learning evidence, not metrics; time is last.
DEPENDENCIES: P1-08.

## P1-11 — Safety v0 — **TODO**

GOAL: Input/output filtering, risky-experiment classification, safe alternatives.
REQUIREMENTS: implement SAFETY.md §2 pipeline stages behind interfaces; rule-based first; every blocked or redirected exchange writes a `safety_events` row with no raw personal data; risk classes enforced (`high` blocked for children).
TEST PLAN: SAFETY.md §10 eval cases must all pass (100%); every safety bug becomes a permanent test.
ACCEPTANCE CRITERIA: safety must-pass cases pass in both languages.
DEPENDENCIES: P1-07.

## P1-12 — Data export and delete — **TODO**

GOAL: Parent can export or delete a child's data, verified end to end.
REQUIREMENTS: per DATA_MODEL §7 (archive contents, soft delete, 14-day grace, hard-delete cascade, audit row without personal content); delete endpoints require `parent+fresh`; backups age out per the documented policy (SECURITY.md §10).
TEST PLAN: export archive contents asserted; delete cascade on a copy of real-shaped data.
ACCEPTANCE CRITERIA: verified end to end; audit row written; nothing personal in the audit.
DEPENDENCIES: P1-01.

## P1-13 — Accessibility baseline — **TODO**

GOAL: Contrast, scalable text (200%), captions/audio hooks, simple-language mode, focus rings, screen-reader live regions.
REQUIREMENTS: DESIGN_SYSTEM §8 checklist; axe clean on key screens; keyboard alternative for experience placement (select, move, place).
TEST PLAN: axe via Playwright in CI; manual checklist on the real phone and tablet.
ACCEPTANCE CRITERIA: checklist passed; no color-only cues anywhere.
DEPENDENCIES: P1-03.

## P1-14 — E2E child journey — **TODO**

GOAL: Automated Playwright journey: login → choose project → activity → AI hint → finish → portfolio.
REQUIREMENTS: mobile and tablet viewports, virtual passkey authenticator, both languages, and a run with live AI off (TESTING.md §2).
TEST PLAN: e2e green in CI smoke; full suite before release.
ACCEPTANCE CRITERIA: test green in CI with live AI off.
DEPENDENCIES: P1-05, P1-07, P1-09.

## P1-15 — Flagship content: Build a Bridge — **TODO (draft skeleton exists in `content/`)**

GOAL: Full project as data with hint ladders and reflection, one lane per stage, in en + zh-Hant.
REQUIREMENTS: status stays `draft` until owner review AND native-speaker review (SAFETY.md §13); the Junior lane needs no reading; terms (plank, pillar, brace) stay consistent across steps, hints and UI in both languages; every unit lists objective, concepts, skills, safety notes, parent notes, pre-written hint ladder (BUILD_PLAN §10).
TEST PLAN: `pnpm content:validate` for schema, graph and i18n completeness; content checklist review.
ACCEPTANCE CRITERIA: child can finish the lane for their stage.
DEPENDENCIES: P1-04.

## P1-16 — Stage presets — **TODO (token presets exist in design-tokens)**

GOAL: Three token-driven UI presets (Junior: icons, big targets, no reading; Explorer: short text; Maker: fuller text and controls), switchable by the parent.
REQUIREMENTS: presets override tokens only; components never change per preset (DESIGN_SYSTEM §9); applied via `data-stage` on the app root.
TEST PLAN: token contrast tests per preset; screenshot snapshots per preset and language.
ACCEPTANCE CRITERIA: same app, three presets, switchable live.
DEPENDENCIES: P0-04, P1-03.

## P1-17 — Audio for pre-readers — **TODO**

GOAL: Read-aloud for prompts and hints in en + zh-Hant using on-device speech synthesis first.
REQUIREMENTS: pause and stop always visible (DESIGN_SYSTEM §8); works offline where the device supports it; evaluate recorded audio for key Junior content if device voices are poor (ARCHITECTURE.md §12).
TEST PLAN: manual on the real devices in both languages; offline check.
ACCEPTANCE CRITERIA: Junior lane fully usable without reading; works offline.
DEPENDENCIES: P1-02, P1-15.

## P1-18 — Private family access — **TODO**

GOAL: Parent-controlled login, no public sign-up, private hosting settings.
REQUIREMENTS: only invited family accounts reach the app; deployment checklist recorded in `docs/operations/`; no public routes except setup, login and health (API_SPEC §5).
TEST PLAN: external scan finds nothing public; sign-up path absent.
ACCEPTANCE CRITERIA: only invited family accounts can reach the app.
DEPENDENCIES: P1-01.

## P1-19 — Backup and restore tooling — **TODO**

GOAL: Scheduled encrypted export of the database and artifacts to a parent-controlled location, plus a tested restore.
REQUIREMENTS: `docs/operations/RECOVERY.md` with recovery steps and target (restore within a day, losing at most a week — SECURITY.md §10); restore drill before launch, then quarterly.
TEST PLAN: restore drill on real-shaped data.
ACCEPTANCE CRITERIA: restore drill passes; drill recorded in `docs/operations/`.
DEPENDENCIES: P1-01.

## P1-20 — Experience runtime: Explorer and Maker — **TODO**

GOAL: All three bridge lanes run (beam, brace, wood and steel, budget, force view, test log).
REQUIREMENTS: data-driven per EXPERIENCE_RUNTIME.md §4 step overrides; force view uses pattern + color + labels, never color alone; known designs give known outcomes per lane; frame-rate targets met on the real devices.
TEST PLAN: determinism fixtures per lane; simulation tests in CI; device measurements.
ACCEPTANCE CRITERIA: known designs give known outcomes per lane; frame rate meets targets.
DEPENDENCIES: P0-07, P0-08.

---

## Phase exit reminder

Do not start Phase N+1 until Phase N's exit criteria are met **and the child has actually used it** (ROADMAP §2, TESTING.md §11).



