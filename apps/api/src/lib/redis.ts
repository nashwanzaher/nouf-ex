/**
 * Redis client wrapper.
 *
 * Phase 1 of the Noufex platform upgrade (competitive-architecture-analysis).
 * Provides a single, lazy-initialised ioredis connection that is shared by
 * every other lib (cache, queue, session, pubsub). The client is created
 * on first use, not at module-load time, so the absence of REDIS_URL
 * does not crash the API.
 *
 * Failure mode (fail-OPEN):
 *   - If REDIS_URL is missing, the connection is never created. All
 *     downstream callers see `null` and gracefully fall back to direct
 *     DB access. This is the same fail-OPEN principle already used in
 *     `lib/settings.ts` and `lib/ratelimit.ts`.
 *   - If the connection drops mid-flight, commands reject with an
 *     `Error`; the cache layer catches and treats them as cache misses
 *     so the user-facing endpoint is never blocked by a Redis outage.
 *
 * Connection strategy:
 *   - `lazyConnect: true` so we don't block the event loop on boot.
 *   - `enableReadyCheck: true` + `maxRetriesPerRequest: 2` to fail fast
 *     instead of hanging on a dead broker (default 20 retries = 1+ s
 *     latency on every cache miss during a Redis outage).
 *   - `retryStrategy` with exponential backoff capped at 5 s — recovers
 *     automatically when the broker comes back without flooding it.
 *   - `keyPrefix: 'noufex:'` so multiple apps can share a single Redis
 *     instance without colliding.
 */
import Redis, { type Redis as RedisClient, type RedisOptions } from 'ioredis';
import { log } from './shared.ts';

const DEFAULT_KEY_PREFIX = 'noufex:';
const DEFAULT_MAX_RETRIES_PER_REQUEST = 2;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

let _client: RedisClient | null = null;
let _disabled = false;

function readConfig(): { url: string; opts: RedisOptions } | null {
	const url = process.env.REDIS_URL?.trim();
	if (!url) return null;
	const opts: RedisOptions = {
		keyPrefix: process.env.REDIS_KEY_PREFIX || DEFAULT_KEY_PREFIX,
		lazyConnect: true,
		enableReadyCheck: true,
		maxRetriesPerRequest: Number.parseInt(
			process.env.REDIS_MAX_RETRIES || String(DEFAULT_MAX_RETRIES_PER_REQUEST),
			10,
		),
		connectTimeout: Number.parseInt(
			process.env.REDIS_CONNECT_TIMEOUT_MS || String(DEFAULT_CONNECT_TIMEOUT_MS),
			10,
		),
		retryStrategy: (times: number) => {
			// Exponential backoff: 50ms, 100ms, 200ms, 400ms, … capped at 5s.
			const delay = Math.min(50 * 2 ** Math.min(times, 7), 5_000);
			return delay;
		},
		reconnectOnError: (err: Error) => {
			// Reconnect on transient READONLY errors (failover). Don't
			// reconnect on logic errors (NOAUTH, WRONGTYPE).
			const msg = err.message;
			if (msg.includes('READONLY')) return true;
			return false;
		},
	};
	return { url, opts };
}

export function isRedisEnabled(): boolean {
	return readConfig() !== null && !_disabled;
}

export function getRedis(): RedisClient | null {
	if (_disabled) return null;
	if (_client) return _client;
	const cfg = readConfig();
	if (!cfg) return null;
	const { url, opts } = cfg;
	try {
		_client = new Redis(url, opts);
		_client.on('error', (err: Error) => {
			// Don't flood the log on every reconnect — ioredis already
			// throttles connection retries. We log only the first error
			// and the recovery event.
			log.warn({ msg: 'redis_error', error: err.message });
		});
		_client.on('ready', () => {
			log.info({ msg: 'redis_ready', url: redactUrl(url) });
		});
		_client.on('end', () => {
			log.warn({ msg: 'redis_connection_closed' });
		});
		return _client;
	} catch (err) {
		log.warn({
			msg: 'redis_init_failed',
			error: (err as Error).message,
		});
		_disabled = true;
		return null;
	}
}

/** Block until Redis is ready (or timeout). Used by health-checks and
 *  tests. Returns `true` on ready, `false` on timeout / disabled. */
export async function waitForRedis(timeoutMs = 2_000): Promise<boolean> {
	const client = getRedis();
	if (!client) return false;
	if (client.status === 'ready') return true;
	return new Promise<boolean>((resolve) => {
		const t = setTimeout(() => resolve(false), timeoutMs);
		const onReady = () => {
			clearTimeout(t);
			client.off('error', onError);
			resolve(true);
		};
		const onError = () => {
			// keep waiting; retryStrategy will keep trying
		};
		client.once('ready', onReady);
		client.on('error', onError);
	});
}

export async function closeRedis(): Promise<void> {
	if (!_client) return;
	try {
		await _client.quit();
	} catch {
		// already closed or never connected
	}
	_client = null;
}

export function redisStatus(): {
	enabled: boolean;
	connected: boolean;
	status: string;
	prefix: string;
} {
	return {
		enabled: isRedisEnabled(),
		connected: _client?.status === 'ready',
		status: _client?.status ?? 'uninitialised',
		prefix: process.env.REDIS_KEY_PREFIX || DEFAULT_KEY_PREFIX,
	};
}

function redactUrl(url: string | undefined): string {
	if (!url) return '(none)';
	try {
		const u = new URL(url);
		if (u.password) u.password = '***';
		return u.toString();
	} catch {
		return '(invalid-url)';
	}
}

export type { RedisClient };
