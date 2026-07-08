/**
 * Integration tests for the wishlist router.
 *
 *   - GET    /api/wishlist/:userId  — list the user's wishlist
 *   - POST   /api/wishlist           — add a product
 *   - DELETE /api/wishlist/:id       — remove a wishlist row
 *
 * All endpoints are auth-gated and trust only `req.user!.id`.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { wishlistRouter } from '../routes/wishlist.ts';
import { signTestToken } from './test-token';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const bearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/wishlist', wishlistRouter);
	return app;
}

describe('wishlistRouter — auth gate', () => {
	it('GET /:userId → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/wishlist/7');
		expect(res.status).toBe(401);
	});

	it('POST / → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).post('/api/wishlist').send({ productId: 1 });
		expect(res.status).toBe(401);
	});

	it('DELETE /:id → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).delete('/api/wishlist/1');
		expect(res.status).toBe(401);
	});
});

describe('wishlistRouter — GET /api/wishlist/:userId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with an array envelope', async () => {
		const res = await request(app).get('/api/wishlist/7').set(bearer);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('returns Content-Type: application/json', async () => {
		const res = await request(app).get('/api/wishlist/7').set(bearer);
		expect(res.headers['content-type']).toMatch(/json/);
	});
});

describe('wishlistRouter — POST /api/wishlist', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/wishlist').set(bearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `productId` is missing', async () => {
		const res = await request(app).post('/api/wishlist').set(bearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `productId` is not positive', async () => {
		const res = await request(app).post('/api/wishlist').set(bearer).send({ productId: 0 });
		expect(res.status).toBe(400);
	});

	it('accepts a valid body — validation passes (insert may 500 due to mock pg)', async () => {
		const res = await request(app).post('/api/wishlist').set(bearer).send({ productId: 1 });
		expect(res.status).not.toBe(400);
	});
});

describe('wishlistRouter — DELETE /api/wishlist/:id', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app).delete('/api/wishlist/abc').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 400 on id=0', async () => {
		const res = await request(app).delete('/api/wishlist/0').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 404 when the mock pg finds no row', async () => {
		const res = await request(app).delete('/api/wishlist/123').set(bearer);
		expect(res.status).toBe(404);
	});
});
