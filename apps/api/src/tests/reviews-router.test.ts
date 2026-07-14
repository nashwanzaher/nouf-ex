/**
 * Integration tests for the reviews router.
 *
 *   - GET  /api/reviews?productId=&storeId=   — public, visible-only
 *   - POST /api/reviews                      — auth-gated, verified
 *     purchase guard
 *
 * The GET is unauthenticated; the POST is `requireAuth` and
 * additionally checks that the user has ordered the product. The
 * mocked `pg` returns empty rows, so verified-purchase is always
 * `false` in these tests — that exercises the insert path but with
 * `is_verified = 0`. The insert itself fails with INSERT_FAILED
 * (500) because the mocked pg's `lastInsertRowid` is `null`; we
 * only assert that validation and auth pass.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { reviewsRouter } from '../routes/reviews.ts';
import { signTestToken } from './test-token';

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/reviews', reviewsRouter);
	return app;
}

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const bearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };

describe('reviewsRouter — GET /api/reviews', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with an array envelope', async () => {
		const res = await request(app).get('/api/reviews');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('does NOT require an Authorization header', async () => {
		const res = await request(app).get('/api/reviews?productId=1');
		expect(res.status).not.toBe(401);
		expect(res.status).not.toBe(403);
	});

	it('accepts a `storeId` filter without erroring', async () => {
		const res = await request(app).get('/api/reviews?storeId=3');
		expect(res.status).toBe(200);
	});

	it('accepts both filters together without erroring', async () => {
		const res = await request(app).get('/api/reviews?productId=1&storeId=2');
		expect(res.status).toBe(200);
	});
});

describe('reviewsRouter — POST /api/reviews', () => {
	describe('auth gate', () => {
		it('returns 401 when no Authorization header', async () => {
			const app = buildApp();
			const res = await request(app).post('/api/reviews').send({ productId: 1, rating: 5 });
			expect(res.status).toBe(401);
		});
	});

	describe('as authenticated customer (sub=7)', () => {
		let app: Express;
		beforeEach(() => {
			app = buildApp();
		});

		it('returns 400 on an empty body', async () => {
			const res = await request(app).post('/api/reviews').set(bearer).send({});
			expect(res.status).toBe(400);
		});

		it('returns 400 when `rating` is out of range (0)', async () => {
			const res = await request(app)
				.post('/api/reviews')
				.set(bearer)
				.send({ productId: 1, rating: 0 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when `rating` is out of range (6)', async () => {
			const res = await request(app)
				.post('/api/reviews')
				.set(bearer)
				.send({ productId: 1, rating: 6 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when `productId` is missing', async () => {
			const res = await request(app).post('/api/reviews').set(bearer).send({ rating: 5 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when `title` exceeds 200 chars', async () => {
			const res = await request(app)
				.post('/api/reviews')
				.set(bearer)
				.send({ productId: 1, rating: 5, title: 'x'.repeat(201) });
			expect(res.status).toBe(400);
		});

		it('accepts a minimal valid review (rating only) — passes validation', async () => {
			// Validation passes; the handler then attempts to insert and
			// the mocked pg's `lastInsertRowid` is `null`, which surfaces
			// as a 500 (INSERT_FAILED). We assert it is NOT a 400.
			const res = await request(app)
				.post('/api/reviews')
				.set(bearer)
				.send({ productId: 1, rating: 5 });
			expect(res.status).not.toBe(400);
		});

		it('accepts a full review body with title + comment — passes validation', async () => {
			const res = await request(app).post('/api/reviews').set(bearer).send({
				productId: 1,
				storeId: 1,
				rating: 4,
				title: 'Solid product',
				comment: 'Would buy again.',
			});
			expect(res.status).not.toBe(400);
		});
	});
});
