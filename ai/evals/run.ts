import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RESULTS_DIR, RECORDED_DIR } from "./datasets.ts";
import { runEval, type EvalMode } from "./runner.ts";

/**
 * `pnpm ai:eval [-- --mode mock|recorded|live] [--record]`
 *
 * Exit 0: all cases pass. Exit 1: a case failed — a failing **must-pass**
 * safety case blocks the release (TESTING.md §7, SAFETY.md §10).
 * Summary (no personal data) is written to `ai/evals/results/summary.json`.
 */

function argValue(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

const mode = (argValue("--mode") ?? "mock") as EvalMode;
const record = process.argv.slice(2).includes("--record");

if (mode !== "mock" && mode !== "recorded") {
  // AI_SPEC.md §16: the live provider is an owner decision; Phase 1 has no live AI.
  console.error(
    `mode "${mode}" is unavailable: a live provider needs owner approval (AI_SPEC.md §16). ` +
      "Phase 1 runs mock and recorded modes only.",
  );
  process.exit(2);
}

const { summary, outcomes } = await runEval(mode);

if (record) {
  mkdirSync(RECORDED_DIR, { recursive: true });
  let seeded = 0;
  for (const o of outcomes) {
    if (o.providerOutput === undefined) continue;
    writeFileSync(path.join(RECORDED_DIR, `${o.id}.txt`), o.providerOutput, "utf8");
    seeded += 1;
  }
  console.info(`recorded outputs written: ${seeded} (ai/evals/recorded/)`);
}

mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(
  path.join(RESULTS_DIR, "summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
  "utf8",
);

console.info(
  `ai:eval mode=${summary.mode} — ${summary.passed}/${summary.total} passed, ` +
    `must-pass ${summary.mustPassTotal - summary.mustPassFailed}/${summary.mustPassTotal}`,
);
for (const [name, counts] of Object.entries(summary.byDataset)) {
  console.info(`  ${name}: ${counts.total - counts.failed}/${counts.total}`);
}
const blocking = summary.failures.filter((f) =>
  outcomes.find((o) => o.id === f.id)?.mustPass === true,
);
for (const f of blocking) {
  for (const line of f.failures) console.error(`FAIL ${f.id}: ${line}`);
}
const warnings = summary.failures.filter((f) => !blocking.includes(f));
for (const f of warnings) {
  for (const line of f.failures) console.warn(`warn ${f.id} (must-pass: no): ${line}`);
}

// TESTING.md §7: a failing must-pass case blocks the release; other failures warn.
process.exit(blocking.length > 0 ? 1 : 0);
