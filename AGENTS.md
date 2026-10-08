# AGENTS.md - CREATEVERSE (concise agent command)

## 0. Hard Rules (MUST always/never)
- Safety/privacy spec rules ALWAYS win (S:5,6.5,7,21)
- No live AI in Phase 1; no child data to 3rd parties; no real data in logs/CI
- STOP and ask owner if blocked by conflicts, unknown child data, or spec violations

## 1. Session Start
1. Read docs/CURRENT_STATE.md
2. Read docs/INDEX.md, open only relevant docs
3. Read task file; no task file = STOP & ask
4. Inspect code + tests BEFORE changing
5. Check approval boundaries; task needs approval = STOP & ask
6. Confirm clean branch + tests pass before starting

## 2. Session End
- Tests/typecheck/lint pass; new behavior has tests
- Update docs + CURRENT_STATE.md + handoff report
- No secrets, real data, or debug code committed
- If budget-exhausted: commit partial work, mark PARTIAL, note what remains

## 3. Stack
- pnpm workspaces monorepo; TS strict; ESLint; Vitest
- Child app: React + Vite, installable PWA, offline-first
- API: Hono, SQLite via Drizzle (backend/)
- Local-first IndexedDB, idempotent sync
- AI: interface + pre-written hints only (no live AI in Ph1); content/ packages
- Hosting: Cloudflare free tier (Pages + Workers + D1 + R2)
- No game engine; Canvas 2D + Matter.js

## 4. Data Rules
- IDs: UUIDv7 with type prefix (c_, p_, e_...); ts = UTC ISO-8601
- Every child-data table has family_id + child_id; queries scoped by both
- Content lives in git (files); learner data in DB (refs only)
- Events are source of truth; progress/skills derived by replay
- Retention: AI msgs 90d, usage 13mo(no text), safety 12mo, audit 24mo immut
- DO NOT send names, birth data, free-text to AI providers

## 5. Localization
- en + zh-Hant (Traditional, Taiwan Mandarin); keys = area.screen.element
- Strings in content/locales/{en,zh-Hant}.json; no hardcoded UI strings
- CI fails on missing key in one locale
- zh-Hant: Traditional only; pinyin w/ tones for Explorer (intro chars only)
- Fonts: self-hosted; Noto Sans TC + sans-serif; CN body line-height >= 1.6

## 6. Read These Docs for Detail (abbreviations)
- S=docs/SAFETY.md    SE=docs/SECURITY.md    A=docs/AI_SPEC.md
- D=docs/DATA_MODEL.md    DS=docs/DESIGN_SYSTEM.md    AR=docs/ARCHITECTURE.md
- T=docs/TESTING.md    P=docs/PRODUCT_SPEC.md    C=docs/CREATEVERSE_BUILD_PLAN.md
- Index=docs/INDEX.md    State=docs/CURRENT_STATE.md    Tasks=docs/TASKS_PHASE_0_1.md
- Master spec = source of truth for product behavior; companions must NOT contradict it

## 7. Approval Needed (STOP & ask owner)
- Core architecture, DB schema changes, paid services, AI providers
- Child data collection changes, legal/privacy, public deployment
- Deleting user data; DB migrations dropping data; ADR changes; D1-D14
- Live AI in Phase 1 (default off)

## 8. Stop Conditions (MUST stop & write BLOCKED)
- Rule conflict (spec vs ADR vs code)
- Child data field not defined in spec S5
- Third-party data use not approved in 6.5
- Test required by S23 cannot run
- Undecided D in S28 with no default
- Deleting user data or DB migration dropping data

## 9. Learning Philosophy (P1-P3, MUST)
- Projects over lessons; creation over consumption; AI = mentor not answer machine
- Mentor never gives full solution in Phase 1 (hint ladder S6.3)
- No engagement hooks; child does the work; fail safely
- Consult SAFETY.md S7 for safe-message scripts and categories

## 10. Code Conventions
- TS strict; ESLint; Vitest; pnpm workspace
- No hardcoded UI strings - t("key") only (lint-enforced)
- Token-only CSS; 3 stage presets: junior/explorer/maker
- packages/: apps/app, packages/{content-sdk,learning-core,ai-core,design-tokens,experience-runtime,i18n}
- No game engine; Canvas 2D + Matter.js

## 11. Testing & Commands
- pnpm check = typecheck + lint + test + content:validate (MUST be green)
- pnpm test | lint | typecheck | content:validate | dev | app:build
- CI: install -> typecheck -> lint -> test -> content validate
- Real child data NEVER in fixtures, logs, screenshots, or bug reports

## 12. Git Workflow
- Feature branch per task (feat/p1-04)
- Commit: type(scope): description
- Push to origin (thwinlinhanit-dev/Createverse.git)
- Update docs/CURRENT_STATE.md at session end

## 13. Handoff Report Format
# HANDOFF | Updated: YYYY-MM-DD | What was done | What remains | Decisions made | Blockers

## 14. If ANYTHING confused - STOP & ask
- Spec conflict, unknown child data, unapproved 3rd party, broken test, open D1-D14
- Write question in CURRENT_STATE.md under Blocked/waiting-on-owner
- Never guess; continue with any unblocked task

## 15. Version
- v1.0 - 2026-10-08 from master spec v1.1 + AGENT_OPERATING_RULES + AI_SPEC + DATA_MODEL + BUILD_PLAN + ARCHITECTURE + CURRENT_STATE
- Read full documents for details; this file is a condensed command
