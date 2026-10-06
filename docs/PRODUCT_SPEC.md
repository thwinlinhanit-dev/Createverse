# PRODUCT_SPEC.md — CREATEVERSE

Status: **Draft v0.1 for owner review**
Read with: Master Spec v1.0 (vision), `ARCHITECTURE.md`, `SAFETY.md`, `DESIGN_SYSTEM.md`, `ROADMAP.md`

This document says **what** CREATEVERSE is and does. How it is built is in `ARCHITECTURE.md`. Where the Master Spec and this document differ, the Master Spec's philosophy wins and this document's scope decisions (private, phone and tablet, free tier, web only) win for implementation.

---

## 1. Product statement

CREATEVERSE is a **private, long-term learning platform for one family's child**. It is not a lesson app. It is a personal Learning Operating System where **projects, experiments, creation and curiosity** are the learning loop.

> Teach the child how to learn, think, create, investigate and build independently.

It optimizes for agency, curiosity, understanding and creation, **never** for time spent in the app.

---

## 2. Scope and constraints

| Item | Decision |
|---|---|
| Users | One family: parent(s) and child profile(s). No public users |
| Devices | Phone and tablet. Installable web app (PWA). Offline-capable |
| Languages | English and Traditional Chinese (`zh-Hant`), both first-class |
| Stages in Phase 1 | Junior (about 3 to 5), Explorer (about 6 to 8), Maker (about 8 to 10) |
| Later stages | Creator (10 to 13), Inventor (13 to 16), Researcher (16+) |
| Running cost | $20 per month total. Free-tier hosting. Live AI is optional and capped |
| AI | Optional layer. Pre-written hints are the default. Junior has no live AI chat |
| Experiences | Web runtime (canvas, physics library). No game engine |
| Privacy | Private use only. No public sign-up. Data minimized. Parent-controlled |

Age is never the only signal. The parent sets the child's stage, and content follows the stage.

---

## 3. Principles (from the Master Spec, applied)

1. **Projects over lessons.** Lessons support projects. A project is the unit of learning.
2. **Creation over consumption.** The child frequently produces something: a design, a song, a program.
3. **AI is a mentor, not an answer machine.** Ask, hint, smaller hint, demonstrate, explain. The child does the work.
4. **Age-adaptive.** Interface, language and complexity change with the stage (presets, lanes).
5. **Human-designed foundation.** Curriculum and projects are authored and reviewed. AI personalizes and drafts. Nothing AI-generated reaches the child unreviewed.
6. **Safety and privacy first.** See `SAFETY.md` and `SECURITY.md`.
7. **Build incrementally.** Every phase ends with something usable that works without more AI help.
8. **No engagement tricks.** No streaks, points, countdown pressure or variable rewards. Progress is learning evidence and portfolio work.

---

## 4. The core loop

```text
Curiosity → Question → Explore → Learn → Experiment → Create → Test
→ Fail safely → Improve → Explain → Publish to portfolio → New curiosity
```

**The MVP loop (what Phase 1 must prove):**

```text
Child opens profile → Explore → chooses a project → learns a concept
→ experiments in the simulation → builds → mentor helps with hints
→ completes the challenge → reflects → portfolio entry
```

If this loop works beautifully, in both languages and at all three stages, the platform has a foundation.

---

## 5. Users and their needs

**Child (Junior, 3 to 5)**
- Needs: pictures, sound, big targets, no reading, a grown-up nearby, quick feedback, safe failure.
- The app speaks prompts aloud, uses icons, and offers pre-written hints only.

**Child (Explorer, 6 to 8)**
- Needs: short text, guided experiments, simple challenges, a sense of ownership of what they build.
- Short hints, limited help chat tied to the current step (if the parent allows).

**Child (Maker, 8 to 10)**
- Needs: real constraints (budget, materials), measurement, trade-offs, explanation of why.
- Fuller text, test log, force view, optional help chat tied to the project.

**Parent / guardian**
- Needs: see learning (not screen time), control safety and time, review the portfolio, trust the AI, export or delete data, minimal setup work.

**Owner**
- The parent who approves content, decisions and spending, and who is the human in the loop for AI agents.

---

## 6. Experience structure

**Child navigation:** Home, Explore, Create, Projects, Me.

| Area | Purpose | Phase 1 content |
|---|---|---|
| Home | Greeting, continue project, today's challenge, recent creations | Calm and uncluttered. Not a dashboard |
| Explore | Discover projects for the child's stage | Build a Bridge |
| Create | The child's creations and shortcuts to start | Portfolio artifacts. Free creation tools arrive in Phase 4 |
| Projects | Current and finished projects | Project runner |
| Me | The child's portfolio, skills they are growing, interests | Portfolio and a simple "what I can do" view. No levels or points |

**Parent navigation:** Overview, Progress, Learning Plan, Projects, Portfolio, Safety, Settings. In Phase 1: Overview, Progress, Portfolio, Safety, Settings. Learning Plan arrives with the AI learning engine (Phase 6).

---

## 7. Functional requirements (Phase 1)

IDs are stable and referenced from tasks and tests.

### Accounts and family
- **FR-01** A parent creates the family and logs in with a passkey. Recovery codes exist.
- **FR-02** A parent creates and edits child profiles (nickname, stage, language, optional birth year).
- **FR-03** Parents register and revoke devices. Children cannot self-register.
- **FR-04** The app is not publicly reachable for sign-up. New adults join by invitation only.

### Learning
- **FR-10** The child sees projects for their stage and language.
- **FR-11** A project runs as a lane of steps (intro, learn, activity, experiment, challenge, reflection) with story and mission.
- **FR-12** Experiment steps run an interactive simulation with limits set by the content.
- **FR-13** Progress is saved after every action, works offline, and resumes where the child stopped.
- **FR-14** Failure is shown as information. No penalties.
- **FR-15** Optional real-world extensions require an adult and are low risk only.

### Mentor
- **FR-20** The child can ask for help and gets the next pre-written hint, one level at a time.
- **FR-21** Explorer and Maker can use optional live help limited to the current step or project, if the parent allows. Junior never.
- **FR-22** The mentor never gives the final answer early, keeps secrets, or acts as a friend (see `SAFETY.md`).
- **FR-23** Parents can read all AI conversations. The child is told so in simple words.
- **FR-24** A family kill switch turns off live AI instantly.

### Creation and portfolio
- **FR-30** Finishing a project creates a portfolio entry with the final design, the test log, and the child's reflection.
- **FR-31** Parents and children can view the portfolio. Parents can delete entries.

### Parent
- **FR-40** The overview shows concepts learned, skills developing, projects completed, interests, struggles and suggested next experiences. Time in the app is not the headline.
- **FR-41** Parents set daily time limits, quiet hours, allowed risk class, project approval, AI on or off, read-aloud.
- **FR-42** Parents see safety events in plain language.

### Language and accessibility
- **FR-50** Every string exists in English and Traditional Chinese. The child's language is set per profile.
- **FR-51** Junior prompts can be read aloud on the device.
- **FR-52** The app meets the accessibility rules in `DESIGN_SYSTEM.md`.

### Privacy and data
- **FR-60** Parents can export a child's data and delete a child's data or the whole family's data.
- **FR-61** Encrypted backups to a parent-controlled location, with a tested restore.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Offline | The shell, the current project and its hints work with no connection. Sync resumes later without data loss |
| Performance | Targets in `ARCHITECTURE.md` section 13. Experiences at 60 fps target, 30 fps floor on the real devices |
| Cost | Total running cost within $20 per month. A hard spending cap protects the AI budget |
| Security | `SECURITY.md` |
| Safety | `SAFETY.md` |
| Accessibility | WCAG AA contrast, scalable text, reduced motion, large targets, no color-only cues |
| Maintainability | Plain stack, small modules, tests and docs as the handover (`AGENT_OPERATING_RULES.md`) |
| Resilience | Everything important works with live AI off |

---

## 9. Content model (summary)

- **Project** → lanes per stage → **steps** → hint ladders, assessments, experiences, extensions.
- Content is data in git, validated at build, versioned, and translated by key.
- Every unit lists objective, concepts, skills, stage, difficulty, activity, challenge, reflection, assessment, safety notes, parent notes, and a **pre-written hint ladder**.
- Flagship project order: Build a Bridge, Mars Rover, Future City, Make Your First Game, Create a Song, Build a Robot. Only Build a Bridge is in Phase 1.

Details: `DATA_MODEL.md` section 2 and `BUILD_A_BRIDGE_CONTENT.md`.

---

## 10. Learning graphs (kept simple at first)

Knowledge, Skill, Interest and Project graphs exist as **tags and prerequisites in content files**. Phase 1 derives concept levels (0 unseen to 4 explained) and skill evidence from events. Graph reasoning, adaptive difficulty and recommendations come in Phase 6.

---

## 11. Success measures

**Primary (learning):** learning progression, project completion quality, demonstrated understanding, ability to explain concepts, creation quality, iteration behavior, curiosity, skill development.

**Secondary:** session frequency, retention, feature adoption. Used only to find usability problems.

**Never optimize:** daily screen time.

**Phase 1 success test (real child, real devices):**
1. The child completes a full project lane for their stage without help, or the notes explain exactly why not.
2. The child wants to try again or change the design.
3. The child can say, in their own words, what they built and why.
4. The parent understands the overview and trusts the controls.
5. The app works offline and in both languages.
6. Everything above also works with live AI turned off.

---

## 12. Non-goals (now)

Giant 3D worlds, multiplayer, social features, a marketplace, public launch, microservices, VR/AR, an autonomous AI teacher, monetization, hundreds of lessons, a game engine.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Too much content for three stages and two languages | One project at a time, all lanes, before the next |
| AI access ends | Pre-written hints, docs, tests, task files (see `ROADMAP.md`) |
| Child loses interest | Playtest at every phase. Let the child's choices steer the next project |
| Free-tier limits hit | Spike in P0-09, fallback plan in ADR-0003 |
| Chinese text quality | Native-speaker review per content batch (`SAFETY.md` section 13) |
| Scope creep | Phase exit criteria, approval boundaries |

---

## 14. Open questions for the owner

1. Which project should come second after Build a Bridge, once the child has played it?
2. Zhuyin or pinyin support in the future, and when?
3. Whether a second guardian account is needed in Phase 1.
4. Whether the portfolio should ever be shareable with relatives (default: no, family only).
