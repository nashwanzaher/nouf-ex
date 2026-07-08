/**
 * Integration tests for the public stats router.
 *
 * `GET /api/stats/home` is the only endpoint and it is
 * unauthenticated. The mocked `pg` driver returns empty rows
 * (see `mocks/setup.ts`), so we can only assert the envelope
 * shape and the four expected count buckets.
 *
 * What we cover:
 *   - The route is mounted at the right path
 *   - 200 with the success envelope on GET /home
 *   - `data.counts` has the four documented keys
 *     (products, stores, orders, users)
 *   - `data.featured` and `data.deals` are arrays (the mocked
 *     `pg.all()` returns `[]`)
 *   - No auth required — the endpoint responds without an
 *     `Authorization` header
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { statsRouter } from '../routes/stats.ts';

function buildApp(): Express {
	const app = express();
	app.use(express.json());
	// No requestId / optionalAuth stub — the route does not read them.
	app.use('/api/stats', statsRouter);
	return app;
}

describe('statsRouter — GET /api/stats/home', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with the success envelope and no auth required', async () => {
		const res = await request(app).get('/api/stats/home');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(res.body).toHaveProperty('data');
	});

	it('exposes the four documented count buckets', async () => {
		const res = await request(app).get('/api/stats/home');
		expect(res.body.data).toHaveProperty('counts');
		const { counts } = res.body.data as { counts: Record<string, unknown> };
		expect(counts).toHaveProperty('products');
		expect(counts).toHaveProperty('stores');
		expect(counts).toHaveProperty('orders');
		expect(counts).toHaveProperty('users');
	});

	it('returns arrays for `featured` and `deals` (mocked pg returns [])', async () => {
		const res = await request(app).get('/api/stats/home');
		expect(Array.isArray(res.body.data.featured)).toBe(true);
		expect(Array.isArray(res.body.data.deals)).toBe(true);
	});

	it('does NOT require an Authorization header', async () => {
		// Explicitly no header — would 401 if requireAuth were attached.
		const res = await request(app).get('/api/stats/home');
		expect(res.status).not.toBe(401);
		expect(res.status).not.toBe(403);
	});

	it('returns Content-Type: application/json', async () => {
		const res = await request(app).get('/api/stats/home');
		expect(res.headers['content-type']).toMatch(/json/);
	});

	it('returns 404 for an UNKNOWN sub-path (route is /home only)', async () => {
		const res = await request(app).get('/api/stats/anything-else');
		// No mount for that sub-path → Express's default 404.
		expect(res.status).toBe(404);
	});
});
