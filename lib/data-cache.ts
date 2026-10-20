/**
 * Tiny in-memory record cache shared by the boot prefetcher and the screens.
 *
 * Tabs mount lazily, so fetching "earlier" only helps if the result survives until
 * the tab mounts — that is what this does. Records are stored raw (exactly what the
 * PocketBase query returns); screens keep their own mapping.
 */

type Entry = { data: unknown; at: number; ttl: number };

const DEFAULT_TTL_MS = 30_000;

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** Returns the cached value even when stale, so a screen can paint instantly and revalidate. */
export function readCache<T>(key: string): T | null {
  const entry = store.get(key);
  return entry ? (entry.data as T) : null;
}

export function isFresh(key: string): boolean {
  const entry = store.get(key);
  return !!entry && entry.at + entry.ttl > Date.now();
}

export function writeCache(key: string, data: unknown, ttl: number = DEFAULT_TTL_MS): void {
  store.set(key, { data, at: Date.now(), ttl });
}

/** Drops every entry whose key starts with the given prefix. `invalidate('cards:me')` etc. */
export function invalidate(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearCache(): void {
  store.clear();
  inflight.clear();
}

/**
 * Deduped, cached fetch. Concurrent callers for the same key share one network run —
 * this is what stops the boot prefetch and a mounting screen from double-fetching.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttl?: number; force?: boolean } = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL_MS, force = false } = opts;

  if (!force && isFresh(key)) {
    return readCache<T>(key) as T;
  }

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const run = (async () => {
    const data = await fetcher();
    writeCache(key, data, ttl);
    return data;
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}
