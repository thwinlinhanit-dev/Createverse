# THREAT_MODEL.md — CREATEVERSE (task P0-05)

Status: **Draft v0.1 for owner review.** Read with: `SECURITY.md` (full threat table T1–T16), `DATA_MODEL.md` §6–7, `SAFETY.md`, `AI_SPEC.md`.
Scope: privacy and safety of **child data** end to end — where it flows, what may ever leave the device, and what the privacy review must confirm. Account/infrastructure security details stay in `SECURITY.md`.

---

## 1. Method

Map every flow child data can take, attach the threats from `SECURITY.md` §3, list mitigations, and name the data that may **never** leave the device. One flow missing from this map is a finding, not a footnote.

## 2. Data flow map

```text
 CHILD DEVICE (phone/tablet)
 ┌────────────────────────────────────────────────────────────┐
 │ PWA shell (static)          content bundles (static)      │  ← no personal data
 │ IndexedDB: progress events, hint cache, project state      │
 │ Read-aloud: on-device TTS only (audio never uploaded)      │
 └───────────────┬────────────────────────────────────────────┘
                 │ HTTPS (TLS)
                 │  1. POST /sync/events   (append-only events, idempotent by event_id)
                 │  2. GET  /content/*     (static bundles, no session data)
                 │  3. artifact upload     (allowlisted types, 2 MB cap)
                 │  4. parent API          (dashboards, settings, export, delete)
                 ▼
        API (Hono, Workers)  ──scoped by family_id, child_id──►  D1 (SQLite)
                 │                                                  progress_events
                 │                                                  derived learning state
                 │                                                  ai_messages: NONE in Phase 1
                 ▼
        Backups: encrypted, off-platform, parent-controlled location
                 │
                 ▼
        AI provider:  **NOTHING IN PHASE 1** (owner decision 2026-10-06, ADR-0005)
                      Later (Phase 2+, if ever): stage, concept ids, current message only
```

## 3. What leaves the device (Phase 1)

| Flow | Data | Leaves device? |
|---|---|---|
| Content bundles | none (static assets) | no (download only) |
| Progress sync | events: ids, content ids/versions, step outcomes, timestamps, small payloads | **yes** — to the family's own API only |
| Artifact upload | child-created files (drawing, audio note, code) the parent can see | **yes** — to the family's own API only |
| Read-aloud | none | no — on-device TTS |
| Hint cache | none | no — local |
| Live AI | **none in Phase 1** | no — provider layer dormant |
| Analytics / tracking / ads | none exist | never — no third-party trackers, ever |

## 4. Never sent to an AI provider (any phase, any config)

Even if live AI is enabled in a later phase, the following must **never** be included in a provider request (`DATA_MODEL.md` §6, `SECURITY.md` T8):

- Child or family names, nicknames included.
- Birth data (full or partial), age in years, or any profile free text.
- Artifact contents (images, audio, code), device identifiers, IP-derived location.
- Progress history, portfolio entries, safety events, other children's data.
- Anything from the parent area (settings, emails, audit log).

Allowed in a future live call: stage (`junior|explorer|maker`), locale, concept/skill ids, the step id, the current hint level, and the child's current message (treated as untrusted data, SECURITY.md T6). `MentorService` enforces this by construction: `HelpContext.childId` is marked internal-only and `AIRequest` carries no ids beyond stage/locale.

## 5. Threats attached to flows

| Flow | Threats (SECURITY.md §3) | Key mitigations | Phase 1 status |
|---|---|---|---|
| Sync ingestion | T9 replay/abuse, T3 cross-child read, T4 injection | idempotent `event_id`, family/child scoping, Zod on every field, rate + size limits | pending P1-08 |
| Artifact upload | T10 malicious/oversized uploads, T5 XSS | type allowlist, 2 MB cap, separate serving path, safe content type, never executed | pending P1-09 |
| Auth and parent area | T1 takeover, T2 child escalation, T11 lost device | passkeys, step-up for sensitive actions, server-enforced roles, device revocation | pending P1-01 |
| Live AI (future) | T6 injection, T7 key/cost abuse, T8 data leak | provider interface, budget caps, minimization list (§4), output safety, kill switch | **moot in Phase 1** |
| Client XSS | T5 | strict CSP, no inline scripts, framework escaping, sandbox user-created code (Phase 4) | pending P1-03 |
| Supply chain / repo | T12, T13, T15 | lockfile, pinned deps, CI audit + secret scan, agents never hold prod secrets | scaffold in place (CI) |
| Data loss | T14 | encrypted off-platform backups, restore drill | pending P1-19 |

## 6. Retention confirmations needed in the privacy review

Proposals from `DATA_MODEL.md` §6 to confirm with the owner: parent email/passkeys until account deletion; child profile and progress events until child deletion; AI messages — **not applicable in Phase 1** (table row still lists 90 days for future phases); AI usage 13 months; safety events 12 months; audit log 24 months; backups age out per the documented schedule (must be written in `SECURITY.md` when set).

## 7. Open items for the owner (privacy review checklist)

1. Approve §4 as the permanent "never sent to AI" list, including for Phase 2+.
2. Confirm the retention proposals in §6.
3. Confirm the backup location is parent-controlled and encrypted (P1-19).
4. Confirm no second guardian account in Phase 1 (PRODUCT_SPEC §14.3).
5. Legal/privacy review remains mandatory before **any** use beyond the family (T16).

---

*Every safety or security bug found later becomes a permanent test (TESTING.md §1) and an update to this map.*
