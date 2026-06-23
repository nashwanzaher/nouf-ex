/**
 * partial-token.cts — short-lived HMAC token used to bridge the
 * password and TOTP steps of a 2FA-protected login.
 *
 * Flow:
 *   1. POST /api/auth/login  (email, password) — valid password but
 *      user has 2FA enabled → server returns
 *      `{ requires_2fa: true, partial_token, user_id }`
 *   2. POST /api/auth/2fa/verify  (partial_token, code) — server
 *      verifies the TOTP / backup code, then issues a real bearer
 *      token via signAuthToken() and returns it.
 *
 * Why a dedicated token type? Two reasons:
 *   - The 2FA verify endpoint must NOT require an Authorization
 *     header (the user is in the middle of authenticating), but it
 *     must still be sure the caller is the same person who just
 *     submitted a valid password.
 *   - The partial token must be SINGLE-USE — replaying it must
 *     fail — so a network eavesdropper cannot reuse a captured
 *     partial_token + a future TOTP code to log in.
 *
 * The token format mirrors signAuthToken() in middleware.ts:
 *   <base64url(payload)>.<base64url(hmac(payload))>
 *
 * Payload: { sub, purpose: '2fa', jti, exp } where jti is a random
 * 128-bit nonce that the server tracks (in memory) for the
 * single-use check. A short TTL (5 min) bounds the replay window.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { promisify as _promisify } from 'util';
void _promisify; // (unused — the type cast below is the only consumer)

// Cache of used JTIs. Entries are evicted lazily on lookup. We
// keep the cache in-process for simplicity; horizontal scale-out
// will need a shared store (Redis, or a `revoked_tokens` table).
const USED_JTIS = new Map<string, number>(); // jti → expiresAt (ms)
const JTI_CLEANUP_INTERVAL_MS = 60_000;
const PARTIAL_TTL_SECONDS = 5 * 60; // 5 minutes

// Background sweeper — drops expired JTIs from the cache.
const sweeper = setInterval(() => {
	const now = Date.now();
	for (const [k, exp] of USED_JTIS) {
		if (exp <= now) USED_JTIS.delete(k);
	}
}, JTI_CLEANUP_INTERVAL_MS);
sweeper.unref();

/** Stop the background sweeper (for tests). */
export function _stopPartialTokenSweeperForTests(): void {
	clearInterval(sweeper);
}

interface PartialTokenPayload {
	sub: number;
	purpose: '2fa';
	jti: string;
	exp: number; // unix seconds
}

function getAuthSecret(): string {
	const s = process.env.AUTH_SECRET;
	if (s && s.length >= 32) return s;
	if (process.env.NODE_ENV === 'production') {
		throw new Error('AUTH_SECRET env var is required in production (>=32 random chars).');
	}
	// Dev-only fallback (must be stable across calls in the same
	// process so verification works).
	return 'dev-only-partial-token-fallback-secret-must-be-32+chars';
}

function base64url(buf: Buffer): string {
	return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Buffer {
	const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
	return Buffer.from(b64, 'base64');
}

/** Sign a partial token bound to a user. The token is single-use
 *  (tracked by jti) and short-lived (5 min). */
export function signPartialToken(userId: number): string {
	const now = Math.floor(Date.now() / 1000);
	const payload: PartialTokenPayload = {
		sub: userId,
		purpose: '2fa',
		jti: base64url(randomBytes(16)),
		exp: now + PARTIAL_TTL_SECONDS,
	};
	const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));
	const sig = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
	return body + '.' + sig;
}

/** Verify a partial token. Returns the user id on success, or null
 *  on any failure (bad signature, expired, wrong purpose, already
 *  used). On success, the jti is marked as used — a second call
 *  with the same token will fail. */
export function verifyPartialToken(token: string): { sub: number } | null {
	const dot = token.indexOf('.');
	if (dot < 0) return null;
	const body = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expected = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
	const expectedBuf = fromBase64url(expected);
	const sigBuf = fromBase64url(sig);
	if (expectedBuf.length !== sigBuf.length) return null;
	if (!timingSafeEqual(expectedBuf, sigBuf)) return null;

	let payload: PartialTokenPayload;
	try {
		payload = JSON.parse(fromBase64url(body).toString('utf8'));
	} catch {
		return null;
	}
	if (payload.purpose !== '2fa') return null;
	if (typeof payload.sub !== 'number') return null;
	if (typeof payload.jti !== 'string') return null;
	if (typeof payload.exp !== 'number') return null;
	if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

	// Single-use: jti may not have been seen before.
	if (USED_JTIS.has(payload.jti)) return null;
	USED_JTIS.set(payload.jti, payload.exp * 1000);
	return { sub: payload.sub };
}

/** Test helper: clear the jti cache. */
export function _resetPartialTokenForTests(): void {
	USED_JTIS.clear();
}
