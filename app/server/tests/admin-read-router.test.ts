/**
 * Integration tests for the admin-read router.
 *
 *   - GET /api/admin/users
 *   - GET /api/admin/stores
 *   - GET /api/admin/products
 *   - GET /api/admin/orders
 *   - GET /api/admin/disputes
 *   - GET /api/admin/audit-log
 *   - GET /api/admin/stats
 *
 * Every endpoint requires `requireAuth` + `requireRole('admin')`.
 * The mocked `pg` returns no rows / undefined so the handlers
 * return empty arrays and the count queries return undefined
 * (covered in the route-level defensive test below).
 *
 * Auth strategy: drive the real `requireAuth` / `requireRole` by
 * signing a real Bearer token with `signTestToken` (see
 * ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { adminReadRouter } from '../routes/admin-read.cts';
import { signTestToken } from './test-token';

const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const adminBearer = { Authorization: `Bearer ${ADMIN_TOKEN}` };
const customerBearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/admin', adminReadRouter);
	return app;
}

describe('adminReadRouter — auth gate', () => {
	const paths = [
		'/api/admin/users',
		'/api/admin/stores',
		'/api/admin/products',
		'/api/admin/orders',
		'/api/admin/disputes',
		'/api/admin/audit-log',
		'/api/admin/stats',
	];
	for (const p of paths) {
		it(`GET ${p} → 401 without token`, async () => {
			const app = buildApp();
			const res = await request(app).get(p);
			expect(res.status).toBe(401);
		});
		it(`GET ${p} → 403 for a non-admin customer`, async () => {
			const app = buildApp();
			const res = await request(app).get(p).set(customerBearer);
			expect(res.status).toBe(403);
		});
	}
});

describe('adminReadRouter — GET /api/admin/users', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with envelope { users, total, limit, offset }', async () => {
		const res = await request(app).get('/api/admin/users').set(adminBearer);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data.users)).toBe(true);
		expect(res.body.data).toHaveProperty('total');
		expect(res.body.data).toHaveProperty('limit');
		expect(res.body.data).toHaveProperty('offset');
	});

	it('accepts a `role` filter', async () => {
		const res = await request(app).get('/api/admin/users?role=admin').set(adminBearer);
		expect(res.status).toBe(200);
	});

	it('rejects an unknown role', async () => {
		const res = await request(app).get('/api/admin/users?role=superuser').set(adminBearer);
		expect(res.status).toBe(400);
	});

	it('rejects `limit` greater than 100 (the schema max)', async () => {
		const res = await request(app).get('/api/admin/users?limit=99999').set(adminBearer);
		expect(res.status).toBe(400);
	});
});

describe('adminReadRouter — GET /api/admin/stores', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with envelope { stores, total, limit, offset }', async () => {
		const res = await request(app).get('/api/admin/stores').set(adminBearer);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data.stores)).toBe(true);
	});

	it('accepts an `is_active` filter', async () => {
		const res = await request(app).get('/api/admin/stores?is_active=true').set(adminBearer);
		expect(res.status).toBe(200);
	});

	it('rejects an unknown `is_active` value', async () => {
		const res = await request(app).get('/api/admin/stores?is_active=maybe').set(adminBearer);
		expect(res.status).toBe(400);
	});
});

describe('adminReadRouter — GET /api/admin/products', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with envelope { products, total, limit, offset }', async () => {
		const res = await request(app).get('/api/admin/products').set(adminBearer);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data.products)).toBe(true);
	});

	it('accepts an `is_active` filter', async () => {
		const res = await request(app).get('/api/admin/products?is_active=true').set(adminBearer);
		expect(res.status).toBe(200);
	});

	it('accepts `store_id` and `category_id` numeric filters', async () => {
		const res = await request(app)
			.get('/api/admin/products?store_id=3&category_id=4')
			.set(adminBearer);
		expect(res.status).toBe(200);
	});

	it('rejects non-numeric `store_id`', async () => {
		const res = await request(app).get('/api/admin/products?store_id=abc').set(adminBearer);
		expect(res.status).toBe(400);
	});
});

describe('adminReadRouter — GET /api/admin/orders', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with envelope { orders, total, limit, offset }', async () => {
		const res = await request(app).get('/api/admin/orders').set(adminBearer);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data.orders)).toBe(true);
	});

	it('accepts a `status` filter', async () => {
		const res = await request(app).get('/api/admin/orders?status=shipped').set(adminBearer);
		expect(res.status).toBe(200);
	});

	it('rejects an unknown `status` value', async () => {
		const res = await request(app).get('/api/admin/orders?status=abandoned').set(adminBearer);
		expect(res.status).toBe(400);
	});
});

describe('adminReadRouter — GET /api/admin/disputes', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with envelope { disputes, total, limit, offset }', async () => {
		const res = await request(app).get('/api/admin/disputes').set(adminBearer);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data.disputes)).toBe(true);
	});

	it('accepts a `status` filter', async () => {
		const res = await request(app).get('/api/admin/disputes?status=open').set(adminBearer);
		expect(res.status).toBe(200);
	});
});

describe('adminReadRouter — GET /api/admin/audit-log', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with envelope { log, total, limit, offset }', async () => {
		const res = await request(app).get('/api/admin/audit-log').set(adminBearer);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data.log)).toBe(true);
	});

	it('accepts `entity_type` and `action` filters', async () => {
		const res = await request(app)
			.get('/api/admin/audit-log?entity_type=user&action=update')
			.set(adminBearer);
		expect(res.status).toBe(200);
	});

	it('accepts a numeric `user_id` filter', async () => {
		const res = await request(app).get('/api/admin/audit-log?user_id=7').set(adminBearer);
		expect(res.status).toBe(200);
	});
});
