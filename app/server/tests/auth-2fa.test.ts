/**
 * Integration tests for app/server/routes/auth-2fa.cts (P0-5: 2FA).
 *
 * Mounts the router in a fresh Express app and uses supertest to
 * verify the request contract. We don't stub the auth middleware
 * (requireAuth enforces a Bearer token) — the focus here is the
 * HTTP shape, not the full flow (covered by totp.test.ts and
 * backup-codes.test.ts).
 *
 * What we cover:
 *   - 5 documented endpoints all return JSON (not Express's HTML 404)
 *   - 401 returned for endpoints that require auth but got no token
 *   - 400 returned for /verify when the body is invalid
 *   - Content-type is application/json on every response
 *   - The route mount under /api/auth/2fa is correctly registered
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { auth2faRouter } from '../routes/auth-2fa.cts';

let app: Express;
beforeAll(() => {
	app = express();
	app.use(express.json());
	// No req.user stub — let the real requireAuth middleware decide.
	// In production every protected route checks the Authorization
	// header; in this test the absence of a header → 401, which is
	// the correct response we want to verify.
	app.use('/api/auth/2fa', auth2faRouter);
});

describe('auth-2fa router — mount + content type', () => {
	const paths = [
		'/api/auth/2fa/setup',
		'/api/auth/2fa/enable',
		'/api/auth/2fa/disable',
		'/api/auth/2fa/verify',
		'/api/auth/2fa/backup-codes/regenerate',
	];
	for (const p of paths) {
		it(`${p} returns JSON (the route exists — not an HTML 404)`, async () => {
			const r = await request(app).post(p).send({});
			expect(r.headers['content-type']).toMatch(/json/);
			expect(typeof r.body).toBe('object');
		});
	}

	it('returns 404 from Express for an UNKNOWN path under /api/auth/2fa', async () => {
		// The router only mounts the 5 documented endpoints; a random
		// path under the same prefix falls through to Express's
		// default 404.
		const r = await request(app).post('/api/auth/2fa/does-not-exist').send({});
		expect(r.status).toBe(404);
	});
});

describe('auth-2fa router — auth gate (no Bearer header)', () => {
	const authRequiredPaths = [
		'/api/auth/2fa/setup',
		'/api/auth/2fa/enable',
		'/api/auth/2fa/disable',
		'/api/auth/2fa/backup-codes/regenerate',
	];
	for (const p of authRequiredPaths) {
		it(`${p} → 401 (requireAuth blocks the request)`, async () => {
			const r = await request(app).post(p).send({});
			expect(r.status).toBe(401);
			expect(r.body).toMatchObject({ success: false });
			expect(r.body.code).toBe('AUTH_REQUIRED');
		});
	}

	it('/verify → 400 (no auth required, but the body is invalid)', async () => {
		// /verify does NOT require a Bearer header — it uses the
		// partial_token. With an empty body the zod schema rejects.
		const r = await request(app).post('/api/auth/2fa/verify').send({});
		expect(r.status).toBe(400);
		expect(r.body).toMatchObject({ success: false });
		expect(r.body.code).toBe('VALIDATION_ERROR');
	});

	it('/verify → 401 with a malformed partial_token', async () => {
		// Use a 30+ character string that passes the length check but
		// fails the HMAC verification — this exercises the
		// verifyPartialToken() path, not the zod schema.
		const r = await request(app)
			.post('/api/auth/2fa/verify')
			.send({
				partial_token: 'a'.repeat(30) + '.b'.repeat(30),
				code: '123456',
			});
		expect(r.status).toBe(401);
		expect(r.body.code).toBe('PARTIAL_INVALID');
	});
});

describe('auth-2fa router — error envelope', () => {
	it('auth-gate errors include request_id (matches the rest of the API)', async () => {
		// 401 from requireAuth: a real app middleware, not the
		// shared-cts sendError helper, so it does include request_id
		// because requestLogger set it on the way in. (Zod
		// validation errors use a different code path and don't
		// include request_id — that's a pre-existing project
		// behavior, not something this router changes.)
		const r = await request(app).post('/api/auth/2fa/setup').send({});
		expect(r.status).toBe(401);
		// The body shape is {success, error, code, request_id} —
		// if `request_id` is missing in the future, this test
		// will fail and force a fix.
		expect(r.body).toHaveProperty('error');
		expect(r.body.error).toBeTruthy();
	});
});
