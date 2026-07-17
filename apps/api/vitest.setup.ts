// Vitest setup file for @noufex/api.
//
// Loaded before every test file. Responsibilities:
//   1. Load .env from the repo root so `lib/shared.ts` (which
//      reads DATABASE_URL at module-load time) never throws
//      "DATABASE_URL is not set".
//   2. Mock the `pg` module globally so tests don't need a real
//      PostgreSQL running locally or in CI. The mock honours the
//      two queries the test suite actually uses:
//        - SELECT 1 AS ok                  (readiness probe)
//        - SELECT token_version, role ...  (auth lookup)
//      and returns empty arrays for everything else. Individual
//      tests can override the response for a specific SQL via
//      `globalThis.__pg_mock.setNextResponse(rows)`.
//
// We use `vi.mock('pg', ...)` instead of `pg-mem` or
// `testcontainers` because:
//   - It's the simplest possible approach: no extra dep, no
//     extra runtime overhead, and no flakiness from container
//     startup.
//   - Our tests assert ENVELOPE shape, not DB semantics. The
//     3 router tests that do need real-DB semantics (see
//     `tests/integration/`) are skipped by the unit test run.
//   - The fail-OPEN contract of every cache layer (Redis,
//     RabbitMQ, ES, Sentry) means DB-less tests are realistic:
//     in production, a PG outage would still serve cached reads.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

// ── pg mock ────────────────────────────────────────────────────────
// Per-test fixture shape: a list of "queries" the pool will
// match against, in order. Each entry says "if the SQL starts
// with this prefix, return this result". The default catches
// everything as an empty result set.
interface PgFixture {
	matchPrefix?: string;
	matchSqlIncludes?: string;
	result: { rows: Record<string, unknown>[]; rowCount: number };
}

interface PgMockState {
	fixtures: PgFixture[];
	defaultFixture: PgFixture;
}

declare global {
	// eslint-disable-next-line no-var
	var __pg_mock: PgMockState & {
		reset(): void;
		setNextResponse(rows: Record<string, unknown>[]): void;
	};
}

// Module-scope singleton so `vi.mock('pg', ...)` below can reach it.
const state: PgMockState & {
	reset(): void;
	setNextResponse(rows: Record<string, unknown>[]): void;
} = {
	fixtures: [],
	defaultFixture: { result: { rows: [], rowCount: 0 } },
	reset() {
		state.fixtures = [];
		state.defaultFixture = { result: { rows: [], rowCount: 0 } };
	},
	setNextResponse(rows) {
		state.fixtures.unshift({ result: { rows, rowCount: rows.length } });
	},
};

globalThis.__pg_mock = state;

function pickFixture(sql: string): PgFixture {
	for (const f of state.fixtures) {
		if (f.matchPrefix && sql.startsWith(f.matchPrefix)) return f;
		if (f.matchSqlIncludes && sql.includes(f.matchSqlIncludes)) return f;
	}
	const norm = sql.replace(/\s+/g, ' ');
	// Auth lookup: requireAuth needs a user row with role + version.
	if (norm.includes('FROM users WHERE id = $1 AND deleted_at IS NULL')) {
		return {
			result: {
				rows: [{ token_version: 0, role: 'admin' }],
				rowCount: 1,
			},
		};
	}
	// Count queries: handlers do `countRow.c` on the first row,
	// so we always return a row with `c: 0` so the route can read
	// the property safely.
	if (/SELECT\s+COUNT\(\*\)/i.test(norm)) {
		return { result: { rows: [{ c: 0 }], rowCount: 1 } };
	}
	// Rate-limiter PL/pgSQL: returns `(allowed, retry_after_ms)`.
	// Always allow + no retry-after so the middleware reaches
	// the "happy path" branch and emits the RateLimit-* headers.
	if (norm.includes('FROM consume_rate_limit($1, $2, $3, $4)')) {
		return {
			result: { rows: [{ allowed: true, retry_after_ms: 0 }], rowCount: 1 },
		};
	}
	// Generic SELECT ... FROM ... queries: return an empty array
	// so list endpoints produce empty results instead of throwing.
	return state.defaultFixture;
}

vi.mock('pg', () => {
	class MockPool {
		// Mirrors the pg.Pool public surface that PgDb reads in
		// production. The numeric counters are zero so
		// `getPoolStats()` returns a plausible shape.
		totalCount = 0;
		idleCount = 0;
		waitingCount = 0;
		async query(sql: string, _params?: unknown[]) {
			return pickFixture(sql).result;
		}
		async connect() {
			return {
				query: async (sql: string, params?: unknown[]) =>
					pickFixture(sql).result,
				release() {
					// no-op
				},
			};
		}
		async end() {
			// no-op
		}
		on() {
			// no-op (event emitter surface)
			return this;
		}
		once() {
			return this;
		}
		removeListener() {
			return this;
		}
	}
	return {
		Pool: MockPool,
		Client: MockPool,
		default: { Pool: MockPool, Client: MockPool },
	};
});

// ── Redis mock ────────────────────────────────────────────────────
// Same fail-OPEN pattern. The Redis helper (`getRedis()`) returns
// null when REDIS_URL is unset, so the mock only needs to ensure
// `redis` and `ioredis` imports don't try to connect. The
// `lib/redis.ts` getter checks `process.env.REDIS_URL` and
// short-circuits when missing — no actual redis server is needed.

vi.mock('ioredis', () => {
	class MockRedis {
		async get() {
			return null;
		}
		async set() {
			return 'OK';
		}
		async del() {
			return 0;
		}
		async pttl() {
			return -1;
		}
		async pexpire() {
			return 1;
		}
		async ping() {
			return 'PONG';
		}
		multi() {
			return {
				incr: () => this.multi(),
				pttl: () => this.multi(),
				exec: async () => [
					[null, 1],
					[null, -1],
				],
			};
		}
		scanStream() {
			return {
				async *[Symbol.asyncIterator]() {
					// yield nothing
				},
				destroy() {
					// no-op
				},
			};
		}
		on() {
			return this;
		}
		off() {
			return this;
		}
		once() {
			return this;
		}
		removeListener() {
			return this;
		}
		async quit() {
			// no-op
		}
		async disconnect() {
			// no-op
		}
	}
	return { default: MockRedis, Redis: MockRedis };
});

// ── Elasticsearch mock ───────────────────────────────────────────
// The ES client (`@elastic/elasticsearch`) is lazy — it doesn't
// connect until the first API call. When `ELASTICSEARCH_URL` is
// unset, `lib/elasticsearch.ts:getEs()` returns null. Combined
// with `vi.mock`, the Client class below is never used, so we
// don't need to mock every method.

vi.mock('@elastic/elasticsearch', () => {
	return {
		Client: class MockClient {
			async ping() {
				throw new Error('mock: no ES connection');
			}
			async indices() {
				throw new Error('mock: no ES connection');
			}
		},
	};
});

// ── amqplib mock ─────────────────────────────────────────────────
// Same pattern — `lib/queue.ts` checks RABBITMQ_URL and returns
// null when missing, so the mock only needs to not crash on
// module-load.

vi.mock('amqplib', () => {
	return {
		connect: async () => {
			throw new Error('mock: no broker connection');
		},
	};
});

// ── OpenTelemetry SDK (kept real — no need to mock the SDK itself,
// but suppress its console-diag spam so test output stays clean) ──

// ── Sentry ─────────────────────────────────────────────────────────
// No network in tests. The SDK is initialised lazily; with
// SENTRY_DSN unset the init() call is a no-op. We don't mock
// @sentry/node because the public surface is fully consumed by
// `lib/sentry.ts` which already no-ops on missing DSN.

// Per-test cleanup ─────────────────────────────────────────────────
//
// Tests that drive `requireAuth` rely on the mock returning an
// empty result set (which the auth helper treats as "user
// deleted"). To pin that to a specific shape, individual tests
// can call `globalThis.__pg_mock.setNextResponse(rows)` BEFORE
// the request. We don't auto-reset between tests because some
// tests explicitly set fixtures in `beforeEach`.

// Note: vitest's `afterEach` is registered globally via the
// `test.afterEach` callback below — it clears any fixtures a
// previous test might have left behind.
import { afterEach as _afterEach } from 'vitest';
_afterEach(() => {
	globalThis.__pg_mock?.reset();
});