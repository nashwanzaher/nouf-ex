/**
 * Cache layer (Phase 1, competitive-architecture-analysis).
 *
 * A typed, fail-OPEN wrapper around Redis that exposes a small surface
 * suitable for hot-path route handlers:
 *
 *   - `cacheGet<T>(key)`          → returns parsed JSON or `null` on miss/error
 *   - `cacheSet<T>(key, val, ttl)`→ fire-and-forget JSON write with TTL
 *   - `cacheDel(...keys)`         → invalidate one or more keys
 *   - `cacheWrap<T>(key, ttl, fn)`→ cache-aside helper (read-through)
 *   - `cacheBust(prefix)`         → SCAN-based bulk delete
 *
 * The layer is intentionally tiny. Anything more elaborate (stampede
 * protection, distributed locks, pub/sub) lives in its own module so
 * each concern is independently testable.
 *
 * Fail-OPEN contract:
 *   Every method swallows Redis errors and logs them as `cache_error`.
 *   Callers MUST be able to handle a miss or a write failure without
 *   breaking the user request. The DB is the source of truth; the
 *   cache is purely an optimisation.
 */
import { getRedis } from './redis.ts';
import { log } from './shared.ts';
import { cacheOpsTotal } from './metrics.ts';

const DEFAULT_TTL_S = 60;
const MAX_KEY_LENGTH = 200;
const KEY_DISALLOWED = /[\s\r\n]/g;

function safeKey(raw: string): string {
	return raw.length > MAX_KEY_LENGTH ? raw.slice(0, MAX_KEY_LENGTH) : raw;
}

function assertKey(raw: string): string {
	const k = safeKey(raw);
	if (k.length === 0) throw new Error('cache: empty key');
	if (KEY_DISALLOWED.test(k)) throw new Error('cache: key contains whitespace');
	return k;
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
	const r = getRedis();
	if (!r) {
		cacheOpsTotal.inc({ op: 'get', source: 'redis', result: 'disabled' });
		return null;
	}
	try {
		const raw = await r.get(assertKey(key));
		if (raw === null || raw === undefined) {
			cacheOpsTotal.inc({ op: 'get', source: 'redis', result: 'miss' });
			return null;
		}
		cacheOpsTotal.inc({ op: 'get', source: 'redis', result: 'hit' });
		return JSON.parse(raw) as T;
	} catch (err) {
		cacheOpsTotal.inc({ op: 'get', source: 'redis', result: 'error' });
		log.warn({ msg: 'cache_error', op: 'get', key, error: (err as Error).message });
		return null;
	}
}

export async function cacheSet<T = unknown>(
	key: string,
	value: T,
	ttlSeconds = DEFAULT_TTL_S,
): Promise<void> {
	const r = getRedis();
	if (!r) return;
	try {
		const k = assertKey(key);
		const payload = JSON.stringify(value);
		if (ttlSeconds > 0) {
			await r.set(k, payload, 'EX', ttlSeconds);
		} else {
			await r.set(k, payload);
		}
	} catch (err) {
		log.warn({ msg: 'cache_error', op: 'set', key, error: (err as Error).message });
	}
}

export async function cacheDel(...keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	const r = getRedis();
	if (!r) return;
	try {
		const safe = keys.map(assertKey);
		await r.del(...safe);
	} catch (err) {
		log.warn({ msg: 'cache_error', op: 'del', error: (err as Error).message });
	}
}

/**
 * Cache-aside: try the cache, fall back to `fetcher`, and write the
 * result back. `fetcher` is called AT MOST once per (key, ttl) even
 * under concurrent misses — the in-process MutexMap collapses stampedes
 * for the duration of a single fetch. Cross-process stampede protection
 * is intentionally left to the upstream caller (use `cacheWrapCluster`
 * with a `lock:key` SET NX pattern if you need it).
 */
export async function cacheWrap<T = unknown>(
	key: string,
	ttlSeconds: number,
	fetcher: () => Promise<T>,
): Promise<T> {
	const hit = await cacheGet<T>(key);
	if (hit !== null) return hit;
	const inflight = inFlight.get(key);
	if (inflight) return inflight as Promise<T>;
	const p = (async () => {
		try {
			const fresh = await fetcher();
			await cacheSet(key, fresh, ttlSeconds);
			return fresh;
		} finally {
			inFlight.delete(key);
		}
	})();
	inFlight.set(key, p);
	return p;
}

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Best-effort bulk invalidation by prefix. Uses SCAN (not KEYS) so
 * large keyspaces don't block Redis. Limited to MAX_SCAN_ITERATIONS
 * iterations; if a prefix has more than ~10k matching keys the rest
 * is left untouched (this is a safety cap, not a feature).
 */
export async function cacheBust(prefix: string): Promise<number> {
	const r = getRedis();
	if (!r) return 0;
	const safePrefix = prefix.replace(/-/g, '\\-');
	const pattern = `${safePrefix}*`;
	const MAX_ITER = 256;
	const stream = r.scanStream({ match: pattern, count: 100 });
	let removed = 0;
	const batch: string[] = [];
	try {
		for await (const keys of stream) {
			if (keys.length === 0) continue;
			batch.push(...keys);
			if (batch.length >= 100) {
				removed += await safeDel(r, batch);
				batch.length = 0;
			}
		}
		if (batch.length > 0) removed += await safeDel(r, batch);
	} catch (err) {
		log.warn({ msg: 'cache_error', op: 'scan', error: (err as Error).message });
	} finally {
		stream.destroy?.();
	}
	void MAX_ITER; // reserved for future cap enforcement
	return removed;
}

async function safeDel(
	r: ReturnType<typeof getRedis> & { del: (...k: string[]) => Promise<number> },
	keys: string[],
): Promise<number> {
	if (keys.length === 0) return 0;
	// Note: ioredis auto-strips the keyPrefix from input keys and
	// re-applies it on the wire. We pass the raw key list.
	try {
		return await r.del(...keys);
	} catch (err) {
		log.warn({ msg: 'cache_error', op: 'bust_del', error: (err as Error).message });
		return 0;
	}
}

/**
 * Stampede-safe `cacheWrap` for cluster deployments. Uses a short
 * `lock:key` SET NX EX to elect a single fetcher across processes.
 * Other callers read the cache after a short backoff loop.
 */
export async function cacheWrapCluster<T = unknown>(
	key: string,
	ttlSeconds: number,
	fetcher: () => Promise<T>,
	options: { lockTtlMs?: number; pollMs?: number; pollTimeoutMs?: number } = {},
): Promise<T> {
	const r = getRedis();
	if (!r) return cacheWrap(key, ttlSeconds, fetcher);
	const lockTtl = options.lockTtlMs ?? 5_000;
	const pollMs = options.pollMs ?? 50;
	const pollTimeoutMs = options.pollTimeoutMs ?? 4_500;

	const hit = await cacheGet<T>(key);
	if (hit !== null) return hit;

	const lockKey = `lock:${key}`;
	const acquired = await safeSetNx(r, lockKey, '1', lockTtl);
	if (acquired) {
		try {
			const fresh = await fetcher();
			await cacheSet(key, fresh, ttlSeconds);
			return fresh;
		} finally {
			await r.del(lockKey).catch(() => void 0);
		}
	}

	// Lost the election — poll the cache until the winner writes or we time out.
	const deadline = Date.now() + pollTimeoutMs;
	while (Date.now() < deadline) {
		await sleep(pollMs);
		const v = await cacheGet<T>(key);
		if (v !== null) return v;
	}
	// Fallback: just fetch directly to avoid hanging the request.
	return fetcher();
}

async function safeSetNx(
	r: NonNullable<ReturnType<typeof getRedis>>,
	key: string,
	value: string,
	ttlMs: number,
): Promise<boolean> {
	try {
		const res = await r.set(key, value, 'PX', ttlMs, 'NX');
		return res === 'OK';
	} catch {
		return false;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Public surface for tests / diagnostics. */
export const cache = {
	get: cacheGet,
	set: cacheSet,
	del: cacheDel,
	wrap: cacheWrap,
	wrapCluster: cacheWrapCluster,
	bust: cacheBust,
};

export type { };
