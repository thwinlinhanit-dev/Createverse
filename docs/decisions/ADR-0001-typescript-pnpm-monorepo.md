# ADR-0001: TypeScript monorepo with pnpm

Status: **Accepted** — approved by the owner (see `docs/ARCHITECTURE.md` §14–15).
Date: 2026-10-06 (recorded from the approved architecture).

## Context

CREATEVERSE is built by AI agents and maintained, maybe, by one human. It needs shared types between client, API, content tools and learning logic; a plain stack with small modules; and a repo that is the only memory when AI access ends (AGENT_OPERATING_RULES.md §0). Agents need exactly two tools: Node and pnpm.

## Decision

Use TypeScript everywhere in a single pnpm-workspaces monorepo:

- `apps/` (PWA, admin CLI), `packages/` (shared logic), `backend/` (API modules), `content/` (data in git).
- pnpm strict node_modules, lockfile committed, `workspace:*` protocol for internal packages.
- TypeScript strict mode everywhere; Zod for runtime validation of external input.

## Alternatives considered

- **Multi-language repo** — rejected: handover and maintenance cost with no benefit at this scale; agents are strongest in TypeScript.
- **npm or yarn workspaces** — rejected: pnpm is faster, enforces dependency isolation (fewer phantom-dependency bugs), and its lockfile is easier to audit.
- **Single package (no workspaces)** — rejected: boundaries between learning logic, AI, content tooling and UI must be explicit and testable.

## Consequences

- One toolchain to install, one lockfile, one CI pipeline.
- Internal packages resolve via `workspace:*`; a package that imports undeclared deps fails fast.
- Strict TS + Zod means more upfront typing, far fewer runtime surprises.
- Changing this decision requires owner approval (AGENT_OPERATING_RULES.md §5).
