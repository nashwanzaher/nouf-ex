// =============================================================================
// Paymob payment provider (Egypt / MENA-focused gateway).
// =============================================================================
// Activates when PAYMOB_API_KEY is set. Paymob's integration is two-step:
//   1. Authenticate to obtain a single-use auth token.
//   2. Create an order + payment key, then return the iframe URL the
//      client renders (Paymob's hosted card form).
//
// Webhook verification uses the HMAC over the concatenation of the
// request fields (see PAYMOB_HMAC_SECRET). When PAYMOB_HMAC_SECRET is
// missing the webhook is rejected.
// =============================================================================
import { createHmac, timingSafeEqual } from 'crypto';
import type {
	InitiateInput,
	InitiateResult,
	PaymentProvider,
	WebhookVerification,
} from './types.cts';

const PAYMOB_API = 'https://accept.paymob.com/api';

interface CachedToken {
	token: string;
	expiresAt: number;
}
let cached: CachedToken | null = null;

function isLive(): boolean {
	return !!process.env.PAYMOB_API_KEY && !!process.env.PAYMOB_INTEGRATION_ID;
}

async function authToken(): Promise<string> {
	if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
	const res = await fetch(`${PAYMOB_API}/auth/tokens`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY }),
	});
	if (!res.ok) throw new Error(`Paymob auth ${res.status}`);
	const j = (await res.json()) as { token: string };
	cached = { token: j.token, expiresAt: Date.now() + 55 * 60 * 1000 }; // 55 min
	return j.token;
}

export const paymobProvider: PaymentProvider = {
	method: 'paymob',
	displayName: 'Paymob',
	isConfigured: isLive(),
	async initiate(input: InitiateInput): Promise<InitiateResult> {
		if (!isLive()) throw new Error('Paymob is not configured (PAYMOB_API_KEY missing)');
		const token = await authToken();
		const amountMinor = Math.round(input.amount * 100);
		// 1. Create an "order" on Paymob.
		const order = (await fetch(`${PAYMOB_API}/ecommerce/orders`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				auth_token: token,
				delivery_needed: false,
				amount_cents: amountMinor,
				currency: input.currency,
				merchant_order_id: String(input.orderId),
			}),
		}).then((r) => r.json())) as { id: number };
		// 2. Get a payment key.
		const paymentKey = (await fetch(`${PAYMOB_API}/acceptance/payment_keys`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				auth_token: token,
				amount_cents: amountMinor,
				expiration: 3600,
				order_id: order.id,
				billing_data: {
					apartment: 'NA',
					email: 'customer@nouf-ex.local',
					floor: 'NA',
					first_name: 'Customer',
					last_name: String(input.userId),
					phone_number: '+967700000000',
					city: 'Sanaa',
					country: 'YE',
					state: 'NA',
					street: 'NA',
				},
				currency: input.currency,
				integration_id: Number(process.env.PAYMOB_INTEGRATION_ID),
			}),
		}).then((r) => r.json())) as { token: string };
		const iframeId = process.env.PAYMOB_IFRAME_ID || '631568';
		return {
			accepted: true,
			transactionId: String(order.id),
			redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey.token}`,
			clientSecret: paymentKey.token,
			message: 'Paymob payment key issued',
			raw: { provider: 'paymob', paymob_order_id: order.id },
		};
	},
	async verifyWebhook(headers, rawBody): Promise<WebhookVerification> {
		const secret = process.env.PAYMOB_HMAC_SECRET;
		if (!secret) return { valid: false, transactionId: null, status: null, raw: {} };
		const params = new URLSearchParams(rawBody);
		const fields = [
			'amount_cents',
			'created_at',
			'currency',
			'error_occured',
			'has_parent_transaction',
			'id',
			'integration_id',
			'is_3d_secure',
			'is_auth',
			'is_capture',
			'is_refunded',
			'is_standalone_payment',
			'is_voided',
			'order',
			'owner',
			'pending',
			' Source_data_pan',
			' Source_data_sub_type',
			' Source_data_type',
			'success',
		];
		const concat = fields.map((f) => params.get(f) ?? '').join('');
		const expected = createHmac('sha512', secret).update(concat).digest('hex');
		const got = headers['hmac'] ?? '';
		const a = Buffer.from(expected, 'hex');
		const b = Buffer.from(got, 'hex');
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			return { valid: false, transactionId: null, status: null, raw: {} };
		}
		const txnId = params.get('id');
		const success = params.get('success') === 'true';
		const status: WebhookVerification['status'] = success ? 'completed' : 'failed';
		return {
			valid: true,
			transactionId: txnId,
			status,
			raw: Object.fromEntries(params.entries()),
		};
	},
};
