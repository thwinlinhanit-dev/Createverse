# API_SPEC.md — CREATEVERSE

Status: **Draft v0.1 for owner review**
Read with: `ARCHITECTURE.md` (sections 3, 5, 6), `DATA_MODEL.md`, `SECURITY.md` (sections 4, 5, 8), `AI_SPEC.md`

A small, typed JSON API for a private family app. Runs on Hono (Workers on the free tier). Every endpoint is deny-by-default, scoped by family, validated with Zod, and light on CPU.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1` |
| Format | JSON in and out (`application/json`), UTF-8 |
| IDs | Prefixed UUIDv7 strings (`c_`, `u_`, `d_`, `e_`, ...) |
| Time | UTC ISO-8601 strings |
| Locale | Taken from the child profile (or parent default). No per-request `Accept-Language` logic |
| Content | Compiled content bundles are **static assets**, not API calls: `/content/{locale}/{stage}/bundle.<hash>.json` |
| Versioning | Path version. Additive changes are allowed within a version. Breaking changes need a new version and owner approval |
| Unknown fields | Rejected (strict schemas) |
| Pagination | `?limit=` (default 50, max 200) and `?cursor=` |
| Idempotency | Sync writes are idempotent by `event_id`. Other writes that can be retried accept an `Idempotency-Key` header |
| CORS | Only the app's own origin |
| Caching | Authenticated responses use `Cache-Control: no-store` |

---

## 2. Authentication, sessions and roles

**Session types**
- **Parent session:** from a passkey login. Short-lived. Tied to a registered device.
- **Child session:** opened from a registered device by selecting a child profile (optional PIN). Scoped to that child only.
- **Device credential:** identifies the registered device for sync.

**Roles used in the tables below**

| Role | Meaning |
|---|---|
| `public` | No session. Only setup, login and health |
| `parent` | Parent session |
| `parent+fresh` | Parent session with a passkey confirmation in the last few minutes (step-up) |
| `child` | Child session, for that child's own data only |
| `device` | Registered device credential (sync) |

**Always derive ownership from the session.** Never trust a family id or child id from the client to grant access.

**Step-up (`parent+fresh`) required for:** creating or deleting a child, changing safety or AI settings, kill switch, device registration or revocation, export, delete, recovery code regeneration.

---

## 3. Errors

```json
{ "error": { "code": "forbidden", "message": "You can't do that.", "request_id": "r_..." } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Schema validation failed |
| 401 | `unauthenticated` | No or expired session |
| 401 | `fresh_auth_required` | Step-up needed |
| 403 | `forbidden` | Wrong role or not your data |
| 404 | `not_found` | Missing, or not visible to you (use 404 to avoid leaking existence) |
| 409 | `conflict` | State conflict |
| 413 | `too_large` | Body or batch over the limit |
| 422 | `unprocessable` | Valid shape but rejected by rules (e.g. risk class not allowed) |
| 429 | `rate_limited` | Too many requests. `Retry-After` header set |
| 500 | `internal` | Generic. No details, no stack traces |

Error messages are generic. Detailed reasons go to the audit or operational log by id only.

---

## 4. Limits (initial, tune after P0-09)

| Limit | Value |
|---|---|
| JSON body | 64 KB |
| Sync batch | 50 events per request |
| Event payload | 4 KB each |
| Artifact upload | 2 MB per file, allowlisted types only |
| Rate: auth | 10 per minute per IP |
| Rate: sync | 30 per minute per device |
| Rate: mentor | 20 per minute per child |
| Rate: others | 120 per minute per session |

Storage quotas per child are set after the storage decision in P0-09.

---

## 5. Endpoints

### 5.1 Setup and authentication

| Method and path | Role | Notes |
|---|---|---|
| `POST /setup/bootstrap` | public (needs one-time setup secret) | Creates the family and first parent. Disabled once a family exists |
| `POST /auth/passkeys/register/options` | public (bootstrap or invitation) or parent+fresh | WebAuthn registration options |
| `POST /auth/passkeys/register/verify` | same | Verifies and stores the public key |
| `POST /auth/login/options` | public | WebAuthn assertion options |
| `POST /auth/login/verify` | public | Verifies assertion, opens parent session |
| `POST /auth/fresh` | parent | Step-up confirmation (fresh assertion) |
| `POST /auth/recovery/use` | public | Uses one recovery code, then forces registering a new passkey |
| `POST /auth/recovery/regenerate` | parent+fresh | New set of codes, shown once |
| `POST /auth/logout` | any session | Ends the session |
| `GET /auth/session` | any session | Role, family id, child id (for child sessions) |

Passkey ceremonies must stay inside the Worker CPU limit (measured in P0-09).

### 5.2 Family and devices

| Method and path | Role | Notes |
|---|---|---|
| `GET /family` | parent | Family info, guardians |
| `POST /family/invitations` | parent+fresh | One-time invitation for another guardian |
| `POST /family/invitations/accept` | public (invitation token) | Starts guardian passkey registration |
| `GET /devices` | parent | List devices |
| `POST /devices` | parent+fresh | Register this device with a label |
| `DELETE /devices/:deviceId` | parent+fresh | Revoke a device and its sessions |

### 5.3 Children and settings

| Method and path | Role | Notes |
|---|---|---|
| `GET /children` | parent | List profiles |
| `POST /children` | parent+fresh | Create (display name, stage, locale, optional birth year) |
| `PATCH /children/:childId` | parent | Edit name, stage, locale, avatar. Stage change changes the content lane |
| `POST /children/:childId/open` | device | Open the child's profile on this device, with PIN if set. Returns a child session |
| `PATCH /children/:childId/pin` | parent+fresh | Set or clear the PIN |
| `GET /children/:childId/settings` | parent | Time limits, quiet hours, AI mentor, risk class, approvals, read-aloud |
| `PATCH /children/:childId/settings` | parent (+fresh for safety and AI fields) | Server enforces these settings |
| `POST /children/:childId/delete` | parent+fresh | Soft delete with grace period (see 5.10) |

### 5.4 Sync (progress events)

| Method and path | Role | Notes |
|---|---|---|
| `POST /sync/events` | device (child or parent session on that device) | Batch of events. Idempotent by `event_id` |
| `GET /sync/state?childId=&since=` | device | Settings and derived state changed since a time, so the device can refresh |
| `GET /sync/settings?childId=` | device | Current settings for the child (time limit, AI flags, locale, stage) |

Request:

```json
{
  "childId": "c_...",
  "deviceId": "d_...",
  "events": [
    {
      "event_id": "018f...",
      "type": "child.activity.completed",
      "schema_version": 1,
      "occurred_at": "2026-10-07T09:12:30Z",
      "content_ref": { "id": "step.bridge.e2", "version": 1 },
      "payload": { "outcome": "success", "hints_used": 1, "iterations": 3 }
    }
  ]
}
```

Response:

```json
{ "accepted": ["018f..."], "duplicates": [], "rejected": [{ "event_id": "...", "reason": "unknown_type" }] }
```

Rules:
- Events must belong to the session's child. Others are rejected.
- Duplicates (same `event_id`) are acknowledged, not stored again.
- Out-of-order events are accepted.
- Server updates derived state incrementally and batches writes.

### 5.5 Progress read models

| Method and path | Role | Notes |
|---|---|---|
| `GET /children/:childId/projects` | parent, child (own) | Project instances and states |
| `GET /children/:childId/progress/summary` | parent, child (own, simplified) | Concepts, skills, interests, struggles |
| `GET /children/:childId/skills` | parent, child (own) | Skill levels and evidence counts |
| `GET /children/:childId/concepts` | parent, child (own) | Concept levels |

### 5.6 Mentor

| Method and path | Role | Notes |
|---|---|---|
| `POST /mentor/help` | child | Next pre-written hint for a step. No provider call |
| `POST /mentor/chat` | child (Explorer, Maker only) | Live help, only if enabled, within budget and safety. Junior always gets 403 |
| `GET /children/:childId/ai/conversations` | parent | Transcripts (paged) |
| `DELETE /children/:childId/ai/conversations` | parent+fresh | Clear AI history |
| `POST /ai/kill-switch` | parent+fresh | Turn live AI on or off for the family |
| `POST /mentor/flag` | parent | Flag a mentor response (creates a safety event and eval candidate) |

`POST /mentor/help` request and response:

```json
{ "stepId": "step.bridge.e2", "hintLevelReached": 1 }
```
```json
{ "source": "precomputed", "hintLevel": 2, "textKey": "hints.bridge.e2.2", "safety": "ok" }
```

`POST /mentor/chat` request and response:

```json
{ "stepId": "step.bridge.m2", "hintLevelReached": 2, "message": "Why did my beam bend?" }
```
```json
{ "source": "live", "text": "Look at the middle of the beam. What is pushing down there?", "safety": "ok" }
```

Notes:
- The server resolves content, stage, locale and settings from the session. The client sends only step and message.
- If AI is off, capped, or unsafe, the response falls back to `source: "fallback"` or `"precomputed"`. Never an error that blocks the child.

### 5.7 Portfolio and artifacts

| Method and path | Role | Notes |
|---|---|---|
| `POST /artifacts` | child | Upload an artifact (allowlisted type and size) |
| `POST /portfolio` | child | Create an entry from an artifact and reflection |
| `GET /children/:childId/portfolio` | parent, child (own) | List entries |
| `GET /portfolio/:entryId` | parent, child (own) | Entry detail with artifact link |
| `PATCH /portfolio/:entryId` | child (own), parent | Edit reflection text, title |
| `DELETE /portfolio/:entryId` | parent | Deletes entry and its artifact file |
| `GET /artifacts/:artifactId/file` | parent, child (own) | Serves the file with a safe content type |

### 5.8 Parent overview and safety

| Method and path | Role | Notes |
|---|---|---|
| `GET /children/:childId/overview` | parent | Learning-first overview (concepts, skills, projects, interests, struggles, suggestions) |
| `GET /children/:childId/safety-events` | parent | Plain-language events sorted by severity |
| `POST /safety-events/:eventId/review` | parent | Mark as reviewed |
| `GET /notifications` | parent | In-app parent notices (new device, budget alerts, safety) |

### 5.9 Content and project actions

Content is read from static bundles. Project actions are recorded as sync events. There are no content-authoring endpoints in Phase 1.

| Method and path | Role | Notes |
|---|---|---|
| `GET /children/:childId/approvals` | parent | Projects or extensions awaiting approval (if approval is required) |
| `POST /children/:childId/approvals/:itemId` | parent | Approve or decline |

### 5.10 Privacy: export, delete, audit

| Method and path | Role | Notes |
|---|---|---|
| `GET /children/:childId/export/events?cursor=` | parent+fresh | Paged events. The app builds the archive on the device |
| `GET /children/:childId/export/portfolio` | parent+fresh | Portfolio JSON and artifact file links |
| `POST /children/:childId/delete` | parent+fresh | Soft delete now, hard delete after the grace period (default 14 days) |
| `POST /children/:childId/delete/cancel` | parent+fresh | Cancel within the grace period |
| `POST /family/delete` | parent+fresh | Same flow for the whole family |
| `GET /audit?cursor=` | parent | Audit log (security-relevant actions, no personal content) |

Heavy work (large exports, cascading deletes) is done in small batches or on the client to stay inside free-tier CPU limits.

### 5.11 Health

| Method and path | Role | Notes |
|---|---|---|
| `GET /health` | public | Returns `{ "ok": true, "version": "..." }`. No internal details |

---

## 6. Authorization rules (testable)

1. Parent of family A cannot read or write any data of family B.
2. A child session can read and write only its own child's data, and cannot call any `parent` endpoint.
3. A revoked device cannot sync or open profiles.
4. Settings (time limit, AI flags, allowed risk class) are enforced **server-side**. The client hides what it may not do, but never decides.
5. Junior sessions cannot reach `/mentor/chat`.
6. Endpoints that return child data require the child's id to belong to the session's family.
7. These rules are covered by the generated authorization matrix tests (`TESTING.md` section 6).

---

## 7. Audit and logging

Write `audit_log` rows for: login, logout, failed logins, device register and revoke, child create and delete, settings changes, kill switch, export, delete, recovery code use, invitations. Rows contain ids and action names, not personal content. Operational logs never contain message text, tokens or secrets.

---

## 8. Implementation notes for agents

- Define each route with a Zod schema for params, query, body and response. Generate types for `packages/shared-types` and the client from the same schemas.
- Keep handlers thin. Call module interfaces. Do not query another module's tables.
- Keep CPU-heavy work out of request handlers (no heavy hashing, no large JSON transformations, no archive building).
- Batch database writes. Prefer one insert of many rows over many inserts.
- Return the smallest response that works. No personal data in logs.
- Every new endpoint adds: schema, role, authorization test, rate limit, audit decision, and an entry in this document.
