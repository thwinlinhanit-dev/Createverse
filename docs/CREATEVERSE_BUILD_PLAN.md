# CREATEVERSE — Build Plan (Token-Resilient Edition)

Companion to: *CREATEVERSE AI-Agent Master Build Specification v1.0*
Goal: build the **whole** platform, in an order that stays usable and continuable even if AI access ends.

---

## 0. How to use this document

1. Treat the Master Spec as the destination. Treat this file as the route.
2. Every agent reads: Master Spec, this plan, `ARCHITECTURE.md`, and the task it was given.
3. Work only from the task backlog (section 7). One task = one small, testable change.
4. When AI access is limited, spend it on the **FRONT-LOAD** items first (section 1).

---

## 1. Strategy: build everything, survive running out of AI

**Core rule: every phase must end with something that works without more AI help.**

| Spend AI on now (durable) | Defer or delegate (cheap to do later) |
|---|---|
| Docs, ADRs, architecture, data model | Routine UI polish |
| Content as data: projects, activities, hint ladders, assessments | Simple CRUD screens |
| Test suites and evaluation datasets | Style/theme variations |
| Task backlog for ALL phases (so any model/human can resume) | Extra languages beyond EN/ZH |
| AI mentor prompts, policies, safety rules | Optional studios (Art, Music) beyond MVP |
| Hard architecture (runtime interface, event system) | Advanced simulations (Phase 5+) |

**Priority tags used below**
- `FRONT-LOAD` = do while AI access is strongest.
- `MEDIUM` = do soon after.
- `DEFER-OK` = a cheaper model or a human can do it from the task file.

---

## 2. Rules for every agent (condensed from Master Spec 32, 33, 47)

1. Read the spec and docs before changing code. Inspect existing code first.
2. Small, testable changes. No large rewrites without written justification.
3. Run tests, lint and type checks after every change.
4. Update docs. Record architecture decisions as `docs/decisions/ADR-XXXX-title.md`.
5. Never silently change a product requirement.
6. Preserve: learning philosophy, child safety, privacy, accessibility, localization.
7. Educational logic is data-driven. Never buried in scene or UI code.
8. If a requirement conflicts with safety, privacy or architecture: STOP and explain.

**Needs human approval:** core architecture changes, incompatible schema changes, expensive infrastructure, changing AI providers, collecting new child data, changing privacy behavior, new external services, public deployment, legal/compliance assumptions, deleting user data, major design-system changes.

**May decide alone:** formatting, equivalent refactors, test improvements, bug fixes, small UI improvements, implementation details inside the existing architecture.

---

## 3. Target architecture (summary)

```text
Clients (child, parent, admin)
        |
   API layer
        |
 Modular monolith modules:
 identity | profiles | family | curriculum | learning | skills | knowledge
 projects | activities | assessment | portfolio | ai | safety
 analytics | notifications | media | experiences
        |
 Experience Runtime (replaceable)
   WebExperienceRuntime  <- build first
   NativeExperienceRuntime / GameEngineRuntime <- only if a spike proves the need
```

**Boundary that must never blur**

```text
Learning OS (what/why) -> Learning Engine (adaptation) -> Experience Spec (data)
-> Experience Runtime (render/simulate) -> Telemetry + Assessment -> Skill/Knowledge graph
```

**Domain events (minimum set)**
`child.project.started`, `child.project.completed`, `child.activity.completed`, `child.experiment.executed`, `child.artifact.created`, `child.assessment.completed`, `child.skill.updated`, `child.interest.detected`, `ai.hint.requested`, `ai.safety.flagged`

**Experience Spec example (data, not code)**

```json
{
  "experience_id": "bridge_001",
  "version": 1,
  "age_range": [6, 9],
  "difficulty": 2,
  "learning_objectives": ["understand_load", "understand_structure"],
  "mission": { "title": "Build a Bridge", "objective": "Cross the gap with the toy car" },
  "constraints": { "max_pieces": 20, "budget": 100 },
  "assessment": { "success_conditions": ["car_crosses", "bridge_holds_5s"] }
}
```

---

## 4. Technology proposal (confirm via ADR in Phase 0)

Chosen for **AI-agent compatibility, low maintenance cost, and low lock-in**.

| Layer | Proposal | Why |
|---|---|---|
| Language | TypeScript across client, backend, shared types | One language, strong typing, best agent support |
| Client | Web app (PWA), responsive, installable | No app-store cost, works on tablet/phone/desktop |
| Backend | Modular monolith, typed API | Simple to run and to hand over |
| Database | PostgreSQL (SQLite acceptable for family alpha) | Relational, boring, durable |
| Experiences | Web runtime (canvas/WebGL + a 2D/3D physics library) | Free, no engine license, easy to maintain |
| AI | Provider abstraction + pre-generated fallback content | See section 5 |
| i18n | Translation keys from day one (EN + ZH) | Spec section 25 |
| Game engine | **Deferred.** Only adopt after a documented spike shows web cannot do it | Cost and maintenance |

Record each choice as an ADR. Evaluate against: performance, productivity, agent compatibility, maintainability, cross-platform, accessibility, offline, security, ecosystem, longevity, cost.

---

## 5. Token-resilience rules (AI-optional design)

1. **Pre-generate** hint ladders, explanations, and reflection prompts for every activity. Store them as content data. The mentor works from these even with zero live AI.
2. **Provider abstraction**: all AI calls go through one interface so the provider (cloud, cheaper, or local model) can be swapped without touching features.
3. **Graceful degradation**: if AI is unavailable, the app shows pre-generated hints and the portfolio and projects still work.
4. **Content is data** (JSON/Markdown) in `content/`. Anyone can edit it without AI.
5. **Cache** AI responses where safe. Log token usage per feature.
6. **No feature may require live AI generation to be usable.**
7. **Docs and tests are the handover.** A new person or a cheaper model must be able to continue from the repo alone.
8. Keep dependencies few and mainstream.

**Budget rules ($20 per month total running cost)**

9. **Hosting is decided: Cloudflare free tier** (static assets, Workers, D1). Respect the free-plan limits listed in `ARCHITECTURE.md` (10 ms CPU per request, 100K requests per day). Re-check limits before building.
10. Bundle content with the app as static data so lessons cost nothing to serve.
11. Live AI is the optional layer: use a small, cheap model, cache answers, and set a daily per-child cap.
12. Add a hard monthly spend cap in code. When it is reached, the mentor falls back to pre-generated hints.
13. No game engine. Web experiences only, sized for phone and tablet.
14. Cache the app shell and content for offline use, so the child can learn without a connection and without server cost.

---

## 6. Roadmap with priorities

| Phase | Goal | Priority | Exit criteria |
|---|---|---|---|
| 0 Discovery | Decide stack, prove the architecture, write docs and the full backlog | FRONT-LOAD | Docs written, ADRs recorded, one Experience Spec runs in the web runtime, full task backlog exists |
| 1 Private Family Alpha | One child can complete one project end to end | FRONT-LOAD | Child uses it weekly; full loop works with and without live AI |
| 2 Project Engine | Templates, challenges, experiments, assessment, interdisciplinary projects | FRONT-LOAD (content) | Flagship projects 1–3 playable |
| 3 Experience Engine | Runtime, physics, simulation API, telemetry, first STEM lab | MEDIUM | One lab reusable across difficulty levels |
| 4 Creative Universe | Art, Music, Animation, Coding, 3D Builder, Game Creator | MEDIUM | Each studio produces a portfolio artifact |
| 5 Advanced STEM | Robotics, electronics, chemistry, biology, astronomy | DEFER-OK | Content packs plus simulations |
| 6 AI Learning Engine | Adaptation, skill-graph reasoning, recommendations, research mode | DEFER-OK | Recommendations beat a fixed path in real use |
| 7 Persistent Universe | Persistent worlds, advanced portfolio, family features | DEFER-OK | Only if earlier phases prove value |

**Rule:** do not start phase N+1 until phase N's exit criteria are met and the child has actually used it.

---

## 7. Task backlog

Task format (use for every task; see section 8): ID, title, goal, requirements, acceptance criteria, tests, dependencies, approval.

### Phase 0 — Discovery

| ID | Title | Goal | Acceptance | Depends | Approval |
|---|---|---|---|---|---|
| P0-01 | Repo scaffold | Monorepo per spec section 34, lint, typecheck, test runner, CI | CI green on empty app | none | No |
| P0-02 | Core docs set | Write PRODUCT_SPEC, ARCHITECTURE, DATA_MODEL, API_SPEC, SAFETY, SECURITY, TESTING, ROADMAP, AGENT_OPERATING_RULES, DESIGN_SYSTEM, AI_SPEC, GAME_ENGINE_SPEC | All files exist, cross-referenced, reviewed by owner | none | Yes (owner review) |
| P0-03 | Technology ADRs | Decide client, DB, AI abstraction, runtime | One ADR per decision with evaluation table | P0-02 | Yes |
| P0-04 | Design tokens + base components | Color/type/spacing/radius/motion tokens; button, card, chip, tabs, dialog | Storybook-style page, accessible contrast | P0-01 | No |
| P0-05 | Privacy and safety threat model | Map child data flows incl. what is sent to AI providers | Threat model doc plus mitigation list | P0-02 | Yes |
| P0-06 | AI mentor prototype | One hint-ladder conversation via provider interface, plus pre-generated fallback | Works with provider on and off | P0-03 | No |
| P0-07 | Web experience runtime spike | Run one Experience Spec (bridge) in browser with physics | Success/fail conditions evaluated, telemetry emitted | P0-03 | No |
| P0-08 | Content schema + validator | JSON Schema for learning experience, project, activity, assessment; validator in CI | Invalid content fails CI | P0-01 | No |
| P0-09 | Free-tier and auth feasibility spike | Hono on Workers + D1: measure CPU time for passkey verification, event batch insert and sync; check storage options for artifacts | Written result, ADR addendum, fallback decision if limits fail | P0-03 | Yes |
| P0-10 | Backlog expansion for Phases 2–7 | Expand epics into tasks in the section 8 format | Every phase has tasks with acceptance criteria | P0-02 | Yes |

### Phase 1 — Private Family Alpha

| ID | Title | Goal | Acceptance | Depends |
|---|---|---|---|---|
| P1-01 | Identity and family | Parent sign-up, child profile created by parent, strong auth | Child cannot self-register; audit log written | P0-* |
| P1-02 | Localization foundation | Translation keys, EN + ZH switching, no hard-coded strings | Lint rule blocks raw strings in UI | P1-01 |
| P1-03 | Child app shell | Home, Explore, Create, Projects, Me navigation | Keyboard + touch accessible, reduced-motion supported | P0-04 |
| P1-04 | Content loader | Load curriculum and projects from `content/` with validation | Bad content rejected at build | P0-08 |
| P1-05 | Project runner | State machine: story, learn, experiment, create, reflect, portfolio | Project can be paused/resumed; events emitted | P1-04 |
| P1-06 | Skill evidence v0 | Tag-based skills with evidence events (no graph reasoning yet) | Completing activities updates skill evidence | P1-05 |
| P1-07 | AI mentor service | Hint ladder, age-aware tone, safety pipeline v0, cached + pre-generated fallback | Passes eval set; works offline from AI | P0-06 |
| P1-08 | Progress log | Timestamped, traceable learning events | Events queryable per child | P1-05 |
| P1-09 | Portfolio | Create/view entries with reflection fields (spec section 17) | Completed project produces an entry | P1-05 |
| P1-10 | Parent overview | Concepts, skills, projects, interests, struggles, next suggestions; time and content controls | No raw screen-time-first dashboard | P1-08 |
| P1-11 | Safety v0 | Input/output filtering, risky-experiment classification, safe alternatives | Safety tests pass | P1-07 |
| P1-12 | Data export and delete | Parent can export or delete child data | Verified end to end | P1-01 |
| P1-13 | Accessibility baseline | Contrast, scalable text, captions/audio hooks, simple-language mode | Checklist passed | P1-03 |
| P1-14 | E2E child journey | login, choose project, activity, AI, finish, portfolio | Automated test green | P1-05, P1-07, P1-09 |
| P1-15 | Flagship content: Build a Bridge | Full project as data with hint ladders and reflection, one lane per stage (Junior, Explorer, Maker), in EN and ZH | Child can finish the lane for their stage | P1-04 |
| P1-16 | Stage presets | Three token-driven UI presets: Junior (icons, big targets, no reading required), Explorer (short text), Maker (fuller text and controls) | Same app, three presets, switchable by parent | P0-04, P1-03 |
| P1-17 | Audio for pre-readers | Read-aloud for prompts and hints in EN and ZH using free on-device voices first | Junior lane fully usable without reading; works offline | P1-02, P1-15 |
| P1-18 | Private family access | Parent-controlled login, no public sign-up, private hosting | Only invited family accounts can reach the app | P1-01 |
| P1-19 | Backup and restore tooling | Scheduled encrypted export of the database and artifacts to a parent-controlled location, plus a tested restore | Restore drill passes on real-shaped data | P1-01 |
| P1-20 | Experience runtime: Explorer and Maker | Extend the web runtime so all three bridge lanes run (beam, brace, wood and steel, budget, force view, test log) | Known designs give known outcomes per lane, frame rate meets targets | P0-07, P0-08 |


**Scope note for Phase 1 (three stages, two languages):** content volume is multiplied by stages and languages. Control it by finishing ONE project (Build a Bridge) across all three lanes and both languages before authoring a second project.

### Phases 2–7 (epics; expand each into tasks during P0-09)

| Epic | Phase | Contents |
|---|---|---|
| P2-A Project templates | 2 | Reusable project schema, challenge and experiment types |
| P2-B Assessment | 2 | Evidence-based assessment, attempts, rubrics |
| P2-C Flagship content | 2 | Mars Rover, Future City, Make Your First Game, Create a Song, Build a Robot |
| P2-D Interdisciplinary linking | 2 | Concept/skill tags across subjects, project graph |
| P3-A Runtime hardening | 3 | Scene, physics, input, camera, audio, save/state |
| P3-B Simulation API | 3 | Variables, constraints, rules, success/failure, assessment signals |
| P3-C Telemetry | 3 | Runtime to backend events, privacy-safe |
| P3-D First STEM lab | 3 | One physics lab with multiple difficulty levels from one spec |
| P4-A Art Studio | 4 | Draw, shapes, layers, export to portfolio |
| P4-B Music Studio | 4 | Rhythm, melody, simple composition |
| P4-C Coding Studio | 4 | Blocks to text, guided debugging with hint ladder |
| P4-D Game Creator | 4 | Rules, characters, scenes, publish to portfolio |
| P4-E Animation and 3D Builder | 4 | Timeline and simple modeling |
| P5-* Advanced STEM | 5 | Robotics, electronics, chemistry, biology, astronomy content packs |
| P6-* AI Learning Engine | 6 | Graph reasoning, difficulty adaptation, interest discovery, recommendations, research mode |
| P7-* Persistent Universe | 7 | Persistent worlds, family experiences, advanced portfolio |

**Reuse rule:** before building a studio or lab from scratch, check whether an embeddable open-source or free tool meets the need. Build the integration and the portfolio capture, not a clone.

---

## 8. Task template and handoff

**Task template**

```text
TASK ID:
TITLE:
GOAL:
CONTEXT:
REQUIREMENTS:
NON-GOALS:
INPUTS:
OUTPUTS:
FILES EXPECTED TO CHANGE:
ACCEPTANCE CRITERIA:
TEST PLAN:
SECURITY CONSIDERATIONS:
PERFORMANCE CONSIDERATIONS:
DOCUMENTATION REQUIRED:
DEPENDENCIES:
APPROVAL REQUIRED:
```

**Handoff report (end of every task)**

```text
TASK:
STATUS:
IMPLEMENTED:
FILES CHANGED:
TESTS:
TEST RESULTS:
KNOWN ISSUES:
DECISIONS:
FOLLOW-UP TASKS:
DOCUMENTATION UPDATED:
```

---

## 9. Definition of Done

A feature is done only when all are true:
- Requirements implemented
- Tests written and passing
- Accessibility checked
- Security reviewed
- Performance checked where relevant
- AI behavior evaluated where relevant
- Works with live AI off (if it touches AI)
- Documentation updated
- No known critical regression

---

## 10. Content production pipeline

```text
Author or generate draft  ->  Validate against schema  ->  Human review (owner)
->  Safety review  ->  Version and publish to content/  ->  Observe child use  ->  Revise
```

Rules:
- Nothing AI-generated is published without validation and owner review.
- Every unit has: objective, prerequisites, concepts, skills, age range, difficulty, intro, activity, experiment, challenge, reflection, assessment, extensions, safety notes, parent notes, **pre-generated hint ladder**.
- Content is version-controlled.

**Minimal content unit (JSON)**

```json
{
  "id": "bridge_unit_01",
  "version": 1,
  "age_range": [6, 9],
  "objectives": ["understand_load"],
  "concepts": ["force", "load", "support"],
  "skills": ["experimentation", "spatial_reasoning"],
  "activity": { "prompt_key": "bridge.activity.prompt" },
  "hints": [
    { "level": 1, "type": "ask", "key": "bridge.hint.1" },
    { "level": 2, "type": "hint", "key": "bridge.hint.2" },
    { "level": 3, "type": "smaller_hint", "key": "bridge.hint.3" },
    { "level": 4, "type": "demonstrate", "key": "bridge.hint.4" }
  ],
  "reflection": ["what_worked", "what_i_would_change"],
  "safety_notes": ["no_real_world_load_tests_without_adult"],
  "parent_notes_key": "bridge.parent.1"
}
```

---

## 11. AI mentor specification (summary)

**Hint hierarchy:** ask the child to think, then hint, then smaller hint, then demonstrate, then explain, then solution only when justified.

**Coding:** understand the problem, ask for the child's approach, hint, debug together, show an example, explain.

**Safety pipeline:** input safety, context policy, generation, output safety, age appropriateness, final response. Risky real-world experiments are classified first and replaced with safe alternatives.

**Evaluation dataset (automated):** correctness, age appropriateness, pedagogical quality, agency preservation (does not do the child's work), safety, consistency, hallucination rate, hint quality, difficulty calibration, answer leakage.

**Start with one mentor agent plus a separate safety check.** Add Learning, Assessment, Parent and other agents only when a real need appears.

---

## 12. Risks and decisions for the owner

| Risk | Mitigation |
|---|---|
| Running out of AI access mid-build | Section 5 rules; docs, tests, content first |
| Content volume | Pipeline in section 10; reuse tools; one flagship project at a time |
| Scope growth | Exit criteria per phase; no skipping |
| Child data sent to AI providers | Threat model (P0-05); data minimization; provider abstraction |
| Legal/privacy (children's data) | Legal review before any public launch |
| Maintenance after build | Plain stack, ADRs, tests, handover docs |

**Decisions needed from the owner**
1. **Confirmed:** Phase 1 covers three stages (assumed Junior, Explorer, Maker, roughly ages 3 to 10). Each project is authored with one lane per stage. The UI uses three token-driven stage presets, not three apps.
2. **Confirmed:** English and Traditional Chinese (`zh-Hant`) from day one. Every string, hint and audio line needs both.
3. **Confirmed:** devices are phone and tablet. Build a touch-first, installable PWA. Desktop is not a target. Keep experiences light enough for mid-range mobile GPUs.
4. **Confirmed:** private family use only. No public deployment, no public sign-up. Parent-controlled family login.
5. **Confirmed:** budget is $20 per month for everything that runs (hosting plus live AI). See the budget rules in section 5.

---

## 13. Next 10 actions

1. Confirm the owner decisions in section 12.
2. P0-01 repo scaffold.
3. P0-02 write the core docs.
4. P0-03 technology ADRs.
5. P0-08 content schema and validator.
6. P0-06 mentor prototype with fallback.
7. P0-07 web runtime spike with the bridge Experience Spec.
8. P0-09 expand the backlog for all phases.
9. Begin P1-15 content (Build a Bridge) while AI access is strongest.
10. Build Phase 1 tasks in order, then watch the child use it before starting Phase 2.

---

## 14. Success metrics

Primary: learning progression, project completion quality, demonstrated understanding, ability to explain concepts, creation quality, iteration behavior, curiosity, skill development.
Secondary: retention, session frequency, feature adoption.
Never optimize for screen time. The goal is a child who wants to learn and create outside the app too.

---

## 15. Document map and status

| Document | Status |
|---|---|
| Master Spec v1.0 | Source of truth for vision and rules |
| `CREATEVERSE_BUILD_PLAN.md` (this file) | Route and priorities |
| `ARCHITECTURE.md` | Approved v0.2 |
| `DATA_MODEL.md` | Approved v0.2 |
| `SAFETY.md` | v0.2, owner decisions recorded, wording reviews pending |
| `SECURITY.md` | Draft v0.1 for owner review |
| `TESTING.md` | Draft v0.1 |
| `AGENT_OPERATING_RULES.md` | Draft v0.1 |
| `TASKS_PHASE_0_1.md` | Detailed task files for Phase 0 and Phase 1 (30 tasks, with build order) |
| `BUILD_A_BRIDGE_CONTENT.md` | Draft content, owner and native-speaker review pending |
| `PRODUCT_SPEC.md` | Draft v0.1 for owner review |
| `DESIGN_SYSTEM.md` | Draft v0.1 for owner review (colors contrast-checked) |
| `AI_SPEC.md` | Draft v0.1 for owner review |
| `API_SPEC.md` | Draft v0.1 for owner review |
| `EXPERIENCE_RUNTIME.md` | Draft v0.1 for owner review (replaces GAME_ENGINE, no engine) |
| `ROADMAP.md` | Draft v0.1 for owner review |
| Still open | Owner review of all drafts (task P0-02), then ADR files (P0-03) |
