/**
 * The offline cache. It makes repeat visits load from the device and lets the app work offline.
 *
 * The site lives under a path of a shared origin (david-dovito.github.io/bible-cross-references/), so:
 * - the worker's scope is that path (browsers allow no wider scope for a worker served there), and
 *   it only ever handles requests under it;
 * - every cache it creates starts with `PREFIX`, and it only ever reads or deletes its own caches,
 *   never those of other sites on the origin.
 *
 * Strategies: the app's code and pages are cached per version and served from the cache
 * (pages network-first, so a new version shows up at once); the datasets are served from the cache
 * and refreshed in the background (stale-while-revalidate).
 */

declare const self: ServiceWorkerGlobalScope;

// Injected by the build (`offline()` in vite/offline.ts): paths relative to the worker's scope.
/** The app's pages. Without them there is no app offline, so they have to be stored. */
declare const PAGES: readonly string[];
/** This version's code, styles and icons. */
declare const FILES: readonly string[];
/** The datasets a first visit needs, cached across versions. */
declare const DATASETS: readonly string[];
/** Where all datasets live, so the ones loaded later (another translation) are cached too. */
declare const DATA_DIRECTORY: string;
/** A hash of this version's files; a new version gets new caches. */
declare const VERSION: string;

const PREFIX = 'bible-cross-references';
const SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const DATA_CACHE = `${PREFIX}-data`;

const scope = new URL(self.registration.scope);
// Cached files are the same whatever the request's headers (they are named by their content, or
// are datasets), so lookups ignore `Vary`: some hosts vary on `Origin`, which module scripts send
// and the worker's own requests don't.
const LOOKUP: CacheQueryOptions = { ignoreVary: true };
const toUrl = (path: string) => new URL(path, scope).href;
const datasetUrls = new Set(DATASETS.map(toUrl));
const dataPath = new URL(`${DATA_DIRECTORY}/`, scope).pathname;

/** Stores what it can, and says what it could not: one missing file is not worth an app that
 * never works offline. */
async function store(cache: Cache, urls: readonly string[]): Promise<void> {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      if (!(await cache.match(url, LOOKUP))) {
        await cache.add(url);
      }
    }),
  );
  const failed = results.filter((result) => result.status === 'rejected').length;
  if (failed > 0) {
    console.warn(`Offline cache: ${String(failed)} of ${String(urls.length)} files were skipped.`);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      // The pages first and on their own: everything else can be fetched again, they cannot.
      await shell.addAll(PAGES.map(toUrl));
      await store(shell, FILES.map(toUrl));
      // The page has just downloaded the datasets, so these usually come from the HTTP cache.
      await store(await caches.open(DATA_CACHE), [...datasetUrls]);
      await self.skipWaiting();
    })(),
  );
});

/**
 * The page tells the worker which datasets it is actually using, which is how a translation other
 * than the default one gets stored: on the visit it was chosen, the page had already fetched it
 * before this worker existed, so nothing else would ever put it here.
 */
self.addEventListener('message', (event) => {
  const message: unknown = event.data;
  if (
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== 'cache-datasets' ||
    !('paths' in message) ||
    !Array.isArray(message.paths)
  ) {
    return;
  }
  const urls = message.paths
    .filter((path): path is string => typeof path === 'string')
    .map(toUrl)
    .filter((url) => url.startsWith(new URL(`${DATA_DIRECTORY}/`, scope).href));
  event.waitUntil(
    (async () => {
      await store(await caches.open(DATA_CACHE), urls);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const oldShells = (await caches.keys()).filter(
        (name) => name.startsWith(`${PREFIX}-shell-`) && name !== SHELL_CACHE,
      );
      await Promise.all(oldShells.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname)
  ) {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith(dataPath)) {
    event.respondWith(dataset(event, request));
  } else {
    event.respondWith(file(request));
  }
});

/** Pages: the network first, so a new version shows at once; this version's copy offline. */
async function page(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const shell = await caches.open(SHELL_CACHE);
    // `?ref=…` only selects a passage: every passage of a page is the same file.
    const cached = await shell.match(request, { ...LOOKUP, ignoreSearch: true });
    return cached ?? Response.error();
  }
}

/** Datasets: the cached copy at once, refreshed in the background for the next visit. */
async function dataset(event: FetchEvent, request: Request): Promise<Response> {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request, LOOKUP);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

/**
 * The app's files: named by their content, so the cached copy is always right. One that is
 * missing — a download that failed while this version was installing — is stored as it is
 * fetched, instead of being absent offline until the next release.
 */
async function file(request: Request): Promise<Response> {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match(request, LOOKUP);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await shell.put(request, response.clone());
  }
  return response;
}
