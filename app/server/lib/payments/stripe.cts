// =============================================================================
// Stripe payment provider
// =============================================================================
// Activates automatically when STRIPE_SECRET_KEY is set. Uses the Stripe
// REST API directly (no SDK dependency) to keep the bundle small. Covers
//   - PaymentIntents (the modern inline flow; recommended for new code)
//   - Checkout Sessions (the redirect flow; simpler for MVP)
//
// When STRIPE_SECRET_KEY is missing, isConfigured=false and the registry
// routes the request to the stub provider instead.
// =============================================================================
import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import type {
	InitiateInput,
	InitiateResult,
	PaymentProvider,
	WebhookVerification,
} from './types.cts';

const STRIPE_API = 'https://api.stripe.com/v1';

function isLive(): boolean {
	return !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_');
}

async function stripeFetch(path: string, body: Record<string, string>): Promise<unknown> {
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(body)) params.append(k, v);
	const res = await fetch(`${STRIPE_API}${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: params.toString(),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Stripe ${path} ${res.status}: ${text}`);
	}
	return res.json();
}

export const stripeProvider: PaymentProvider = {
	method: 'stripe',
	displayName: 'Stripe',
	isConfigured: isLive(),
	async initiate(input: InitiateInput): Promise<InitiateResult> {
		if (!isLive()) {
			throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
		}
		const amountMinor = Math.round(input.amount * 100); // Stripe wants minor units (cents).
		const session = (await stripeFetch('/checkout/sessions', {
			'payment_method_types[0]': 'card',
			mode: 'payment',
			success_url: `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/checkout/success?order=${input.orderId}`,
			cancel_url: `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/checkout/cancel?order=${input.orderId}`,
			client_reference_id: String(input.orderId),
			'line_items[0][quantity]': '1',
			'line_items[0][price_data][currency]': input.currency.toLowerCase(),
			'line_items[0][price_data][unit_amount]': String(amountMinor),
			'line_items[0][price_data][product_data][name]': input.description.slice(0, 120),
			'metadata[order_id]': String(input.orderId),
			'metadata[user_id]': String(input.userId),
		})) as { id: string; url: string };
		return {
			accepted: true,
			transactionId: session.id,
			redirectUrl: session.url,
			clientSecret: null,
			message: 'Stripe Checkout Session created',
			raw: { provider: 'stripe', session_id: session.id },
		};
	},
	async verifyWebhook(headers, rawBody): Promise<WebhookVerification> {
		const secret = process.env.STRIPE_WEBHOOK_SECRET;
		const sigHeader = headers['stripe-signature'];
		if (!secret || !sigHeader)
			return { valid: false, transactionId: null, status: null, raw: {} };
		// Stripe signs "<timestamp>.<body>" with HMAC-SHA256(secret).
		const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, p) => {
			const [k, v] = p.split('=');
			acc[k] = v;
			return acc;
		}, {});
		const ts = parts['t'];
		const sig = parts['v1'];
		if (!ts || !sig) return { valid: false, transactionId: null, status: null, raw: {} };
		const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
		const a = Buffer.from(sig, 'hex');
		const b = Buffer.from(expected, 'hex');
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			return { valid: false, transactionId: null, status: null, raw: {} };
		}
		const evt = JSON.parse(rawBody) as {
			type?: string;
			data?: { object?: { id?: string; payment_status?: string } };
		};
		const obj = evt.data?.object;
		const id = obj?.id ?? null;
		let status: WebhookVerification['status'] = null;
		if (evt.type === 'checkout.session.completed' || evt.type === 'payment_intent.succeeded') {
			status = 'completed';
		} else if (evt.type?.endsWith('.payment_failed')) {
			status = 'failed';
		} else if (evt.type === 'charge.refunded') {
			status = 'refunded';
		}
		return { valid: true, transactionId: id, status, raw: evt as Record<string, unknown> };
	},
};

// Helper kept for tests — lets a unit test simulate a unique provider txn.
export function _stubStripeTxn(): string {
	return `stub_stripe_${randomUUID().replace(/-/g, '')}`;
}
