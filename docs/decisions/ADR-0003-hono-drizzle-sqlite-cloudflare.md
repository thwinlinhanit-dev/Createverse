# ADR-0003: Hono + Drizzle + SQLite on Cloudflare free tier (portable)

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15). Hosting addendum decided with it.
Date: 2026-10-06 (recorded from the approved architecture).

## Context

The API must run inside a tiny budget (free tier) on a modular monolith, stay portable so a small VPS remains a fallback, and be maintainable by agents with docs and tests. Free-tier CPU limits (about 10 ms per Worker request, 100k requests/day) shape every handler.

## Decision

- **API:** Hono — small, typed, runs on Node and edge runtimes unchanged.
- **DB:** SQLite via Drizzle ORM on Cloudflare D1; schema and migrations in git.
- **Hosting:** Cloudflare free tier — Pages (static shell + content bundles), Workers (API), D1 (database), R2 or equivalent behind a `FileStore` interface for artifacts.
- Keep code portable: no Cloudflare-specific APIs outside an infrastructure adapter, so a small VPS stays a drop-in fallback.

## Alternatives considered

- **Next.js full-stack** — rejected: heavier runtime, harder to keep inside 10 ms CPU limits, more lock-in.
- **Postgres from the start** — rejected: managed Postgres free tiers are scarce and fragile; SQLite/D1 is boring, cheap and easy to back up. ADR keeps the Drizzle layer portable to Postgres later.
- **Small VPS now** — kept as documented fallback only: it costs money every month from day one.

## Consequences

- Handlers must be light: batch writes, no CPU-heavy work in requests, validate with Zod (API_SPEC.md §8).
- Free-tier limits are re-verified before Phase 1 (task P0-09 spike); if they fail, the fallback is a small VPS — decided **before** Phase 1 starts (ROADMAP §6).
- Backup: scheduled encrypted export of D1 + artifacts to a parent-controlled location (P1-19).
- Changing hosting or DB needs owner approval.

## Addendum (P0-09, 2026-10-06) — free-tier spike results

Status: **Spike measured locally; on-platform confirmation pending owner account approval.**
Full write-up: `docs/architecture/FREE_TIER_SPIKE.md`; benchmark: `scripts/free-tier-bench.mjs`.

- WebAuthn assertion verification (`@simplewebauthn/server` v14): **0.32 ms CPU** median —
  ~3 % of the Workers free 10 ms budget.
- 50-event idempotent batch insert (SQLite shape of `db.batch()`): **0.15 ms CPU**;
  duplicate replays write 0 rows (idempotency proven against the real SQL).
- Sync read (200-row cursor page, covering index): **0.16 ms CPU**.
- Free-tier quotas (Workers 100k req/day; D1 5M rows read, 100k rows written, 5 GB;
  R2 10 GB + 1M/10M ops) carry 30–600× headroom at private-alpha scale.
- Artifacts: **R2 free tier recommended** behind the `FileStore` interface; B2 as the
  S3-compatible exit path.
- Fallback-to-VPS triggers and the remaining on-platform verification step are recorded
  in the spike doc §7–§9. No change to this decision; the spike supports it.
