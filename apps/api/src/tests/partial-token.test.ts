/**
 * Unit tests for apps/api/src/lib/partial-token.ts.
 *
 * Covers:
 *   - sign → verify round-trip
 *   - Single-use enforcement (jti stored in the `used_jtis` table)
 *   - Expiry (TTL 5 min, simulated by manipulating the payload)
 *   - Bad signature rejection
 *   - Wrong purpose rejection
 *
 * Uses a focused `db` mock (instead of the project-wide `pg` mock)
 * so we can simulate the INSERT … ON CONFLICT atomic reservation
 * semantics without needing a live database.
 */
process.env.AUTH_SECRET = 'unit-test-secret-must-be-at-least-32-characters-long-aaaaaa';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track which JTIs have been "consumed" so verifyPartialToken can
// reject replays without needing real Postgres.
const CONSUMED_JTIS = new Set<string>();
beforeEach(() => {
	CONSUMED_JTIS.clear();
});

vi.mock('../lib/shared.ts', () => {
	return {
		db: {
			prepare: (_sql: string) => ({
				get: (_jti: string, _userId: number, _expiresAt: string) => {
					// We can't see the args easily from prepare-time, so
					// use the mock at the test level via the shared map.
					return Promise.resolve(undefined);
				},
				run: async () => ({ rowCount: 1 }),
			}),
		},
	};
});

// Replace partial-token's actual db import with our test-aware mock
// so it can honour the single-use contract.
import { db as realDb } from '../lib/shared.ts';
// Cast through unknown so the test can monkey-patch prepare() — the
// real `db` type from shared.ts is strictly typed and doesn't allow
// reassignment of its members. We don't type this as `any` because
// eslint flags it.
type DbLike = { prepare: (sql?: string) => unknown };
(realDb as unknown as DbLike).prepare = () => {
	return {
		get: async (jti: string) => {
			if (CONSUMED_JTIS.has(jti)) return undefined;
			CONSUMED_JTIS.add(jti);
			return { jti };
		},
		run: async () => ({ rowCount: 1 }),
	};
};

const { signPartialToken, verifyPartialToken, _resetPartialTokenForTests } = await import(
	'../lib/partial-token.ts'
);

describe('partial-token', () => {
	beforeEach(async () => {
		await _resetPartialTokenForTests();
	});

	it('round-trips a freshly-signed token', async () => {
		const token = signPartialToken(42);
		const r = await verifyPartialToken(token);
		expect(r).toEqual({ sub: 42 });
	});

	it('returns null on bad signature (tampered body)', async () => {
		const token = signPartialToken(1);
		// Tamper a non-last byte of the signature. Flipping the LAST
		// character is unreliable because Node's Buffer.from('base64url')
		// silently ignores the 2 padding bits in the trailing char
		// (it is lenient about non-zero padding), so a 0→1 swap on a
		// last char that already encodes 0 padding leaves the decoded
		// byte unchanged and the signature still matches. Flipping a
		// middle byte is unambiguous: every 6-bit group has 6 data bits.
		const dot = token.lastIndexOf('.');
		const mid = dot + 1 + 5; // well inside the signature, past any padding
		const swapTo = token[mid] === 'A' ? 'B' : 'A';
		const tampered = token.slice(0, mid) + swapTo + token.slice(mid + 1);
		expect(await verifyPartialToken(tampered)).toBeNull();
	});

	it('returns null on a completely garbled token', async () => {
		expect(await verifyPartialToken('not.a.token')).toBeNull();
		expect(await verifyPartialToken('just-garbage')).toBeNull();
	});

	it('returns null when the separator is missing', async () => {
		expect(await verifyPartialToken('abcdef')).toBeNull();
	});

	it('returns null on an empty string', async () => {
		expect(await verifyPartialToken('')).toBeNull();
	});

	it('is single-use: a second call with the same token fails', async () => {
		const token = signPartialToken(7);
		expect(await verifyPartialToken(token)).toEqual({ sub: 7 });
		// Second call must fail (jti already consumed).
		expect(await verifyPartialToken(token)).toBeNull();
	});

	it('two different tokens for the same user both succeed', async () => {
		const t1 = signPartialToken(5);
		const t2 = signPartialToken(5);
		expect(await verifyPartialToken(t1)).toEqual({ sub: 5 });
		expect(await verifyPartialToken(t2)).toEqual({ sub: 5 });
	});

	it('rejects an expired token', async () => {
		// We can't easily wait 5 minutes in a test, so we synthesise
		// a token whose payload claims to be expired. The HMAC will
		// still verify (we sign with the same secret), so the expiry
		// check is the only thing that can fail it.
		const now = Math.floor(Date.now() / 1000);
		const expiredPayload = {
			sub: 1,
			purpose: '2fa',
			jti: 'a'.repeat(22), // base64url 16 bytes ≈ 22 chars
			exp: now - 60, // 1 minute ago
		};
		const body = Buffer.from(JSON.stringify(expiredPayload), 'utf8')
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		const { createHmac } = await import('crypto');
		const sig = createHmac('sha256', process.env.AUTH_SECRET!)
			.update(body)
			.digest()
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		const expired = body + '.' + sig;
		expect(await verifyPartialToken(expired)).toBeNull();
	});

	it('rejects when purpose is not "2fa"', async () => {
		const now = Math.floor(Date.now() / 1000);
		const wrong = {
			sub: 1,
			purpose: 'login', // not '2fa'
			jti: 'b'.repeat(22),
			exp: now + 60,
		};
		const body = Buffer.from(JSON.stringify(wrong), 'utf8')
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		const { createHmac } = await import('crypto');
		const sig = createHmac('sha256', process.env.AUTH_SECRET!)
			.update(body)
			.digest()
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		expect(await verifyPartialToken(body + '.' + sig)).toBeNull();
	});
});
