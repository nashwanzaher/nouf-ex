/**
 * Integration tests for the store-followers router.
 *
 * `GET /api/store-followers/check?store_id=X&user_id=Y` tells the
 * storefront whether the user already follows a given store. The
 * endpoint is auth-gated and authorized against the row's user_id
 * (admins can check anyone).
 *
 * Strategy:
 *   - Drive the real `requireAuth` middleware by signing a real
 *     Bearer token with `signTestToken` (see ./test-token.ts).
 *     `requireAuth` then sets `req.user` from the verified payload.
 *   - For the 401 test, do NOT pass a token.
 *   - The mocked `pg` returns `undefined` for `.get()` and `[]` for
 *     `.all()`; the handler must tolerate that and return
 *     `following: false`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { storeFollowersRouter } from '../routes/store-followers.ts';
import { signTestToken } from './test-token';

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/store-followers', storeFollowersRouter);
	return app;
}

describe('storeFollowersRouter — GET /api/store-followers/check', () => {
	describe('without auth (no Bearer token)', () => {
		let app: Express;
		beforeEach(() => {
			app = buildApp();
		});

		it('returns 401 when no Authorization header is present', async () => {
			const res = await request(app).get('/api/store-followers/check?store_id=1&user_id=1');
			expect(res.status).toBe(401);
			expect(res.body).toMatchObject({ success: false });
		});
	});

	describe('as authenticated customer (sub=7)', () => {
		let app: Express;
		beforeEach(() => {
			app = buildApp();
		});

		it('returns 200 with the success envelope', async () => {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.get('/api/store-followers/check?store_id=1&user_id=7')
				.set('Authorization', `Bearer ${token}`);
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({ success: true });
		});

		it('returns `following: false` when the mock pg returns no row', async () => {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.get('/api/store-followers/check?store_id=1&user_id=7')
				.set('Authorization', `Bearer ${token}`);
			expect(res.body.data.following).toBe(false);
		});

		it('returns the requested store_id and user_id in the envelope', async () => {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.get('/api/store-followers/check?store_id=42&user_id=7')
				.set('Authorization', `Bearer ${token}`);
			expect(res.body.data.store_id).toBe(42);
			expect(res.body.data.user_id).toBe(7);
		});

		it('returns 403 when the customer tries to check another user', async () => {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.get('/api/store-followers/check?store_id=1&user_id=99')
				.set('Authorization', `Bearer ${token}`);
			expect(res.status).toBe(403);
			expect(res.body.code).toBe('FORBIDDEN');
		});

		it('returns 400 when `store_id` is missing', async () => {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.get('/api/store-followers/check?user_id=7')
				.set('Authorization', `Bearer ${token}`);
			expect(res.status).toBe(400);
		});

		it('returns 400 when `user_id` is missing', async () => {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.get('/api/store-followers/check?store_id=1')
				.set('Authorization', `Bearer ${token}`);
			expect(res.status).toBe(400);
		});
	});

	describe('as authenticated admin (sub=1)', () => {
		it('allows checking any user (not just self)', async () => {
			const app = buildApp();
			const token = signTestToken({ sub: 1, role: 'admin' });
			const res = await request(app)
				.get('/api/store-followers/check?store_id=1&user_id=99')
				.set('Authorization', `Bearer ${token}`);
			// Admin is allowed past the 403 check; the actual follow state
			// is `false` because the mock pg returns no row.
			expect(res.status).toBe(200);
			expect(res.body.data.following).toBe(false);
		});
	});
});
