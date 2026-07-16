/**
 * Prometheus metrics — Tier 2.1.
 *
 * Single registry for the API + worker process. Exposes:
 *   - HTTP request counters + latency histograms (per route + status)
 *   - DB pool gauges (idle / waiting / total)
 *   - Cache hit/miss counters (Redis, in-process)
 *   - Queue publish/consume counters
 *   - Worker job counters (success / failure / retry)
 *   - Search source gauge (elasticsearch vs postgresql)
 *   - Default process metrics (CPU, RSS, event loop lag) via
 *     `prom-client`'s `collectDefaultMetrics`.
 *
 * The `/api/metrics` endpoint exposes the registry in the
 * Prometheus exposition format. The endpoint is intentionally
 * NOT authenticated — it runs on the internal Docker network
 * only (see index.ts mount), and Prometheus scrapers expect an
 * unauthenticated /metrics path. If you need to expose it to
 * the internet, put a reverse proxy in front and authenticate
 * there.
 */
import client, { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
// `client` is imported as a side-effect for tree-shaking guards
// (so prom-client's default metrics collectors are bundled).
void client;

const registry = new Registry();
registry.setDefaultLabels({ app: 'noufex-api', version: process.env.APP_VERSION ?? 'dev' });

collectDefaultMetrics({ register: registry, prefix: 'noufex_' });

// ── HTTP ─────────────────────────────────────────────────────────────
export const httpRequestsTotal = new Counter({
	name: 'noufex_http_requests_total',
	help: 'Total HTTP requests processed, labelled by method, route, and status code.',
	labelNames: ['method', 'route', 'status'] as const,
	registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
	name: 'noufex_http_request_duration_seconds',
	help: 'HTTP request duration in seconds, labelled by method, route, and status.',
	labelNames: ['method', 'route', 'status'] as const,
	buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [registry],
});

// ── DB pool ──────────────────────────────────────────────────────────
export const dbPoolConnections = new Gauge({
	name: 'noufex_db_pool_connections',
	help: 'PostgreSQL pool size in use, labelled by state (idle/waiting/total).',
	labelNames: ['state'] as const,
	registers: [registry],
});

// ── Cache ────────────────────────────────────────────────────────────
export const cacheOpsTotal = new Counter({
	name: 'noufex_cache_ops_total',
	help: 'Cache operations, labelled by op (get/set/del), source (redis/process), result (hit/miss/error).',
	labelNames: ['op', 'source', 'result'] as const,
	registers: [registry],
});

// ── Queue ────────────────────────────────────────────────────────────
export const queueMessagesTotal = new Counter({
	name: 'noufex_queue_messages_total',
	help: 'RabbitMQ messages, labelled by exchange, op (publish/consume/ack/nack), result.',
	labelNames: ['exchange', 'op', 'result'] as const,
	registers: [registry],
});

export const queueMessageDurationSeconds = new Histogram({
	name: 'noufex_queue_message_duration_seconds',
	help: 'Time spent in the worker handler before ack/nack.',
	labelNames: ['queue'] as const,
	buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10, 30],
	registers: [registry],
});

// ── Search ───────────────────────────────────────────────────────────
export const searchSourceTotal = new Counter({
	name: 'noufex_search_source_total',
	help: 'Search results by backend, labelled by source (elasticsearch/postgresql).',
	labelNames: ['source'] as const,
	registers: [registry],
});

// ── External services ──────────────────────────────────────────────
export const cloudflarePurgesTotal = new Counter({
	name: 'noufex_cloudflare_purges_total',
	help: 'Cloudflare cache purge calls, labelled by result (ok/error).',
	labelNames: ['result'] as const,
	registers: [registry],
});

/**
 * Express middleware that records HTTP duration + counts.
 * Mount it AFTER `requestId` so the request-id is logged on the
 * way out.
 */
export function httpMetricsMiddleware() {
	return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
		const start = process.hrtime.bigint();
		res.on('finish', () => {
			const route =
				(req.route?.path as string | undefined) ||
				req.baseUrl + (req.route?.path ?? '') ||
				req.path.split('?')[0] ||
				'unknown';
			const labels = {
				method: req.method,
				route,
				status: String(res.statusCode),
			};
			httpRequestsTotal.inc(labels);
			const seconds = Number(process.hrtime.bigint() - start) / 1e9;
			httpRequestDurationSeconds.observe(labels, seconds);
		});
		next();
	};
}

/**
 * Periodically refresh DB pool gauges. The PgDb wrapper already
 * exposes `getPoolStats()` — call this on a 5 s interval from
 * index.ts.
 */
export function updateDbPoolGauges(stats: { totalCount: number; idleCount: number; waitingCount: number }) {
	dbPoolConnections.set({ state: 'total' }, stats.totalCount);
	dbPoolConnections.set({ state: 'idle' }, stats.idleCount);
	dbPoolConnections.set({ state: 'waiting' }, stats.waitingCount);
}

export async function metricsExposition(): Promise<string> {
	return registry.metrics();
}

export const contentType = registry.contentType;

export { registry };