/**
 * Notification worker.
 *
 * Subscribes to `noufex.notifications` fanout exchange. Today every
 * notification message is routed via the in-process dispatcher (which
 * already supports email + SMS channels). In a future iteration the
 * email/SMS providers will be split out as their own workers so a
 * slow SMTP connection doesn't block the in-app notification path.
 */
import { QUEUES, subscribe } from '../lib/queue.ts';
import type { NotificationRow } from '../lib/notifications/types.ts';
import { dispatch } from '../lib/notifications/dispatcher.ts';

let unsubscribe: (() => Promise<void>) | null = null;

export async function startNotificationWorker(): Promise<void> {
	if (unsubscribe) return;
	unsubscribe = await subscribe<NotificationRow>(QUEUES.emailSend.name, async (msg) => {
		// The publisher passes the full notification row. We re-dispatch
		// through the same channel layer used by the synchronous path so
		// provider semantics (best-effort, never throws) stay consistent.
		await dispatch(msg);
	});
}

export async function stopNotificationWorker(): Promise<void> {
	if (unsubscribe) {
		await unsubscribe();
		unsubscribe = null;
	}
}