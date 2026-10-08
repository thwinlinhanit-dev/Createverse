# ADR-0004: Local-first events with idempotent sync

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15).
Date: 2026-10-06 (recorded from the approved architecture).

## Context

The child must be able to learn with no connection at all — offline is a Phase 1 exit criterion, not a nice-to-have. The network on a family phone is unreliable, and app closes happen mid-activity.

## Decision

- The child app records every learning action as an **append-only event** with a client-generated UUIDv7 `event_id`.
- Events are written to IndexedDB first (source of truth on the device), then pushed to `POST /sync/events` when online.
- The server **dedupes by `event_id`**, so retries and replays are free of side effects.
- Progress, skills and concepts are **derived** server-side by replaying events (DATA_MODEL.md §5, invariant 3).

## Alternatives considered

- **Server-only state** — rejected: the app is unusable offline, the core Phase 1 requirement.
- **CRDTs / full offline DB replication** — rejected: far more complexity than a single-child family app needs; append-only events already converge by replay.

## Consequences

- `progress_events` is append-only; no updates, no deletes except the deletion workflow (DATA_MODEL.md §8 invariant 2).
- Derived tables can always be rebuilt; storage mistakes are recoverable.
- Sync client must be resumable and loss-free on app close (P1-08).
- Event schema changes are additive or versioned — incompatible changes need owner approval.
