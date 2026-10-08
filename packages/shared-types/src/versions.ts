/**
 * Content bundle format identity — the single source of truth shared by the
 * compiler (`packages/content-sdk`) and the runtime loader (`apps/app`).
 * Bumping the version without a documented upgrader needs owner approval
 * (AGENT_OPERATING_RULES.md §5: incompatible schema changes).
 */

export const BUNDLE_FORMAT = "createverse.content-bundle";
export const BUNDLE_SCHEMA_VERSION = 1;
