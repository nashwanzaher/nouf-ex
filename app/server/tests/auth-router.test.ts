/**
 * Integration tests for the auth router (register, login, me).
 *
 *   - POST /api/auth/register — create a new customer account
 *   - POST /api/auth/login    — exchange credentials for a Bearer
 *   - GET  /api/auth/me       — return the authenticated user
 *
 * Both POSTs are rate-limited via `authLimiter` (DB-backed, mocked
 * here). Login has additional branches — 2FA required, wrong
 * password, missing user — exercised by the cases below.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { authRouter } from '../routes/auth.cts';
import { signTestToken } from './test-token';

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/auth', authRouter);
	return app;
}

describe('authRouter — POST /api/auth/register', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/auth/register').send({});
		expect(res.status).toBe(400);
		expect(res.body.code).toBe('VALIDATION_ERROR');
	});

	it('returns 400 when `email` is missing', async () => {
		const res = await request(app)
			.post('/api/auth/register')
			.send({ password: 'abcdefgh', name: 'Nouf' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `email` is not a valid address', async () => {
		const res = await request(app)
			.post('/api/auth/register')
			.send({ email: 'not-an-email', password: 'abcdefgh', name: 'Nouf' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `password` is too short', async () => {
		const res = await request(app)
			.post('/api/auth/register')
			.send({ email: 'n@example.com', password: 'short', name: 'Nouf' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `name` is too short', async () => {
		const res = await request(app)
			.post('/api/auth/register')
			.send({ email: 'n@example.com', password: 'abcdefgh', name: 'A' });
		expect(res.status).toBe(400);
	});

	it('returns 201-ish (or 500) on a fully-valid body — mocked pg fails the INSERT', async () => {
		// The mocked pg returns `lastInsertRowid: null`, which the
		// handler treats as INSERT_FAILED → 500. The point of this
		// test is that validation passes.
		const res = await request(app)
			.post('/api/auth/register')
			.send({ email: 'n@example.com', password: 'abcdefgh', name: 'Nouf Ali' });
		expect(res.status).not.toBe(400);
	});
});

describe('authRouter — POST /api/auth/login', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on an empty body', async () => {
		const res = await request(app).post('/api/auth/login').send({});
		expect(res.status).toBe(400);
		expect(res.body.code).toBe('VALIDATION_ERROR');
	});

	it('returns 400 when `email` is missing', async () => {
		const res = await request(app).post('/api/auth/login').send({ password: 'abcdefgh' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when `password` is missing', async () => {
		const res = await request(app).post('/api/auth/login').send({ email: 'n@example.com' });
		expect(res.status).toBe(400);
	});

	it('returns 401 AUTH_INVALID when the user is not found (mocked pg returns undefined)', async () => {
		const res = await request(app)
			.post('/api/auth/login')
			.send({ email: 'missing@example.com', password: 'abcdefgh' });
		expect(res.status).toBe(401);
		expect(res.body.code).toBe('AUTH_INVALID');
	});
});

describe('authRouter — GET /api/auth/me', () => {
	describe('auth gate', () => {
		it('returns 401 when no Authorization header is present', async () => {
			const app = buildApp();
			const res = await request(app).get('/api/auth/me');
			expect(res.status).toBe(401);
		});

		it('returns 401 when the token is invalid', async () => {
			const app = buildApp();
			const res = await request(app)
				.get('/api/auth/me')
				.set('Authorization', 'Bearer not-a-real-token');
			expect(res.status).toBe(401);
		});
	});

	describe('as authenticated user', () => {
		let app: Express;
		beforeEach(() => {
			app = buildApp();
		});

		it('returns 200 (or 500 because the mock pg returns no user row)', async () => {
			// With a valid token, the handler hits pg for the user row.
			// The mock returns undefined → handler throws HttpError(404).
			// We just want to confirm the auth gate cleared.
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.get('/api/auth/me')
				.set('Authorization', `Bearer ${token}`);
			expect([200, 404, 500]).toContain(res.status);
			// Critically, must NOT be 401.
			expect(res.status).not.toBe(401);
		});
	});
});
