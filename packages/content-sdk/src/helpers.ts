import type { z } from "zod";
import type { Issue } from "./load.ts";

/** Shared validation helpers (kept small and pure for testability). */

export function parseArray<S extends z.ZodType>(
  schema: S,
  value: unknown,
  where: string,
  errors: Issue[],
): z.output<S>[] {
  if (!Array.isArray(value)) {
    errors.push({ where, message: "expected a JSON array" });
    return [];
  }
  const out: z.output<S>[] = [];
  value.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (result.success) {
      out.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          where: `${where}[${index}]`,
          message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        });
      }
    }
  });
  return out;
}

export function parseOne<S extends z.ZodType>(
  schema: S,
  value: unknown,
  where: string,
  errors: Issue[],
): z.output<S> | null {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    errors.push({
      where,
      message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    });
  }
  return null;
}

/** Collect ids, reporting duplicates. `getId` supports entities like experience_id. */
export function collectIds<T>(
  items: readonly T[],
  where: string,
  errors: Issue[],
  getId: (item: T) => string,
): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    const id = getId(item);
    if (ids.has(id)) {
      errors.push({ where, message: `duplicate id "${id}"` });
    }
    ids.add(id);
  }
  return ids;
}

export function requireRefs(
  refs: readonly string[],
  valid: ReadonlySet<string>,
  where: string,
  field: string,
  errors: Issue[],
): void {
  refs.forEach((ref, index) => {
    if (!valid.has(ref)) {
      errors.push({
        where: `${where}.${field}[${index}]`,
        message: `referenced id "${ref}" does not exist`,
      });
    }
  });
}

/**
 * Collect every message key: any `*_key` string property (DATA_MODEL.md §2.7) plus
 * `reflection_prompts` entries, which are keys without the suffix.
 */
export function collectMessageKeys(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMessageKeys(item, out);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [prop, child] of Object.entries(value)) {
    if (prop.endsWith("_key")) {
      if (typeof child === "string") out.add(child);
      continue;
    }
    if (prop === "reflection_prompts" && Array.isArray(child)) {
      for (const key of child) if (typeof key === "string") out.add(key);
      continue;
    }
    collectMessageKeys(child, out);
  }
}
