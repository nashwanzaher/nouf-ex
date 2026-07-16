/**
 * Email worker.
 *
 * Currently a thin wrapper around the existing email channel. The
 * purpose of having a separate queue/worker is to keep the synchronous
 * notification path responsive even when the SMTP provider is slow —
 * if email send time spikes from 50 ms to 5 s, this worker absorbs
 * the latency instead of the request thread.
 */
import { QUEUES, subscribe } from '../lib/queue.ts';
import type { NotificationRow } from '../lib/notifications/types.ts';
import { dispatch } from '../lib/notifications/dispatcher.ts';

let unsubscribe: (() => Promise<void>) | null = null;

export async function startEmailWorker(): Promise<void> {
	if (unsubscribe) return;
	unsubscribe = await subscribe<NotificationRow>(QUEUES.emailSend.name, async (msg) => {
		await dispatch(msg);
	});
}

export async function stopEmailWorker(): Promise<void> {
	if (unsubscribe) {
		await unsubscribe();
		unsubscribe = null;
	}
}