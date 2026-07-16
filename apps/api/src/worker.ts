/**
 * Worker entrypoint (Phase 2, Tier 1.4).
 *
 * Boots only the RabbitMQ consumers — no Express server, no HTTP
 * listener, no SPA fallback. Runs in its own container so a
 * `docker restart noufex-api` never kills in-flight notifications
 * or search-indexer jobs.
 *
 * Lifecycle
 *   - Loads .env (same convention as the API).
 *   - Connects to PG, Redis, RabbitMQ.
 *   - Starts all 4 workers.
 *   - On SIGTERM/SIGINT: stops workers, closes connections, exits 0.
 *   - On Windows console close: same as SIGINT.
 *
 * Why a separate process
 *   - Workers are CPU-bound during bulk ES indexing and IO-bound
 *     during SMTP delivery. Sharing the event loop with Express
 *     caused noticeable request latency spikes when the email
 *     worker drained.
 *   - Independent scaling: a 10-store marketplace can run 1
 *     worker container; a 10,000-store marketplace can run 20.
 *   - Independent deploys: code changes to notification templates
 *     don't require an API restart (and the reverse).
 */
import 'dotenv/config';

import { log } from './lib/shared.ts';
import { closeRedis } from './lib/redis.ts';
import { closeQueue } from './lib/queue.ts';
import { startWorkers, stopWorkers } from './workers/index.ts';

const STARTED_AT = Date.now();

log.info({ msg: 'worker_process_started', pid: process.pid });

// Validate the minimum environment before starting consumers.
if (!process.env.DATABASE_URL) {
	log.error({ msg: 'worker_start_aborted', reason: 'DATABASE_URL missing' });
	process.exit(1);
}
if (!process.env.RABBITMQ_URL) {
	log.warn({
		msg: 'worker_running_without_broker',
		detail: 'RABBITMQ_URL is not set; workers will no-op until it is',
	});
}

async function shutdown(signal: string): Promise<void> {
	log.info({ msg: 'worker_shutdown_started', signal });
	try {
		await stopWorkers();
	} catch (err) {
		log.warn({ msg: 'worker_stop_error', error: (err as Error).message });
	}
	try {
		await closeQueue();
	} catch (err) {
		log.warn({ msg: 'queue_close_error', error: (err as Error).message });
	}
	try {
		await closeRedis();
	} catch (err) {
		// closeRedis is best-effort
		void err;
	}
	log.info({
		msg: 'worker_shutdown_complete',
		uptime_ms: Date.now() - STARTED_AT,
	});
	process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
if (process.stdin && typeof process.stdin.on === 'function' && process.stdin.isTTY === true) {
	process.stdin.on('end', () => void shutdown('STDIN_EOF'));
	process.stdin.resume();
}

// Crash early on uncaught errors so the container restart loop
// (restart: on-failure:5) brings a fresh process up. Without this,
// a silent bug can leak memory for hours.
process.on('uncaughtException', (err) => {
	log.error({ msg: 'worker_uncaught_exception', error: err.message, stack: err.stack });
	process.exit(1);
});
process.on('unhandledRejection', (reason) => {
	log.error({ msg: 'worker_unhandled_rejection', reason: String(reason) });
});

void startWorkers().then(() => {
	log.info({ msg: 'worker_ready' });
});