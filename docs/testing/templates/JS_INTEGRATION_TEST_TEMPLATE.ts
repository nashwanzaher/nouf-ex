/**
 * __RESOURCE__-router — integration tests
 * ----------------------------------------------------------------------------
 * IEEE 829-2008 §8-compliant Vitest template for new server-side router
 * tests. Mirrors the structure of tests/e2e/phaseNN_*.ps1 (A.2) so that
 * E2E and integration coverage stay in lock-step.
 *
 * Endpoints covered (replace with the real verbs):
 *   GET    /api/__RESOURCE__/:userId   — list the user's __RESOURCE__
 *   POST   /api/__RESOURCE__           — create / increment
 *   PATCH  /api/__RESOURCE__/:id       — partial update
 *   DELETE /api/__RESOURCE__/:id       — remove an item
 *
 * Auth strategy: drive the real requireAuth by signing a real Bearer
 * token with signTestToken. The token uses the same AUTH_SECRET as the
 * API, so requireAuth accepts it and the handler runs end-to-end
 * (only `pg` is mocked globally via mocks/setup.ts).
 *
 * Copy this file to app/server/tests/__RESOURCE__-router.test.ts and
 * replace every __PLACEHOLDER__ with real values (most editors have a
 * "rename symbol" command that handles this in one shot).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
// ↓↓↓ Adjust the named export below to match the router under test.
import { __RESOURCE__Router } from '../routes/__RESOURCE__.cts';
import { signTestToken } from './test-token';

// ----------------------------------------------------------------------------
// Test token fixtures (ISTQB CTFL: equivalence partitioning — 3 roles)
// ----------------------------------------------------------------------------
const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const MERCHANT_TOKEN = signTestToken({ sub: 2, role: 'merchant' });
const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const STRANGER_TOKEN = signTestToken({ sub: 99, role: 'customer' });

const bearerCustomer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };
const bearerMerchant = { Authorization: `Bearer ${MERCHANT_TOKEN}` };
const bearerAdmin = { Authorization: `Bearer ${ADMIN_TOKEN}` };
const bearerStranger = { Authorization: `Bearer ${STRANGER_TOKEN}` };

/**
 * Build a minimal Express app with only the router under test mounted.
 * trust proxy is set so X-Forwarded-For is honored in real deployments;
 * json parsing is enabled because most routes accept a JSON body.
 */
function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/__RESOURCE__', __RESOURCE__Router);
	return app;
}

// ============================================================================
// 1. Auth gate — ISTQB CTFL: boundary value analysis
// ============================================================================
describe('__RESOURCE__Router — auth gate', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('GET /:userId → 401 without token', async () => {
		const res = await request(app).get('/api/__RESOURCE__/7');
		expect(res.status).toBe(401);
	});

	it('GET /:userId → 401 with malformed Authorization header', async () => {
		const res = await request(app)
			.get('/api/__RESOURCE__/7')
			.set('Authorization', 'Bearer not.a.real.jwt');
		expect(res.status).toBe(401);
	});

	it('POST / → 401 without token', async () => {
		const res = await request(app).post('/api/__RESOURCE__').send({ foo: 'bar' });
		expect(res.status).toBe(401);
	});

	it('PATCH /:id → 401 without token', async () => {
		const res = await request(app).patch('/api/__RESOURCE__/1').send({ qty: 2 });
		expect(res.status).toBe(401);
	});

	it('DELETE /:id → 401 without token', async () => {
		const res = await request(app).delete('/api/__RESOURCE__/1');
		expect(res.status).toBe(401);
	});
});

// ============================================================================
// 2. GET /api/__RESOURCE__/:userId
// ============================================================================
describe('__RESOURCE__Router — GET /api/__RESOURCE__/:userId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with the success envelope + array data', async () => {
		const res = await request(app).get('/api/__RESOURCE__/7').set(bearerCustomer);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('returns Content-Type: application/json', async () => {
		const res = await request(app).get('/api/__RESOURCE__/7').set(bearerCustomer);
		expect(res.headers['content-type']).toMatch(/json/);
	});

	it('returns 403 when a customer asks for another user (ownership guard)', async () => {
		const res = await request(app).get('/api/__RESOURCE__/99').set(bearerCustomer);
		expect(res.status).toBe(403);
		expect(res.body.code).toBe('FORBIDDEN');
	});

	it('returns 200 when an admin asks for another user', async () => {
		const res = await request(app).get('/api/__RESOURCE__/99').set(bearerAdmin);
		expect(res.status).toBe(200);
	});

	it('returns 400 on a non-integer userId', async () => {
		const res = await request(app).get('/api/__RESOURCE__/abc').set(bearerCustomer);
		expect(res.status).toBe(400);
	});

	it('returns 400 on userId = 0 (boundary)', async () => {
		const res = await request(app).get('/api/__RESOURCE__/0').set(bearerCustomer);
		expect(res.status).toBe(400);
	});
});

// ============================================================================
// 3. POST /api/__RESOURCE__ — validation (ISTQB CTFL: equivalence partitioning)
// ============================================================================
describe('__RESOURCE__Router — POST /api/__RESOURCE__', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/__RESOURCE__').set(bearerCustomer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when requiredField is missing', async () => {
		const res = await request(app)
			.post('/api/__RESOURCE__')
			.set(bearerCustomer)
			.send({ otherField: 'x' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when requiredField is empty string', async () => {
		const res = await request(app)
			.post('/api/__RESOURCE__')
			.set(bearerCustomer)
			.send({ requiredField: '' });
		expect(res.status).toBe(400);
	});

	it('accepts a valid body — mocked pg returns undefined so insert path is exercised', async () => {
		// The mocked pg's .get() returns undefined, so the route does NOT
		// take the "existing" branch and instead attempts an INSERT whose
		// lastInsertRowid is also null → 500. We only assert that
		// validation passed (status !== 400).
		const res = await request(app)
			.post('/api/__RESOURCE__')
			.set(bearerCustomer)
			.send({ requiredField: 'valid', productId: 1, quantity: 2 });
		expect(res.status).not.toBe(400);
	});
});

// ============================================================================
// 4. PATCH /api/__RESOURCE__/:id
// ============================================================================
describe('__RESOURCE__Router — PATCH /api/__RESOURCE__/:id', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app)
			.patch('/api/__RESOURCE__/abc')
			.set(bearerCustomer)
			.send({ quantity: 5 });
		expect(res.status).toBe(400);
	});

	it('returns 400 on id = 0', async () => {
		const res = await request(app)
			.patch('/api/__RESOURCE__/0')
			.set(bearerCustomer)
			.send({ quantity: 5 });
		expect(res.status).toBe(400);
	});

	it('returns 404 when the mocked pg finds no row', async () => {
		const res = await request(app)
			.patch('/api/__RESOURCE__/123')
			.set(bearerCustomer)
			.send({ quantity: 5 });
		expect(res.status).toBe(404);
	});

	it('returns 403 or 404 when the row belongs to another user', async () => {
		// To exercise the strict 403 branch you must mock pg to RETURN a
		// row for a different user. See customer-mutations.test.ts for
		// the canonical pattern of overriding the global pg mock.
		const res = await request(app)
			.patch('/api/__RESOURCE__/1')
			.set(bearerStranger)
			.send({ quantity: 5 });
		expect([403, 404]).toContain(res.status);
	});
});

// ============================================================================
// 5. DELETE /api/__RESOURCE__/:id
// ============================================================================
describe('__RESOURCE__Router — DELETE /api/__RESOURCE__/:id', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app).delete('/api/__RESOURCE__/abc').set(bearerCustomer);
		expect(res.status).toBe(400);
	});

	it('returns 404 when the mocked pg finds no row', async () => {
		const res = await request(app).delete('/api/__RESOURCE__/123').set(bearerCustomer);
		expect(res.status).toBe(404);
	});

	it('returns 200 with the deleted id (mocked pg returns a row)', async () => {
		const res = await request(app).delete('/api/__RESOURCE__/1').set(bearerCustomer);
		expect(res.status).toBe(200);
		expect(res.body.data.id).toBeDefined();
	});
});

// ============================================================================
// 6. Idempotency — DELETE twice → first 200, second 404
// ============================================================================
describe('__RESOURCE__Router — idempotency', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('DELETE same id twice → second call returns 404', async () => {
		const first = await request(app).delete('/api/__RESOURCE__/1').set(bearerCustomer);
		const second = await request(app).delete('/api/__RESOURCE__/1').set(bearerCustomer);
		expect(first.status).toBe(200);
		expect(second.status).toBe(404);
	});
});

// ============================================================================
// 7. Cleanup — reset all mocks between tests so assertions don't leak
// ============================================================================
afterEach(() => {
	vi.restoreAllMocks();
});