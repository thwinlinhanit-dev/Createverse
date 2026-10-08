# ADR-0005: AI provider interface with pre-generated hints as the default path

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15).
Date: 2026-10-06 (recorded from the approved architecture).

## Context

AI access may end at any time and live AI costs money inside a $20/month budget. The mentor must keep guiding children with zero live AI, and no feature may require live AI to be usable (CREATEVERSE_BUILD_PLAN.md §5).

## Decision

- All AI calls go through one `AIProvider` interface (`packages/ai-core`), swappable by configuration — cloud, cheaper, or local model.
- The **default mentor path is pre-written hint ladders** (content data in git): `MentorService` resolves from content first, live AI only when enabled, allowed by stage, and inside budget.
- A `BudgetGuard` enforces daily per-child and monthly hard caps; exhausted budget falls back to hints.
- **Owner decision 2026-10-06: no live AI in Phase 1 at all** — the provider layer ships dormant. Provider choice, caps and terms are a Phase 2 approval item (AI_SPEC.md §16).

## Alternatives considered

- **Live-AI-only mentor** — rejected: unusable without money and connectivity; unsafe dependency for a child's learning loop.
- **Fully local model on device** — kept as a future option: quality and device cost unproven; revisit in Phase 2+.

## Consequences

- The app is fully usable with AI off; tests use the mock provider and cost nothing (TESTING.md §7).
- Enabling live AI later requires: provider terms review (SECURITY.md §16.3), owner-set caps, prompt versioning, and a safety eval run.
- Hints must be authored well — content quality *is* the mentor quality in Phase 1.
