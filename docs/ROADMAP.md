# ROADMAP.md — CREATEVERSE

Status: **Draft v0.1 for owner review**
Read with: Master Spec section 36 and 50, `CREATEVERSE_BUILD_PLAN.md`, `TASKS_PHASE_0_1.md`, `PRODUCT_SPEC.md`

The route from nothing to the full platform. **Every phase ends with something the family can use, even if AI access ends.**

Agents update the **Status** section (section 1) at the end of every task or session.

---

## 1. Status (keep current)

| Phase | Status | Notes |
|---|---|---|
| 0 Discovery | Planning docs written. Not started in code | Docs: all core docs drafted. Next: P0-01 |
| 1 Private Family Alpha | Not started | Tasks ready in `TASKS_PHASE_0_1.md` |
| 2 Project Engine | Not started | Backlog to be expanded in P0-10 |
| 3 Experience Engine | Not started | |
| 4 Creative Universe | Not started | |
| 5 Advanced STEM | Not started | |
| 6 AI Learning Engine | Not started | |
| 7 Persistent Universe | Not started | |

Last updated: _(agent fills date and name)_

---

## 2. Rules of the road

1. **One phase at a time.** Do not start phase N+1 until phase N's exit criteria are met **and the child has actually used it**.
2. **Every phase is a usable product.** If everything stopped after the phase, the family still has a working app.
3. **Content before cleverness.** A reviewed project beats a new feature.
4. **Front-load what lasts without AI:** docs, tests, content as data, task files.
5. **Stay inside the constraints:** private, phone and tablet, free tier, $20 per month, English and Traditional Chinese, web runtime.
6. **The child steers.** After each phase, a playtest decides what comes next.
7. **No dates promised.** Effort depends on AI access and free time. Order matters, not calendar dates.

Priority tags: `FRONT-LOAD` (do while AI access is strongest), `MEDIUM` (soon after), `DEFER-OK` (a cheaper model or a human can do it).

---

## 3. Phases

### Phase 0 — Discovery · FRONT-LOAD

**Goal:** make the architecture real enough to trust, and make the next phases cheap to execute.

**Deliverables**
- Repo scaffold, CI, docs index and `CURRENT_STATE.md`.
- Core docs (this set) and the eight ADR files.
- Content schema, validator and compiler with the Build a Bridge pack loaded.
- Design tokens and base components.
- AI mentor prototype with the mock provider.
- Web runtime spike: the Junior bridge running on the real phone and tablet.
- Free-tier and passkey feasibility results.
- Threat model and AI provider checklist.
- Backlog for Phases 2 to 7.

**Exit criteria**
1. `pnpm check` is green in CI.
2. The Junior bridge runs at target frame rate on the real devices, or a documented fix exists.
3. Free-tier spike gives a clear go or no-go for passkeys, sync, storage and scheduled jobs.
4. The Build a Bridge pack validates and compiles for 3 stages and 2 languages.
5. The mentor pipeline works with live AI off.
6. The owner has reviewed the docs and decisions.

**Decision gate:** if the free tier or the web runtime fails, choose a fallback (small VPS, paid plan, simpler physics) **before** starting Phase 1.

**If AI access ends here:** the repo has all docs, schemas, content and tasks. A human or cheaper model can continue from `TASKS_PHASE_0_1.md`.

---

### Phase 1 — Private Family Alpha · FRONT-LOAD

**Goal:** one child can complete a full project, every week, in both languages, at their stage.

**Deliverables** (30 tasks live in `TASKS_PHASE_0_1.md`; Phase 1 is P1-01 to P1-20)
- Passkey login, family and child profiles, private deployment.
- App shell (Home, Explore, Create, Projects, Me), stage presets, English and Traditional Chinese, read-aloud.
- Project runner, Build a Bridge in three lanes, runtime features for all lanes.
- Hints (pre-written first), optional capped live help for Explorer and Maker, safety v0.
- Progress events with offline sync, skill and concept progress, portfolio.
- Parent overview and controls, export and delete, backups and restore, accessibility baseline.
- End-to-end tests for every stage and language.

**Exit criteria**
1. The child completes a full lane without help (or notes explain why not) on the real devices.
2. The child wants to try again or change the design.
3. The child explains what they built in their own words.
4. The parent understands the overview and trusts the controls.
5. Works offline and with live AI off.
6. Full end-to-end suite and safety evaluation pass. Native-speaker and owner reviews recorded.

**Decision gate:** playtest findings decide Phase 2 priorities (which project next, which stage needs more content). Decide whether to enable live help at all.

**If AI access ends here:** the family has a working, private learning app with one complete project and pre-written hints.

---

### Phase 2 — Project Engine · FRONT-LOAD (content)

**Goal:** make new projects cheap to author, and ship the next flagship projects.

**Deliverables**
- Reusable project templates, challenge and experiment types, assessment rubrics, project progression, interdisciplinary linking.
- Flagship projects in this order (owner may reorder after the playtest): **Mars Rover**, **Future City**, **Make Your First Game**, **Create a Song**, **Build a Robot**. Each as three lanes in two languages with hints, assessments, safety notes and parent notes.
- Content authoring workflow tools (validator improvements, bulk translation review checklists, a content status field: draft, reviewed, approved).

**Exit criteria:** at least three flagship projects playable, authored mostly as data with little new code, and reviewed. Authoring a new project takes a fraction of the effort of Build a Bridge.

**Note on creative projects:** Create a Song and Make Your First Game need creative tools (Phase 4). Until then, use embeddable free tools or simple built-in versions, following the reuse rule in `CREATEVERSE_BUILD_PLAN.md` section 7.

---

### Phase 3 — Experience Engine · MEDIUM

**Goal:** harden the runtime and make simulations reusable.

**Deliverables**
- Runtime hardening (scene, input, camera, audio, save and state, error handling).
- Simulation API: variables, constraints, rules, success and failure, assessment signals.
- Domain interface (`EXPERIENCE_RUNTIME.md` section 13) with the bridge domain plus one more (Mars Rover physics).
- Telemetry pipeline into the standard events.
- First reusable STEM lab generating several difficulty levels from one spec.

**Exit criteria:** one lab reused across difficulty levels from data only. Frame-rate targets met on the real devices. Still no game engine unless an ADR and owner approval say otherwise.

---

### Phase 4 — Creative Universe · MEDIUM

**Goal:** the child can make original things: art, music, animation, code, games.

**Deliverables (reuse first, build only the glue and the portfolio capture)**
- Art Studio (draw, shapes, layers, export to portfolio).
- Music Studio (rhythm, melody, simple composition).
- Coding Studio (blocks to text, guided debugging with the hint ladder).
- Game Creator (rules, characters, scenes, publish to the portfolio).
- Animation and a simple 3D builder.

**Exit criteria:** each studio produces a portfolio artifact, works offline where possible, respects stage presets and accessibility rules, and stays within storage limits.

**Security note:** user-created code runs in a sandboxed iframe (`SECURITY.md` section 8).

---

### Phase 5 — Advanced STEM · DEFER-OK

**Goal:** depth in more subjects as the child grows.

**Deliverables:** robotics, electronics, advanced physics, chemistry, biology, astronomy as content packs plus simulations. Real-world extensions stay `low` risk unless a deliberate safety review says otherwise (`SAFETY.md` section 3).

**Exit criteria:** content packs reviewed and approved, simulations meet performance targets, no `high` risk activities.

---

### Phase 6 — AI Learning Engine · DEFER-OK

**Goal:** the platform adapts to the child, with the child and parent in control.

**Deliverables:** skill-graph reasoning, difficulty adaptation, interest discovery, project recommendations, AI-generated project **drafts** (reviewed before use), research mode for older stages, parent summaries.

**Exit criteria:** recommendations beat the fixed path in real use (child engagement with learning, not time). Everything follows `AI_SPEC.md` rules: reviewed, capped, evaluated, parent-visible.

---

### Phase 7 — Persistent Universe · DEFER-OK

**Goal:** worlds and projects that persist and connect, if earlier phases prove their value.

**Deliverables:** persistent child-created worlds, interconnected projects, richer simulations, family experiences if appropriate, advanced portfolio. No exploitative monetization, ever.

**Exit criteria:** decided by the owner at that time. May never be needed.

---

## 4. Stages as the child grows

| When | What changes |
|---|---|
| Child moves from Junior to Explorer to Maker | Parent changes the stage. The lane, preset and mentor policy change. Progress and portfolio continue |
| Child outgrows Maker | Add the Creator stage (10 to 13) in Phase 4 or later: new presets, richer tools, deeper projects |
| Chinese phonetic aids | Decide Zhuyin or pinyin support after Phase 1 playtests |

Stages are not automatic promotions. A child can work in a higher lane for some projects with the parent's approval.

---

## 5. Cross-cutting tracks (every phase)

| Track | Always |
|---|---|
| Safety | Safety review of all content. Safety eval before each release |
| Security | Authorization tests, dependency audit, secret scan, restore drill before launches |
| Accessibility | Checked per phase on the real devices |
| Localization | Both languages complete. Native-speaker review per content batch |
| Privacy | Retention, export and delete verified. Legal review before any non-family use |
| Cost | Monitor AI spend and free-tier usage. Stay within $20 per month |
| Docs | `CURRENT_STATE.md`, changelog, ADRs updated at every task |
| Playtest | Real child, real devices, at the end of every phase (`TESTING.md` section 11) |

---

## 6. Decision gates and approvals

| Gate | Question | Who |
|---|---|---|
| After Phase 0 | Do the free tier and web runtime work, or do we need a fallback? | Owner |
| Before first deploy | Approve private deployment settings | Owner |
| Before live AI | Choose provider, model, caps. Review provider terms | Owner |
| Before any content reaches the child | Owner review and native-speaker review | Owner and reviewer |
| After Phase 1 | Which project and which gaps next? Enable live help? | Owner (with playtest) |
| Any new external service | Justify, price, privacy review | Owner |
| Any use beyond the family | Legal and privacy review first | Owner |

---

## 7. Risks to the roadmap

| Risk | Response |
|---|---|
| AI access ends mid-phase | Work is always in small tasks with task files. `CURRENT_STATE.md` says exactly where to resume. Prefer finishing a phase over starting a new one |
| Free-tier limits | Spike early (P0-09). Fallback plan in ADR-0003 |
| Child's interest shifts | Playtest every phase and let the child's choices guide the next project |
| Content volume | One project at a time, all lanes, before the next. Reuse tools. Bulk generate once, review, store as data |
| Scope creep | Exit criteria, approval boundaries, "Not now" list |
| Owner time | Keep review tasks small and clearly listed in `CURRENT_STATE.md` |

---

## 8. "Not now" list

Giant 3D worlds, multiplayer, social features, a marketplace, public launch, microservices, VR or AR first, an autonomous AI teacher, monetization, hundreds of subjects, a game engine, more than the planned AI agents.

Ideas that come up go in `docs/product/IDEAS.md` with a one-line note, not into the plan.

---

## 9. Changelog of this document

- v0.1: first draft aligned with the approved architecture, free-tier hosting, Traditional Chinese, three stages, and a $20 per month budget.
