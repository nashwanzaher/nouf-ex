/**
 * Integration tests for the user-addresses router.
 *
 *   - GET    /api/addresses              — list the user's addresses
 *   - POST   /api/addresses              — create a new address
 *   - DELETE /api/addresses/:id          — delete an address
 *
 * All endpoints are auth-gated and trust only `req.user!.id`. The
 * mocked `pg` returns empty rows / `undefined` so we mainly assert
 * the envelope shape, validation errors, and the auth gate.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { addressesRouter } from '../routes/addresses.ts';
import { signTestToken } from './test-token';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/addresses', addressesRouter);
	return app;
}

const validAddress = {
	label: 'Home',
	full_name: 'Nouf Ali',
	phone: '+967771122334',
	governorate: 'Sana\u02bea',
	city: 'Sana\u02bea',
	street: 'Hadda St, Building 5',
};

const bearer = (token = CUSTOMER_TOKEN) => ({
	Authorization: `Bearer ${token}`,
});

describe('addressesRouter — auth gate', () => {
	it('GET / → 401 when no Authorization header', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/addresses');
		expect(res.status).toBe(401);
	});

	it('POST / → 401 when no Authorization header', async () => {
		const app = buildApp();
		const res = await request(app).post('/api/addresses').send(validAddress);
		expect(res.status).toBe(401);
	});

	it('DELETE /:id → 401 when no Authorization header', async () => {
		const app = buildApp();
		const res = await request(app).delete('/api/addresses/1');
		expect(res.status).toBe(401);
	});
});

describe('addressesRouter — GET /api/addresses', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with an array envelope', async () => {
		const res = await request(app).get('/api/addresses').set(bearer());
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it('returns Content-Type: application/json', async () => {
		const res = await request(app).get('/api/addresses').set(bearer());
		expect(res.headers['content-type']).toMatch(/json/);
	});
});

describe('addressesRouter — POST /api/addresses', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 with a validation error on an empty body', async () => {
		const res = await request(app).post('/api/addresses').set(bearer()).send({});
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ success: false });
	});

	it('returns 400 when `label` is missing', async () => {
		const res = await request(app)
			.post('/api/addresses')
			.set(bearer())
			.send({ ...validAddress, label: undefined });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `phone` is too short', async () => {
		const res = await request(app)
			.post('/api/addresses')
			.set(bearer())
			.send({ ...validAddress, phone: '12' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `governorate` is missing', async () => {
		const res = await request(app)
			.post('/api/addresses')
			.set(bearer())
			.send({ ...validAddress, governorate: '' });
		expect(res.status).toBe(400);
	});

	it('accepts a fully-valid address and returns 200', async () => {
		const res = await request(app).post('/api/addresses').set(bearer()).send(validAddress);
		// The mocked pg's `.get()` returns `undefined`, which the handler
		// passes through `sendSuccess` (data: undefined). The envelope
		// still has success=true.
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
	});
});

describe('addressesRouter — DELETE /api/addresses/:id', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app).delete('/api/addresses/abc').set(bearer());
		expect(res.status).toBe(400);
	});

	it('returns 400 on id=0', async () => {
		const res = await request(app).delete('/api/addresses/0').set(bearer());
		expect(res.status).toBe(400);
	});

	it('returns 400 on a negative id', async () => {
		const res = await request(app).delete('/api/addresses/-3').set(bearer());
		expect(res.status).toBe(400);
	});

	it('returns 404 when the mock pg finds no row', async () => {
		// Valid id, but the mocked pg returns undefined → handler emits 404.
		const res = await request(app).delete('/api/addresses/123').set(bearer());
		expect(res.status).toBe(404);
		expect(res.body).toMatchObject({ success: false });
	});
});
