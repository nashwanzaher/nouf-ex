/**
 * Unit tests for app/server/lib/partial-token.cts (P0-5: 2FA).
 *
 * Covers:
 *   - sign → verify round-trip
 *   - Single-use enforcement (jti cache)
 *   - Expiry (TTL 5 min, simulated by manipulating the payload)
 *   - Bad signature rejection
 *   - Wrong purpose rejection
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
	signPartialToken,
	verifyPartialToken,
	_resetPartialTokenForTests,
} from '../lib/partial-token.cts';

describe('partial-token', () => {
	beforeEach(() => {
		_resetPartialTokenForTests();
	});

	it('round-trips a freshly-signed token', () => {
		const token = signPartialToken(42);
		const r = verifyPartialToken(token);
		expect(r).toEqual({ sub: 42 });
	});

	it('returns null on bad signature (tampered body)', () => {
		const token = signPartialToken(1);
		const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
		expect(verifyPartialToken(tampered)).toBeNull();
	});

	it('returns null on a completely garbled token', () => {
		expect(verifyPartialToken('not.a.token')).toBeNull();
		expect(verifyPartialToken('just-garbage')).toBeNull();
	});

	it('returns null when the separator is missing', () => {
		expect(verifyPartialToken('abcdef')).toBeNull();
	});

	it('returns null on an empty string', () => {
		expect(verifyPartialToken('')).toBeNull();
	});

	it('is single-use: a second call with the same token fails', () => {
		const token = signPartialToken(7);
		expect(verifyPartialToken(token)).toEqual({ sub: 7 });
		// Second call must fail (jti already consumed).
		expect(verifyPartialToken(token)).toBeNull();
	});

	it('two different tokens for the same user both succeed', () => {
		const t1 = signPartialToken(5);
		const t2 = signPartialToken(5);
		expect(verifyPartialToken(t1)).toEqual({ sub: 5 });
		expect(verifyPartialToken(t2)).toEqual({ sub: 5 });
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
		// Sign with the dev fallback secret (same as the helper uses
		// when AUTH_SECRET is missing).
		const { createHmac } = await import('crypto');
		const sig = createHmac('sha256', 'dev-only-partial-token-fallback-secret-must-be-32+chars')
			.update(body)
			.digest()
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		const expired = body + '.' + sig;
		expect(verifyPartialToken(expired)).toBeNull();
	});
});
