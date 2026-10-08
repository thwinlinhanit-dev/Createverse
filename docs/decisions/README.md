# docs/decisions — Architecture Decision Records

All eight ADRs below were **approved by the owner**; the summaries live in `docs/ARCHITECTURE.md` §14–15. These files are the full record. Changing any Accepted ADR requires owner approval (AGENT_OPERATING_RULES.md §5).

| ADR | Decision | File |
|---|---|---|
| 0001 | TypeScript pnpm monorepo | `ADR-0001-typescript-pnpm-monorepo.md` |
| 0002 | Installable PWA (phone + tablet) | `ADR-0002-installable-pwa.md` |
| 0003 | Hono + Drizzle + SQLite on Cloudflare free tier (portable) | `ADR-0003-hono-drizzle-sqlite-cloudflare.md` |
| 0004 | Local-first events with idempotent sync | `ADR-0004-local-first-idempotent-sync.md` |
| 0005 | AI provider interface + pre-written hints default (no live AI in Phase 1) | `ADR-0005-ai-provider-prewritten-hints.md` |
| 0006 | Web-only experience runtime, no game engine | `ADR-0006-web-experience-runtime.md` |
| 0007 | Content as validated data in git | `ADR-0007-content-as-data.md` |
| 0008 | ICU keys, `en` + `zh-Hant` from day one | `ADR-0008-icu-i18n-en-zh-hant.md` |

Template used: Context / Decision / Alternatives considered / Consequences / Status.
New ADRs: create `ADR-00XX-short-title.md` here and add a row to this table and to `ARCHITECTURE.md` §14.
