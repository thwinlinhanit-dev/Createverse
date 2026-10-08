import { randomBytes, randomUUID } from "node:crypto";

/**
 * Prefixed UUIDv7 identifiers (API_SPEC §1): `u_`, `f_`, `c_`, `d_`, `s_`,
 * `e_` (audit), `r_` (request), `ch_` (challenge), `sk_` (setup secret),
 * `k_` (passkey credential ids keep their WebAuthn base64url id instead).
 *
 * UUIDv7 = 48-bit unix-ms timestamp + version/variant bits + randomness, so
 * ids sort by creation time (useful for cursor pagination later).
 */
function uuidv7(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  const timeHex = nowMs.toString(16).padStart(12, "0");
  bytes[0] = Number.parseInt(timeHex.slice(0, 2), 16);
  bytes[1] = Number.parseInt(timeHex.slice(2, 4), 16);
  bytes[2] = Number.parseInt(timeHex.slice(4, 6), 16);
  bytes[3] = Number.parseInt(timeHex.slice(6, 8), 16);
  bytes[4] = Number.parseInt(timeHex.slice(8, 10), 16);
  bytes[5] = Number.parseInt(timeHex.slice(10, 12), 16);
  bytes[6] = 0x70 | (bytes[6]! & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8]! & 0x3f); // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${uuidv7()}`;
}

export const ids = {
  family: () => newId("f"),
  user: () => newId("u"),
  child: () => newId("c"),
  device: () => newId("d"),
  session: () => newId("s"),
  audit: () => newId("e"),
  request: () => newId("r"),
  challenge: () => newId("ch"),
  setupSecret: () => newId("sk"),
};

/** Opaque 256-bit token (session / device credential). Raw value shown once. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export { randomUUID as newUuid };
