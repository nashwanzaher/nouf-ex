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
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, hashPassword, verifyPassword } from '../lib/shared.cts';
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
		//
		// SECURITY (C-4): the password must clear the new strength
		// checks (10+ chars, 3-of-4 classes, no repeats/sequences).
		// `ValidP@ssw0rd` qualifies.
		const res = await request(app)
			.post('/api/auth/register')
			.send({ email: 'n@example.com', password: 'ValidP@ssw0rd', name: 'Nouf Ali' });
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

/* ------------------------------------------------------------------ */
/*  POST /api/auth/logout                                              */
/* ------------------------------------------------------------------ */
// SECURITY (C-3): logout must bump users.token_version so every other
// outstanding Bearer token for that user is invalidated on the next
// requireAuth lookup. The current handler issues
//   UPDATE users SET token_version = token_version + 1 WHERE id = ?
// and then calls invalidateTokenVersionCache(userId). Both the DB
// bump and the cache invalidation are required — without either, a
// stolen token would keep working after the user logs out.
describe('authRouter — POST /api/auth/logout', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with {revoked: true} and bumps token_version in the DB', async () => {
		// We override db.prepare to count how many times the token_version
		// UPDATE is issued. Anything else falls through to the original
		// (global mock) prepare so unrelated SELECTs return undefined.
		let tokenVersionUpdateCount = 0;
		const originalPrepare = db.prepare.bind(db);
		(db as unknown as { prepare: typeof originalPrepare }).prepare = ((
			sql: string,
		) => {
			const upper = sql.trim().toUpperCase();
			if (
				upper.startsWith('UPDATE USERS SET TOKEN_VERSION') ||
				upper.startsWith('UPDATE USERS SET TOKEN_VERSION = TOKEN_VERSION')
			) {
				return {
					run: async () => {
						tokenVersionUpdateCount += 1;
						return { rowCount: 1, lastInsertRowid: null };
					},
					get: async () => undefined,
					all: async () => [],
				};
			}
			return originalPrepare(sql);
		}) as typeof originalPrepare;
		try {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.post('/api/auth/logout')
				.set('Authorization', `Bearer ${token}`);
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toMatchObject({ revoked: true });
			// The handler issued exactly one token_version bump.
			expect(tokenVersionUpdateCount).toBe(1);
		} finally {
			(db as unknown as { prepare: typeof originalPrepare }).prepare =
				originalPrepare;
		}
	});

	it('a follow-up authenticated request with the SAME token returns 401', async () => {
		// The handler must invalidate the in-process cache so the next
		// requireAuth() cannot satisfy the lookup from cache. Combined
		// with the global pg mock returning undefined for the user row,
		// that produces a 401 AUTH_REQUIRED.
		const token = signTestToken({ sub: 7, role: 'customer' });
		const bearer = { Authorization: `Bearer ${token}` };

		const logoutRes = await request(app)
			.post('/api/auth/logout')
			.set(bearer);
		expect(logoutRes.status).toBe(200);
		expect(logoutRes.body.data.revoked).toBe(true);

		// The token's signature is still valid (it didn't expire), but
		// its `ver` is no longer the current token_version — and the
		// in-process cache was just invalidated. requireAuth cannot
		// verify the token, so the request is rejected.
		const meRes = await request(app).get('/api/auth/me').set(bearer);
		expect(meRes.status).toBe(401);
		// The exact code depends on whether requireAuth fails before
		// or after the DB lookup; both AUTH_REQUIRED and AUTH_INVALID
		// are acceptable evidence of the gate firing.
		expect(['AUTH_REQUIRED', 'AUTH_INVALID']).toContain(meRes.body.code);
	});
});

/* ------------------------------------------------------------------ */
/*  POST /api/auth/change-password                                    */
/* ------------------------------------------------------------------ */
// Self-service password change. The handler must:
//   1. Verify the current password (rejects on mismatch with 401).
//   2. Re-hash the new password with the same scrypt settings.
//   3. UPDATE users.password_hash with the new hash.
//   4. Bump users.token_version so all outstanding sessions die.
//   5. Write an audit log entry (non-blocking).
describe('authRouter — POST /api/auth/change-password', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with {updated: true, sessions_invalidated: true} and persists the new hash', async () => {
		const originalPassword = 'CurrentPass123!';
		const newPassword = 'NewPass456@word';
		let storedHash = await hashPassword(originalPassword);
		let passwordUpdateCount = 0;
		let tokenVersionBumpCount = 0;
		let lastWrittenHash: string | null = null;

		const originalPrepare = db.prepare.bind(db);
		(db as unknown as { prepare: typeof originalPrepare }).prepare = ((
			sql: string,
		) => {
			const upper = sql.trim().toUpperCase();
			if (upper.startsWith('SELECT PASSWORD_HASH FROM USERS')) {
				return {
					get: async () => ({ password_hash: storedHash }),
					run: async () => ({ rowCount: 1 }),
					all: async () => [],
				};
			}
			if (upper.startsWith('UPDATE USERS SET PASSWORD_HASH')) {
				return {
					run: async (newHash: string) => {
						lastWrittenHash = newHash;
						storedHash = newHash;
						passwordUpdateCount += 1;
						return { rowCount: 1, lastInsertRowid: null };
					},
					get: async () => undefined,
					all: async () => [],
				};
			}
			if (upper.startsWith('UPDATE USERS SET TOKEN_VERSION')) {
				return {
					run: async () => {
						tokenVersionBumpCount += 1;
						return { rowCount: 1, lastInsertRowid: null };
					},
					get: async () => undefined,
					all: async () => [],
				};
			}
			return originalPrepare(sql);
		}) as typeof originalPrepare;
		try {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.post('/api/auth/change-password')
				.set('Authorization', `Bearer ${token}`)
				.send({
					current_password: originalPassword,
					new_password: newPassword,
				});
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toMatchObject({
				updated: true,
				sessions_invalidated: true,
			});
			// Exactly one password_hash UPDATE and one token_version bump.
			expect(passwordUpdateCount).toBe(1);
			expect(tokenVersionBumpCount).toBe(1);
			// The hash actually written to the DB accepts the NEW password
			// and rejects the OLD one.
			expect(lastWrittenHash).toBeTruthy();
			expect(
				await verifyPassword(newPassword, lastWrittenHash as unknown as string),
			).toBe(true);
			expect(
				await verifyPassword(originalPassword, lastWrittenHash as unknown as string),
			).toBe(false);
		} finally {
			(db as unknown as { prepare: typeof originalPrepare }).prepare =
				originalPrepare;
		}
	});

	it('returns 401 WRONG_PASSWORD when the current password is wrong and does NOT update the DB', async () => {
		const storedHash = await hashPassword('CurrentPass123!');
		let anyUpdateCount = 0;
		const originalPrepare = db.prepare.bind(db);
		(db as unknown as { prepare: typeof originalPrepare }).prepare = ((
			sql: string,
		) => {
			const upper = sql.trim().toUpperCase();
			if (upper.startsWith('SELECT PASSWORD_HASH FROM USERS')) {
				return {
					get: async () => ({ password_hash: storedHash }),
					run: async () => ({ rowCount: 1 }),
					all: async () => [],
				};
			}
			// Count ANY update to users — neither password_hash nor
			// token_version should be touched on the wrong-password path.
			if (upper.startsWith('UPDATE USERS')) {
				return {
					run: async () => {
						anyUpdateCount += 1;
						return { rowCount: 1, lastInsertRowid: null };
					},
					get: async () => undefined,
					all: async () => [],
				};
			}
			return originalPrepare(sql);
		}) as typeof originalPrepare;
		try {
			const token = signTestToken({ sub: 7, role: 'customer' });
			const res = await request(app)
				.post('/api/auth/change-password')
				.set('Authorization', `Bearer ${token}`)
				.send({
					current_password: 'WrongPassword!',
					new_password: 'NewPass456@word',
				});
			expect(res.status).toBe(401);
			expect(res.body.code).toBe('WRONG_PASSWORD');
			// CRITICAL: no UPDATE was issued — the handler must not
			// write anything until the current password is verified.
			expect(anyUpdateCount).toBe(0);
		} finally {
			(db as unknown as { prepare: typeof originalPrepare }).prepare =
				originalPrepare;
		}
	});
});

/* ------------------------------------------------------------------ */
/*  POST /api/auth/login — 2FA branch                                  */
/* ------------------------------------------------------------------ */
// When the user has two_factor_enabled = true, login must NOT issue a
// full Bearer token. Instead it returns a short-lived partial_token
// that the /api/auth/2fa/verify endpoint exchanges for the real
// token. The full-token path is covered by the existing 401/user-not-
// found test above; this case exercises the partial-token branch.
describe('authRouter — POST /api/auth/login (2FA branch)', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with {requires_2fa, partial_token, user_id} and NO `token` when 2FA is enabled', async () => {
		const validPassword = 'ValidPass123!';
		const validHash = await hashPassword(validPassword);
		const originalPrepare = db.prepare.bind(db);
		(db as unknown as { prepare: typeof originalPrepare }).prepare = ((
			sql: string,
		) => {
			const upper = sql.trim().toUpperCase();
			// The login handler's SELECT includes `token_version` but the
			// TypeScript cast adds `two_factor_enabled?: boolean` to the
			// row shape. We return both, matching the live DB row.
			if (upper.includes('FROM USERS WHERE EMAIL')) {
				return {
					get: async () => ({
						id: 7,
						email: 'twofa@example.com',
						full_name: 'TwoFA User',
						avatar: null,
						role: 'customer',
						status: 'active',
						is_verified: true,
						phone: null,
						preferred_language: 'en',
						gender: null,
						password_hash: validHash,
						last_login: null,
						created_at: '2026-01-01T00:00:00Z',
						token_version: 0,
						two_factor_enabled: true,
					}),
					run: async () => ({ rowCount: 1 }),
					all: async () => [],
				};
			}
			return originalPrepare(sql);
		}) as typeof originalPrepare;
		try {
			const res = await request(app)
				.post('/api/auth/login')
				.send({ email: 'twofa@example.com', password: validPassword });
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.requires_2fa).toBe(true);
			expect(typeof res.body.data.partial_token).toBe('string');
			// A partial token is `header.payload.sig`; even a minimal
			// JWT is 30+ characters.
			expect(res.body.data.partial_token.length).toBeGreaterThan(20);
			expect(res.body.data.user_id).toBe(7);
			// CRITICAL: no full Bearer token must be issued on the 2FA path.
			// Leaking a real token would defeat the second-factor check.
			expect(res.body.data.token).toBeUndefined();
			expect(res.body.token).toBeUndefined();
		} finally {
			(db as unknown as { prepare: typeof originalPrepare }).prepare =
				originalPrepare;
		}
	});
});
