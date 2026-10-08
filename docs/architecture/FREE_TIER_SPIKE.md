# FREE_TIER_SPIKE.md — P0-09 free-tier and passkey feasibility

Status: **Draft — measurements complete; hosting decision awaits owner approval** (ROADMAP §6 decision gate, ADR-0003 addendum).
Date: 2026-10-06. Task: P0-09 (`docs/TASKS_PHASE_0_1.md`).
Read with: ADR-0003, `docs/ARCHITECTURE.md` §5–7, `docs/API_SPEC.md` §1, `docs/DATA_MODEL.md` §6.

## 1. Question

Does **Hono on Workers + D1** fit the Cloudflare free tier for the three hot paths —
(a) WebAuthn (passkey) verification, (b) 50-event idempotent batch insert, (c) sync read —
and which artifact storage fits the free tier? If limits fail, the documented fallback is a
small VPS (decided **before** Phase 1 starts).

## 2. Method (and what it does not prove)

- Benchmark: `node scripts/free-tier-bench.mjs` (committed, re-runnable).
  - (a) runs the **real library we would ship**: `@simplewebauthn/server` v14.0.3,
    `verifyAuthenticationResponse()` with a synthesized ES256 assertion (P-256 key,
    UP|UV flags, DER signature) — the full code path including challenge, origin,
    rpID, counter and signature checks.
  - (b)/(c) run against `node:sqlite` — the same SQLite semantics as D1, with the exact
    SQL shape planned for `POST /sync/events` (one transaction per batch,
    `ON CONFLICT(event_id) DO NOTHING`) and the indexed cursor read for sync.
- Machine: Intel Core i5-14400F, 16 cores, 31.8 GB RAM, Windows x64, Node v24.13.1.
- Each op warmed up, then N iterations; `cpuMeanMs` = process CPU (user+system) per op.
- **Honest limits of this spike:** local hardware is not Cloudflare hardware, and local
  SQLite does not add D1's network + durable-replication **wall** time. D1 query
  execution *does* run inside the Worker's CPU budget (D1 limits doc), so the measured
  SQLite CPU is a fair proxy for the CPU component. The on-platform confirmation
  (deploy a spike Worker to a free account, run a real passkey ceremony, read
  `wrangler tail` CPU times) is **blocked on owner approval to create the account** —
  it is the last step of this task.

## 3. Results

| Operation | n | wall median | wall p95 | wall max | CPU mean | Share of 10 ms CPU budget |
|---|---|---|---|---|---|---|
| (a) WebAuthn assertion verify | 200 | **0.313 ms** | 0.556 ms | 0.840 ms | **0.315 ms** | ~3 % |
| (b) 50-event idempotent batch insert (1 tx) | 100 | **0.144 ms** | 0.183 ms | 0.206 ms | **0.150 ms** | ~1.5 % |
| (b′) duplicate replay of the same batch | 50 | 0.075 ms | 0.092 ms | 0.095 ms | ~0 ms | 0 rows written — idempotency holds |
| (c) sync read, 200-row page over 5,000 rows | 200 | **0.109 ms** | 0.149 ms | 0.624 ms | **0.155 ms** | ~1.5 % |

- Verification asserted (`verified: true`); batch asserted 50 rows in / 0 rows on replay;
  final row count asserted exactly 5,050; sync read asserted non-empty with a
  **covering-index** plan (`idx_events_child_time`), so rows-examined stays ≈ rows-returned.
- Estimated full request CPU (worst case, all three ops' style in one request — they
  never co-occur this way): login ≈ 0.4 ms, sync push ≈ 0.5 ms including Zod validation
  and JSON serialization. **≥ 10× headroom under the 10 ms budget** even with a 3×
  safety factor for hardware differences.

## 4. Free-tier limits (verified against Cloudflare docs, 2026-10-06)

| Product | Free tier |
|---|---|
| Workers | 100,000 requests/day; **10 ms CPU per invocation** |
| D1 | 5,000,000 rows read/day; **100,000 rows written/day**; 5 GB storage/account (500 MB/db); 10 databases; 50 queries/invocation; Time Travel 7 days |
| D1 enforcement | Since 2026-09-01 queries **fail** when the daily row limits are exceeded — a hard stop, not an overage |
| R2 | 10 GB-month storage; 1,000,000 Class A ops/month; 10,000,000 Class B ops/month; egress free |
| Backblaze B2 (alternative) | First 10 GB storage free; egress free up to 3× stored data; S3-compatible; then $6.95/TB-month |

Sources: developers.cloudflare.com/workers/platform/limits + /pricing,
developers.cloudflare.com/d1/platform/limits + /pricing + changelog,
developers.cloudflare.com/r2/pricing, backblaze.com/cloud-storage/pricing.

## 5. Capacity math (private family alpha)

Assumptions: one family, 4 children, ~20 events per activity, ~10 sync batches/day/child,
~200 rows per sync read page.

| Resource | Alpha demand/day | Free limit | Headroom |
|---|---|---|---|
| Rows written | ≤ 4 × 10 × 50 batch attempts = 2,000 | 100,000 | ~50× |
| Rows read | ≤ 4 × 10 × 200 = 8,000 | 5,000,000 | ~600× |
| Requests | ≤ a few thousand (app + sync + content) | 100,000 | ~30× |
| Storage (events, ~300 B) | ~1.5 MB/child/year | 5 GB (500 MB/db) | ~300 children |
| CPU per request | 0.3–0.5 ms | 10 ms | ~20–30× |

Alpha fits with wide margins. Scale-out triggers (rows written is the first wall):
100k rows/day ≈ 2,000 batches of 50 ≈ 200 children syncing 10×/day — far beyond the
private alpha, and by then the paid tier or the VPS fallback is a deliberate decision.

## 6. Artifact storage options (portfolio uploads, P1-09)

| Option | Free | Egress | Fit |
|---|---|---|---|
| **R2 — recommended** | 10 GB, 1M Class A + 10M Class B ops/month | free | Same account as Workers/D1 (ADR-0003); presigned uploads through the existing `FileStore` interface; zero egress matters because parents re-download artifacts |
| Backblaze B2 | 10 GB storage | free up to 3× stored data | S3-compatible exit path; separate vendor/account — more moving parts for Phase 1 |
| Local-first only | — | — | Artifacts stay on device until the portfolio entry syncs (ADR-0004); storage option only needed at upload time, so this defers the decision entirely |

Verdict: **R2 free tier** for Phase 1; the `FileStore` interface in ADR-0003 keeps B2 as a
drop-in swap. Both sit behind owner approval as part of the hosting gate.

## 7. Verdict and fallback

**Fits the free tier** for the private family alpha, on every measured axis:

- Passkey verification is the heaviest single op at ~0.32 ms CPU — 3 % of the budget.
- The 50-event idempotent batch costs ~0.15 ms CPU; duplicate retries cost nothing and
  write nothing (API_SPEC §1 idempotency proven against the real SQL shape).
- Sync reads use a covering index; row-examination stays ≈ rows-returned, protecting the
  5M rows-read quota.
- Quotas carry 30–600× headroom at alpha scale (§5).

**Risks and mitigations:**

1. D1 hard-fails when daily row limits are exceeded → client backoff + parent-visible
   "sync paused" state; monitor with `wrangler tail` during alpha (P1-08).
2. Local ≠ Workers hardware → on-platform CPU confirmation required before Phase 1 exit
   (blocked on account approval, §2).
3. Single D1 database is single-threaded → irrelevant at one family; revisit at ~200
   children.

**Fallback (small VPS) triggers** — revisit if any holds:

- measured p95 request CPU on real Workers > 8 ms, or
- sustained rows-written > 80k/day (80 % of cap), or
- storage > 4 GB, or
- a feature needs long-lived connections/work in a request, or
- Workers Paid + D1 overage would cost more than a ~$5/month VPS.

A VPS switch changes ADR-0003 and therefore needs owner approval (ROADMAP §6).

## 8. Reproduce

```bash
node scripts/free-tier-bench.mjs   # prints the JSON table of §3
```

## 9. Open items

- [ ] Owner: approve a Cloudflare account for the on-platform spike (last step of P0-09).
- [ ] Owner: confirm R2 as the artifact store (or defer via local-first until P1-09).
- [ ] Next agent: deploy a spike Worker (Hono + `@simplewebauthn/server` + D1), run a
      real passkey ceremony from the phone, record CPU via `wrangler tail`, append the
      numbers to the ADR-0003 addendum.
