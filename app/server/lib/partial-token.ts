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
 * Replay protection storage:
 *   The "already-used" set lives in the `used_jtis` Postgres table
 *   (migration 0010) so multiple server replicas behind a load
 *   balancer share the same view. The atomic UPSERT is a single
 *   INSERT ... ON CONFLICT DO NOTHING, returning the affected row
 *   count — a return value of 1 means "first time we see this jti,
 *   proceed"; 0 means "already used, reject".
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { db } from './shared.ts';

const PARTIAL_TTL_SECONDS = 5 * 60; // 5 minutes

interface PartialTokenPayload {
	sub: number;
	purpose: '2fa';
	jti: string;
	exp: number; // unix seconds
}

function getAuthSecret(): string {
	const s = process.env.AUTH_SECRET;
	if (!s || s.length < 32) {
		throw new Error(
			'AUTH_SECRET env var is required (>=32 random chars). ' +
				"Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
		);
	}
	return s;
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
 *  (tracked by jti in the `used_jtis` table) and short-lived (5 min). */
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

/**
 * Verify a partial token. Returns the user id on success, or null on
 * any failure (bad signature, expired, wrong purpose, already used).
 *
 * On success the jti is atomically marked as used via UPSERT. A second
 * call with the same token will fail because the INSERT … ON CONFLICT
 * DO NOTHING will affect 0 rows.
 */
export async function verifyPartialToken(token: string): Promise<{ sub: number } | null> {
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

	// Atomic single-use reservation: returns 1 on first use, 0 on replay.
	const expiresAt = new Date(payload.exp * 1000).toISOString();
	const result = (await db
		.prepare(
			`INSERT INTO used_jtis (jti, user_id, expires_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT (jti) DO NOTHING
			 RETURNING jti`,
		)
		.get(payload.jti, payload.sub, expiresAt)) as { jti: string } | undefined;
	if (!result) {
		// Replay — this jti was already used (or its row hasn't expired
		// yet, which is the same effect).
		return null;
	}
	return { sub: payload.sub };
}

/**
 * Test helper: clear the jti cache for a specific user. Deletes rows
 * from `used_jtis` matching the supplied user_id (or all rows when
 * userId is undefined).
 */
export async function _resetPartialTokenForTests(userId?: number): Promise<void> {
	if (userId === undefined) {
		await db.prepare('DELETE FROM used_jtis').run();
	} else {
		await db.prepare('DELETE FROM used_jtis WHERE user_id = ?').run(userId);
	}
}
