# ADR-0007: Content as validated data in git

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15).
Date: 2026-10-06 (recorded from the approved architecture).

## Context

Content volume is multiplied by three stages and two languages. AI access may end, so content must survive as plain files a human or cheap model can edit. Nothing AI-generated may reach a child without review (SAFETY.md §13).

## Decision

- All learning content lives in `content/` as JSON files in git: graph nodes, projects, steps, hint ladders, assessments, experience specs, locale catalogs.
- Content is **validated in CI** (`packages/content-sdk`): schemas (Zod), graph references, lane coverage, hint-ladder completeness, and `en` + `zh-Hant` key completeness. Invalid content fails the build.
- Content ids and versions are stable; learner data stores `(content_id, version)` references, never copies.
- Approval is recorded in the content's `status` field: `draft → reviewed → approved`.

## Alternatives considered

- **Content in the database or a CMS** — rejected: review history is git history; agents and humans can diff, revert and audit for free; no extra service to secure or pay for.
- **Markdown with front matter only** — rejected: structured entities (ladders, specs, graphs) need schemas; JSON validates directly.

## Consequences

- `pnpm content:validate` is a merge gate; every `*_key` must exist in both locales.
- Editing content never silently corrupts history: old progress keeps pointing at its recorded version (DATA_MODEL.md §9).
- Publishing to the child still requires the human reviews — validation only proves structure, not quality or safety.
