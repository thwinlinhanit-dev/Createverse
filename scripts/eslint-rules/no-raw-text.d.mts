/**
 * Types for no-raw-text.mjs — TypeScript resolves `./no-raw-text.mjs` to this
 * declaration. The rule implementation stays plain ESM JS so eslint.config.js
 * can load it without a build step.
 */
import type { TSESLint } from "typescript-eslint";

export declare const noRawText: TSESLint.Rule.RuleModule<"rawText", readonly []>;
export default noRawText;
