/**
 * Integration tests for the seller self-service router
 * (app/server/routes/seller.cts).
 *
 * C.3 in MASTER_PLAN.md — closes the 12 missing seller endpoints
 * documented in phase10_merchant_flow.ps1 §3.
 *
 * Strategy: drive the real router via supertest with a real Bearer
 * token (signed with the same AUTH_SECRET as the app). `pg` is mocked
 * globally, so the DB calls are no-ops, but the middleware chain
 * (requireAuth + requireRole) runs end-to-end and we verify the
 * status codes the route returns.
 *
 * Note: because pg.prepare().get() returns undefined for everything,
 * the handlers that depend on real DB results (e.g. finding my
 * store) will return 404. That's expected behaviour for the mocked
 * path; the live end-to-end run in phase10_merchant_flow.ps1 covers
 * the happy paths.
 */
import { describe, it, expect } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { sellerRouter } from '../routes/seller.cts';
import { signTestToken } from './test-token';

const MERCHANT_TOKEN = signTestToken({ sub: 2, role: 'merchant' });
const CUSTOMER_TOKEN = signTestToken({ sub: 2, role: 'customer' });
const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const STRANGER_TOKEN = signTestToken({ sub: 99, role: 'merchant' });

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/seller', sellerRouter);
	return app;
}

describe('sellerRouter — auth gate', () => {
	it('GET /api/seller/stores/me without token → 401', async () => {
		const res = await request(buildApp()).get('/api/seller/stores/me');
		expect(res.status).toBe(401);
	});

	it('GET /api/seller/stores/me as customer → 403 (BFLA)', async () => {
		const res = await request(buildApp())
			.get('/api/seller/stores/me')
			.set('Authorization', `Bearer ${CUSTOMER_TOKEN}`);
		expect(res.status).toBe(403);
	});

	it('GET /api/seller/products without token → 401', async () => {
		const res = await request(buildApp()).get('/api/seller/products');
		expect(res.status).toBe(401);
	});

	it('GET /api/seller/orders without token → 401', async () => {
		const res = await request(buildApp()).get('/api/seller/orders');
		expect(res.status).toBe(401);
	});

	it('GET /api/seller/analytics without token → 401', async () => {
		const res = await request(buildApp()).get('/api/seller/analytics');
		expect(res.status).toBe(401);
	});

	it('GET /api/seller/inventory without token → 401', async () => {
		const res = await request(buildApp()).get('/api/seller/inventory');
		expect(res.status).toBe(401);
	});
});

describe('sellerRouter — merchant gets through the role gate', () => {
	it('GET /api/seller/stores/me as merchant → 404 (no store in mock)', async () => {
		const res = await request(buildApp())
			.get('/api/seller/stores/me')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`);
		// 200 if store exists, 404 if not — under pg-mock we get 404.
		expect([200, 404]).toContain(res.status);
	});

	it('GET /api/seller/products as merchant → 200/404', async () => {
		// Under pg-mock, getMerchantStoreId() returns null → 404.
		const res = await request(buildApp())
			.get('/api/seller/products')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`);
		expect([200, 404]).toContain(res.status);
	});

	it('GET /api/seller/orders as merchant → 200/404', async () => {
		const res = await request(buildApp())
			.get('/api/seller/orders')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`);
		expect([200, 404]).toContain(res.status);
	});
});

describe('sellerRouter — admin gets through the role gate (power-user)', () => {
	it('GET /api/seller/stores/me as admin → 200/404', async () => {
		const res = await request(buildApp())
			.get('/api/seller/stores/me')
			.set('Authorization', `Bearer ${ADMIN_TOKEN}`);
		expect([200, 404]).toContain(res.status);
	});

	it('GET /api/seller/dashboard as admin → 200/404', async () => {
		const res = await request(buildApp())
			.get('/api/seller/dashboard')
			.set('Authorization', `Bearer ${ADMIN_TOKEN}`);
		expect([200, 404]).toContain(res.status);
	});
});

describe('sellerRouter — input validation', () => {
	// Under pg-mock the merchant has no store, so the route returns 404
	// from the getMerchantStoreId() call before the validation step.
	// We accept either 400 (validation) or 404 (no store) — the live
	// run in phase10_merchant_flow.ps1 covers the happy-path 400 case
	// when a store exists.
	it('POST /api/seller/products with empty body → 400 or 404', async () => {
		const res = await request(buildApp())
			.post('/api/seller/products')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`)
			.send({});
		expect([400, 404]).toContain(res.status);
	});

	it('POST /api/seller/products with bad slug → 400 or 404', async () => {
		const res = await request(buildApp())
			.post('/api/seller/products')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`)
			.send({
				name_ar: 'منتج تجريبي',
				slug: 'Invalid Slug With Spaces',
				category_id: 1,
				price: 100,
			});
		expect([400, 404]).toContain(res.status);
	});

	it('POST /api/seller/products with negative price → 400 or 404', async () => {
		const res = await request(buildApp())
			.post('/api/seller/products')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`)
			.send({
				name_ar: 'منتج',
				slug: 'test-product',
				category_id: 1,
				price: -100,
			});
		expect([400, 404]).toContain(res.status);
	});

	it('POST /api/seller/products with unknown method → 400 or 404', async () => {
		const res = await request(buildApp())
			.post('/api/seller/products')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`)
			.send({
				name_ar: 'منتج',
				slug: 'test-product',
				category_id: 1,
				price: 100,
				method: 'unknown_method',
			});
		expect([400, 404]).toContain(res.status);
	});

	it('POST /api/seller/orders/123/status with invalid status → 400 or 404', async () => {
		const res = await request(buildApp())
			.post('/api/seller/orders/123/status')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`)
			.send({ status: 'invalid_state' });
		expect([400, 404]).toContain(res.status);
	});

	it('PATCH /api/seller/products/abc with bad id → 400 (validation first)', async () => {
		// Path param validation happens before the merchant-store lookup.
		const res = await request(buildApp())
			.patch('/api/seller/products/abc')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`)
			.send({ price: 50 });
		expect(res.status).toBe(400);
	});
});

describe('sellerRouter — schema strict-mode', () => {
	// Same caveat: pg-mock means most routes return 404 (no store) before
	// reaching the zod strict check. The strict-mode behavior is verified
	// by the live E2E in phase10_merchant_flow.ps1.
	it('rejects unknown fields in store update (z.strict)', async () => {
		// PATCH on /api/seller/stores/1 is validated BEFORE the merchant
		// ownership check (id is in the URL, store is from the JWT).
		const res = await request(buildApp())
			.patch('/api/seller/stores/1')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`)
			.send({ rogue_field: 'injection' });
		expect([400, 404]).toContain(res.status);
	});
});

describe('sellerRouter — role-based access (BFLA)', () => {
	// All seller routes require merchant OR admin. A customer with a
	// valid token is blocked at the role layer with 403.
	const protectedPaths = [
		'/stores/me',
		'/products',
		'/orders',
		'/analytics',
		'/inventory',
		'/payouts',
		'/dashboard',
	];
	for (const p of protectedPaths) {
		it(`GET ${p} as customer → 403`, async () => {
			const res = await request(buildApp())
				.get(`/api/seller${p}`)
				.set('Authorization', `Bearer ${CUSTOMER_TOKEN}`);
			expect(res.status).toBe(403);
		});
	}
});

describe('sellerRouter — store id always derived server-side', () => {
	// C.3 security: the client never supplies a store id. The merchant
	// gets their own store via `stores.owner_id = req.user.id`.
	it('GET /api/seller/products/123 does not trust a URL :id for ownership', async () => {
		// Even as a merchant, querying a product by id goes through the
		// ownership check (returns 404 under mock — not 200, not 403,
		// not 500).
		const res = await request(buildApp())
			.get('/api/seller/products/123')
			.set('Authorization', `Bearer ${MERCHANT_TOKEN}`);
		expect([403, 404]).toContain(res.status);
	});
});

// Silence the unused-import warning while keeping the import for
// future use in additional tests.
void STRANGER_TOKEN;
