/**
 * Event-triggered notifications — fire when business events happen.
 *
 * Wires the existing `dispatcher.cts` infrastructure to the order
 * lifecycle so that:
 *   - Customer receives a notification when they place an order
 *   - Seller receives a notification when an order is placed
 *   - Customer receives a notification when payment is confirmed
 *   - Both parties receive notifications for refund/dispute events
 *
 * The helper is intentionally fire-and-forget: a failed dispatch
 * (e.g., SMTP server down) must NEVER break the order flow.
 * Errors are logged but not propagated.
 */

import { db } from '../shared.ts';
import { dispatch } from './dispatcher.ts';
import { render } from './email-templates.ts';
import type { NotificationType } from './types.ts';

/**
 * Template data fields are `string` only (no undefined) because the
 * `render()` function expects concrete values. Optional fields like
 * `reason`, `subject`, `comment` are passed as empty string when
 * absent. This keeps the type strict at the boundary.
 */
type TemplateData = Record<string, string>;

export interface EventContext {
	/** Map of user_id → preferred_language, fetched in one query. */
	languageByUserId: Map<number, 'ar' | 'en' | 'zh'>;
}

/**
 * Look up the preferred language for a list of users in one query.
 * Use this when you need to dispatch to multiple recipients.
 */
export async function fetchLanguages(userIds: number[]): Promise<Map<number, 'ar' | 'en' | 'zh'>> {
	if (userIds.length === 0) return new Map();
	const unique = [...new Set(userIds)];
	const placeholders = unique.map((_, i) => `$${i + 1}`).join(',');
	const rows = (await db
		.prepare(`SELECT id, preferred_language FROM users WHERE id IN (${placeholders})`)
		.all(...unique)) as { id: number; preferred_language: string | null }[];
	return new Map(rows.map((r) => [r.id, (r.preferred_language as 'ar' | 'en' | 'zh') || 'ar']));
}

/**
 * Look up a single user's preferred language.
 */
export async function fetchLanguage(userId: number): Promise<'ar' | 'en' | 'zh'> {
	const row = (await db
		.prepare('SELECT preferred_language FROM users WHERE id = $1')
		.get(userId)) as { preferred_language: string | null } | undefined;
	return (row?.preferred_language as 'ar' | 'en' | 'zh') || 'ar';
}

/**
 * Low-level: insert a notification row + dispatch it. Returns the id.
 * Never throws.
 */
async function dispatchOne(
	userId: number,
	type: NotificationType,
	title: string,
	body: string,
	data?: Record<string, unknown>,
): Promise<number | null> {
	try {
		const result = (await db
			.prepare(
				`INSERT INTO notifications (user_id, type, title, body, data, is_read, created_at)
				 VALUES ($1, $2, $3, $4, $5::jsonb, FALSE, NOW())
				 RETURNING id`,
			)
			.get(userId, type, title, body, data ? JSON.stringify(data) : null)) as
			| { id: number }
			| undefined;
		if (!result) return null;
		// Fetch the full row for the dispatcher
		const row = (await db
			.prepare(
				'SELECT id, user_id, type, title, body, data, is_read, read_at, created_at FROM notifications WHERE id = $1',
			)
			.get(result.id)) as unknown as import('./types.ts').NotificationRow;
		if (!row) return null;
		await dispatch(row);
		return result.id;
	} catch (err) {
		// Log but don't throw — a failed dispatch must NOT break the caller.
		// (Caller is in the middle of an order flow.)
		process.stderr.write(
			JSON.stringify({
				t: new Date().toISOString(),
				level: 'error',
				msg: 'event_notification_failed',
				user_id: userId,
				type,
				error: err instanceof Error ? err.message : String(err),
			}) + '\n',
		);
		return null;
	}
}

// ---------------------------------------------------------------------------
// High-level event triggers — call these from your route handlers.
// ---------------------------------------------------------------------------

/**
 * ORDER_PLACED: notify the customer + the merchant.
 */
export async function onOrderPlaced(input: {
	orderId: number;
	customerId: number;
	merchantId: number;
	orderNumber: string;
	total: number;
	itemCount: number;
	paymentMethod: string;
	trackingUrl: string;
	productName: string;
}): Promise<void> {
	const langs = await fetchLanguages([input.customerId, input.merchantId]);
	const data: TemplateData = {
		orderNumber: input.orderNumber,
		total: String(input.total),
		itemCount: String(input.itemCount),
		paymentMethod: input.paymentMethod,
		trackingUrl: input.trackingUrl,
	};
	// Customer notification
	{
		const lang = langs.get(input.customerId) ?? 'ar';
		const tpl = render({ event: 'order_placed', language: lang, data });
		await dispatchOne(input.customerId, 'order', tpl.subject, tpl.body, {
			orderId: input.orderId,
			eventType: 'order_placed',
		});
	}
	// Merchant notification
	{
		const lang = langs.get(input.merchantId) ?? 'ar';
		const tpl = render({ event: 'order_placed', language: lang, data });
		// Merchant gets a "new order received" framing (subject differs)
		const merchantSubject =
			lang === 'ar'
				? `طلب جديد رقم #${input.orderNumber}`
				: `New order #${input.orderNumber}`;
		await dispatchOne(input.merchantId, 'order', merchantSubject, tpl.body, {
			orderId: input.orderId,
			eventType: 'order_placed',
			role: 'merchant',
		});
	}
}

/**
 * PAYMENT_CONFIRMED: notify the customer.
 */
export async function onPaymentConfirmed(input: {
	orderId: number;
	customerId: number;
	orderNumber: string;
	amount: number;
}): Promise<void> {
	const lang = await fetchLanguage(input.customerId);
	const tpl = render({
		event: 'payment_confirmed',
		language: lang,
		data: {
			orderNumber: input.orderNumber,
			amount: String(input.amount),
		},
	});
	await dispatchOne(input.customerId, 'order', tpl.subject, tpl.body, {
		orderId: input.orderId,
		eventType: 'payment_confirmed',
	});
}

/**
 * REFUND_REQUESTED: notify the merchant (and customer for receipt).
 */
export async function onRefundRequested(input: {
	orderId: number;
	orderNumber: string;
	customerId: number;
	merchantId: number;
	amount: number;
}): Promise<void> {
	const langs = await fetchLanguages([input.customerId, input.merchantId]);
	const data: TemplateData = {
		orderNumber: input.orderNumber,
		amount: String(input.amount),
	};
	// Customer (receipt)
	{
		const lang = langs.get(input.customerId) ?? 'ar';
		const tpl = render({ event: 'refund_requested', language: lang, data });
		await dispatchOne(input.customerId, 'refund', tpl.subject, tpl.body, {
			orderId: input.orderId,
			eventType: 'refund_requested',
		});
	}
	// Merchant (action required)
	{
		const lang = langs.get(input.merchantId) ?? 'ar';
		const tpl = render({ event: 'refund_requested', language: lang, data });
		const merchantSubject =
			lang === 'ar'
				? `طلب استرداد جديد على الطلب رقم #${input.orderNumber}`
				: `New refund request for order #${input.orderNumber}`;
		await dispatchOne(input.merchantId, 'refund', merchantSubject, tpl.body, {
			orderId: input.orderId,
			eventType: 'refund_requested',
			role: 'merchant',
		});
	}
}

/**
 * REFUND_RESOLVED: notify the customer.
 */
export async function onRefundResolved(input: {
	orderId: number;
	orderNumber: string;
	customerId: number;
	amount: number;
	status: 'approved' | 'rejected';
	reason?: string;
}): Promise<void> {
	const lang = await fetchLanguage(input.customerId);
	const event = input.status === 'approved' ? 'refund_approved' : 'refund_rejected';
	const tpl = render({
		event,
		language: lang,
		data: {
			orderNumber: input.orderNumber,
			amount: String(input.amount),
			reason: input.reason ?? '',
		},
	});
	await dispatchOne(input.customerId, 'refund', tpl.subject, tpl.body, {
		orderId: input.orderId,
		eventType: event,
	});
}

/**
 * DISPUTE_OPENED: notify the merchant.
 */
export async function onDisputeOpened(input: {
	orderId: number;
	orderNumber: string;
	merchantId: number;
	subject?: string;
}): Promise<void> {
	const lang = await fetchLanguage(input.merchantId);
	const tpl = render({
		event: 'dispute_opened',
		language: lang,
		data: {
			orderNumber: input.orderNumber,
			subject: input.subject ?? '',
		},
	});
	await dispatchOne(input.merchantId, 'dispute', tpl.subject, tpl.body, {
		orderId: input.orderId,
		eventType: 'dispute_opened',
	});
}

/**
 * DISPUTE_RESOLVED: notify the customer.
 */
export async function onDisputeResolved(input: {
	orderId: number;
	orderNumber: string;
	customerId: number;
	resolution?: string;
}): Promise<void> {
	const lang = await fetchLanguage(input.customerId);
	const tpl = render({
		event: 'dispute_resolved',
		language: lang,
		data: {
			orderNumber: input.orderNumber,
			resolution: input.resolution ?? '',
		},
	});
	await dispatchOne(input.customerId, 'dispute', tpl.subject, tpl.body, {
		orderId: input.orderId,
		eventType: 'dispute_resolved',
	});
}

/**
 * REVIEW_POSTED: notify the merchant whose product was reviewed.
 */
export async function onReviewPosted(input: {
	productId: number;
	productName: string;
	merchantId: number;
	rating: number;
	comment?: string;
}): Promise<void> {
	const lang = await fetchLanguage(input.merchantId);
	const tpl = render({
		event: 'review_posted',
		language: lang,
		data: {
			productName: input.productName,
			rating: String(input.rating),
			comment: input.comment ?? '',
		},
	});
	await dispatchOne(input.merchantId, 'review', tpl.subject, tpl.body, {
		productId: input.productId,
		eventType: 'review_posted',
	});
}

/**
 * WELCOME: notify a newly-registered user.
 */
export async function onWelcome(input: { userId: number; name: string }): Promise<void> {
	const lang = await fetchLanguage(input.userId);
	const tpl = render({
		event: 'welcome',
		language: lang,
		data: { name: input.name },
	});
	await dispatchOne(input.userId, 'system', tpl.subject, tpl.body, {
		eventType: 'welcome',
	});
}
