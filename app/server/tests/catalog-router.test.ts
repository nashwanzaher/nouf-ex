/**
 * Integration tests for the catalog router (Products + Stores + Categories).
 *
 * Each test mounts the `catalogRouter` in a fresh Express app and uses
 * supertest to drive it. The `pg` driver is mocked globally by
 * `tests/setup.ts`, so the pool returns empty rows for every query —
 * which is exactly what we want for these tests:
 *
 *   - The "happy path" tests verify the success envelope is correct
 *     and the route handler does not crash on an empty result set.
 *   - The 404 tests verify the route correctly distinguishes a
 *     missing row from a successful empty list.
 *   - The mount test verifies that every public route is reachable
 *     at the expected path (catches typos in the router file).
 *
 * These are pure black-box tests of the HTTP surface. The SQL itself
 * is exercised separately by the live E2E suite (see
 * `docs/audit/verify-from-scratch-2026-06-23.md`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { catalogRouter } from '../routes/catalog.cts';

// ── Test app factory ─────────────────────────────────────────────────────
/** Build a minimal Express app that mounts the catalog router. */
function buildApp(): Express {
	const app = express();
	app.use(express.json());
	// The real server has requestId + optionalAuth + requestLogger mounted
	// before the routers. We add lightweight stubs here so the handlers
	// see the fields they expect on `req` without pulling in middleware.ts
	// (which would re-import the real `db` and conflict with the global
	// `pg` mock).
	app.use((req, _res, next) => {
		(req as { id?: string }).id = 'test-req-id';
		(req as { user?: unknown }).user = undefined;
		next();
	});
	app.use('/api', catalogRouter);
	return app;
}

// ═══════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════
describe('catalogRouter — /api/products', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('GET /api/products → 200 with success envelope and a `products` array', async () => {
		const res = await request(app).get('/api/products');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		// `data` is the wrapped object — `products`, `total`, `limit`, `offset`.
		expect(res.body.data).toBeDefined();
		expect(res.body.data).toHaveProperty('products');
		expect(Array.isArray(res.body.data.products)).toBe(true);
		expect(res.body.data).toHaveProperty('total');
		expect(res.body.data).toHaveProperty('limit');
		expect(res.body.data).toHaveProperty('offset');
		expect(res.body.request_id).toBe('test-req-id');
	});

	it('GET /api/products clamps `limit` into [1, 100]', async () => {
		// A limit of 0 must be clamped to 1 (the lower bound).
		const res = await request(app).get('/api/products?limit=0');
		expect(res.status).toBe(200);
		expect(res.body.data.limit).toBe(1);
	});

	it('GET /api/products clamps `limit` to 100 for absurd values', async () => {
		const res = await request(app).get('/api/products?limit=99999');
		expect(res.status).toBe(200);
		expect(res.body.data.limit).toBe(100);
	});

	it('GET /api/products falls back to defaults when no query params are passed', async () => {
		const res = await request(app).get('/api/products');
		expect(res.status).toBe(200);
		// Defaults: limit=20, offset=0.
		expect(res.body.data.limit).toBe(20);
		expect(res.body.data.offset).toBe(0);
	});

	it('GET /api/products/featured → 200 with an array envelope', async () => {
		const res = await request(app).get('/api/products/featured');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('GET /api/products/deals → 200 with an array envelope', async () => {
		const res = await request(app).get('/api/products/deals');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('GET /api/products/123 → 404 when the product is missing', async () => {
		const res = await request(app).get('/api/products/123');
		expect(res.status).toBe(404);
		expect(res.body).toMatchObject({ success: false });
		expect(res.body.error).toMatch(/not found/i);
		expect(res.body.request_id).toBe('test-req-id');
	});
});

// ═══════════════════════════════════════════════════════════
// STORES
// ═══════════════════════════════════════════════════════════
describe('catalogRouter — /api/stores', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('GET /api/stores → 200 with an array envelope', async () => {
		const res = await request(app).get('/api/stores');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('GET /api/stores/123 → 404 when the store is missing', async () => {
		const res = await request(app).get('/api/stores/123');
		expect(res.status).toBe(404);
		expect(res.body).toMatchObject({ success: false });
		expect(res.body.error).toMatch(/not found/i);
	});

	it('GET /api/stores/123/reviews → 200 with an array envelope (visible filter only)', async () => {
		const res = await request(app).get('/api/stores/123/reviews');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════
describe('catalogRouter — /api/categories', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('GET /api/categories → 200 with an array envelope', async () => {
		const res = await request(app).get('/api/categories');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('GET /api/categories/missing-slug → 404', async () => {
		const res = await request(app).get('/api/categories/does-not-exist');
		expect(res.status).toBe(404);
		expect(res.body).toMatchObject({ success: false });
		expect(res.body.error).toMatch(/not found/i);
	});
});

// ═══════════════════════════════════════════════════════════
// SEARCH — /api/search
// ═══════════════════════════════════════════════════════════
describe('catalogRouter — GET /api/search', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 when the required `q` parameter is missing', async () => {
		const res = await request(app).get('/api/search');
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ success: false });
		expect(res.body.code).toBe('VALIDATION_ERROR');
		expect(res.body.error).toMatch(/q/i);
	});

	it('returns 400 when `q` is empty (whitespace-only)', async () => {
		// The handler trims and then rejects on the empty result.
		const res = await request(app).get('/api/search?q=%20%20');
		expect(res.status).toBe(400);
	});

	it('returns JSON with the success envelope on a valid query', async () => {
		// The mocked pg returns empty rows, so hits will be empty
		// — but the envelope shape (query, total, limit, offset,
		// duration_ms, products) is what we care about.
		const res = await request(app).get('/api/search?q=honey');
		expect(res.headers['content-type']).toMatch(/json/);
		expect(res.body).toHaveProperty('success', true);
		expect(res.body).toHaveProperty('data');
		expect(res.body.data).toHaveProperty('query', 'honey');
		expect(res.body.data).toHaveProperty('total');
		expect(res.body.data).toHaveProperty('limit');
		expect(res.body.data).toHaveProperty('offset');
		expect(res.body.data).toHaveProperty('duration_ms');
		expect(res.body.data).toHaveProperty('products');
		expect(Array.isArray(res.body.data.products)).toBe(true);
	});

	it('echoes the (trimmed) query back in the response', async () => {
		const res = await request(app).get('/api/search?q=%20%20honey%20%20');
		expect(res.body.data.query).toBe('honey');
	});

	it('clamps limit to [1, 100] and offset to >= 0', async () => {
		const res = await request(app).get('/api/search?q=honey&limit=99999&offset=-5');
		expect(res.body.data.limit).toBe(100);
		expect(res.body.data.offset).toBe(0);
	});

	it('uses default limit=20 and offset=0 when not provided', async () => {
		const res = await request(app).get('/api/search?q=honey');
		expect(res.body.data.limit).toBe(20);
		expect(res.body.data.offset).toBe(0);
	});

	it('accepts Arabic queries', async () => {
		// Mocked pg returns empty rows; the contract is the envelope.
		const res = await request(app).get('/api/search?q=' + encodeURIComponent('عسل'));
		expect(res.status).toBe(200);
		expect(res.body.data.query).toBe('عسل');
	});

	it('accepts category / store / price filter params without error', async () => {
		const res = await request(app)
			.get('/api/search?q=honey')
			.query({
				category: 'food',
				store: '1',
				minPrice: '100',
				maxPrice: '50000',
				sort: 'price_asc',
			});
		// Even with the mock returning empty rows, the envelope is
		// well-formed and the limit/offset clamps apply.
		expect(res.status).toBe(200);
		expect(res.body.data.limit).toBe(20);
	});
});

// ═══════════════════════════════════════════════════════════
// MOUNT SMOKE
// ═══════════════════════════════════════════════════════════
describe('catalogRouter — route mount smoke', () => {
	it('all 9 public catalog routes are mounted and reachable', async () => {
		// We hit each route and only assert that the response is NOT 404
		// (route not found). The 4xx outcomes we get back (404 for the
		// detail endpoints, 200 for the list endpoints) confirm the route
		// is wired up; a missing mount would return "Cannot GET ...".
		const app = buildApp();
		const paths = [
			'/api/products',
			'/api/products/featured',
			'/api/products/deals',
			'/api/products/1',
			'/api/stores',
			'/api/stores/1',
			'/api/stores/1/reviews',
			'/api/categories',
			'/api/categories/anything',
			'/api/search?q=honey',
		];
		for (const p of paths) {
			const res = await request(app).get(p);
			// "Cannot GET /api/products" surfaces as a 404 from Express's
			// default handler. Our handlers return 200 or a domain 404
			// (with our `success: false` envelope), never the Express 404
			// text body. Asserting on the body shape catches a missing
			// mount: the Express default 404 returns HTML, not JSON.
			expect(res.headers['content-type']).toMatch(/json/);
			expect(res.body).toBeDefined();
		}
	});
});
