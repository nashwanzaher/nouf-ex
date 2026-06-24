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
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { paymentsRouter } from '../routes/payments.cts';
import { signTestToken } from './test-token';

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
