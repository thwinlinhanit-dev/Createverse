/**
 * P0-09 free-tier spike benchmark (docs/architecture/FREE_TIER_SPIKE.md).
 *
 * Measures the CPU/wall cost of the three operations the API must fit inside
 * the Workers Free plan's 10 ms CPU-per-invocation budget:
 *
 *   (a) WebAuthn assertion verification — @simplewebauthn/server v14, the
 *       library we would ship for passkey login (P1-01),
 *   (b) 50-event idempotent batch insert — the shape of POST /sync/events
 *       (API_SPEC §1, ARCHITECTURE §6), one transaction like D1 db.batch(),
 *   (c) sync read — indexed cursor read of one child's events.
 *
 * Storage: node:sqlite (same SQLite semantics as D1; D1 adds network +
 * durable-replication wall time on top of this CPU cost — see the doc).
 *
 * Run: node scripts/free-tier-bench.mjs   (prints JSON)
 */
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { cpus, platform, arch, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

// ---------------------------------------------------------------- helpers

function base64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    n: sorted.length,
    meanMs: Number(mean.toFixed(4)),
    medianMs: Number(at(0.5).toFixed(4)),
    p95Ms: Number(at(0.95).toFixed(4)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(4)),
  };
}

/** Measure wall samples per op plus aggregate CPU per op over the same loop. */
async function bench(iterations, op) {
  await op(-1); // warm-up (ops must tolerate a negative index)
  const wall = [];
  const cpuBefore = process.cpuUsage();
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    await op(i);
    wall.push(performance.now() - t0);
  }
  const totalWall = performance.now() - start;
  const cpu = process.cpuUsage(cpuBefore);
  const cpuPerOpMs = (cpu.user + cpu.system) / 1000 / iterations;
  return {
    ...stats(wall),
    cpuMeanMs: Number(cpuPerOpMs.toFixed(4)),
    throughputPerSec: Number((iterations / (totalWall / 1000)).toFixed(0)),
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

// ------------------------------------------------- (a) WebAuthn verification

function makeAssertion() {
  const rpID = "createverse.example";
  const origin = `https://${rpID}`;
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  // Extract x/y to build the COSE public key a registration would have stored.
  const jwk = publicKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");
  // COSE_Key for EC2/P-256/ES256:
  //   {1: 2, 3: -7, -1: 1, -2: x, -3: y} — hand-encoded CBOR.
  const cosePublicKey = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    Buffer.from([0x22, 0x58, 0x20]),
    y,
  ]);

  const challenge = base64url(randomBytes(32));
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: "webauthn.get",
      challenge,
      origin,
      crossOrigin: false,
    }),
    "utf8",
  );
  const rpIdHash = createHash("sha256").update(rpID).digest();
  const flags = Buffer.from([0x05]); // UP | UV
  const signCount = Buffer.alloc(4); // 0
  const authenticatorData = Buffer.concat([rpIdHash, flags, signCount]);

  const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
  const signedBytes = Buffer.concat([authenticatorData, clientDataHash]);
  const signature = sign("sha256", signedBytes, privateKey); // DER, as WebAuthn expects

  const credentialId = base64url(Buffer.from("credential-id-00000000000000000001", "utf8"));

  return {
    challenge,
    origin,
    rpID,
    response: {
      id: credentialId,
      rawId: credentialId,
      type: "public-key",
      response: {
        clientDataJSON: base64url(clientDataJSON),
        authenticatorData: base64url(authenticatorData),
        signature: base64url(signature),
        userHandle: null,
      },
    },
    credential: {
      id: credentialId,
      publicKey: new Uint8Array(cosePublicKey),
      counter: 0,
    },
  };
}

async function benchWebAuthn() {
  const { challenge, origin, rpID, response, credential } = makeAssertion();
  const verifyOnce = () =>
    verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential,
      requireUserVerification: true,
    });
  const first = await verifyOnce();
  assert(first.verificationError === undefined, `verification must pass: ${first.verificationError}`);
  const result = await bench(200, verifyOnce);
  return { ...result, verified: first.verified === undefined ? true : first.verified };
}

// --------------------------------------------- (b) idempotent batch insert

function setupDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE progress_events (
      event_id   TEXT PRIMARY KEY,
      family_id  TEXT NOT NULL,
      child_id   TEXT NOT NULL,
      type       TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_events_child_time ON progress_events (child_id, created_at, event_id);
  `);
  return db;
}

const EVENT_TYPES = [
  "child.project.started",
  "child.activity.completed",
  "child.hint.requested",
  "child.step.completed",
];

function makeBatch(batchIndex, count = 50) {
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const n = batchIndex * count + i;
    events.push({
      event_id: `evt-${String(n).padStart(9, "0")}`,
      family_id: "fam-0001",
      child_id: "child-0001",
      type: EVENT_TYPES[((n % EVENT_TYPES.length) + EVENT_TYPES.length) % EVENT_TYPES.length],
      payload: JSON.stringify({ step: `step.bridge.${(n % 6) + 1}`, attempt: (n % 3) + 1 }),
      created_at: 1_770_000_000_000 + n * 250,
    });
  }
  return events;
}

function insertBatch(db, events) {
  // One transaction per batch = D1's db.batch(); ON CONFLICT DO NOTHING =
  // idempotent by event_id (API_SPEC §1: retries never duplicate rows).
  const stmt = db.prepare(
    `INSERT INTO progress_events (event_id, family_id, child_id, type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id) DO NOTHING`,
  );
  db.exec("BEGIN");
  let inserted = 0;
  try {
    for (const e of events) {
      const r = stmt.run(e.event_id, e.family_id, e.child_id, e.type, e.payload, e.created_at);
      inserted += Number(r.changes);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return inserted;
}

async function benchInserts() {
  const db = setupDb();
  const ITER = 100;
  const result = await bench(ITER, (i) => {
    const inserted = insertBatch(db, makeBatch(i));
    assert(inserted === 50, `batch ${i} inserted ${inserted}, expected 50`);
  });

  // Idempotency: replay the exact same batch → zero new rows, still fast.
  const replay = makeBatch(ITER - 1);
  const replayResult = await bench(50, () => {
    const inserted = insertBatch(db, replay);
    assert(inserted === 0, `duplicate batch must insert 0 rows, got ${inserted}`);
  });
  const total = db
    .prepare("SELECT COUNT(*) AS n FROM progress_events")
    .get().n;
  // +50 for the warm-up batch (event ids for batch -1).
  assert(Number(total) === (ITER + 1) * 50, `expected ${(ITER + 1) * 50} rows, got ${total}`);
  db.close();
  return { firstWrite: result, duplicateReplay: replayResult, rowsInTable: Number(total) };
}

// ----------------------------------------------------------- (c) sync read

async function benchSyncRead() {
  const db = setupDb();
  const insert = db.prepare(
    `INSERT INTO progress_events (event_id, family_id, child_id, type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  db.exec("BEGIN");
  for (const e of makeBatch(0, 5000)) {
    insert.run(e.event_id, e.family_id, e.child_id, e.type, e.payload, e.created_at);
  }
  db.exec("COMMIT");

  const read = db.prepare(
    `SELECT event_id, type, payload, created_at
     FROM progress_events
     WHERE child_id = ? AND created_at > ?
     ORDER BY created_at, event_id
     LIMIT 200`,
  );
  let rows = 0;
  const result = await bench(200, (i) => {
    const got = read.all("child-0001", 1_770_000_000_000 + i * 10);
    rows = got.length;
  });
  assert(rows > 0, "sync read must return rows");
  const plan = db
    .prepare("EXPLAIN QUERY PLAN SELECT event_id FROM progress_events WHERE child_id = ? ORDER BY created_at")
    .all("child-0001")
    .map((r) => r.detail)
    .join(" | ");
  db.close();
  return { ...result, sampleRows: rows, queryPlan: plan };
}

// ------------------------------------------------------------------- main

const webauthn = await benchWebAuthn();
const inserts = await benchInserts();
const syncRead = await benchSyncRead();

const report = {
  meta: {
    when: new Date().toISOString(),
    platform: `${platform()} ${arch()}`,
    cpu: cpus()[0]?.model ?? "unknown",
    cores: cpus().length,
    memoryGb: Number((totalmem() / 1024 ** 3).toFixed(1)),
    node: process.version,
  },
  webauthnAssertionVerify: webauthn,
  insertBatch50: inserts,
  syncRead,
};

console.log(JSON.stringify(report, null, 2));
