import {
  ContentBundleSchema,
  type ContentBundle,
  type Locale,
  type Stage,
} from "@createverse/shared-types";

export type { ContentBundle, Locale, Stage };

/**
 * P1-04 content loader: fetch a compiled bundle and re-validate it at load.
 *
 * Build time already rejects bad content (`gen-content.ts` fails the build),
 * but the app must also survive a corrupt or stale file at runtime (partial
 * deploy, bad service-worker cache entry): anything that fails validation is
 * refused with a typed error and the UI shows a calm fallback instead of a
 * half-loaded project (P1-04 acceptance: rejected at build AND at load).
 */

export type BundleLoadErrorKind =
  | "network"
  | "invalid-json"
  | "invalid-bundle"
  | "locale-stage-mismatch";

export class BundleLoadError extends Error {
  readonly kind: BundleLoadErrorKind;
  readonly detail: string;
  constructor(kind: BundleLoadErrorKind, detail: string) {
    super(`content bundle failed to load (${kind}): ${detail}`);
    this.name = "BundleLoadError";
    this.kind = kind;
    this.detail = detail;
  }
}

type FetchFn = (
  input: string,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** One bundle per (locale, stage); cached in memory for the session. */
const cache = new Map<string, ContentBundle>();

export function bundleUrl(locale: Locale, stage: Stage): string {
  return `/content/${locale}/${stage}.json`;
}

/** Test hook: drop the in-memory cache between cases. */
export function clearBundleCache(): void {
  cache.clear();
}

export async function loadBundle(
  locale: Locale,
  stage: Stage,
  fetchFn: FetchFn = fetch,
): Promise<ContentBundle> {
  const key = `${locale}/${stage}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetchFn(bundleUrl(locale, stage));
  } catch (err) {
    throw new BundleLoadError(
      "network",
      err instanceof Error ? err.message : String(err),
    );
  }
  if (!response.ok) {
    throw new BundleLoadError("network", `HTTP ${response.status}`);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw new BundleLoadError(
      "invalid-json",
      err instanceof Error ? err.message : String(err),
    );
  }

  const parsed = ContentBundleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first ? first.path.join(".") : "bundle";
    throw new BundleLoadError(
      "invalid-bundle",
      `${where}: ${first?.message ?? "schema mismatch"}`,
    );
  }
  if (parsed.data.locale !== locale || parsed.data.stage !== stage) {
    throw new BundleLoadError(
      "locale-stage-mismatch",
      `file holds ${parsed.data.locale}/${parsed.data.stage}, asked for ${key}`,
    );
  }
  cache.set(key, parsed.data);
  return parsed.data;
}
