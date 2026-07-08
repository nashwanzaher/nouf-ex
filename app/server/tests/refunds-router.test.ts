/**
 * Integration tests for the refunds router.
 *
 *   - POST /api/refunds                — request a refund (customer)
 *   - POST /api/refunds/:id/resolve    — approve / reject (admin)
 *
 * The customer endpoint checks that the order is owned by the
 * caller and is `paid`. The admin endpoint updates the refund's
 * status and (on approval) marks the payment as `refunded` and
 * records a `transactions` row.
 *
 * Auth strategy: drive the real `requireAuth`/`requireRole` by
 * signing a real Bearer token with `signTestToken` (see
 * ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { refundsRouter } from '../routes/refunds.ts';
import { signTestToken } from './test-token';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const customerBearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };
const adminBearer = { Authorization: `Bearer ${ADMIN_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/refunds', refundsRouter);
	return app;
}

describe('refundsRouter — auth gate', () => {
	it('POST / → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).post('/api/refunds').send({});
		expect(res.status).toBe(401);
	});

	it('POST /:id/resolve → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).post('/api/refunds/1/resolve').send({ status: 'approved' });
		expect(res.status).toBe(401);
	});
});

describe('refundsRouter — POST /api/refunds', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/refunds').set(customerBearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `reason` is too short', async () => {
		const res = await request(app)
			.post('/api/refunds')
			.set(customerBearer)
			.send({ order_id: 1, amount: 10, reason: 'ab' });
		expect(res.status).toBe(400);
	});

	it('returns 404 when the order is not found (mocked pg returns undefined)', async () => {
		const res = await request(app)
			.post('/api/refunds')
			.set(customerBearer)
			.send({ order_id: 9999, amount: 10, reason: 'Not as described' });
		expect(res.status).toBe(404);
	});
});

describe('refundsRouter — POST /api/refunds/:id/resolve (admin)', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 403 when a non-admin tries to call it', async () => {
		const res = await request(app)
			.post('/api/refunds/1/resolve')
			.set(customerBearer)
			.send({ status: 'approved' });
		expect(res.status).toBe(403);
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app)
			.post('/api/refunds/abc/resolve')
			.set(adminBearer)
			.send({ status: 'approved' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `status` is missing', async () => {
		const res = await request(app).post('/api/refunds/1/resolve').set(adminBearer).send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when `status` is not approved/rejected', async () => {
		const res = await request(app)
			.post('/api/refunds/1/resolve')
			.set(adminBearer)
			.send({ status: 'pending' });
		expect(res.status).toBe(400);
	});

	it('returns 404 when the refund is not found (mocked pg returns undefined)', async () => {
		const res = await request(app)
			.post('/api/refunds/9999/resolve')
			.set(adminBearer)
			.send({ status: 'approved' });
		expect(res.status).toBe(404);
	});

	it('accepts `approved` and returns 200 (mocked pg returns undefined → 404)', async () => {
		// The mocked pg returns no row → handler emits 404. The point
		// of this test is that the status validator accepted `approved`.
		const res = await request(app)
			.post('/api/refunds/1/resolve')
			.set(adminBearer)
			.send({ status: 'approved' });
		expect(res.status).not.toBe(400);
	});

	it('accepts `rejected`', async () => {
		const res = await request(app)
			.post('/api/refunds/1/resolve')
			.set(adminBearer)
			.send({ status: 'rejected' });
		expect(res.status).not.toBe(400);
	});

	it('accepts an optional `admin_notes` string', async () => {
		const res = await request(app)
			.post('/api/refunds/1/resolve')
			.set(adminBearer)
			.send({ status: 'approved', admin_notes: 'Reviewed by ops' });
		expect(res.status).not.toBe(400);
	});
});
