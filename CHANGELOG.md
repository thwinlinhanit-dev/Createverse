# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Every task adds an entry here.

## [Unreleased] — 2026-10-06

### Added
- **Docs rearranged (spec set cleanup):** removed 5 MD5-verified duplicate files, promoted `docs/files/*` to `docs/`, moved the unrelated `BLANC_COFFEE_SPEC.md` to `docs/other-products/`.
- **`docs/INDEX.md`** — one line per document (required by AGENT_OPERATING_RULES §2/§4).
- **`docs/CURRENT_STATE.md`** — resume protocol page (AGENT_OPERATING_RULES §4).
- **`docs/TASKS_PHASE_0_1.md`** — reconstructed the missing Phase 0 + Phase 1 backlog (P0-01..P0-10, P1-01..P1-20) from CREATEVERSE_BUILD_PLAN §7.
- **P0-01 repo scaffold:** pnpm workspace, TypeScript strict, ESLint (typescript-eslint), Vitest, root `pnpm check`, GitHub Actions CI.
- **`packages/shared-types`:** Zod schemas for stages, locales, content entities (concept, skill, interest, step, hint ladder, project, assessment, experience spec) and the progress-event envelope.
- **`packages/learning-core`:** hint-ladder progression (never skips, solution gated), concept levels 0–4 (never decrease), skill evidence with time decay. Unit tests.
- **`packages/ai-core` (P0-06 prototype):** `MentorService` (pre-written → cache/live → fallback), `BudgetGuard` (daily per-child + monthly caps), `MockAIProvider`, rule-based safety layer. Works with live AI off. Unit tests.
- **`packages/content-sdk` (P0-08 slice):** content pack validator (schemas, graph refs, lane coverage, hint-ladder completeness, en/zh-Hant key completeness, `high` risk blocked) + `pnpm content:validate` CLI. Fails on invalid content.
- **`content/` draft skeleton:** Build a Bridge project across all three lanes with hint ladders, experience specs and both locales — **status: draft, not approved for the child.**
- **`packages/design-tokens` (P0-04 slice):** DESIGN_SYSTEM tokens JSON, stage presets (junior/explorer/maker/parent), CSS variable generation, WCAG contrast tests.
