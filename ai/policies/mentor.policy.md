# Mentor policy (Phase 1: pre-written hints only)

Status: **v0.1** — versioned per AI_SPEC.md §14.

Version: 0.1.0

## Live-AI gate (ALL must hold, else pre-written hint)
- `liveAiEnabled: true` (parent setting, default false)
- kill switch OFF
- stage is explorer or maker (junior: never)
- budget guard allows the estimated tokens
- input safety verdict is `ok`

## Budgets (owner-set before any live call — AI_SPEC.md §16)
- daily tokens per child: TBD by owner (Phase 2)
- monthly tokens total: TBD by owner (Phase 2)

## Retention
- Phase 1 stores NO ai messages. 90-day default applies only if live help
  is ever enabled (DATA_MODEL.md §6, AI_SPEC.md §12).
