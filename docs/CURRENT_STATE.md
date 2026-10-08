# CURRENT_STATE

Updated: 2026-10-08 by Buffy (agent)
Phase: 1 started — Phase 0 tasks that need no owner input are DONE

## Done
- Core docs set written (owner review still pending on the Draft v0.1 documents) — P0-02 drafts.
- Docs rearranged: duplicates removed, `docs/files/*` promoted to `docs/`, `BLANC_COFFEE_SPEC.md` moved to `docs/other-products/`.
- `docs/INDEX.md`, `docs/CURRENT_STATE.md`, `docs/TASKS_PHASE_0_1.md` created.
- **P0-01 repo scaffold — DONE.** pnpm workspace, TypeScript strict, ESLint, Vitest, GitHub Actions CI, git repo.
- **P0-03 ADR files — DONE (uncommitted).** `docs/decisions/ADR-0001`–`ADR-0008` plus `README.md`.
- **P0-05 threat model — DONE draft (uncommitted; owner review PENDING).** `docs/architecture/THREAT_MODEL.md`.
- **P0-07 headless slice — PARTIAL (headless done in CI; device run pending).** `packages/experience-runtime` with 8 deterministic fixtures; `docs/architecture/RUNTIME_SPIKE.md` (device numbers pending).
- **P0-04 — DONE (2026-10-06).** `packages/ui`: Button/Card/Chip/Tabs/Dialog/StepProgress/HintButton/PortfolioCard/ParentGate/SafetyNotice + inline SVG icon set (no dependency, justified in `Icon.ts`), token-only component CSS (`styles.ts`), `data-stage` preset switching owned by the app root (§10), generated preview page (`pnpm ui:preview` → `packages/ui/preview/index.html`, committed with a freshness test) covering all 4 presets × en + zh-Hant, axe-clean via jsdom (`packages/ui/test/ui.test.ts`, 22 tests). Token drift fixed to match DESIGN_SYSTEM §2.3/§3 (radius, spacing incl. 64px, motion, elevation tokens added, Explorer touch target 56px); tests pin these values.
- **P0-06 — DONE (2026-10-06).** `ai/prompts/mentor.system.md`, `ai/policies/mentor.policy.md` (v0.1) + **eval runner** `ai/evals/` with mock and recorded modes (TESTING §7): 51 cases — SAFETY §10 rows 1–15 in en + zh-Hant, S1–S7, pedagogy, hint-ladder (zero leakage before level 5), injection. Runs as `pnpm ai:eval` and inside `pnpm test` (`ai/evals/eval.test.ts`); mutation-tested (disabling the output filter fails CI with leak markers). ai-core gained the gaps the eval set demanded: `secrets` verdict, block→`safety.safe_alternative`, explode/heat/chemicals/sad/hurting/story patterns, output instruction-leak filter.
- **P0-08 — DONE (2026-10-06).** `packages/content-sdk`: bundle **compiler** (`pnpm content:build` → deterministic `content/bundles/<locale>/<stage>.json`, 3 stages × 2 languages, 6 files, nothing written on validation failure), **Simplified-character check** for zh-Hant wired into validation (`src/zhHant.ts`, curated simplified-only set; existing content passes 0 hits), **JSON Schema generation** (`pnpm content:schemas` → committed `content/schemas/*.schema.json` with drift test; `$schema` referenced from `projects/*.project.json`). 14 new tests (`compile.test.ts`).
- **P0-09 — DONE locally (2026-10-06); on-platform confirmation PENDING owner account.** `docs/architecture/FREE_TIER_SPIKE.md` + ADR-0003 addendum + reproducible `scripts/free-tier-bench.mjs`. Measured on this machine: WebAuthn assertion verify (`@simplewebauthn/server` v14) **0.32 ms CPU**, 50-event idempotent batch insert **0.15 ms CPU** (duplicate replay writes 0 rows), sync read (200-row covering-index page) **0.16 ms CPU** — all ≪ the Workers free 10 ms budget. Free-tier quotas (Workers 100k req/day; D1 5M read/100k write/5 GB, hard-fails over quota since 2026-09-01; R2 10 GB) carry 30–600× headroom at alpha scale. Artifacts: **R2 free tier recommended** behind `FileStore`; B2 as exit path.
- **P0-10 — DONE draft (2026-10-06); owner scope check PENDING.** `docs/TASKS_PHASE_2_7.md`: all Phase 2–7 epics expanded into 53 tasks with goal/requirements/acceptance/test plan/dependencies/approval.
- **P0-02 slices:** `packages/shared-types` (Zod schemas), `packages/learning-core` (14 tests), `packages/ai-core` (19 tests), `packages/content-sdk` (25 tests), `packages/design-tokens` (23 tests).
- **P1-01 Identity and family — DONE (2026-10-08).** `backend/` Hono + Drizzle/SQLite API: passkey-first parent auth (WebAuthn register/login, step-up `parent+fresh` via `POST /auth/fresh`), one-time setup bootstrap, sessions with hashed tokens + 5-min fresh window, device credentials (hashed, shown once, revoke kills sessions), parent-created child profiles with optional PIN lockout, `POST /children/:id/open` at role=device family-scoped; strict Zod, API_SPEC error envelope, rate limits, same-origin CORS incl. preflight; audit_log rows for all 14 auth actions (ids/enums only). 29 new tests incl. a route-table-generated authorization matrix, cross-family denial and PIN lockout. Not deployed (needs P0-09 owner approval); real passkey ceremony pending P0-09.
- **P1-02 Localization foundation — DONE (2026-10-08).** `packages/i18n`: ~160-key ICU catalogs (en source of truth; zh-Hant type-checked against `MessageKey`), `createTranslator` with ICU plural/select via `intl-messageformat`, en fallback. App: `useT()` binds locale to the child profile (only locale source, ADR-0008); every shell surface (header/nav, gate, 10 pages, fallbacks) renders `t("key")`. Lint rule `cv/no-raw-text` blocks raw strings in all `.tsx` (proven: `npx eslint` exits 1 on a raw-string probe). 21 new tests: catalog parity/ICU/fallback (11), rule fixtures (7), locale-switch render of the whole shell (3). `pnpm check` green (181 tests).
- **P1-03 app shell — PARTIAL (2026-10-08): shell DONE, device install PENDING.** `apps/app` React+Vite PWA (ADR-0002): route-guarded child (Home/Explore/Create/Projects/Me) + parent (Overview/Progress/Portfolio/Safety/Settings) areas behind a dialog-semantics parent gate; installable (manifest + generated icons); offline shell verified against the production build with the server killed (`sw.js` v2 precaches shell + referenced assets, `ignoreVary` for same-origin); `data-stage` presets switch live; full en + zh-Hant incl. nav labels; nav = fixed bottom bar <600 px / bar under header ≥600 px; token-only shell CSS; `user-scalable=no` removed (200 % text scaling); `aria-current` on the active nav item; icons render as real inline SVG. `pnpm dev` runs it at http://127.0.0.1:5173. Remaining: install on the real phone/tablet; Playwright viewport suite (verified locally with agent-browser at 390 px + 1280 px).

## In progress
- (nothing open — session ends at a green `pnpm check`: 181 tests + content validation)

## Next up (ordered)
1. **P1-04** — Content loader (`content/` validation at build; P1-02 done, P1-01 backend in place).
2. P0-07 device run — Junior bridge on the real phone/tablet (30 fps floor); record in `docs/architecture/RUNTIME_SPIKE.md`.
3. P0-09 on-platform step — owner approves a Cloudflare account; deploy spike Worker, real passkey ceremony against the new `backend/`, `wrangler tail` CPU numbers → ADR-0003 addendum.
4. P0-02 closure — owner review of every Draft v0.1 document (incl. the two new docs above).
5. P0-10 closure — owner scope check of `TASKS_PHASE_2_7.md`.

## Blocked / waiting on owner
- QUESTION: Which live AI provider and what monthly/per-child caps? (AI_SPEC §16; default = no live AI in Phase 1.)
- QUESTION: Confirm retention periods (DATA_MODEL §6) and passkey-first auth (SECURITY §16.1) in the privacy review.
- APPROVAL: Cloudflare account creation for the P0-09 on-platform spike.
- APPROVAL: R2 as artifact store (or defer to local-first until P1-09).
- APPROVAL: scope check of `TASKS_PHASE_2_7.md`; owner review of all Draft v0.1 docs.
- P0-07/P1 device work needs the physical phone and tablet.

## Known issues
- Draft content under `content/` is **status: draft** — no owner or native-speaker review yet, so it must not reach the child (SAFETY.md §13). `pnpm content:validate` prints this warning on every run.
- `ai/evals/recorded/*.txt` outputs are **mock-seeded** until a real provider is approved; re-record after approval and run live mode before release (TESTING §7).
- axe `color-contrast` rule is disabled in jsdom (cannot compute paint); covered instead by contrast-ratio math over every token pair in `packages/design-tokens`.
- CI workflow committed but never executed on GitHub (repo not pushed).
- `pnpm check` does not run `scripts/free-tier-bench.mjs` (manual spike tool) and does not build bundles (`pnpm content:build` on demand; tests compile in-memory).

## Commands
- install: pnpm install
- everything: pnpm check
- typecheck: pnpm typecheck
- lint: pnpm lint
- test: pnpm test (if the machine is under memory pressure: `pnpm vitest run --no-file-parallelism`)
- validate content: pnpm content:validate
- build content bundles: pnpm content:build
- regenerate editor schemas: pnpm content:schemas
- regenerate UI preview: pnpm ui:preview (required whenever `packages/ui/src/preview.ts` changes — freshness test)
- run AI evals (mock/recorded): pnpm ai:eval [-- --mode recorded]
- free-tier benchmark: node scripts/free-tier-bench.mjs
- dev: pnpm dev → app shell at http://127.0.0.1:5173 (P1-03)
- regenerate backend migration (after editing `backend/src/db/schema.ts`): `cd backend && rm -rf migrations && npx drizzle-kit generate`
- backend typecheck only: `cd backend && npx tsc -p tsconfig.json --noEmit` (never omit `--noEmit` — it litters `.js` next to sources)
- app production build: pnpm app:build → `apps/dist`; preview with `pnpm --filter @createverse/app preview` → :4173
- regenerate PWA icons: node apps/app/scripts/gen-icons.mjs
