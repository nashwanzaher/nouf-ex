// =============================================================================
// SMS channel — generic HTTP webhook (compatible with most MENA gateways)
// =============================================================================
// Activates when SMS_WEBHOOK_URL is set. The webhook URL receives a JSON
// payload with the rendered message and phone number; the gateway (Twilio,
// Unifonic, Jaib, etc.) is responsible for delivery.
//
// Expected env vars:
//   SMS_WEBHOOK_URL  POST target (e.g. https://api.unifonic.com/...)
//   SMS_WEBHOOK_AUTH Optional "Bearer <token>" or "Basic <b64>"
//   SMS_FROM         Sender id shown on the phone
//
// Phone numbers are normalised to E.164 (default +967 for YE) before
// being sent. Override with SMS_DEFAULT_COUNTRY_CODE.
// =============================================================================
import type {
	DispatchContext,
	DispatchResult,
	NotificationChannel,
	NotificationRow,
} from './types.cts';

function isConfigured(): boolean {
	return !!process.env.SMS_WEBHOOK_URL && !!process.env.SMS_FROM;
}

function normalizePhone(phone: string): string {
	const trimmed = phone.replace(/[^\d+]/g, '');
	if (trimmed.startsWith('+')) return trimmed;
	if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`;
	const cc = (process.env.SMS_DEFAULT_COUNTRY_CODE || '967').replace(/^\+/, '');
	// Local numbers in YE are 9 digits (7XXXXXXXX). Drop a leading 0 if present.
	const local = trimmed.replace(/^0+/, '');
	return `+${cc}${local}`;
}

export const smsChannel: NotificationChannel = {
	name: 'sms',
	isConfigured: isConfigured(),
	// SMS is reserved for high-urgency events. Promos and reviews go
	// to email (or in-app) only.
	shouldDeliver(notification: NotificationRow): boolean {
		return new Set(['order', 'refund', 'dispute', 'system']).has(notification.type);
	},
	async send(ctx: DispatchContext): Promise<DispatchResult> {
		if (!ctx.user.phone) {
			return {
				channel: 'sms',
				ok: false,
				providerMessageId: null,
				error: 'user has no phone',
			};
		}
		const url = process.env.SMS_WEBHOOK_URL!;
		const from = process.env.SMS_FROM!;
		const text =
			`${ctx.notification.title}${ctx.notification.body ? `: ${ctx.notification.body}` : ''}`.slice(
				0,
				320,
			); // GSM-7 limit
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};
		if (process.env.SMS_WEBHOOK_AUTH) headers['Authorization'] = process.env.SMS_WEBHOOK_AUTH;
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					from,
					to: normalizePhone(ctx.user.phone),
					text,
					notification_id: ctx.notification.id,
					user_id: ctx.user.id,
				}),
			});
			if (!res.ok) {
				return {
					channel: 'sms',
					ok: false,
					providerMessageId: null,
					error: `SMS gateway ${res.status}: ${(await res.text()).slice(0, 200)}`,
				};
			}
			const data = (await res.json().catch(() => ({}))) as { id?: string; sid?: string };
			return {
				channel: 'sms',
				ok: true,
				providerMessageId: data.id ?? data.sid ?? null,
				error: null,
			};
		} catch (err) {
			return {
				channel: 'sms',
				ok: false,
				providerMessageId: null,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	},
};
