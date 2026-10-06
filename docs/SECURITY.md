# SECURITY.md — CREATEVERSE

Status: **Draft v0.1 for owner review**
Read with: Master Spec sections 22, 33; `ARCHITECTURE.md` sections 3, 6, 9, 11; `DATA_MODEL.md`; `SAFETY.md`

Scope: security of accounts, data, infrastructure, AI access and the build process. Child safety and AI behavior are in `SAFETY.md`.
This is an engineering policy, not legal advice. A legal and privacy review is required before anyone outside the family uses the product.

---

## 1. Security goals

1. Only invited family members can reach the app and the data.
2. A child's data is never visible to anyone outside the family.
3. Children cannot change parent settings, safety limits, or other children's data.
4. Live AI cannot be abused to spend money or to leak data.
5. The family can export and delete all data, and can recover from loss.
6. The system stays secure with a tiny budget and a small maintenance effort.

---

## 2. Assets and actors

| Assets | Why it matters |
|---|---|
| Parent credentials (passkeys, recovery codes) | Control over everything |
| Child profiles, progress, AI messages, artifacts | Personal data about a child |
| AI provider API key | Money and abuse risk |
| Content and source code | Integrity of what children see |
| Backups | A second copy of all of the above |

| Actors | Trust |
|---|---|
| Parent / guardian | Trusted, authenticated |
| Child | Limited. Uses a registered device and profile, optionally a PIN |
| Another family member's device | Only if registered by a parent |
| Internet attacker | Untrusted |
| AI provider | Third party. Receives minimal data only |
| AI coding agents | Trusted to write code, **not** to hold production secrets or touch live data without approval |

---

## 3. Threats and mitigations

| # | Threat | Mitigation |
|---|---|---|
| T1 | Parent account takeover | Passkeys (phishing-resistant), recovery codes stored offline, session revocation, audit log, login alerts |
| T2 | Child changes settings or reaches parent area | Separate parent and child session types. Parent area requires a fresh parent authentication. Server enforces, not just the UI |
| T3 | Reading another family's or child's data (broken access control) | Every query scoped by `family_id`. Tests for cross-family and cross-child access on every endpoint |
| T4 | Injection (SQL, command) | Parameterized queries via ORM, schema validation (Zod) on every input, no string-built queries |
| T5 | XSS in the PWA | Strict Content Security Policy, no inline scripts, framework escaping, sanitize any child-authored rich text, sandbox user-created HTML/code |
| T6 | Prompt injection through child text or content | Treat child text as untrusted data. System policy outranks it. Output filtering (see `SAFETY.md`). The model has no tools that change data |
| T7 | AI key leaked or abused, or runaway cost | Key only in server secrets. Budget guard with daily per-child and monthly hard caps. Rate limits. Alerts at 50% and 90% of budget |
| T8 | Personal data leaks to the AI provider | Send only stage, concept ids and the current message. No names, birth data, or profile text. Check provider data-retention and training terms before adopting (owner approval) |
| T9 | Sync endpoint abuse or replay | Authenticated device, idempotent by `event_id`, size and rate limits, schema validation, ignore events for other children |
| T10 | Malicious or oversized uploads (artifacts) | Allowlist of types, size limits, serve from a separate path with a safe content type, never execute uploads |
| T11 | Lost or stolen device | Parent can revoke the device. Server sessions expire. Local data on device is limited to the child's progress cache. Sign-out clears it |
| T12 | Dependency or supply-chain attack | Small dependency set, lockfile, pinned versions, audit in CI, review updates before merging |
| T13 | Secrets committed to the repo by a person or an agent | Secret scanning in CI, pre-commit hook, `.env` ignored, secrets only in platform secret stores |
| T14 | Data loss (bad deploy, platform issue, mistake) | Scheduled exports of the database, encrypted off-platform backup, restore test (section 10) |
| T15 | Insider mistake by an AI agent (deleting data, changing prod) | Agents work on dev data only. Destructive or production actions need owner approval (Master Spec section 33) |
| T16 | Legal and privacy non-compliance | Private family use only. Legal and privacy review before any non-family use. No public sign-up |

---

## 4. Authentication and sessions

**Parents**
- Primary login: **passkeys (WebAuthn)**. No password to steal or hash.
- Recovery: a set of **recovery codes** shown once at setup (store offline), plus the ability to register a second passkey on another device. An emailed one-time code is optional and needs an external email service, which requires owner approval.
- Sensitive actions (export, delete, change safety settings, register or revoke devices) require a fresh passkey confirmation.
- Sessions are short-lived and tied to a registered device. Parents can revoke any device or session.
- Password login is off by default. If ever enabled, use a slow hash suited to the host (Argon2id on a server). Do not do heavy hashing inside a free-tier Worker.

**Children**
- Children have profiles, not accounts. A parent registers the device. The child opens their profile, optionally behind a short PIN.
- Child sessions cannot access the parent area, other children's data, or settings.
- PIN attempts are rate limited and lock the profile on repeated failures.

**Free-tier note.** The Workers free plan allows about 10 ms of CPU per request. Passkey verification is a fast signature check, but **measure it in task P1-01**. If it does not fit, options in order: optimize, move auth to a small server, or use the paid Workers plan if the budget allows. Do not weaken authentication to fit the limit.

---

## 5. Authorization

- Deny by default. Every endpoint declares which role may call it (parent, child, device, system).
- Scope all data access by `family_id`, then `child_id`. Modules expose functions that require these ids. No module reads another module's tables.
- Test matrix (automated): parent of family A cannot read family B. Child X cannot read child Y. Child cannot call parent endpoints. Revoked device cannot sync.
- Never trust ids sent by the client for ownership. Derive ownership from the session.

---

## 6. Data protection

| Area | Requirement |
|---|---|
| In transit | HTTPS only, HSTS, modern TLS |
| At rest | Rely on platform encryption for the database and object storage. Additionally encrypt backups before they leave the platform |
| Field-level | Do not store raw secrets. Recovery codes stored only as hashes. Passkeys store public keys only |
| Minimization | Follow `DATA_MODEL.md` section 6: nickname allowed, optional birth year, no addresses or photos unless a parent adds an artifact |
| Retention | Follow the retention table. Deletion cascades (`DATA_MODEL.md` section 7) |
| Logs | No names, messages, tokens, or free text in operational logs. Use ids |
| Export and delete | Parent can export and delete per child and for the whole family, with confirmation |

---

## 7. AI-specific security

- All AI calls go through the server `AIProvider` interface. Clients never see the provider key.
- The AI model has **no tools** that read or write family data. It receives a bounded context and returns text.
- Prompts are versioned in `ai/prompts/`. Changes need review and a safety eval run.
- Budget guard and rate limits (per child per day, per family per month). When exhausted, fall back to pre-written hints.
- Store usage (tokens, cost) but not message text in usage records.
- Provider choice, region, retention, and training terms are an approval item. Prefer a provider and plan with no training on API data and short or zero retention. Verify current terms at the time of choosing.
- Cache responses only when they contain no personal data.

---

## 8. API, sync and client hardening

**API**
- Validate every request body, params and headers with Zod. Reject unknown fields.
- Limit body sizes and batch sizes. Rate limit by device and by IP.
- Idempotent writes for sync (`event_id`). Return generic errors, no stack traces.
- CORS: allow only the app's origin.

**PWA / client**
- Content Security Policy: default-src self, no inline scripts, no `eval`, restricted `connect-src`, `frame-ancestors none`.
- Other headers: `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy` limiting camera, microphone and location to what features need (microphone only if a feature uses it).
- Service worker: cache only the app shell, content bundles and static assets. Never cache authenticated API responses with personal data in shared caches. Version caches and clear them on update and on sign-out.
- IndexedDB holds the child's local progress and queued events. It is not a secret store. Never put tokens or secrets there beyond the session mechanism.
- User-created code or HTML (Coding Studio, later phases) runs in a sandboxed iframe without access to the app origin, storage, or network.
- Camera, microphone and file access are opt-in per feature, with clear parent controls.

---

## 9. Uploads and artifacts

- Allowlist types (for example PNG, JPEG, WebP, SVG sanitized, MP3/WAV, JSON, text). Reject everything else.
- Enforce size limits per file and per child.
- Re-encode images where practical. Sanitize SVG or disallow it.
- Store with random keys. Serve with correct content type and `Content-Disposition` where needed. Never serve user files as executable HTML on the app origin.
- Parents can view and delete any artifact.

---

## 10. Backup and recovery

- Scheduled export of the database (at least weekly), encrypted, stored off-platform (for example a parent-controlled cloud drive or local disk).
- Back up artifact files on the same schedule or rely on object storage durability plus periodic export.
- **Test a restore** before launch and after any schema migration.
- Document recovery steps in `docs/operations/RECOVERY.md`. Target: restore within a day, losing at most a week.
- Backups follow deletion rules: when a child is deleted, older backups age out on a documented schedule.

---

## 11. Secrets and environments

- Environments: `local`, `staging` (optional), `production`. Production secrets exist only in the hosting platform's secret store.
- `.env` files are never committed. A secret scanner runs in CI and as a pre-commit hook.
- Rotate the AI key and any signing keys on suspicion of exposure and at least yearly.
- AI coding agents use local or staging data only. They do not receive production secrets.

---

## 12. Supply chain and build

- TypeScript monorepo with a lockfile and pinned versions.
- CI steps: install from lockfile, type check, lint, unit tests, content validation, dependency audit, secret scan, build.
- Prefer few, mainstream, maintained dependencies. Adding a dependency that touches auth, crypto, uploads or the network needs a short written justification (ADR or PR note).
- Review dependency updates before merging. No auto-merge of major updates.

---

## 13. Monitoring, alerts and incident response

**Monitor**
- Auth failures, device registrations, settings changes, exports and deletions (from `audit_log`).
- AI spend versus caps, unusual request rates, error spikes.
- Sync failures and storage growth.

**Alert the parent/owner** on: new device registered, recovery code used, export or delete requested, budget at 50% and 90%, repeated failed logins.

**If something goes wrong**
1. Contain: revoke sessions and devices, turn on the AI kill switch, rotate secrets if needed.
2. Preserve logs.
3. Fix and add a regression test.
4. Tell affected family members what happened.
5. Record in `docs/operations/` with lessons learned.

---

## 14. Security testing plan

| Test | When |
|---|---|
| Authorization matrix (cross-family, cross-child, child-to-parent) | Every change to API or modules |
| Input validation and fuzz tests on sync and uploads | Every change to those endpoints |
| CSP and security header check | Every deploy |
| Dependency audit and secret scan | Every CI run |
| Passkey and recovery flows (e2e) | Phase 1 and on auth changes |
| Restore drill | Before launch, then quarterly |
| Prompt-injection cases in the AI eval set | Every prompt or model change |
| Manual review of the threat model | Each phase exit |

---

## 15. Rules for AI coding agents

1. Never put secrets, keys, or real child data in code, tests, logs, prompts, or docs.
2. Use fake data for tests and fixtures.
3. Do not weaken auth, authorization, validation, CSP, or logging rules to make a test pass. Stop and ask.
4. Do not add services, SDKs, analytics, or trackers without owner approval.
5. Destructive actions (delete data, drop tables, rotate keys, change hosting) need approval.
6. Report security-relevant findings in the handoff report under KNOWN ISSUES.

---

## 16. Open decisions for the owner

1. Approve the passkey-first design and offline recovery codes. Decide whether to allow an emailed code (needs an external email service).
2. Choose a parent-controlled location for encrypted backups.
3. Approve the AI provider only after reviewing its data-retention and training terms.
4. Decide whether to put an extra access layer in front of the whole app (for example an identity-aware gateway) once Phase 1 works. Evaluate its free-tier terms first.
5. Schedule the legal and privacy review for any use beyond the family.
