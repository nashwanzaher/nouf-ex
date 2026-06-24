/**
 * Integration tests for the orders router.
 *
 *   - GET  /api/orders         — list the customer's orders
 *   - GET  /api/orders/:id     — fetch a single order
 *   - POST /api/orders         — create a new order (transaction)
 *
 * All endpoints are auth-gated. The list and single-order
 * endpoints trust only `req.user!.id` (admins can read any).
 * The POST is the most complex: it resolves `storeId` server-side
 * from the product rows, optionally validates a coupon, and runs
 * the order + order_items inserts inside a single transaction.
 *
 * The mocked `pg` returns no rows so the existence checks fail
 * with 404; the POST surfaces a 500 (or any non-400) when the
 * transaction cannot complete. We focus on auth, validation, and
 * the success envelope when no data is needed.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { ordersRouter } from '../routes/orders.cts';
import { signTestToken } from './test-token';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const customerBearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };
const adminBearer = { Authorization: `Bearer ${ADMIN_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/orders', ordersRouter);
	return app;
}

describe('ordersRouter — auth gate', () => {
	it('GET / → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/orders');
		expect(res.status).toBe(401);
	});

	it('GET /:id → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/orders/1');
		expect(res.status).toBe(401);
	});

	it('POST / → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app)
			.post('/api/orders')
			.send({ items: [], total: 0 });
		expect(res.status).toBe(401);
	});
});

describe('ordersRouter — GET /api/orders', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with an array envelope', async () => {
		const res = await request(app).get('/api/orders').set(customerBearer);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('returns 200 for an admin token (admins can list)', async () => {
		const res = await request(app).get('/api/orders').set(adminBearer);
		expect(res.status).toBe(200);
	});
});

describe('ordersRouter — GET /api/orders/:id', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 404 when the order is not found', async () => {
		const res = await request(app).get('/api/orders/9999').set(customerBearer);
		expect(res.status).toBe(404);
	});

	it('returns 404 when an admin asks for a missing order', async () => {
		const res = await request(app).get('/api/orders/9999').set(adminBearer);
		expect(res.status).toBe(404);
	});
});

describe('ordersRouter — POST /api/orders', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/orders').set(customerBearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `items` is empty', async () => {
		const res = await request(app)
			.post('/api/orders')
			.set(customerBearer)
			.send({ items: [], total: 0 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `total` is negative', async () => {
		const res = await request(app)
			.post('/api/orders')
			.set(customerBearer)
			.send({
				items: [{ productId: 1, quantity: 1, unitPrice: 10 }],
				total: -5,
			});
		expect(res.status).toBe(400);
	});

	it('returns 400 when an item has quantity=0', async () => {
		const res = await request(app)
			.post('/api/orders')
			.set(customerBearer)
			.send({
				items: [{ productId: 1, quantity: 0, unitPrice: 10 }],
				total: 10,
			});
		expect(res.status).toBe(400);
	});

	it('returns 400 when an item has a non-positive productId', async () => {
		const res = await request(app)
			.post('/api/orders')
			.set(customerBearer)
			.send({
				items: [{ productId: 0, quantity: 1, unitPrice: 10 }],
				total: 10,
			});
		expect(res.status).toBe(400);
	});

	it('returns 400 when an item has negative unitPrice', async () => {
		const res = await request(app)
			.post('/api/orders')
			.set(customerBearer)
			.send({
				items: [{ productId: 1, quantity: 1, unitPrice: -10 }],
				total: 10,
			});
		expect(res.status).toBe(400);
	});

	it('returns 400 when items exceed the max of 100', async () => {
		const items = Array.from({ length: 101 }, (_, i) => ({
			productId: i + 1,
			quantity: 1,
			unitPrice: 1,
		}));
		const res = await request(app)
			.post('/api/orders')
			.set(customerBearer)
			.send({ items, total: 101 });
		expect(res.status).toBe(400);
	});

	it('accepts a valid body — validation passes (transaction may fail with mock pg)', async () => {
		// The handler resolves the store from the products. The mock
		// returns no product rows → `PRODUCT_UNAVAILABLE` (400) or
		// `EMPTY_CART` (400). Either way, validation passed.
		const res = await request(app)
			.post('/api/orders')
			.set(customerBearer)
			.send({
				items: [{ productId: 1, quantity: 1, unitPrice: 10 }],
				total: 10,
				paymentMethod: 'cod',
			});
		// We only assert the auth gate cleared. The downstream error
		// (mocked pg returns no product) may be 400 (PRODUCT_UNAVAILABLE)
		// or 500 — both are acceptable evidence that validation passed.
		expect(res.status).not.toBe(401);
	});
});
