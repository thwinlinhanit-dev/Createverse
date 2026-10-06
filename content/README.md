# content/ — CREATEVERSE learning content

**Status: DRAFT. Nothing here may reach the child yet.** Every unit needs owner review AND a native Traditional Chinese review before it is shown (SAFETY.md §13). `pnpm content:validate` enforces structure, graph references, lane coverage and locale completeness; it cannot replace those reviews.

## Layout (DATA_MODEL.md §2, ARCHITECTURE.md §7)

```text
content/
├─ graph/{concepts,skills,interests}.json   versioned graph nodes
├─ projects/*.project.json                  one project object per file (lanes per stage)
├─ activities/steps.json                    array of lane steps
├─ hints/ladders.json                       pre-written hint ladders (levels 1–4 minimum)
├─ assessments/assessments.json             evidence signals and mastery rules
├─ experiences/experiences.json             experience specs per stage (EXPERIENCE_RUNTIME.md §3)
└─ locales/{en,zh-Hant}.json                flat key → message maps
```

## Rules enforced by `pnpm content:validate`

1. Every record validates against the Zod schemas in `packages/shared-types` (invalid content fails CI).
2. Every referenced id exists: concept prerequisites, step concepts/skills, hint ladders, assessments, experience refs, project lanes, interests, objectives.
3. Every project has a lane for each configured stage (junior, explorer, maker), and each lane's experience matches its stage.
4. Every step has a hint ladder with sequential levels 1–4.
5. `risk_class: "high"` is blocked for children (SAFETY.md §3).
6. Every `*_key` message (and every `reflection_prompts` entry) exists in BOTH `en` and `zh-Hant`, non-empty.

## Review status

| Item | Status |
|---|---|
| Build a Bridge — structure and schemas | Validated by CI |
| English wording | Draft, owner review pending |
| Traditional Chinese wording | Draft, native-speaker review pending (SAFETY.md §13 decision 3) |
| Publishing to the child | Blocked until both reviews pass and `status` becomes `approved` |

The `safety.*` fallback keys used by `ai-core` (`safety.ask_grownup`, `safety.private_info`, ...) belong to the app's UI catalog (task P1-02), not to this content pack.

Lane step counts here are a **skeleton** (2 steps per lane). Task P1-15 expands each lane to the full Build a Bridge project.
