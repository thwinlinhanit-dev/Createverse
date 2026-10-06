# CURRENT_STATE

Updated: 2026-10-06 by Cline (agent)
Phase: 0 (Discovery)

## Done
- Core docs set written (owner review still pending on the Draft v0.1 documents) — P0-02 drafts.
- Docs rearranged: duplicates removed, `docs/files/*` promoted to `docs/`, `BLANC_COFFEE_SPEC.md` moved to `docs/other-products/`.
- `docs/INDEX.md`, `docs/CURRENT_STATE.md`, `docs/TASKS_PHASE_0_1.md` created (they were referenced but missing).
- **P0-01 repo scaffold — DONE.** pnpm workspace, TypeScript strict, ESLint, Vitest, GitHub Actions CI, git repo. `pnpm check` green: typecheck + lint + 78 tests + content validation.
- **`packages/shared-types`** — Zod schemas: stages/locales, concept/skill/interest, step, hint ladder (levels 1–4 enforced), project (3 lanes required), assessment, experience spec, progress event envelope.
- **`packages/learning-core`** — hint-ladder progression (never skips, solution gated), concept levels 0–4 (never decrease), skill evidence with half-life decay. 14 tests.
- **P0-06 slice — `packages/ai-core`** — `MentorService` (pre-written → live → fallback), `BudgetGuard` (daily per-child + monthly caps), `MockAIProvider`, rule-based safety layer. 19 tests prove it works with live AI off, Junior never gets live chat, budget and kill switch block live calls.
- **P0-08 slice — `packages/content-sdk` + `content/`** — pack loader + validator (schemas, graph refs, lane coverage, ladder completeness, en/zh-Hant key completeness, `high` risk blocked) + `pnpm content:validate` CLI (exit 0 and exit 1 both verified). 11 tests. Draft Build a Bridge skeleton in `content/` (status: draft).
- **P0-04 slice — `packages/design-tokens`** — DESIGN_SYSTEM tokens, 4 stage presets, CSS variable generation, WCAG contrast tests. 23 tests.

## In progress
- (nothing open — session ended clean at a green `pnpm check`)

## Next up (ordered)
1. P0-03 — write the 8 ADR files into `docs/decisions/` (content already summarized in ARCHITECTURE.md §14).
2. P0-05 — threat model document (`docs/architecture/THREAT_MODEL.md`).
3. P0-04 remainder — `packages/ui` components + preview page.
4. P0-07 — web experience runtime spike (Junior bridge on the real phone and tablet).
5. P0-09 — free-tier and passkey feasibility spike.
6. P0-02 closure — owner review of all Draft v0.1 documents.

## Blocked / waiting on owner
- QUESTION: Which live AI provider and what monthly/per-child caps? (needed before any live AI call)
- WHY IT MATTERS: AI_SPEC §16, SECURITY §16; only affects the live path — the app must work with AI off regardless.
- OPTIONS: (a) smallest cloud model behind the provider interface, (b) no live AI in Phase 1 at all, (c) local model.
- DEFAULT IF NO ANSWER: (b) no live AI in Phase 1 — pre-written hint ladders only (safest, free).
- QUESTION: Confirm retention periods in DATA_MODEL.md §6 and passkey-first auth (SECURITY.md §16.1) during the privacy review.

## Known issues
- Draft content under `content/` is **status: draft** — no owner or native-speaker review yet, so it must not reach the child (SAFETY.md §13). `pnpm content:validate` prints this warning on every run.
- `pnpm` was broken on this machine (stale npm global shim); fixed during P0-01 via `corepack enable pnpm`.
- pnpm blocked esbuild's build script (`pnpm approve-builds` if a native binary problem appears later). Not observed in practice yet.
- CI workflow committed but never executed on GitHub (repo not pushed).

## Commands
- install: pnpm install
- everything: pnpm check
- typecheck: pnpm typecheck
- lint: pnpm lint
- test: pnpm test
- validate content: pnpm content:validate
- dev: pnpm dev (app arrives with P1-03)
