# ADR-0002: Installable PWA for phone and tablet

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15).
Date: 2026-10-06 (recorded from the approved architecture).

## Context

The product is private family use only, on the family's existing phone and tablet. App stores bring review processes, accounts, fees and a maintenance surface that one owner cannot carry. The budget is $20 per month for everything that runs.

## Decision

Ship one installable web app (PWA): React + Vite, service worker for the offline shell and content bundles, touch-first layouts, installable on Android and iOS. Desktop is explicitly not a target (PRODUCT_SPEC.md §2).

## Alternatives considered

- **Native apps (Kotlin/Swift)** — rejected: store review, signing, two codebases, ongoing release burden.
- **Flutter** — rejected: a second toolchain agents must learn; web build adds complexity without removing the store requirement.
- **React Native** — rejected: same store burden plus a non-web runtime the experience stack cannot reuse.

## Consequences

- No store fees or review; deploys are a static-hosting push.
- Offline is a first-class requirement: service worker + IndexedDB local-first (ADR-0004).
- Some platform APIs (speech, storage quotas) vary by device — must be tested on the real phone and tablet (TESTING.md §11).
- iOS installability is less strict than Android; acceptable for private family use.
