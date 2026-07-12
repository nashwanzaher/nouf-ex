/**
 * reset-token.cts — G7 fix 2026-07-11.
 *
 * Short-lived HMAC token used by the password-reset flow:
 *   1. POST /api/auth/forgot-password (email) — server always returns
 *      200 (no enumeration). If the email matches a real user, the
 *      response includes `reset_token` and `reset_url`. In dev those
 *      are echoed back so the page can navigate the user straight to
 *      /auth/reset-password?token=…; in production the same fields are
 *      emailed via the notifications dispatcher.
 *   2. POST /api/auth/reset-password (token, new_password) — verifies
 *      the token, hashes the new password, bumps token_version so
 *      every existing bearer cookie becomes invalid.
 *
 * Single-use protection uses the same `used_jtis` table as the 2FA
 * partial-token — same atomic UPSERT, same replay-protection story.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { db } from './shared.ts';

const RESET_TTL_SECONDS = 30 * 60; // 30 minutes

interface ResetTokenPayload {
	sub: number;
	purpose: 'password_reset';
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

export function signResetToken(userId: number): { token: string; expiresAt: Date } {
	const now = Math.floor(Date.now() / 1000);
	const payload: ResetTokenPayload = {
		sub: userId,
		purpose: 'password_reset',
		jti: base64url(randomBytes(16)),
		exp: now + RESET_TTL_SECONDS,
	};
	const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));
	const sig = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
	return {
		token: body + '.' + sig,
		expiresAt: new Date(payload.exp * 1000),
	};
}

/**
 * Verify a reset token. Returns the user id on success, or null on any
 * failure (bad signature, expired, wrong purpose, already used). On
 * success the jti is atomically marked as used.
 */
export async function verifyResetToken(token: string): Promise<{ sub: number } | null> {
	const dot = token.indexOf('.');
	if (dot < 0) return null;
	const body = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expected = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
	const expectedBuf = fromBase64url(expected);
	const sigBuf = fromBase64url(sig);
	if (expectedBuf.length !== sigBuf.length) return null;
	if (!timingSafeEqual(expectedBuf, sigBuf)) return null;

	let payload: ResetTokenPayload;
	try {
		payload = JSON.parse(fromBase64url(body).toString('utf8'));
	} catch {
		return null;
	}
	if (payload.purpose !== 'password_reset') return null;
	if (typeof payload.sub !== 'number') return null;
	if (typeof payload.jti !== 'string') return null;
	if (typeof payload.exp !== 'number') return null;
	if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

	const expiresAt = new Date(payload.exp * 1000).toISOString();
	const result = (await db
		.prepare(
			`INSERT INTO used_jtis (jti, user_id, expires_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT (jti) DO NOTHING
			 RETURNING jti`,
		)
		.get(payload.jti, payload.sub, expiresAt)) as { jti: string } | undefined;
	if (!result) return null; // replay
	return { sub: payload.sub };
}