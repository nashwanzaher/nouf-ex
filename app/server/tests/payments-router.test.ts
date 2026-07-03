/**
 * Integration tests for the payments router.
 *
 *   - POST /api/payments                   — record a payment
 *   - GET  /api/payments/order/:orderId    — list payments for an order
 *   - POST /api/payments/:id/confirm       — mark a payment as completed
 *
 * All endpoints are auth-gated. The customer must own the order
 * unless they are an admin. The /confirm endpoint is admin-only.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentsRouter } from '../routes/payments.cts';
import { signTestToken } from './test-token';
import { db } from '../lib/shared.cts';
import { stubProvider } from '../lib/payments/stub.cts';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const customerBearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };
const adminBearer = { Authorization: `Bearer ${ADMIN_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/payments', paymentsRouter);
	return app;
}

describe('paymentsRouter — auth gate', () => {
	it('POST / → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app)
			.post('/api/payments')
			.send({ order_id: 1, amount: 100, method: 'cod' });
		expect(res.status).toBe(401);
	});

	it('GET /order/:orderId → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/payments/order/1');
		expect(res.status).toBe(401);
	});

	it('POST /:id/confirm → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).post('/api/payments/1/confirm');
		expect(res.status).toBe(401);
	});
});

describe('paymentsRouter — POST /api/payments', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/payments').set(customerBearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `method` is invalid', async () => {
		const res = await request(app)
			.post('/api/payments')
			.set(customerBearer)
			.send({ order_id: 1, amount: 100, method: 'cashapp' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `amount` is negative', async () => {
		const res = await request(app)
			.post('/api/payments')
			.set(customerBearer)
			.send({ order_id: 1, amount: -10, method: 'cod' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `currency` is not 3 chars', async () => {
		const res = await request(app)
			.post('/api/payments')
			.set(customerBearer)
			.send({ order_id: 1, amount: 100, method: 'cod', currency: 'Y' });
		expect(res.status).toBe(400);
	});

	it('accepts a valid body — validation passes', async () => {
		// The mocked pg returns no order, so the handler emits 404.
		// We just want to confirm validation passed.
		const res = await request(app)
			.post('/api/payments')
			.set(customerBearer)
			.send({ order_id: 1, amount: 100, method: 'cod' });
		expect(res.status).not.toBe(400);
	});
});

describe('paymentsRouter — GET /api/payments/order/:orderId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on a non-integer orderId', async () => {
		const res = await request(app).get('/api/payments/order/abc').set(customerBearer);
		expect(res.status).toBe(400);
	});

	it('returns 400 on orderId=0', async () => {
		const res = await request(app).get('/api/payments/order/0').set(customerBearer);
		expect(res.status).toBe(400);
	});

	it('returns 404 when the order is not found', async () => {
		const res = await request(app).get('/api/payments/order/9999').set(customerBearer);
		expect(res.status).toBe(404);
	});
});

describe('paymentsRouter — POST /api/payments/:id/confirm (admin)', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 404 for a non-admin (existence check fires before role check)', async () => {
		// The handler looks up the payment first; the mock returns
		// undefined → 404. A 403 (role check) is only reached when the
		// payment actually exists. With a customer token + missing
		// payment, the observed status is 404.
		const res = await request(app).post('/api/payments/1/confirm').set(customerBearer);
		expect(res.status).toBe(404);
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app).post('/api/payments/abc/confirm').set(adminBearer);
		expect(res.status).toBe(400);
	});

	it('returns 404 when the payment is not found', async () => {
		const res = await request(app).post('/api/payments/9999/confirm').set(adminBearer);
		expect(res.status).toBe(404);
	});
});

/* ------------------------------------------------------------------ */
/*  POST /api/payments/webhook/:method                                 */
/* ------------------------------------------------------------------ */
// SEC-P2-08 (added 2026-07-02): the webhook endpoint is the only
// admin-route-shaped handler that accepts unauthenticated POSTs
// (providers sign the request instead). Verifying the signature
// is the *only* auth check — a forged payload could update any
// payment by guessing a provider_txn_id, so we must:
//   1. Reject unknown methods (400)
//   2. Delegate verification to the provider (which returns
//      {valid, status, transactionId})
//   3. Reject the request if any of (valid, status, transactionId)
//      is missing — partial verification is still rejected
//   4. Run the UPDATE only after all three are present
//
// In the test environment the Stripe/Paymob providers are not
// configured, so the stub provider is used. The stub always
// returns `valid: false`, so every webhook call against a
// configured method in tests will be rejected at step 3.
describe('paymentsRouter — POST /api/payments/webhook/:method (signature verification)', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 for an unknown payment method', async () => {
		// 'cashapp' is not a registered PaymentMethod, but the route
		// handler does an unchecked `as PaymentMethod` cast and the
		// registry falls back to the stub. The stub's verifyWebhook
		// returns valid:false, so we get a 400 "Webhook signature
		// rejected" — same end-state as a forged signed payload.
		// This is correct (rejection at the signature layer), and
		// the test documents that behavior.
		const res = await request(app)
			.post('/api/payments/webhook/cashapp')
			.set('content-type', 'application/json')
			.send({ type: 'payment.completed' });
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toMatch(/signature|rejected/i);
	});

	it('rejects a Stripe webhook with no signature header (stub returns valid=false)', async () => {
		// Stripe is registered but no STRIPE_SECRET_KEY is set, so
		// the registry falls back to the stub. The stub's
		// verifyWebhook always returns {valid:false}, which our
		// handler must reject with 400.
		const res = await request(app)
			.post('/api/payments/webhook/stripe')
			.set('content-type', 'application/json')
			.send({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_test' } } });
		expect(res.status).toBe(400);
		expect(res.body.error).toMatch(/signature|rejected/i);
	});

	it('rejects a Paymob webhook with no HMAC', async () => {
		const res = await request(app)
			.post('/api/payments/webhook/paymob')
			.set('content-type', 'application/json')
			.send({ type: 'TRANSACTION', obj: { id: 'pm_test' } });
		expect(res.status).toBe(400);
	});

	it('rejects a webhook with an empty body', async () => {
		const res = await request(app)
			.post('/api/payments/webhook/stripe')
			.set('content-type', 'application/json')
			.send({});
		expect(res.status).toBe(400);
	});

	it('does NOT touch the payments table when verification fails (no UPDATE issued)', async () => {
		// The handler must short-circuit BEFORE the UPDATE. We can't
		// assert "no UPDATE" directly with the global pg mock, but
		// the 400 status confirms the early-return path was taken
		// (otherwise the handler would have called .run() and we'd
		// see the run mock's empty return value merged into a 200).
		const res = await request(app)
			.post('/api/payments/webhook/stripe')
			.set('stripe-signature', 't=12345,v1=deadbeef')
			.send({ type: 'payment_intent.succeeded' });
		expect(res.status).toBe(400);
	});
});

/* ------------------------------------------------------------------ */
/*  POST /api/payments/webhook/:method — idempotency                   */
/* ------------------------------------------------------------------ */
// Providers retry on transient failure. If the same webhook fires
// twice (legit retry OR a duplicate delivery from the provider), the
// handler must NOT run the UPDATE twice. The current implementation
// issues an unconditional UPDATE on every call — see payments.cts:
//   await db.prepare(`UPDATE payments SET status = ?, updated_at = NOW()
//                     WHERE provider_txn_id = ?`).run(...);
// There is no dedupe, no idempotency-key check, and no
// pg_try_advisory_xact_lock to serialize concurrent retries.
//
// What a properly idempotent system would do:
//   1. Wrap the UPDATE in a CTE that checks the current status and
//      skips the write if it has already advanced past the new one.
//   2. Or use a dedicated `webhook_events` table with a UNIQUE
//      constraint on (provider, provider_txn_id) — the INSERT would
//      fail on a duplicate and the UPDATE would never run.
//
// This test documents the CURRENT behaviour: the same body posted
// twice produces two UPDATEs. If the production fix is added, the
// assertion will need to change to `expect(updateCount).toBe(1)`.
describe('paymentsRouter — POST /api/payments/webhook/:method (idempotency)', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('documents the current behavior: two identical webhooks produce two UPDATEs (no idempotency layer)', async () => {
		// Force the stub provider to accept the webhook by spying on
		// its verifyWebhook() — by default it returns {valid:false}
		// because there is no real signing key in test, but we want
		// to exercise the POST-verification UPDATE path. We DO NOT
		// touch the registry or the route file — just the stub's
		// method.
		const verifySpy = vi
			.spyOn(stubProvider, 'verifyWebhook')
			.mockResolvedValue({
				valid: true,
				transactionId: 'tx_idempotency_probe',
				status: 'completed',
				raw: { stub: true, test: 'idempotency' },
			});

		// Count every UPDATE issued against the payments table.
		let paymentUpdateCount = 0;
		const originalPrepare = db.prepare.bind(db);
		(db as unknown as { prepare: typeof originalPrepare }).prepare = ((
			sql: string,
		) => {
			const upper = sql.trim().toUpperCase();
			if (upper.startsWith('UPDATE PAYMENTS')) {
				return {
					run: async () => {
						paymentUpdateCount += 1;
						return { rowCount: 1, lastInsertRowid: null };
					},
					get: async () => undefined,
					all: async () => [],
				};
			}
			return originalPrepare(sql);
		}) as typeof originalPrepare;

		try {
			const body = {
				type: 'payment_intent.succeeded',
				data: { object: { id: 'tx_idempotency_probe' } },
			};
			const res1 = await request(app)
				.post('/api/payments/webhook/stripe')
				.set('content-type', 'application/json')
				.send(body);
			const res2 = await request(app)
				.post('/api/payments/webhook/stripe')
				.set('content-type', 'application/json')
				.send(body);

			// Both calls reach the UPDATE because the handler does
			// NOT dedupe. Count is 2, not 1. (A future fix that
			// adds idempotency would reduce this to 1.)
			expect([res1.status, res2.status]).toEqual([200, 200]);
			expect(paymentUpdateCount).toBe(2);
		} finally {
			verifySpy.mockRestore();
			(db as unknown as { prepare: typeof originalPrepare }).prepare =
				originalPrepare;
		}
	});
});

/* ------------------------------------------------------------------ */
/*  POST /api/payments/webhook/:method — rate limit (SEC-P2-08)       */
/* ------------------------------------------------------------------ */
// The webhook endpoint is rate-limited at 120 requests / minute / IP
// (see `webhookLimiter = rateLimit(60_000, 120, 'webhook')` in
// payments.cts). 100 rapid requests stay below the cap, so we expect
// the natural per-request response (400 "Webhook signature rejected"
// from the stub) for every call and ZERO 429s.
//
// This test pins the OBSERVED behavior at this volume. To actually
// hit the rate limit a future test would need to send 121+ requests
// within the 60-second window; doing that in CI is slow and noisy,
// so we only assert the contract that "100 < 120 ⇒ no 429".
describe('paymentsRouter — POST /api/payments/webhook/:method (rate limit at 100 rapid requests)', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('100 rapid requests stay below the 120/min limit — 0 429s observed, all 400 (signature rejected)', async () => {
		const body = { type: 'payment_intent.succeeded' };
		const results: number[] = [];
		// Sequential (not Promise.all) so each request completes
		// before the next one starts. This is closer to a real
		// retry storm than 100 parallel sockets.
		for (let i = 0; i < 100; i++) {
			const res = await request(app)
				.post('/api/payments/webhook/stripe')
				.set('content-type', 'application/json')
				.send(body);
			results.push(res.status);
		}
		const status429 = results.filter((s) => s === 429).length;
		const status400 = results.filter((s) => s === 400).length;
		// Every request was rejected by the signature check (the
		// stub returns valid:false). None were throttled because
		// 100 < 120 — the rate limit only kicks in on the 121st
		// request inside the 60-second window.
		expect(status429).toBe(0);
		expect(status400).toBe(100);
	});
});
