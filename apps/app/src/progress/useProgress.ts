import { useEffect, useState } from "react";
import type { ProgressEvent } from "@createverse/shared-types";
import {
  indexedDbBackend,
  memoryBackend,
  ProgressStore,
  type StorageBackend,
} from "./store.ts";

/**
 * On-device progress plumbing (P1-05/P1-08 client).
 *
 * One loaded `ProgressStore` per child profile, shared by every screen.
 * Storage is IndexedDB first (ADR-0004 local-first); environments without it
 * (jsdom tests, private-mode failure) fall back to memory so the UI never
 * crashes for lack of storage. `resetProgressStores()` isolates render tests.
 *
 * Sync: `syncNow()` pushes the outbox to `POST /api/v1/sync/events`. The
 * endpoint arrives with P1-08; until then the call 404s (or the device is
 * offline) and the outbox is retained untouched — sync is best-effort and
 * never blocks the child.
 */

const stores = new Map<string, { store: ProgressStore; ready: Promise<void> }>();

function defaultBackend(): StorageBackend {
  try {
    if (typeof indexedDB !== "undefined") return indexedDbBackend("createverse-progress");
  } catch {
    // Private mode / no storage: memory keeps the session working.
  }
  return memoryBackend();
}

export function resetProgressStores(): void {
  stores.clear();
}

export function getDeviceId(): string {
  const KEY = "cv:device:id";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = `d_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "d_ephemeral";
  }
}

export function getProgressStore(
  childId: string,
  backend: StorageBackend = defaultBackend(),
): { store: ProgressStore; ready: Promise<void> } {
  const key = `${childId}`;
  const cached = stores.get(key);
  if (cached) return cached;
  const store = new ProgressStore(childId, getDeviceId(), backend);
  const entry = { store, ready: store.load() };
  stores.set(key, entry);
  return entry;
}

export function useProgressStore(childId: string): {
  store: ProgressStore | null;
  ready: boolean;
} {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<ProgressStore | null>(null);
  useEffect(() => {
    let live = true;
    const entry = getProgressStore(childId);
    setStore(entry.store);
    entry.ready.then(
      () => {
        if (live) setReady(true);
      },
      () => {
        if (live) setReady(true);
      },
    );
    return () => {
      live = false;
    };
  }, [childId]);
  return { store, ready };
}

async function postSyncEvents(events: readonly ProgressEvent[]): Promise<readonly string[]> {
  const response = await fetch("/api/v1/sync/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
  });
  if (!response.ok) throw new Error(`sync HTTP ${response.status}`);
  const body = (await response.json()) as { stored?: unknown };
  return Array.isArray(body.stored)
    ? body.stored.filter((id): id is string => typeof id === "string")
    : [];
}

/** Best-effort push; safe to call before P1-08 builds the endpoint. */
export async function syncNow(
  store: ProgressStore,
): Promise<{ synced: number; pending: number }> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { synced: 0, pending: store.pendingEvents().length };
    }
    return await store.sync(postSyncEvents);
  } catch {
    return { synced: 0, pending: store.pendingEvents().length };
  }
}
