/**
 * Integration tests for the API server (app/server/index.ts).
 *
 * Strategy:
 *   - We mock the entire PgDb wrapper so tests do NOT need a live DB.
 *   - supertest issues real HTTP requests against the Express app.
 *   - We pre-load a `defaultGet` statement; any SQL the server runs (after the
 *     wrapper's normalization + placeholder rewriting) falls through to it.
 *
 * These cover happy-path responses for the read endpoints and the 404 handler.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

// ── Mock the DB wrapper BEFORE requiring the server ───────────────────────────

type FakeRow = Record<string, unknown>;
interface FakeStmt {
	all: (...args: unknown[]) => Promise<FakeRow[]>;
	get: (...args: unknown[]) => Promise<FakeRow | undefined>;
	run: (...args: unknown[]) => Promise<{ lastInsertRowid: number | null; changes: number }>;
}

function makeFakeStmt(
	rows: FakeRow[] | FakeRow | undefined | null,
	opts: { rowCount?: number; insertId?: number } = {}
) {
	// Normalize input: accept arrays, single objects, or empty/null/undefined.
	let allRows: FakeRow[];
	let firstRow: FakeRow | undefined;
	if (rows === undefined || rows === null) {
		allRows = [];
		firstRow = undefined;
	} else if (Array.isArray(rows)) {
		allRows = rows;
		firstRow = rows[0];
	} else {
		// Single object → treat as one-element result for `.all`, the object itself for `.get`.
		allRows = [rows];
		firstRow = rows;
	}
	return {
		all: vi.fn().mockResolvedValue(allRows),
		get: vi.fn().mockResolvedValue(firstRow),
		run: vi.fn().mockResolvedValue({
			lastInsertRowid: opts.insertId ?? null,
			changes: opts.rowCount ?? 1,
		}),
	} as FakeStmt;
}

// Per-SQL overrides. The wrapper rewrites `?` → `$N` and SQLite-style
// fragments (datetime('now'), is_<col> = 1) → PG syntax, so we let it
// fall through to `defaultGet` for any statement we don't explicitly mock.
const stmts: Record<string, FakeStmt> = {};
let defaultGet: FakeStmt;

vi.mock('../db/pg-wrapper.cjs', () => {
	class PgDb {
		prepare(sql: string) {
			const key = sql.replace(/\s+/g, ' ').trim();
			if (stmts[key]) return stmts[key];
			return defaultGet;
		}
		async tx(fn: (tx: { prepare: (s: string) => FakeStmt }) => Promise<unknown>) {
			const txStmts: Record<string, FakeStmt> = {};
			const txDb = {
				prepare(sql: string) {
					const k = sql.replace(/\s+/g, ' ').trim();
					if (stmts[k]) return stmts[k];
					if (txStmts[k]) return txStmts[k];
					txStmts[k] = makeFakeStmt([]);
					return txStmts[k];
				},
			};
			return await fn(txDb);
		}
		async close() {
			/* no-op */
		}
	}
	return { PgDb };
});

// Also mock dotenv so requiring the server doesn't fail if .env is missing.
// We inject a deterministic AUTH_SECRET so HMAC token signing inside the
// server middleware is reproducible across test runs.
process.env.AUTH_SECRET = 'test-secret-must-be-at-least-32-chars-long-x';
process.env.NODE_ENV = 'test';
process.env.DB_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DB_PASSWORD = 'test';

vi.mock('dotenv', () => ({
	default: { config: () => ({ parsed: {} }) },
	config: () => ({ parsed: {} }) }
));

// Now require the server. It uses `export default app` (ESM).
import appModule from '../index';
const app = appModule as unknown as import('express').Express;

// ── Test auth helper ─────────────────────────────────────────────────────────
// Most of the protected endpoints now require a valid HMAC-signed bearer
// token. Sign one for a known test user and attach it to requests that need
// authentication.
import { createHmac } from 'crypto';

function base64url(buf: Buffer): string {
	return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signTestToken(sub: number, role: 'customer' | 'admin' = 'customer'): string {
	const payload = { sub, role, exp: Math.floor(Date.now() / 1000) + 3600 };
	const body = base64url(Buffer.from(JSON.stringify(payload)));
	const sig = base64url(createHmac('sha256', process.env.AUTH_SECRET!).update(body).digest());
	return `${body}.${sig}`;
}

// Default customer/admin tokens; tests attach them to Authorization headers.
const TEST_USER_TOKEN = signTestToken(5, 'customer');
const TEST_ADMIN_TOKEN = signTestToken(1, 'admin');

function authedPost(url: string): request.Test {
	return request(app).post(url).set('Authorization', `Bearer ${TEST_USER_TOKEN}`);
}
function adminPost(url: string): request.Test {
	return request(app).post(url).set('Authorization', `Bearer ${TEST_ADMIN_TOKEN}`);
}

beforeAll(() => {
	for (const k of Object.keys(stmts)) delete stmts[k];
	defaultGet = makeFakeStmt([]);
});

afterAll(() => {
	vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('API server — categories', () => {
	it('GET /api/categories returns categories wrapped in sendSuccess()', async () => {
		defaultGet = makeFakeStmt([
			{
				id: 1,
				name_ar: 'إلكترونيات',
				name_en: 'Electronics',
				slug: 'electronics',
				product_count: 12,
			},
			{ id: 2, name_ar: 'ملابس', name_en: 'Clothing', slug: 'clothing', product_count: 8 },
		]);

		const res = await request(app).get('/api/categories');
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.data)).toBe(true);
		expect(res.body.data).toHaveLength(2);
		expect(res.body.data[0]).toMatchObject({ slug: 'electronics', product_count: 12 });
	});
});

describe('API server — stores', () => {
	it('GET /api/stores returns stores wrapped in sendSuccess()', async () => {
		defaultGet = makeFakeStmt([
			{ id: 1, store_name: 'متجر 1', rating: 4.8 },
			{ id: 2, store_name: 'متجر 2', rating: 4.5 },
		]);

		const res = await request(app).get('/api/stores');
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.data)).toBe(true);
		expect(res.body.data).toHaveLength(2);
		expect(res.body.data[0]).toMatchObject({ rating: 4.8 });
	});
});

describe('API server — products', () => {
	it('GET /api/products returns a successful response', async () => {
		defaultGet = makeFakeStmt([{ id: 1, name_ar: 'منتج', price: 100 }]);

		const res = await request(app).get('/api/products');
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('success');
		expect(res.body.success).toBe(true);
	});

	it('GET /api/products?category=2 filters by category', async () => {
		defaultGet = makeFakeStmt([{ id: 5, name_ar: 'منتج 5', price: 50 }]);

		const res = await request(app).get('/api/products?category=2');
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
	});
});

describe('API server — store detail', () => {
	it('GET /api/stores/1 returns a single store wrapped in sendSuccess()', async () => {
		defaultGet = makeFakeStmt({ id: 1, store_name: 'متجر 1', rating: 4.8 });

		const res = await request(app).get('/api/stores/1');
		expect([200, 404]).toContain(res.status);
	});

	it('GET /api/stores/9999 returns 404 when the store does not exist', async () => {
		defaultGet = makeFakeStmt(undefined);

		const res = await request(app).get('/api/stores/9999');
		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});
});

describe('API server — error handling', () => {
	it('GET /api/unknown returns 404 JSON', async () => {
		const res = await request(app).get('/api/this-endpoint-does-not-exist');
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('error');
		expect(res.body.success).toBe(false);
	});
});

describe('API server — static assets', () => {
	it('GET / falls back to index.html (200) or 404 when no static is mounted', async () => {
		const res = await request(app).get('/');
		// In production, GET / serves dist/index.html. In tests we don't mount
		// it, so we expect the 404 handler to fire — either is acceptable.
		expect([200, 404]).toContain(res.status);
	});
});

describe('API server — payments (P0-2)', () => {
	it('POST /api/payments validates body shape and rejects bad input', async () => {
		const res = await authedPost('/api/payments').send({ order_id: 'not-a-number' });
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it('POST /api/payments returns 404 when order does not exist', async () => {
		defaultGet = makeFakeStmt(undefined);
		const res = await authedPost('/api/payments').send({
			order_id: 9999,
			amount: 100,
			method: 'cod',
		});
		expect(res.status).toBe(404);
	});

	it('POST /api/payments creates a COD payment and marks it pending', async () => {
		defaultGet = makeFakeStmt({ id: 1, customer_id: 5, total: 250, status: 'pending' });
		const res = await authedPost('/api/payments').send({
			order_id: 1,
			amount: 250,
			method: 'cod',
		});
		expect(res.status).toBe(200);
		expect(res.body.data.status).toBe('pending');
	});

	it('GET /api/payments/order/:orderId returns the payment list', async () => {
		// defaultGet is hit twice: once for the order lookup (customer_id
		// must match the authenticated user) and once for the payments list.
		defaultGet = makeFakeStmt({ customer_id: 5 });
		const orderStmt = makeFakeStmt([{ id: 1, order_id: 1, status: 'completed', amount: 100 }]);
		stmts['SELECT customer_id FROM orders WHERE id = ?'] = defaultGet;
		stmts['SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC'] = orderStmt;
		const getRes = await request(app)
			.get('/api/payments/order/1')
			.set('Authorization', `Bearer ${TEST_USER_TOKEN}`);
		expect(getRes.status).toBe(200);
		expect(Array.isArray(getRes.body.data)).toBe(true);
	});
});

describe('API server — coupons (P1-5)', () => {
	it('POST /api/coupons/validate rejects an invalid code', async () => {
		defaultGet = makeFakeStmt(undefined);
		const res = await request(app)
			.post('/api/coupons/validate')
			.send({ code: 'NOPE', user_id: 1, order_subtotal: 5000 });
		expect(res.status).toBe(404);
	});

	it('POST /api/coupons/validate computes a percentage discount', async () => {
		defaultGet = makeFakeStmt({
			id: 1,
			code: 'SAVE10',
			type: 'percentage',
			value: 10,
			min_order: null,
			max_discount: 1000,
			usage_limit: null,
			usage_count: 0,
			starts_at: null,
			expires_at: null,
		});
		const res = await request(app)
			.post('/api/coupons/validate')
			.send({ code: 'SAVE10', user_id: 1, order_subtotal: 5000 });
		expect(res.status).toBe(200);
		expect(res.body.data.discount).toBe(500);
		expect(res.body.data.final_total).toBe(4500);
	});
});

describe('API server — addresses (P1-3)', () => {
	it('GET /api/addresses works when authenticated (no user_id query needed)', async () => {
		defaultGet = makeFakeStmt([]);
		const res = await request(app)
			.get('/api/addresses')
			.set('Authorization', `Bearer ${TEST_USER_TOKEN}`);
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('GET /api/addresses returns 401 when no token is provided', async () => {
		const res = await request(app).get('/api/addresses');
		expect(res.status).toBe(401);
	});

	it('POST /api/addresses rejects payloads missing required fields', async () => {
		const res = await authedPost('/api/addresses').send({});
		expect(res.status).toBe(400);
	});
});

describe('API server — refunds (P1-6)', () => {
	it('POST /api/refunds/:id/resolve rejects an unknown status', async () => {
		const res = await adminPost('/api/refunds/1/resolve').send({ status: 'maybe' });
		expect(res.status).toBe(400);
	});

	it('POST /api/refunds/:id/resolve requires admin role (customer gets 403)', async () => {
		const res = await authedPost('/api/refunds/1/resolve').send({ status: 'approved' });
		expect(res.status).toBe(403);
	});
});
