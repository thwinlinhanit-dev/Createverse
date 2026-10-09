/**
 * Local API server (P1-14) — the Node entry that runs the same `createApp`
 * the Workers deploy serves (ADR-0003 deploys via wrangler; this wrapper only
 * exists so local development and Playwright can talk to a real HTTP API with
 * a real SQLite file).
 *
 * Usage:
 *   node backend/src/serve.ts            dev: var/dev.db, spec rate limits
 *   node backend/src/serve.ts --e2e      e2e: wipes the DB on start (a fresh
 *                                        family per run — bootstrap is
 *                                        single-use by spec), raises rate
 *                                        limits so parallel Playwright tests
 *                                        share one IP bucket, fixed secret
 * Env: CV_PORT (8787), CV_DB, CV_SETUP_SECRET, CV_ORIGIN, CV_RP_ID.
 *
 * The setup secret default is a local-dev convenience only: the server binds
 * 127.0.0.1 and bootstrap disables itself once a family exists.
 */
import { rmSync } from "node:fs";
import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { createApp } from "./api/app.ts";
import { openDb } from "./db/index.ts";

const e2e = process.argv.includes("--e2e");
const port = Number(process.env.CV_PORT ?? 8787);
const dbFile = process.env.CV_DB ?? (e2e ? "var/e2e.db" : "var/dev.db");
const setupSecret =
  process.env.CV_SETUP_SECRET ?? (e2e ? "e2e-setup-secret" : "createverse-dev-setup-secret");
const origin = process.env.CV_ORIGIN ?? "http://localhost:5173";
const rpID = process.env.CV_RP_ID ?? "localhost";

if (e2e) {
  // Fresh database per e2e run: /setup/bootstrap is single-use (API_SPEC §5.1),
  // so a rerun must start from an empty family table.
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbFile}${suffix}`, { force: true });
}

const db = openDb(dbFile);

const app = createApp({
  db,
  setupSecret,
  allowedOrigin: origin,
  webauthn: {
    rpName: "Createverse",
    rpID,
    // The e2e journey loads the app on the localhost origin (WebAuthn RP IDs
    // are hostnames, not IPs); 127.0.0.1 is accepted for the plain dev app.
    expectedOrigins: [origin, "http://127.0.0.1:5173"],
  },
  ...(e2e
    ? {
        limits: {
          auth: { kind: "auth" as const, max: 10_000, windowMs: 60_000 },
          session: { kind: "session" as const, max: 10_000, windowMs: 60_000 },
          device: { kind: "device" as const, max: 10_000, windowMs: 60_000 },
        },
      }
    : {}),
});

if (e2e) {
  // Test-only reset (TESTING.md §8 hygiene: "a test-only seeding path that
  // does not exist in production builds"). This route is mounted by serve.ts
  // only — `createApp` never registers it, so it cannot exist on the Workers
  // deploy. Playwright calls it before each ceremony so a retried test starts
  // from an empty family table (bootstrap is single-use by spec).
  app.post("/api/v1/e2e/reset", (c) => {
    // No LIKE patterns with backslashes here: cooked template strings turn
    // `\_` into `_`, which would match every table. `substr` keeps the intent
    // — skip sqlite internals and the drizzle migration journal — explicit.
    const tables = db.all<{ name: string }>(
      sql`select name from sqlite_master
          where type = 'table'
            and substr(name, 1, 1) != '_'
            and substr(name, 1, 7) != 'sqlite_'`,
    );
    // Order-independent wipe: FKs are enforced (openDb turns them on), and a
    // full reset legitimately deletes parents before children.
    db.run(sql`pragma foreign_keys = OFF`);
    try {
      for (const table of tables) db.run(sql`delete from "${sql.raw(table.name)}"`);
    } finally {
      db.run(sql`pragma foreign_keys = ON`);
    }
    return c.json({ ok: true, cleared: tables.length });
  });
}

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(
    `[api] http://127.0.0.1:${info.port} (db ${dbFile}${e2e ? ", e2e mode" : ""})`,
  );
});
