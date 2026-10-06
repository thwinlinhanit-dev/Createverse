# ARCHITECTURE.md — CREATEVERSE

Status: **Approved v0.2** (owner approved ADR-0001 to ADR-0008 and the decisions in section 15; changes need owner approval)
Read with: Master Spec v1.0, `CREATEVERSE_BUILD_PLAN.md`, `DATA_MODEL.md`

---

## 1. Constraints that shape every decision

| Constraint | Consequence |
|---|---|
| Private family use only | No public sign-up, no public deployment, parent-controlled access |
| Phone and tablet | Touch-first installable PWA, light experiences |
| $20 per month total running cost | Free/cheap hosting, static content, optional capped live AI |
| English and Chinese from day one | Translation keys everywhere, no hard-coded strings |
| Three stages (Junior, Explorer, Maker) | Token-driven UI presets, one project with one lane per stage |
| AI access may end | AI is an optional layer. Pre-generated hints are the default path |
| Built by AI agents, maintained maybe by a human | Plain stack, small modules, docs and tests as handover |

---

## 2. System context

```text
 Child device (tablet/phone)           Parent device (phone/tablet)
 ┌──────────────────────────┐          ┌──────────────────────────┐
 │ PWA: Child app           │          │ PWA: Parent app          │
 │  - IndexedDB (local-first)│          │  - dashboards, controls  │
 │  - Service worker (offline)│         └────────────┬─────────────┘
 └─────────────┬────────────┘                        │
               │            HTTPS + sync             │
               └──────────────────┬──────────────────┘
                                  │
                         ┌────────▼────────┐
                         │   API (Hono)    │
                         │ modular monolith│
                         └───┬────────┬────┘
                             │        │
                 ┌───────────▼─┐   ┌──▼─────────────┐
                 │ SQLite DB   │   │ AI Provider    │ (optional, capped)
                 │ + file store│   │ interface      │
                 └─────────────┘   └────────────────┘

 Build time: content/ (JSON + Markdown) → validate → compile → static bundles
```

---

## 3. Proposed stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript everywhere | Shared types between client, API, content tools |
| Monorepo | pnpm workspaces | Simple, fast |
| Client | React + Vite, installable PWA | Service worker for offline shell and content |
| Local storage | IndexedDB | Child progress works offline, syncs later |
| API | Hono | Runs on Node or on edge runtimes, so hosting stays portable |
| DB | SQLite via Drizzle ORM | Boring, cheap, easy backup. Can move to Postgres later |
| File storage | Local disk or S3-compatible bucket behind a `FileStore` interface | Artifacts: drawings, songs, code |
| Validation | Zod (runtime) plus JSON Schema for content | One source of truth for shapes |
| i18n | ICU message format, keys per locale | `en`, `zh-Hant` (Traditional Chinese, confirmed) |
| Tests | Vitest (unit), Playwright (e2e, mobile viewports) | |
| Experiences | Canvas 2D with Matter.js first. Three.js + Rapier only if needed later | No game engine |
| Hosting | **Decided: Cloudflare free tier** (Pages + Workers + D1, object storage for artifacts). Keep code portable so a small VPS stays a fallback | ADR-0003 |

**Free-tier limits that shape the design** (checked October 2026, re-verify before building):

| Limit | Value | Consequence |
|---|---|---|
| Workers requests | 100,000 per day, 1,000 per minute burst | Plenty for one family. Batch sync requests anyway |
| Workers CPU time | 10 ms per invocation | No heavy hashing or big data processing in the Worker. Waiting on network or DB does not count |
| Subrequests | 50 per request | Keep each API call to a few DB/AI calls |
| D1 | 5 GB total, 5M row reads/day, 100K row writes/day | Batch event writes. Derive state incrementally |
| Static assets | Free and unlimited | Serve app shell and content bundles as static assets |

If the app ever outgrows these limits, ADR-0003 allows a move to a small VPS without rewriting features.

---

## 4. Repository layout

```text
createverse/
├─ apps/
│  ├─ app/                # one PWA, child + parent areas, route-guarded
│  └─ admin-cli/          # content tools, export/delete, backups (CLI first, UI later)
├─ packages/
│  ├─ design-tokens/      # tokens + stage presets (junior/explorer/maker)
│  ├─ ui/                 # reusable components
│  ├─ shared-types/       # Zod schemas, event types
│  ├─ content-sdk/        # loaders, validators, compilers
│  ├─ learning-core/      # hint ladder, skill evidence, concept progress (pure logic)
│  ├─ ai-core/            # AIProvider interface, MentorService, safety pipeline, budget guard
│  ├─ experience-runtime/ # ExperienceRuntime interface + WebExperienceRuntime
│  └─ i18n/               # message catalogs, helpers, lint rules
├─ backend/
│  ├─ api/                # Hono routes
│  ├─ modules/            # identity, profiles, family, projects, portfolio, ...
│  └─ db/                 # schema, migrations, seeds
├─ content/
│  ├─ graph/              # skills, concepts, interests (versioned files)
│  ├─ projects/           # one folder per project, lanes per stage
│  ├─ activities/
│  ├─ assessments/
│  └─ locales/            # en/, zh-Hant/
├─ ai/
│  ├─ prompts/
│  ├─ policies/
│  └─ evals/              # evaluation datasets and runners
├─ docs/{architecture,decisions,product,operations}/
└─ tests/{e2e,simulation,ai-eval}/
```

Two deliberate differences from the Master Spec layout: one `app` instead of separate child, parent and admin apps (cheaper to build and ship), and no `game/` directory until a spike proves the web runtime is not enough.

---

## 5. Backend modules and boundaries

Modular monolith. Each module owns its tables and exposes a typed interface. **No module reads another module's tables directly.**

| Module | Owns | May depend on |
|---|---|---|
| identity | users, sessions, auth | none |
| family | families, devices, invitations | identity |
| profiles | children, child_settings | family |
| curriculum | content catalog index (read-only) | none |
| projects | project_instances, activity_attempts | curriculum, profiles |
| learning | skill_evidence, concept_progress, interest_signals | curriculum, projects (via events) |
| assessment | evaluation of evidence against rubrics | learning, curriculum |
| portfolio | artifacts, portfolio_entries | projects, profiles, media |
| media | file storage interface | none |
| ai | conversations, usage, budget | safety, curriculum, profiles |
| safety | safety_events, policies | none |
| analytics | read models for parent dashboard | events only |
| notifications | parent notices | family |
| sync | devices sync state, event ingestion | identity, profiles |

Cross-module communication: calling the other module's public interface, or publishing a domain event. Never importing its internals.

---

## 6. Local-first and sync (ADR-0004)

- The child app records every learning action as an **append-only event** with a client-generated UUIDv7.
- Events are stored in IndexedDB first, then pushed to `POST /sync/events` when online. The server dedupes by `event_id`, so retries are safe.
- Server-derived state (skill evidence, concept progress, portfolio) is computed from events. It can be rebuilt by replaying them.
- Content bundles and the app shell are cached by the service worker. A child can finish a project fully offline.
- Conflicts are rare (one child, mostly one device). Rule: events never conflict, derived state is recomputed, settings use last-write-wins by server time.

**Event envelope**

```json
{
  "event_id": "018f...uuidv7",
  "type": "child.activity.completed",
  "schema_version": 1,
  "child_id": "c_...",
  "device_id": "d_...",
  "occurred_at": "2026-10-07T09:12:30Z",
  "content_ref": { "id": "bridge_unit_01", "version": 1 },
  "payload": { "outcome": "success", "hints_used": 1, "iterations": 3 }
}
```

Minimum event types: see Master Spec section 21 and `DATA_MODEL.md`.

---

## 7. Content pipeline (ADR-0007)

```text
content/*.json|md  →  validate (JSON Schema + Zod)  →  check i18n completeness
                   →  compile per (locale, stage)    →  static bundles in app
                   →  service worker caches bundles
```

- Build fails if: a schema is invalid, a translation key is missing in `en` or `zh-Hant`, a hint ladder is incomplete, or a project lacks a lane for a configured stage.
- Content ids and versions are stable. A child's progress stores `(content_id, version)`, so editing content never silently corrupts history.
- Graph files (skills, concepts, interests) live in git, which gives versioning and audit for free.

---

## 8. Experience runtime (ADR-0006)

```ts
interface ExperienceRuntime {
  load(spec: ExperienceSpec, ctx: RuntimeContext): Promise<void>;
  start(): void;
  pause(): void;
  getSnapshot(): ExperienceSnapshot;        // for save/resume
  onTelemetry(cb: (e: TelemetryEvent) => void): Unsubscribe;
  evaluate(): AssessmentResult;             // checks spec.assessment conditions
  dispose(): void;
}
```

- `WebExperienceRuntime` is the only implementation at first. Others (native, engine) can be added later without changing callers.
- Experiences are **data-driven**: constraints, success conditions and difficulty come from the `ExperienceSpec`, never from hard-coded scene scripts.
- Telemetry events are mapped into the standard event envelope by the app, not by the runtime.
- Determinism: simulations must be reproducible from `(spec, seed, inputs)` so they can be unit tested.
- Stage presets change input size, text, and allowed controls, not the underlying simulation.

---

## 9. AI layer (ADR-0005)

```text
Child asks for help
   │
   ▼
MentorService.getHelp(context)
   ├─ 1. Resolve from pre-generated hint ladder (content)        ← default, free
   ├─ 2. If open-ended question AND AI enabled AND budget left:
   │      Input safety → context policy → AIProvider.complete()
   │      → output safety → age appropriateness → cache
   └─ 3. If AI off / capped / fails: next pre-generated hint or a safe "ask a grown-up" fallback
```

```ts
interface AIProvider {
  id: string;
  complete(req: AIRequest): Promise<AIResponse>;   // text in, text + usage out
}
interface BudgetGuard {
  canSpend(estimatedTokens: number): boolean;      // daily per-child and monthly total caps
  record(usage: Usage): void;
}
```

- Providers are swappable (cloud model, cheaper model, local model) via configuration.
- The mentor follows the hint hierarchy: ask, hint, smaller hint, demonstrate, explain, solution only when justified.
- Prompts, policies and evals live in `ai/` and are versioned. Behavior changes require running the eval set.
- Personal data sent to a provider is minimized: no names, no birth dates, no free-text profile data. Use stage and concept ids.
- Every AI call logs usage (tokens, cost estimate) to `ai_usage`.

---

## 10. Safety architecture (summary)

- Safety pipeline wraps all live AI: input check, context policy, generation, output check, age check.
- Risky real-world experiments are classified first. High-risk requests get a safe alternative, never instructions.
- Content in `content/` carries `safety_notes` and a risk class. Activities above "low" need parent approval.
- Safety events are stored and visible to the parent dashboard in a privacy-appropriate form.
- Details go in `SAFETY.md`.

---

## 11. Security and privacy architecture (summary)

- Parent accounts: **passkeys (WebAuthn) as the primary login**, with offline recovery codes (shown once at setup) and a second registered passkey for recovery. An emailed one-time code is optional and needs an external email service (owner approval). Password hashing is avoided on the free Workers plan because of the 10 ms CPU limit. If passwords are ever needed, use a slow hash suited to the host (Argon2id on a VPS). Children have profiles, not accounts. A child opens a profile on a device the parent has registered, optionally behind a PIN.
- Sessions: short-lived tokens, device registration, revocation by the parent.
- Authorization: every query is scoped by `family_id`. Row-level checks live in module interfaces, tested.
- Encryption in transit (TLS). Sensitive fields (parent email, auth data) encrypted or hashed at rest. Backups encrypted.
- Data minimization: store stage, optional birth year (not full birth date), display name (can be a nickname).
- Export and delete workflows for each child (see `DATA_MODEL.md`).
- Audit log for sensitive actions (login, settings change, export, delete).
- Before any non-family use: legal and privacy review (Master Spec section 22).
- Details go in `SECURITY.md`.

---

## 12. Localization, stages and theming

- All user-visible text uses `t("key")`. A lint rule blocks raw strings in UI code.
- Locales: `en` and `zh-Hant` at launch. Locale is per child, with a parent default.
- Junior lane never requires reading: icons, spoken prompts (read-aloud), large touch targets.
- Read-aloud uses on-device speech synthesis first (free, offline-capable where the device supports it). Availability and quality of Traditional Chinese voices (zh-TW / zh-HK) varies by device, so test on the actual phone and tablet, and plan recorded audio for key Junior content if needed.
- Design tokens: color, type, spacing, radius, shadow, motion, elevation. Stage presets (`junior`, `explorer`, `maker`) override tokens. Themes are token sets.
- Accessibility baseline: contrast, scalable text, reduced motion, captions where audio exists, simple-language mode.

---

## 13. Performance and offline budgets (initial targets, revise after measuring)

| Area | Target |
|---|---|
| First load on mid-range phone, 4G | App usable in under 3 s |
| Initial JS (gzipped) | Under 250 KB for the shell. Experiences lazy-loaded |
| Interaction latency | Under 100 ms response to touch |
| Experience frame rate | 60 fps target, 30 fps floor on mid-range devices |
| Offline | Shell, current project, hint ladders, and read-aloud text work with no connection |
| Sync | Background, resumable, no data loss on app close |

---

## 14. ADR index (all **Accepted**, approved by the owner)

| ADR | Decision | Main alternative |
|---|---|---|
| 0001 | TypeScript monorepo (pnpm) | Multi-language repo |
| 0002 | Installable PWA for phone and tablet | Native apps, Flutter |
| 0003 | Hono + Drizzle + SQLite, portable between Node and edge | Next.js full-stack, Postgres from the start |
| 0004 | Local-first events with idempotent sync | Server-only state |
| 0005 | AI provider interface + pre-generated hints as default | Live-AI-only mentor |
| 0006 | Web-only experience runtime behind `ExperienceRuntime` | Unity / game engine |
| 0007 | Content as validated data in git | Content in database or CMS |
| 0008 | ICU message keys, `en` + `zh-Hant` | Ad-hoc strings |

Each ADR file uses: Context, Decision, Alternatives, Consequences, Status. Changing any of these requires owner approval.

---

## 15. Decisions (resolved)

1. **Chinese script:** Traditional (`zh-Hant`). Phonetic aids (Zhuyin or pinyin) are not decided yet. Not needed for Phase 1 content.
2. **Hosting:** Cloudflare free tier. VPS is a fallback only.
3. **ADR-0001 to ADR-0008:** approved.
4. **Still open:** live AI provider for the optional mentor (choose after the budget cap is set), and the retention periods in `DATA_MODEL.md` (confirm in the privacy review).

## 16. Not in scope now

Game engine, multiplayer, social features, marketplace, public launch, microservices, VR/AR, autonomous AI teacher, monetization.
