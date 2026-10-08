# INDEX.md — CREATEVERSE

**One line per document. Open only what your task needs** (AGENT_OPERATING_RULES.md §2).
Every document listed here lives in `docs/` unless noted.

## Start here (every session)

| Doc | One line |
|---|---|
| `CURRENT_STATE.md` | What is done, in progress, blocked, next up, and the commands. Read first, every session. |
| `TASKS_PHASE_0_1.md` | The task backlog for Phase 0 and Phase 1: 30 tasks in task-file format. |
| `TASKS_PHASE_2_7.md` | The backlog for Phases 2–7: 53 tasks expanded from the epics (P0-10 draft, owner scope check pending). |
| `CREATEVERSE_BUILD_PLAN.md` | The route: strategy, priority tags, backlog summary, task template, Definition of Done. |
| `ROADMAP.md` | Phases 0 to 7 with exit criteria, decision gates, cross-cutting tracks. |

## Rules and process

| Doc | One line |
|---|---|
| `AGENT_OPERATING_RULES.md` | Roles, session checklists, approval boundaries, resume protocol, master prompt, handoff report format. |

## Product

| Doc | One line |
|---|---|
| `PRODUCT_SPEC.md` | What the product is: statement, scope, principles, core loop, users, success measures. |
| `DESIGN_SYSTEM.md` | Design tokens, three stage presets, component list, accessibility rules, tone for children. |
| `AI_SPEC.md` | The AI mentor: what it does and never does, interfaces, budget, evaluation, fallbacks. |

## Technical

| Doc | One line |
|---|---|
| `ARCHITECTURE.md` | Approved stack, free-tier limits, repo layout, modules, sync, ADR index (ADR-0001 to 0008). |
| `DATA_MODEL.md` | Content entities (files), database tables, derivations, retention, export/delete, invariants. |
| `API_SPEC.md` | JSON API: conventions, sessions and roles, errors, limits, endpoints, authorization rules. |
| `EXPERIENCE_RUNTIME.md` | Web experience runtime interface, experience spec fields, domains, performance rules. |
| `architecture/FREE_TIER_SPIKE.md` | P0-09 spike: measured CPU for passkeys, batch sync and reads vs Cloudflare free-tier limits; storage options; VPS fallback triggers. |
| `TESTING.md` | Test layers, unit must-covers, CI gates, AI and safety eval sets, playtest protocol. |

## Safety, security, operations

| Doc | One line |
|---|---|
| `SAFETY.md` | Child safety and AI behavior policy: safety pipeline, risk classes, safe messages, reviews. |
| `SECURITY.md` | Accounts, threat model, secrets, supply chain, backup, incident response, agent rules. |
| `architecture/THREAT_MODEL.md` | Child data-flow map, what may leave the device, threats tied to flows, privacy-review items (P0-05). |

## Decisions

| Doc | One line |
|---|---|
| `decisions/README.md` | Index of all ADRs (0001–0008, owner-approved); changing one needs owner approval. |
| `decisions/ADR-*.md` | Full records: Context, Decision, Alternatives, Consequences, Status. |

## Not part of CREATEVERSE

| Doc | One line |
|---|---|
| `other-products/BLANC_COFFEE_SPEC.md` | A separate product (Android business OS for a coffee shop). Unrelated to this build; kept for reference only. |

## Still open (referenced by docs, not yet written)

- `BUILD_A_BRIDGE_CONTENT.md` — draft content pack (task P1-15).
- `docs/product/LANGUAGE_STYLE.md` — Traditional Chinese variety/style decisions (required by SAFETY.md §13).
- `docs/operations/` — RECOVERY.md, incident records (tasks P1-19, P0-05 follow-ups).
