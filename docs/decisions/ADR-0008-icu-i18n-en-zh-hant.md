# ADR-0008: ICU message keys, English + Traditional Chinese from day one

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15).
Date: 2026-10-06 (recorded from the approved architecture).

## Context

Both languages are first-class from day one (owner-confirmed decision, BUILD_PLAN §12). Retrofitting localization multiplies cost and quality risk. Chinese script is Traditional (`zh-Hant`) — confirmed.

## Decision

- Every user-visible string is a key: `t("key")` in UI code, ICU message format in catalogs (`packages/i18n`), one catalog per locale (`en`, `zh-Hant`).
- Locale is per child with a parent default; no per-request `Accept-Language` logic (API_SPEC.md §1).
- Content strings follow the same rule (ADR-0007); the content validator fails the build on any missing key in either locale.
- A lint rule blocks raw strings in UI code (task P1-02).
- Read-aloud uses on-device speech synthesis first; recorded audio only if device voices prove poor (ARCHITECTURE.md §12).

## Alternatives considered

- **English first, translate later** — rejected: doubles content cost, and Junior content (spoken, icon-driven) must be bilingual from the first playtest.
- **Machine translation only** — rejected as the final word: an AI check may draft, but a native Traditional Chinese review is required per content batch (SAFETY.md §13 decision 3).
- **zh-Hans or mixed** — rejected: the family's variety is Traditional; recorded in `docs/product/LANGUAGE_STYLE.md` when written.

## Consequences

- Every content batch carries a native-speaker review cost — kept small by authoring one project at a time.
- Plurals and gender-free phrasing handled through ICU, not string concatenation.
- Phonetic aids (Zhuyin/pinyin) are undecided and out of Phase 1 scope (ARCHITECTURE.md §15).
