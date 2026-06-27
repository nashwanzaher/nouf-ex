/**
 * Integration tests for the cart router.
 *
 *   - GET    /api/cart/:userId       — list the user's cart
 *   - POST   /api/cart                — add / increment an item
 *   - DELETE /api/cart/:id            — remove an item
 *   - DELETE /api/cart/clear/:userId  — clear the cart
 *   - GET    /api/cart/count/:userId  — sum of quantities
 *
 * All endpoints are auth-gated and trust only `req.user!.id`.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { cartRouter } from '../routes/cart.cts';
import { signTestToken } from './test-token';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const bearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/cart', cartRouter);
	return app;
}

describe('cartRouter — auth gate', () => {
	it('GET /:userId → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/cart/7');
		expect(res.status).toBe(401);
	});

	it('POST / → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).post('/api/cart').send({ productId: 1, quantity: 1 });
		expect(res.status).toBe(401);
	});

	it('DELETE /:id → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).delete('/api/cart/1');
		expect(res.status).toBe(401);
	});
});

describe('cartRouter — GET /api/cart/:userId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with an array envelope', async () => {
		const res = await request(app).get('/api/cart/7').set(bearer);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('returns Content-Type: application/json', async () => {
		const res = await request(app).get('/api/cart/7').set(bearer);
		expect(res.headers['content-type']).toMatch(/json/);
	});

	it('returns 403 when a customer asks for another user cart (ownership guard)', async () => {
		const res = await request(app).get('/api/cart/99').set(bearer);
		expect(res.status).toBe(403);
		expect(res.body.code).toBe('FORBIDDEN');
	});

	it('returns 200 when an admin asks for another user cart', async () => {
		const res = await request(app)
			.get('/api/cart/99')
			.set('Authorization', `Bearer ${ADMIN_TOKEN}`);
		expect(res.status).toBe(200);
	});

	it('returns 400 on a non-integer userId', async () => {
		const res = await request(app).get('/api/cart/abc').set(bearer);
		expect(res.status).toBe(400);
	});
});

describe('cartRouter — POST /api/cart', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/cart').set(bearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `productId` is missing', async () => {
		const res = await request(app).post('/api/cart').set(bearer).send({ quantity: 1 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `productId` is not positive', async () => {
		const res = await request(app)
			.post('/api/cart')
			.set(bearer)
			.send({ productId: 0, quantity: 1 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `quantity` is 0', async () => {
		const res = await request(app)
			.post('/api/cart')
			.set(bearer)
			.send({ productId: 1, quantity: 0 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `quantity` exceeds 100', async () => {
		const res = await request(app)
			.post('/api/cart')
			.set(bearer)
			.send({ productId: 1, quantity: 101 });
		expect(res.status).toBe(400);
	});

	it('accepts a valid body — mocked pg returns undefined so insert path is exercised', async () => {
		// The mocked pg's `.get()` returns undefined, so the route
		// does NOT take the "existing" branch and instead attempts an
		// INSERT whose `lastInsertRowid` is also null → 500. We only
		// care that validation passed.
		const res = await request(app)
			.post('/api/cart')
			.set(bearer)
			.send({ productId: 1, quantity: 2 });
		expect(res.status).not.toBe(400);
	});
});

describe('cartRouter — DELETE /api/cart/:id', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app).delete('/api/cart/abc').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 400 on id=0', async () => {
		const res = await request(app).delete('/api/cart/0').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 404 when the mock pg finds no row', async () => {
		const res = await request(app).delete('/api/cart/123').set(bearer);
		expect(res.status).toBe(404);
	});
});

describe('cartRouter — DELETE /api/cart/clear/:userId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with the count of removed items (mocked pg returns 0 changes)', async () => {
		const res = await request(app).delete('/api/cart/clear/7').set(bearer);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
	});
});

describe('cartRouter — GET /api/cart/count/:userId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with `count` (mocked pg returns 0)', async () => {
		const res = await request(app).get('/api/cart/count/7').set(bearer);
		expect(res.status).toBe(200);
		expect(res.body.data.user_id).toBe(7);
		expect(res.body.data.count).toBe(0);
	});

	it('returns 400 on a non-integer userId', async () => {
		const res = await request(app).get('/api/cart/count/abc').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 403 when a customer asks for another user count', async () => {
		const res = await request(app).get('/api/cart/count/99').set(bearer);
		expect(res.status).toBe(403);
		expect(res.body.code).toBe('FORBIDDEN');
	});

	it('returns 200 when an admin asks for another user count', async () => {
		const res = await request(app)
			.get('/api/cart/count/99')
			.set('Authorization', `Bearer ${ADMIN_TOKEN}`);
		expect(res.status).toBe(200);
	});
});
