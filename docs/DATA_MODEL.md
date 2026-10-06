# DATA_MODEL.md — CREATEVERSE

Status: **Approved v0.2** (aligned with approved ARCHITECTURE.md)
Read with: `ARCHITECTURE.md`, Master Spec sections 9, 12, 13, 17, 20, 21

---

## 1. Principles

1. **Content lives in git as files. Learner data lives in the database.** The database stores references `(content_id, content_version)`, not copies of content.
2. **Events are the source of truth for learning history.** Progress, skills and concepts are derived and can be rebuilt by replaying events.
3. All ids are UUIDv7 strings with a type prefix (`c_`, `p_`, `e_`...). Timestamps are UTC ISO-8601 strings.
4. Every table that holds child data has `child_id` and, where useful, `family_id`, and every query is scoped by `family_id`.
5. Collect the minimum. No full birth date, no address, no photos of the child unless the parent adds an artifact.
6. Versioned and auditable: content graph changes are git commits. Learner data changes that matter go to `audit_log`.

---

## 2. Content entities (files in `content/`, not DB tables)

### 2.1 Graph nodes

```json
// content/graph/concepts.json (array)
{ "id": "concept.load", "version": 1, "name_key": "concept.load.name", "prerequisites": ["concept.force"], "tags": ["physics"] }

// content/graph/skills.json
{ "id": "skill.experimentation", "version": 1, "name_key": "skill.experimentation.name", "levels": 5 }

// content/graph/interests.json
{ "id": "interest.space", "version": 1, "name_key": "interest.space.name", "parent": null }
```

Edges are expressed inside content: `prerequisites`, `concepts[]`, `skills[]`, `interests[]` on units and projects. This gives the Knowledge, Skill, Interest and Project graphs without a graph database.

### 2.2 Project

```json
{
  "id": "project.bridge",
  "version": 1,
  "title_key": "project.bridge.title",
  "story_key": "project.bridge.story",
  "mission_key": "project.bridge.mission",
  "interests": ["interest.engineering"],
  "lanes": {
    "junior":   { "age_range": [3, 5],  "steps": ["step.bridge.j1", "step.bridge.j2"], "experience": "exp.bridge.j" },
    "explorer": { "age_range": [6, 8],  "steps": ["step.bridge.e1", "step.bridge.e2", "step.bridge.e3"], "experience": "exp.bridge.e" },
    "maker":    { "age_range": [8, 10], "steps": ["step.bridge.m1", "step.bridge.m2", "step.bridge.m3", "step.bridge.m4"], "experience": "exp.bridge.m" }
  },
  "learning_objectives": ["concept.load", "concept.structure"],
  "required_skills": ["skill.experimentation"],
  "materials": [],
  "reflection_prompts": ["reflection.what_worked", "reflection.would_change"],
  "portfolio_artifact": { "kind": "experiment_result" },
  "safety": { "risk_class": "low", "notes_key": "project.bridge.safety" }
}
```

### 2.3 Step / Activity (a lane step)

```json
{
  "id": "step.bridge.e2",
  "version": 1,
  "type": "experiment",              // intro | learn | activity | experiment | challenge | reflection
  "prompt_key": "step.bridge.e2.prompt",
  "audio_key": "step.bridge.e2.audio",
  "concepts": ["concept.load"],
  "skills": ["skill.experimentation"],
  "experience_ref": "exp.bridge.e",
  "hint_ladder": "hints.bridge.e2",
  "assessment": "assess.bridge.e2",
  "extensions": [],
  "parent_notes_key": "step.bridge.e2.parent"
}
```

### 2.4 Hint ladder (pre-generated, the offline-safe mentor)

```json
{
  "id": "hints.bridge.e2",
  "version": 1,
  "levels": [
    { "level": 1, "type": "ask",          "text_key": "hints.bridge.e2.1" },
    { "level": 2, "type": "hint",         "text_key": "hints.bridge.e2.2" },
    { "level": 3, "type": "smaller_hint", "text_key": "hints.bridge.e2.3" },
    { "level": 4, "type": "demonstrate",  "text_key": "hints.bridge.e2.4" },
    { "level": 5, "type": "explain",      "text_key": "hints.bridge.e2.5" }
  ],
  "solution_allowed_after": 5
}
```

### 2.5 Assessment

```json
{
  "id": "assess.bridge.e2",
  "version": 1,
  "evidence": [
    { "signal": "experience.success", "skill": "skill.experimentation", "strength": 0.6 },
    { "signal": "iterations>=2",      "skill": "skill.experimentation", "strength": 0.3 },
    { "signal": "reflection.complete","concept": "concept.load",        "strength": 0.4 }
  ],
  "mastery_rule": "sum(strength) >= 1.0 over 2 attempts"
}
```

### 2.6 Experience spec (see Master Spec section 8)

Adds `experience_id`, `version`, `age_range`, `difficulty`, `learning_objectives`, `mission`, `constraints`, `assessment.success_conditions`, plus `seed` for determinism and `variables` for simulation parameters.

### 2.7 Content rules enforced by validation

- Every `*_key` exists in `en` and `zh-Hant`.
- Every step has a hint ladder with at least levels 1 to 4.
- Every project has a lane for each configured stage.
- Every referenced concept, skill and interest id exists.
- `risk_class` is one of `low`, `medium`, `high`. `high` is blocked for children.

---

## 3. Database schema (SQLite, via Drizzle)

Types shown as SQL for clarity. JSON columns store small validated JSON.

```sql
-- Identity and family
CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE users (               -- parents/guardians only
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,                  -- optional: passkeys are the primary login
  role TEXT NOT NULL CHECK (role IN ('owner','guardian')),
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE passkey_credentials (
  id TEXT PRIMARY KEY,                 -- credential id
  user_id TEXT NOT NULL REFERENCES users(id),
  public_key BLOB NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  label TEXT,
  created_at TEXT NOT NULL,
  last_sync_at TEXT,
  revoked_at TEXT
);

-- Children (profiles, not accounts)
CREATE TABLE children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  display_name TEXT NOT NULL,          -- nickname is fine
  avatar_key TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('junior','explorer','maker','creator','inventor','researcher')),
  birth_year INTEGER,                  -- optional, data minimization
  locale TEXT NOT NULL DEFAULT 'en',   -- 'en' | 'zh-Hant'
  ui_preset TEXT NOT NULL,             -- usually equals stage
  pin_hash TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE child_settings (
  child_id TEXT PRIMARY KEY REFERENCES children(id),
  daily_minutes_limit INTEGER,
  quiet_hours JSON,
  ai_mentor_enabled INTEGER NOT NULL DEFAULT 1,
  read_aloud_enabled INTEGER NOT NULL DEFAULT 1,
  project_approval_required INTEGER NOT NULL DEFAULT 0,
  allowed_risk_class TEXT NOT NULL DEFAULT 'low',
  updated_at TEXT NOT NULL
);

-- Source-of-truth event log (append only)
CREATE TABLE progress_events (
  event_id TEXT PRIMARY KEY,           -- client-generated UUIDv7, used for dedupe
  child_id TEXT NOT NULL REFERENCES children(id),
  device_id TEXT NOT NULL REFERENCES devices(id),
  type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  content_id TEXT,
  content_version INTEGER,
  payload JSON NOT NULL
);
CREATE INDEX idx_events_child_time ON progress_events(child_id, occurred_at);
CREATE INDEX idx_events_type ON progress_events(child_id, type);

-- Projects and attempts (derived, but stored for fast reads)
CREATE TABLE project_instances (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  project_id TEXT NOT NULL,
  content_version INTEGER NOT NULL,
  lane TEXT NOT NULL,                  -- stage lane used
  state TEXT NOT NULL CHECK (state IN ('not_started','in_progress','paused','completed','abandoned')),
  current_step_id TEXT,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE activity_attempts (
  id TEXT PRIMARY KEY,
  project_instance_id TEXT NOT NULL REFERENCES project_instances(id),
  step_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  outcome TEXT CHECK (outcome IN ('success','partial','failed','skipped')),
  hints_used INTEGER NOT NULL DEFAULT 0,
  iterations INTEGER NOT NULL DEFAULT 0
);

-- Learning state (derived from events)
CREATE TABLE skill_evidence (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  skill_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL REFERENCES progress_events(event_id),
  strength REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_skill_child ON skill_evidence(child_id, skill_id);

CREATE TABLE concept_progress (
  child_id TEXT NOT NULL REFERENCES children(id),
  concept_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,    -- 0 unseen, 1 seen, 2 practiced, 3 demonstrated, 4 explained
  evidence_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT,
  last_seen_at TEXT,
  PRIMARY KEY (child_id, concept_id)
);

CREATE TABLE interest_signals (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  interest_id TEXT NOT NULL,
  source_event_id TEXT REFERENCES progress_events(event_id),
  weight REAL NOT NULL,
  created_at TEXT NOT NULL
);

-- Creations
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  project_instance_id TEXT REFERENCES project_instances(id),
  kind TEXT NOT NULL,                  -- drawing | song | code | experiment_result | design | report | game | model
  mime TEXT NOT NULL,
  storage_key TEXT NOT NULL,           -- FileStore key
  size_bytes INTEGER NOT NULL,
  meta JSON,
  created_at TEXT NOT NULL
);

CREATE TABLE portfolio_entries (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  project_instance_id TEXT REFERENCES project_instances(id),
  title TEXT NOT NULL,
  stage_at_creation TEXT NOT NULL,
  skills JSON NOT NULL,                -- skill ids
  concepts JSON NOT NULL,              -- concept ids
  what_i_learned TEXT,
  what_i_would_improve TEXT,
  created_at TEXT NOT NULL
);

-- AI
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  step_id TEXT,
  started_at TEXT NOT NULL
);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
  role TEXT NOT NULL CHECK (role IN ('child','mentor')),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('precomputed','live','cache','fallback')),
  hint_level INTEGER,
  safety_status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL
);

CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,                   -- YYYY-MM-DD
  child_id TEXT REFERENCES children(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  cost_micro_usd INTEGER NOT NULL
);
CREATE INDEX idx_ai_usage_day ON ai_usage(day);

-- Safety and audit
CREATE TABLE safety_events (
  id TEXT PRIMARY KEY,
  child_id TEXT REFERENCES children(id),
  kind TEXT NOT NULL,                  -- input_blocked | output_blocked | risky_experiment | privacy | other
  severity TEXT NOT NULL CHECK (severity IN ('info','warn','high')),
  source TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  reviewed_by_parent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,            -- parent | system | child
  actor_id TEXT,
  action TEXT NOT NULL,                -- login, settings_change, export, delete, ...
  target_type TEXT,
  target_id TEXT,
  at TEXT NOT NULL,
  meta JSON
);
```

---

## 4. Event catalogue (v1)

| Type | Payload (key fields) | Derived effects |
|---|---|---|
| `child.project.started` | project_id, lane | creates project_instance |
| `child.activity.completed` | step_id, outcome, hints_used, iterations | attempt row, skill evidence |
| `child.experiment.executed` | experience_id, seed, params, result | iteration count, evidence |
| `child.artifact.created` | artifact_id, kind | artifact row |
| `child.reflection.submitted` | step_id, text_ref | evidence for explaining |
| `child.assessment.completed` | assessment_id, result | concept_progress update |
| `child.project.completed` | project_id | portfolio prompt |
| `child.skill.updated` | skill_id, delta | skill state |
| `child.interest.detected` | interest_id, weight | interest_signals |
| `ai.hint.requested` | step_id, level, source | usage and hint metrics |
| `ai.safety.flagged` | kind, severity | safety_events |
| `parent.settings.changed` | field | audit_log |

Each event carries the envelope in `ARCHITECTURE.md` section 6. Adding or changing an event type needs a `schema_version` bump and a migration note.

---

## 5. Derivation rules (learning state)

- **Concept level**: 0 unseen, 1 seen (intro/learn step done), 2 practiced (activity completed), 3 demonstrated (experiment or challenge success with evidence strength threshold met), 4 explained (reflection or explanation step completed). A level never drops. It only gets reinforced.
- **Skill level**: sum of recent evidence strengths with decay, mapped to the skill's configured levels.
- **Interest strength**: weighted count of project choices, voluntary extensions, and time-on-optional-activities. Never used to push engagement. Used only to suggest next projects.
- **Mastery**: defined per assessment (see 2.5). Mastery gates optional challenge unlocks, never basic access to content.
- Derivations are pure functions in `packages/learning-core`, with unit tests and deterministic fixtures.

---

## 6. Data classification and retention

| Data | Class | Retention | Notes |
|---|---|---|---|
| Parent email, passkey credentials, optional password hash | Sensitive | Until account deletion | Passkeys preferred. Any password hash uses a slow hash suited to the host |
| Child display name, stage, locale | Personal | Until child deletion | Nickname allowed |
| Birth year | Personal, optional | Until child deletion | Not required |
| Progress events | Personal | Until child deletion | Source of truth |
| Artifacts (files) | Personal | Until child deletion | Parent can delete individually |
| AI messages | Personal | Rolling, default 90 days, configurable | Parent can disable AI and clear history |
| AI usage (tokens, cost) | Operational | 13 months | No message text |
| Safety events | Sensitive | 12 months | Visible to parent |
| Audit log | Operational | 24 months | Immutable |

Rules:
- Do not send names, birth data, or free-text profile data to AI providers. Send stage, concept ids, and the child's current message only.
- Free-text fields entered by the child are treated as personal data.
- Retention periods above are proposals. Confirm them in the privacy review.

---

## 7. Export and deletion

**Export (per child):** one archive containing `profile.json`, `events.ndjson`, `portfolio.json`, `skills.json`, `concepts.json`, `ai_messages.json` (if retained), and all artifact files.

**Delete (per child):**
1. Parent confirms with password.
2. Soft delete (`children.deleted_at`), child hidden immediately.
3. After a short grace period (default 14 days), hard delete cascades: events, derived tables, artifacts and files, AI messages, safety events tied to the child.
4. Write an `audit_log` row without personal content.
5. Backups age out per the backup retention policy, which must be documented in `SECURITY.md`.

Deletion of a whole family follows the same flow for all children, then users and devices.

---

## 8. Invariants (tested)

1. Every row reachable from a child belongs to the same `family_id` as that child.
2. `progress_events` is append only. No updates, no deletes except via the deletion workflow.
3. Replaying all events for a child reproduces `skill_evidence`, `concept_progress` and `project_instances`.
4. A portfolio entry always points to an existing artifact.
5. A project instance's `lane` exists in the content version it references.
6. No AI message row exists for a child whose `ai_mentor_enabled` is 0 at that time.

---

## 9. Migration and versioning rules

- Schema migrations are forward-only, reviewed, and tested on a copy of real-shaped data.
- Incompatible schema changes need owner approval (Master Spec section 33).
- Content versions are immutable once a child has progress against them. Edits create a new version, and the app maps old progress forward by id.
- Event schema changes add fields only, or bump `schema_version` with a documented upgrader.
