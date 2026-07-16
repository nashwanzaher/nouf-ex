/**
 * Worker bootstrap (Phase 2, competitive-architecture-analysis).
 *
 * Starts the in-process RabbitMQ consumers when the API boots. Each
 * worker is a function (not a class) — easier to test in isolation
 * and easier to disable via env var for ad-hoc environments.
 *
 * To run an API instance WITHOUT workers (e.g. a read replica behind
 * the load balancer) set `DISABLE_WORKERS=1` and only producers run
 * on that node.
 */
import { startEmailWorker, stopEmailWorker } from './email-worker.ts';
import { startNotificationWorker, stopNotificationWorker } from './notification-worker.ts';
import { startSearchIndexerWorker, stopSearchIndexerWorker } from './search-indexer.ts';
import { startAnalyticsWorker, stopAnalyticsWorker } from './analytics-worker.ts';
import { log } from '../lib/shared.ts';

const workers: Array<{ name: string; start: () => Promise<unknown>; stop: () => Promise<unknown> }> = [
	{ name: 'email', start: startEmailWorker, stop: stopEmailWorker },
	{ name: 'notification', start: startNotificationWorker, stop: stopNotificationWorker },
	{ name: 'search-indexer', start: startSearchIndexerWorker, stop: stopSearchIndexerWorker },
	{ name: 'analytics', start: startAnalyticsWorker, stop: stopAnalyticsWorker },
];

let started = false;

export async function startWorkers(): Promise<void> {
	if (started) return;
	if (process.env.DISABLE_WORKERS === '1') {
		log.info({ msg: 'workers_disabled_by_env' });
		return;
	}
	started = true;
	for (const w of workers) {
		try {
			await w.start();
			log.info({ msg: 'worker_started', name: w.name });
		} catch (err) {
			log.warn({ msg: 'worker_start_failed', name: w.name, error: (err as Error).message });
		}
	}
}

export async function stopWorkers(): Promise<void> {
	if (!started) return;
	started = false;
	for (const w of workers.reverse()) {
		try {
			await w.stop();
		} catch {
			// ignore
		}
	}
}