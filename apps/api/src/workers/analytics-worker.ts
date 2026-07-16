/**
 * Analytics worker.
 *
 * Persists analytics events (search queries, page views, conversions)
 * for later aggregation. Today the only sink is `search_logs`; the
 * worker is also a natural place to forward events to a future
 * warehouse (BigQuery, ClickHouse) without touching the API.
 */
import { QUEUES, subscribe } from '../lib/queue.ts';
import { db, log } from '../lib/shared.ts';

interface AnalyticsEvent {
	kind: 'search' | 'view' | 'conversion';
	payload: Record<string, unknown>;
	ts: string;
}

let unsubscribe: (() => Promise<void>) | null = null;

export async function startAnalyticsWorker(): Promise<void> {
	if (unsubscribe) return;
	unsubscribe = await subscribe<AnalyticsEvent>(QUEUES.analyticsEvents.name, async (msg) => {
		try {
			if (msg.kind === 'search') {
				await db
					.prepare(
						`INSERT INTO search_logs
						 (query, query_normalized, result_count, duration_ms, user_id, request_id)
						 VALUES (?, ?, ?, ?, ?, ?)`,
					)
					.run(
						String(msg.payload.query ?? ''),
						String(msg.payload.normalized ?? ''),
						Number(msg.payload.resultCount ?? 0),
						Number(msg.payload.durationMs ?? 0),
						(msg.payload.userId as number | null) ?? null,
						(msg.payload.requestId as string | null) ?? null,
					);
			}
			// Other event kinds are forwarded here in a future iteration.
		} catch (err) {
			log.warn({
				msg: 'analytics_persist_failed',
				kind: msg.kind,
				error: (err as Error).message,
			});
			// analytics is best-effort: don't DLQ
		}
	});
}

export async function stopAnalyticsWorker(): Promise<void> {
	if (unsubscribe) {
		await unsubscribe();
		unsubscribe = null;
	}
}