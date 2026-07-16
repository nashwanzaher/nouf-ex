/**
 * Search indexer worker (Phase 3).
 *
 * Consumes `search.index` and `search.deindex` messages from the
 * `noufex.search` direct exchange. Each message carries an entity
 * type + id; the worker fetches the fresh row from PostgreSQL and
 * writes it to Elasticsearch. This is intentionally a pull-style
 * sync (rather than embedding the ES client in the route) so:
 *   - Route latency stays low (publish is a 1ms ack).
 *   - ES outages don't break user flows.
 *   - The index can be rebuilt from the RabbitMQ stream on demand.
 *
 * Tier 2.5: wraps each ES call in `withRetry` so a transient ES
 * outage (cluster restart, network blip) doesn't NACK the message
 * to the DLQ. Permanent failures (mapping conflict, 404) still
 * bubble up and go to the DLQ for manual inspection.
 */
import { QUEUES, subscribe } from '../lib/queue.ts';
import { indexProduct, deindexProduct, indexStore, deindexStore } from '../lib/search-index.ts';
import { log } from '../lib/shared.ts';
import { withRetry } from '../lib/retry.ts';

interface IndexMessage {
	entity: 'product' | 'store' | 'category';
	id: number;
}

let unsubIndex: (() => Promise<void>) | null = null;
let unsubDeindex: (() => Promise<void>) | null = null;

export async function startSearchIndexerWorker(): Promise<void> {
	if (unsubIndex) return;
	unsubIndex = await subscribe<IndexMessage>(QUEUES.searchIndex.name, async (msg) => {
		try {
			await withRetry(async () => {
				if (msg.entity === 'product') await indexProduct(msg.id);
				else if (msg.entity === 'store') await indexStore(msg.id);
			}, {
				onRetry: (err, attempt, delayMs) => {
					log.warn({
						msg: 'search_index_retry',
						entity: msg.entity,
						id: msg.id,
						attempt,
						delay_ms: delayMs,
						error: (err as Error).message,
					});
				},
			});
		} catch (err) {
			log.error({
				msg: 'search_index_failed',
				entity: msg.entity,
				id: msg.id,
				error: (err as Error).message,
			});
			throw err; // → DLQ
		}
	});
	unsubDeindex = await subscribe<IndexMessage>(QUEUES.searchDeindex.name, async (msg) => {
		try {
			await withRetry(async () => {
				if (msg.entity === 'product') await deindexProduct(msg.id);
				else if (msg.entity === 'store') await deindexStore(msg.id);
			}, {
				onRetry: (err, attempt, delayMs) => {
					log.warn({
						msg: 'search_deindex_retry',
						entity: msg.entity,
						id: msg.id,
						attempt,
						delay_ms: delayMs,
						error: (err as Error).message,
					});
				},
			});
		} catch (err) {
			log.error({
				msg: 'search_deindex_failed',
				entity: msg.entity,
				id: msg.id,
				error: (err as Error).message,
			});
			throw err;
		}
	});
}

export async function stopSearchIndexerWorker(): Promise<void> {
	if (unsubIndex) {
		await unsubIndex();
		unsubIndex = null;
	}
	if (unsubDeindex) {
		await unsubDeindex();
		unsubDeindex = null;
	}
}