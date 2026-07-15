/**
 * Integration tests for the coupons router.
 *
 *   - POST /api/coupons/validate — apply a coupon to a subtotal
 *   - POST /api/coupons/redeem   — record a coupon usage on an order
 *
 * Both endpoints are auth-gated. The mocked `pg` returns
 * `undefined` for `.get()` so the "coupon not found" path is the
 * one most often exercised here.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { couponsRouter } from '../routes/coupons.ts';
import { signTestToken } from './test-token';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const bearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/coupons', couponsRouter);
	return app;
}

describe('couponsRouter — auth gate', () => {
	it('POST /validate → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app)
			.post('/api/coupons/validate')
			.send({ code: 'X', user_id: 7, order_subtotal: 100 });
		expect(res.status).toBe(401);
	});

	it('POST /redeem → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app)
			.post('/api/coupons/redeem')
			.send({ code: 'X', user_id: 7, order_subtotal: 100, order_id: 1 });
		expect(res.status).toBe(401);
	});
});

describe('couponsRouter — POST /api/coupons/validate', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/coupons/validate').set(bearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `code` is missing', async () => {
		const res = await request(app)
			.post('/api/coupons/validate')
			.set(bearer)
			.send({ user_id: 7, order_subtotal: 100 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `order_subtotal` is negative', async () => {
		const res = await request(app)
			.post('/api/coupons/validate')
			.set(bearer)
			.send({ code: 'X', user_id: 7, order_subtotal: -10 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when the coupon is not found (mocked pg returns undefined)', async () => {
		const res = await request(app)
			.post('/api/coupons/validate')
			.set(bearer)
			.send({ code: 'NOPE', user_id: 7, order_subtotal: 100 });
		expect(res.status).toBe(400);
	});
});

describe('couponsRouter — POST /api/coupons/redeem', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/coupons/redeem').set(bearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `order_id` is missing', async () => {
		const res = await request(app)
			.post('/api/coupons/redeem')
			.set(bearer)
			.send({ code: 'X', user_id: 7, order_subtotal: 100 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `order_id` is not positive', async () => {
		const res = await request(app)
			.post('/api/coupons/redeem')
			.set(bearer)
			.send({ code: 'X', user_id: 7, order_subtotal: 100, order_id: 0 });
		expect(res.status).toBe(400);
	});

	it('returns 404 when the coupon is not found', async () => {
		const res = await request(app)
			.post('/api/coupons/redeem')
			.set(bearer)
			.send({ code: 'NOPE', order_subtotal: 100, order_id: 1 });
		expect(res.status).toBe(404);
	});
});
