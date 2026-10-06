# CREATEVERSE

Private, long-term learning platform for one family's child. Projects, experiments, creation and curiosity are the learning loop — not lessons or screen time.

**Start here: [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)** then [`docs/INDEX.md`](docs/INDEX.md).

## Commands

```text
pnpm install            install dependencies
pnpm check              typecheck + lint + test + content validation
pnpm test               unit tests (Vitest)
pnpm content:validate   validate content/ against the schemas and both locales
pnpm dev                (app arrives with task P1-03)
```

## Constraints (approved)

- Private family use only. Phone and tablet. Installable PWA. No public sign-up.
- $20 per month total running cost. Cloudflare free tier. No game engine.
- English and Traditional Chinese (`zh-Hant`) from day one. Stages: Junior, Explorer, Maker.
- AI is optional and capped. Everything important works with live AI off, using pre-written hints.
- Child safety, privacy and security first: `docs/SAFETY.md`, `docs/SECURITY.md`.

## Rules for agents and humans

Read `docs/AGENT_OPERATING_RULES.md` before changing anything. One task = one small, testable change (`docs/TASKS_PHASE_0_1.md`). Never weaken `SAFETY.md` or `SECURITY.md`.
