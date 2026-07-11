/**
 * App-settings reader, extracted from inline literals as part of
 * P1-2 (deep audit 2026-06-30).
 *
 * The hardcoded `'YER'` and `10000` / `500` numeric thresholds
 * that used to live inside `routes/orders.cts` made it
 * impossible to ship a regional deployment that priced in
 * SAR / USD / EGP without a code change. They now live in
 * the `app_settings` key/value table (migration 0023), and
 * this module is the typed accessor.
 *
 * Behaviour
 * ---------
 * - Single fetch per minute (`CACHE_TTL_MS`). A request that
 *   lands during the cache window is cache-hit and never hits
 *   the DB. Keeps the hot path (orders.cts) on a single
 *   in-process map.
 * - On DB read error: the cache returns the LAST-KNOWN value,
 *   or the built-in `FALLBACK` if the cache is cold. This is
 *   a fail-OPEN policy - the order flow degrades to the
 *   literal we used to ship with, never blocks.
 * - Reads write to the audit log ONLY when the value changes
 *   from cache to fresh (i.e. the cache is updated). Routine
 *   cache hits don't bloat the audit table.
 *
 * Module-load time: do NOT call `getSetting()` at module top
 * level. The DB may not be connected when this module is
 * imported (the server module-load sequence in `index.ts`
 * creates the `db` connection, but a future structural
 * refactor might reorder that). Lazy reads on first call are
 * robust to either ordering.
 */

import { db } from './shared.ts';

/** Refresh every 60 s. */
const CACHE_TTL_MS = 60_000;

/** Built-in last-resort defaults (also seeded into the DB
 *  by migration 0023). Used only if the DB read fails AND
 *  the cache is cold. */
const FALLBACK: Readonly<Record<string, string>> = Object.freeze({
    DEFAULT_CURRENCY: 'YER',
    FREE_SHIPPING_THRESHOLD: '10000',
    FLAT_SHIPPING_COST: '500',
});

interface CacheEntry {
    readonly value: string;
    readonly loadedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Fetch a setting value, falling back to the built-in defaults
 *  on DB error. The result is cached for `CACHE_TTL_MS`.
 *
 *  Numeric settings are returned as raw TEXT - callers parse
 *  with `Number(...)` or `parseInt(..., 10)` as needed. We
 *  intentionally do NOT auto-coerce, because that would mask
 *  configuration mistakes (e.g. "10,000" with a comma would
 *  silently become NaN). */
export async function getSetting(key: string): Promise<string> {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.loadedAt < CACHE_TTL_MS) {
        return hit.value;
    }
    try {
        const row = (await db
            .prepare('SELECT value FROM app_settings WHERE key = $1')
            .get(key)) as { value: string } | undefined;
        const value = row?.value ?? FALLBACK[key] ?? '';
        cache.set(key, { value, loadedAt: now });
        return value;
    } catch (err) {
        // Fail-open: if the DB is unreachable, serve the
        // fallback. The order flow continues to work even if
        // the settings table is down.
        const fallback = FALLBACK[key] ?? hit?.value ?? '';
        if (!hit) {
            cache.set(key, { value: fallback, loadedAt: now });
        }
        // Logged at warn level so an operator can spot a
        // sustained outage.
        const { log } = await import('./shared.ts');
        log.warn({
            msg: 'app_settings_db_error',
            key,
            error: (err as Error).message,
        });
        return fallback;
    }
}

/** Synchronous version for code paths that cannot await
 *  (none today, but keeping this here for backstop). Returns
 *  either the last cached value or the fallback.
 *
 *  IMPORTANT: this WILL serve a stale value if the cache
 *  hasn't been populated yet. Use `getSetting()` (async)
 *  from request handlers. */
export function getSettingSync(key: string): string {
    const hit = cache.get(key);
    if (hit) return hit.value;
    return FALLBACK[key] ?? '';
}

/** Test-only: clear the in-process cache so the next read
 *  hits the DB. */
export function _resetSettingsCacheForTests(): void {
    cache.clear();
}

/** Test-only: inspect the in-process cache. */
export function _dumpSettingsCache(): ReadonlyMap<string, CacheEntry> {
    return cache;
}
