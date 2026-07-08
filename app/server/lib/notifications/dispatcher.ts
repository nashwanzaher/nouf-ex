// =============================================================================
// Notification dispatcher
// =============================================================================
// Coordinates the channels for a single notification. Always logs an
// "in_app" entry (which is just the DB row itself, already inserted by
// the caller). If a channel reports `ok=false` the dispatcher logs the
// reason but does NOT throw — we don't want a misconfigured SMTP server
// to break the order flow. Delivery is best-effort.
// =============================================================================
import { db } from '../shared.ts';
import { emailChannel } from './email.ts';
import { smsChannel } from './sms.ts';
import type {
	DispatchContext,
	DispatchResult,
	NotificationChannel,
	NotificationRow,
} from './types.ts';

const CHANNELS: NotificationChannel[] = [emailChannel, smsChannel];

async function fetchUser(userId: number): Promise<{
	id: number;
	email: string | null;
	phone: string | null;
	preferred_language: string;
}> {
	const row = (await db
		.prepare('SELECT id, email, phone, preferred_language FROM users WHERE id = ?')
		.get(userId)) as
		| { id: number; email: string | null; phone: string | null; preferred_language: string }
		| undefined;
	return (
		row ?? {
			id: userId,
			email: null,
			phone: null,
			preferred_language: 'ar',
		}
	);
}

/**
 * Dispatch a single notification across all applicable channels. Returns
 * the per-channel results so the caller can persist them or report them.
 */
export async function dispatch(notification: NotificationRow): Promise<DispatchResult[]> {
	const user = await fetchUser(notification.user_id);
	const ctx: DispatchContext = { notification, user };
	const results: DispatchResult[] = [
		// In-app is implicit — the row exists in the DB. Record it for parity.
		{ channel: 'in_app', ok: true, providerMessageId: null, error: null },
	];
	for (const ch of CHANNELS) {
		if (!ch.shouldDeliver(notification)) continue;
		if (!ch.isConfigured) {
			results.push({
				channel: ch.name,
				ok: false,
				providerMessageId: null,
				error: `${ch.name} channel not configured (set ${ch.name === 'email' ? 'SMTP_HOST' : 'SMS_WEBHOOK_URL'})`,
			});
			continue;
		}
		try {
			const r = await ch.send(ctx);
			results.push(r);
		} catch (err) {
			results.push({
				channel: ch.name,
				ok: false,
				providerMessageId: null,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
	return results;
}

/**
 * Convenience: insert a notification and dispatch it in one call.
 * Returns the inserted row id and the per-channel results.
 */
export async function notify(input: {
	userId: number;
	type: NotificationRow['type'];
	title: string;
	body: string;
	data?: Record<string, unknown>;
}): Promise<{ id: number; results: DispatchResult[] }> {
	const result = (await db
		.prepare(
			`INSERT INTO notifications (user_id, type, title, body, data, is_read, created_at)
			 VALUES (?, ?, ?, ?, ?::jsonb, FALSE, NOW())
			 RETURNING id, user_id, type, title, body, data, is_read, read_at, created_at`,
		)
		.get(
			input.userId,
			input.type,
			input.title,
			input.body,
			input.data ? JSON.stringify(input.data) : null,
		)) as unknown as NotificationRow;
	const results = await dispatch(result);
	return { id: result.id, results };
}
