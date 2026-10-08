const CACHE = "createverse-shell-v2";
const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// P1-04: precache the compiled content bundles listed in
// /content/manifest.json (written by apps/app/scripts/gen-content.ts), so the
// current project keeps working offline after the first visit. Best effort:
// a missing manifest or bundle must not fail the install.
async function precacheContentBundles(cache) {
  try {
    const response = await fetch("/content/manifest.json", { cache: "no-cache" });
    if (!response.ok) return;
    const manifest = await response.json();
    const bundles = Array.isArray(manifest?.bundles) ? manifest.bundles : [];
    await Promise.allSettled(
      bundles
        .filter((url) => typeof url === "string" && url.startsWith("/content/"))
        .map(async (url) => {
          const res = await fetch(url, { cache: "no-cache" });
          if (res.ok) await cache.put(url, res);
        }),
    );
  } catch {
    // Offline on first install, or manifest not published yet: the runtime
    // loader fetches (and then caches) bundles on demand instead.
  }
}

// Install: precache the shell AND the assets its HTML references so the app
// opens offline on the FIRST revisit. Assets fetched before this worker
// controls the page would otherwise never enter the cache (P1-03 offline shell).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL_URLS);
      await precacheContentBundles(cache);

      // Best effort: parse the shell HTML for src/href references and cache
      // them too. Individual failures must not fail the whole install.
      const results = await Promise.allSettled(
        SHELL_URLS.map(async (url) => {
          const response = await fetch(url);
          if (!response.ok) return;
          const html = await response.text();
          const refs = html.matchAll(/(?:src|href)=["']([^"']+)["']/g);
          const urls = new Set();
          for (const match of refs) {
            const raw = match[1];
            if (!raw || raw.startsWith("#") || raw.startsWith("data:")) continue;
            const resolved = new URL(raw, self.location.origin);
            if (resolved.origin === self.location.origin) {
              urls.add(resolved.pathname);
            }
          }            await Promise.allSettled(
            [...urls].map(async (path) => {
              const res = await fetch(path, { cache: "no-cache" });
              if (!res.ok) return;
              // Store a copy without Vary: the shell is same-origin only, and a
              // stored `Vary: Origin` would make crossorigin script/style requests
              // miss the cache and fail offline.
              const headers = new Headers(res.headers);
              headers.delete("vary");
              await cache.put(path, new Response(await res.clone().arrayBuffer(), {
                status: res.status,
                statusText: res.statusText,
                headers,
              }));
            }),
          );
        }),
      );
      return results;
    }),
  );
  self.skipWaiting();
});

// Activate: keep only the current cache.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch: serve the shell from cache first, then fall back to the network.
// HTML is always revalidated in the background; other assets use cache-first.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then((cached) => {
        const fetchPromise = fetch(request).then(
          (response) => {
            // Update the cache with the fresh HTML if the network worked.
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          },
          () => cached,
        );
        return cached || fetchPromise;
      }),
    );
    return;
  }

  // Cache-first for static assets; stale-while-revalidate for CSS/JS/icons.
  // ignoreVary: same-origin shell only — see the install note on Vary: Origin.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      const networkPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkPromise;
    }),
  );
});
