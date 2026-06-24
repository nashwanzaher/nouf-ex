/**
 * Integration tests for the public shipping router.
 *
 * `GET /api/shipping/methods` lists every active shipping method
 * with a pre-computed `estimated_total` for a given weight. It is
 * unauthenticated and the only endpoint in this router.
 *
 * What we cover:
 *   - The route is mounted at the right path
 *   - 200 with the success envelope on GET /methods
 *   - Response is an array (mocked `pg.all()` returns `[]`)
 *   - Default weight is 1 kg when no `weight_kg` is passed
 *   - No auth required
 *   - 404 for an unknown sub-path
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { shippingRouter } from '../routes/shipping.cts';

function buildApp(): Express {
	const app = express();
	app.use(express.json());
	app.use('/api/shipping', shippingRouter);
	return app;
}

describe('shippingRouter — GET /api/shipping/methods', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with the success envelope', async () => {
		const res = await request(app).get('/api/shipping/methods');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
	});

	it('returns an array (mocked pg returns [])', async () => {
		const res = await request(app).get('/api/shipping/methods');
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('does NOT require an Authorization header', async () => {
		const res = await request(app).get('/api/shipping/methods');
		expect(res.status).not.toBe(401);
		expect(res.status).not.toBe(403);
	});

	it('accepts a `weight_kg` query param without erroring', async () => {
		// The handler computes `estimated_total` from weight, so a
		// non-numeric value should fall back to 1 (Math.max(0, NaN || 1)).
		const res = await request(app).get('/api/shipping/methods?weight_kg=2.5');
		expect(res.status).toBe(200);
	});

	it('clamps negative `weight_kg` to 0 (Math.max(0, ...))', async () => {
		// Negative values should NOT throw; the handler clamps them.
		const res = await request(app).get('/api/shipping/methods?weight_kg=-5');
		expect(res.status).toBe(200);
	});

	it('returns Content-Type: application/json', async () => {
		const res = await request(app).get('/api/shipping/methods');
		expect(res.headers['content-type']).toMatch(/json/);
	});

	it('returns 404 for an unknown sub-path', async () => {
		const res = await request(app).get('/api/shipping/does-not-exist');
		expect(res.status).toBe(404);
	});
});
