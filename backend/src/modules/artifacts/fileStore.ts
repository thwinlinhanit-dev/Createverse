/**
 * P1-09 artifact file store — local filesystem implementation of the
 * DATA_MODEL "FileStore" (R2 remains pending owner approval; CURRENT_STATE
 * blocked list). SECURITY.md §6/T10: allowlisted types only, 2 MB cap,
 * files live outside the served tree and are streamed back through the API
 * with the stored (already allowlisted) content type, never executed.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Hard per-file cap (API_SPEC §4: artifact upload 2 MB per file). */
export const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

/**
 * Body cap for the upload route: base64 inflates 4/3, so a 2 MB file needs
 * ~2.7 MB of JSON — the generic 64 KB JSON cap (API_SPEC §4) is bypassed
 * here only, and the decoded size is still checked against MAX_ARTIFACT_BYTES.
 */
export const ARTIFACT_BODY_LIMIT = 3 * 1024 * 1024;

/**
 * Allowlist (SECURITY.md §6: "PNG, JPEG, WebP, SVG sanitized, MP3/WAV,
 * JSON, text — reject everything else"). Every value doubles as the stored
 * mime, and only values from this list are ever echoed as Content-Type.
 */
export const ARTIFACT_MIME_ALLOWLIST = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "audio/mpeg",
  "audio/wav",
  "application/json",
  "text/plain",
] as const;

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "application/json": "json",
  "text/plain": "txt",
};

export function isAllowlistedMime(mime: string): boolean {
  return (ARTIFACT_MIME_ALLOWLIST as readonly string[]).includes(mime);
}

export function extForMime(mime: string): string {
  return EXTENSIONS[mime] ?? "bin";
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Strict base64 decode: rejects malformed input (Buffer.from would silently
 * drop bad characters) and whitespace-padded tricks. Size policy is the
 * caller's job so it can answer 413 vs 400.
 */
export function decodeArtifactBase64(data: string): Buffer | null {
  const compact = data.replace(/\s+/g, "");
  if (compact.length === 0 || compact.length % 4 !== 0 || !BASE64_RE.test(compact)) return null;
  const bytes = Buffer.from(compact, "base64");
  // Round-trip check: Buffer.from is lenient, re-encoding must match.
  if (bytes.toString("base64") !== compact) return null;
  return bytes;
}

/**
 * SECURITY.md §6 "SVG sanitized": instead of patching untrusted markup, we
 * reject any SVG that could execute (script elements, event handler
 * attributes, javascript:/data: URLs, embedded foreign objects). Files are
 * additionally served as attachment + nosniff, so nothing renders inline
 * even if a novel vector slips past this scan.
 */
export function svgIsSafe(text: string): boolean {
  if (/<\s*script/i.test(text)) return false;
  if (/<\s*foreignobject/i.test(text)) return false;
  if (/\son[a-z]+\s*=/i.test(text)) return false;
  if (/javascript\s*:/i.test(text)) return false;
  if (/(?:xlink:)?href\s*=\s*["']?\s*(?:data|vbscript)\s*:/i.test(text)) return false;
  return true;
}

/** Storage keys are server-generated `uuid.ext`; anything else is refused. */
function safePath(dir: string, storageKey: string): string | null {
  if (!/^[A-Za-z0-9._-]+$/.test(storageKey) || storageKey.includes("..")) return null;
  return join(dir, storageKey);
}

export function saveArtifactFile(dir: string, storageKey: string, bytes: Buffer): void {
  const path = safePath(dir, storageKey);
  if (!path) throw new Error("invalid storage key");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, bytes);
}

export function readArtifactFile(dir: string, storageKey: string): Buffer | null {
  const path = safePath(dir, storageKey);
  if (!path || !existsSync(path)) return null;
  return readFileSync(path);
}

export function deleteArtifactFile(dir: string, storageKey: string): boolean {
  const path = safePath(dir, storageKey);
  if (!path || !existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
