/**
 * DB-backed rate limiter, extracted from `shared.cts` as part of
 * the P0-1 god object refactor (Phase 4, 2026-07-04).
 *
 * The limiter is implemented as an Express middleware factory. It
 * calls the `consume_rate_limit(bucket, key, window_ms, max)`
 * PL/pgSQL function (database/migrations/0006) which is owned by
 * `noufex_owner` and exposed to `noufex_app` via `EXECUTE`. The
 * function performs an atomic `INSERT ... ON CONFLICT` against
 * `rate_limit_buckets` and returns `(allowed, retry_after_ms)`.
 *
 * Why DB-backed and not in-memory:
 *   - Multiple Express workers (PM2 cluster, k8s replicas) need a
 *     shared counter — in-memory would let an attacker bypass the
 *     limit by round-robin hits across workers.
 *   - The function is `SECURITY DEFINER` so even with the least-
 *     privilege app role we get atomic, transactional counting.
 *
 * Note on circular imports: this file imports `db` from
 * `./shared.cts`, but `shared.cts` only imports the `rateLimit`
 * and `authLimiter` NAMES from here (re-exports). The order is
 * safe because:
 *   1. Node CJS evaluates `shared.cts` top-down; the
 *      `export { ... } from './ratelimit.js'` triggers loading
 *      of `ratelimit.ts` *before* the `db` const is declared.
 *   2. However, by the time any route handler runs, the entire
 *      module graph has finished loading. `db` is then available
 *      to `rateLimit` via late binding (the `db` reference is
 *      dereferenced inside the returned async function, not at
 *      import time).
 *
 * If that ever stops being true, switch the import to a `require`
 * inside the function body.
 */
import { type NextFunction, type Request, type Response } from 'express';
import { db } from './shared.ts';

/**
 * Build a per-route, per-IP rate-limit middleware.
 *
 * @param windowMs Rolling window in milliseconds (e.g. 60_000 for 1 min).
 * @param max     Maximum requests per window per IP.
 * @param bucket  Logical bucket name used by `consume_rate_limit` so
 *                different endpoints can have independent quotas.
 * @returns An Express middleware that 429s on overflow.
 */
export function rateLimit(windowMs: number, max: number, bucket = 'global') {
	return async (req: Request, res: Response, next: NextFunction) => {
		const route = (req.route?.path as string | undefined) || req.path.split('?')[0];
		const ip = req.ip || req.socket.remoteAddress || 'anon';
		const key = `${bucket}:${req.method}:${route}:${ip}`;
		try {
			const row = (await db
				.prepare('SELECT allowed, retry_after_ms FROM consume_rate_limit($1, $2, $3, $4)')
				.get(bucket, key, windowMs, max)) as
				| { allowed: boolean; retry_after_ms: number }
				| undefined;
			if (!row) return next();
			if (!row.allowed) {
				res.setHeader('Retry-After', Math.ceil(row.retry_after_ms / 1000));
				// 429 with the standard error envelope. We deliberately
				// don't import sendError at module-load time because
				// that creates a tighter cycle with middleware.ts;
				// instead we import lazily to avoid it.
				const { sendError } = await import('./shared.ts');
				return sendError(res, 'Too many requests. Try again later.', 429, 'RATE_LIMITED');
			}
		} catch (err) {
			// Fail-OPEN on limiter outage: a transient DB hiccup
			// must not lock out legitimate users. We log a
			// structured warning so SREs can spot a sustained
			// outage in the logs.
			const { log } = await import('./shared.ts');
			log.warn({
				msg: 'rate_limit_db_error',
				bucket,
				route,
				error: (err as Error).message,
			});
		}
		next();
	};
}

/**
 * Pre-configured limiter for the auth surface. 20 hits per 15 minutes
 * per IP across `/api/auth/*`. Tight enough that online brute-force
 * attempts are blocked; loose enough that a forgotten-password flow
 * + a typo doesn't lock out a real user.
 */
export const authLimiter = rateLimit(15 * 60 * 1000, 20, 'auth');
