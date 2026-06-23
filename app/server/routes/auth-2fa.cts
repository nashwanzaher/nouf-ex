/**
 * auth-2fa.cts — 2FA endpoints (P0-5)
 *
 * Mounted at /api/auth/2fa. All endpoints are JSON-in / JSON-out.
 * The endpoints form a small state machine:
 *
 *   ┌─ setup (Bearer) ─┐
 *   │ returns secret, otpauth URL, backup codes (NOT yet active)
 *   │
 *   ├─ enable (Bearer) ─ must verify the FIRST TOTP code
 *   │ within this session to confirm enrollment. Sets
 *   │ two_factor_enabled = TRUE and totp_enabled_at = now().
 *   │
 *   │  ◄── enrollment complete ──►
 *   │
 *   ├─ verify (partial_token) ─ on login, user with 2FA enabled
 *   │ submits a TOTP or backup code here. On success, returns a
 *   │ real bearer token (same shape as POST /api/auth/login).
 *   │
 *   ├─ disable (Bearer) ─ user submits their PASSWORD to confirm.
 *   │ Clears two_factor_enabled, totp_secret, and backup codes.
 *   │
 *   └─ backup-codes/regenerate (Bearer) ─ issues a fresh batch of
 *      10 codes and invalidates the old ones.
 *
 * The TOTP + backup-codes helpers live in `../lib/totp.cts` and
 * `../lib/backup-codes.cts`. The single-use "partial token" that
 * bridges login → 2fa verify lives in `../lib/partial-token.cts`.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, sendError, sendSuccess, requireAuth, log, HttpError } from '../lib/shared.cts';
import { signAuthToken } from '../middleware';
import { generateSecret, verifyTotp, otpauthUrl } from '../lib/totp.cts';
import {
	generateBackupCodes,
	hashBackupCode,
	findBackupCode,
	arrayLiteral,
} from '../lib/backup-codes.cts';
import { verifyPartialToken } from '../lib/partial-token.cts';

export const auth2faRouter = Router();

// ── Schemas ──────────────────────────────────────────────────
const enableSchema = z.object({
	code: z.string().trim().min(6).max(20),
});

const disableSchema = z.object({
	password: z.string().min(1).max(200),
});

const verifySchema = z.object({
	partial_token: z.string().min(20).max(500),
	code: z.string().trim().min(6).max(20),
});

// In-memory rate limiter for /verify (3 attempts / min / IP).
// Per-process state is fine — verification is the ONLY TOTP entry
// point and is per-user anyway, so a global cap is enough to block
// a brute-force loop. (Production should swap to a shared store.)
const verifyAttempts = new Map<string, { count: number; resetAt: number }>();
const VERIFY_WINDOW_MS = 60_000;
const VERIFY_MAX = 5;
function checkVerifyRate(ip: string): boolean {
	const now = Date.now();
	const e = verifyAttempts.get(ip);
	if (!e || e.resetAt <= now) {
		verifyAttempts.set(ip, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
		return true;
	}
	if (e.count >= VERIFY_MAX) return false;
	e.count += 1;
	return true;
}

// ── Helpers ──────────────────────────────────────────────────
interface UserRow {
	id: number;
	email: string;
	full_name: string;
	role: 'customer' | 'merchant' | 'admin';
	two_factor_enabled: boolean;
	totp_secret: string | null;
	totp_backup_codes: string[] | null;
}

async function loadUser(id: number): Promise<UserRow | null> {
	const row = (await db
		.prepare(
			`SELECT id, email, full_name, role, two_factor_enabled,
			        totp_secret, totp_backup_codes
			   FROM users
			  WHERE id = ? AND deleted_at IS NULL`
		)
		.get(id)) as UserRow | undefined;
	return row ?? null;
}

/** Strip TOTP columns from a user before returning it to the client. */
function publicUser(u: UserRow): Record<string, unknown> {
	return {
		id: u.id,
		email: u.email,
		full_name: u.full_name,
		role: u.role,
		two_factor_enabled: u.two_factor_enabled,
	};
}

// ═══════════════════════════════════════════════════════════
// 1) setup — generate secret + otpauth URL + backup codes.
//    NOT yet active: the secret is saved on the row but
//    two_factor_enabled is still false until /enable is called.
// ═══════════════════════════════════════════════════════════
auth2faRouter.post('/setup', requireAuth, async (req: Request, res: Response) => {
	try {
		const user = await loadUser(req.user!.id);
		if (!user) throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
		if (user.two_factor_enabled) {
			return sendError(
				res,
				'2FA is already enabled. Disable it first to re-enroll.',
				409,
				'ALREADY_ENABLED'
			);
		}
		const secret = generateSecret();
		const backupCodes = generateBackupCodes();
		// Hash the backup codes BEFORE storing. The plaintext is
		// returned to the user ONCE — we never store it.
		const hashed = await Promise.all(backupCodes.map(hashBackupCode));
		await db
			.prepare(
				`UPDATE users
				    SET totp_secret = ?,
				        totp_backup_codes = ?::text[],
				        two_factor_enabled = FALSE,
				        totp_enabled_at = NULL
				  WHERE id = ?`
			)
			.run(secret, arrayLiteral(hashed), user.id);

		const otpauth = otpauthUrl(user.email, secret, 'Nouf-ex');
		sendSuccess(
			res,
			{
				secret, // base32 — for manual entry into the authenticator
				otpauth_url: otpauth, // otpauth:// — for QR-code generation by the client
				backup_codes: backupCodes, // plaintext — show to the user ONCE
				instructions:
					'1. Open your authenticator app (Google Authenticator, Authy, etc.).\n' +
					'2. Either scan a QR of otpauth_url OR enter the secret manually.\n' +
					'3. Confirm the 6-digit code via POST /api/auth/2fa/enable to activate 2FA.\n' +
					'4. Save the backup codes in a safe place. They are shown only once.',
			},
			200,
			'2FA setup ready. Confirm with /enable to activate.'
		);
	} catch (err) {
		sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// 2) enable — confirm enrollment with a TOTP code.
//    The secret must already be on the row (via /setup).
// ═══════════════════════════════════════════════════════════
auth2faRouter.post('/enable', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = enableSchema.safeParse(req.body);
		if (!v.success) {
			return sendError(res, 'Invalid input: ' + v.error.message, 400, 'VALIDATION_ERROR');
		}
		const user = await loadUser(req.user!.id);
		if (!user) throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
		if (user.two_factor_enabled) {
			return sendError(res, '2FA is already enabled.', 409, 'ALREADY_ENABLED');
		}
		if (!user.totp_secret) {
			return sendError(
				res,
				'2FA setup was not started. Call POST /api/auth/2fa/setup first.',
				400,
				'NOT_SET_UP'
			);
		}
		if (!verifyTotp(user.totp_secret, v.data.code)) {
			return sendError(res, 'Invalid code.', 401, 'TOTP_INVALID');
		}
		// Activate.
		await db
			.prepare(
				`UPDATE users
				    SET two_factor_enabled = TRUE,
				        totp_enabled_at = CURRENT_TIMESTAMP
				  WHERE id = ?`
			)
			.run(user.id);
		log.info({
			msg: 'totp_enabled',
			user_id: user.id,
		});
		sendSuccess(
			res,
			{ user: publicUser({ ...user, two_factor_enabled: true }) },
			200,
			'2FA enabled. Save your backup codes — they are not shown again.'
		);
	} catch (err) {
		sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// 3) verify — exchange a partial token + TOTP/backup code for
//    a real bearer token. Used by the login page when 2FA is
//    enabled on the account.
// ═══════════════════════════════════════════════════════════
auth2faRouter.post('/verify', async (req: Request, res: Response) => {
	try {
		const v = verifySchema.safeParse(req.body);
		if (!v.success) {
			return sendError(res, 'Invalid input: ' + v.error.message, 400, 'VALIDATION_ERROR');
		}
		// Rate limit per IP. 5 attempts / minute is plenty for
		// legitimate users and small enough to block brute force.
		const ip = req.ip || req.socket.remoteAddress || 'anon';
		if (!checkVerifyRate(ip)) {
			return sendError(res, 'Too many 2FA attempts. Try again in a minute.', 429, 'RATE_LIMITED');
		}
		const partial = verifyPartialToken(v.data.partial_token);
		if (!partial) {
			return sendError(res, 'Invalid or expired partial token.', 401, 'PARTIAL_INVALID');
		}
		const user = await loadUser(partial.sub);
		if (!user || !user.two_factor_enabled || !user.totp_secret) {
			return sendError(res, '2FA is not enabled for this account.', 400, 'NOT_2FA');
		}
		const code = v.data.code;
		// First try TOTP.
		const totpOk = verifyTotp(user.totp_secret, code);
		// Then try a backup code.
		let backupIdx = -1;
		if (!totpOk && user.totp_backup_codes && user.totp_backup_codes.length > 0) {
			backupIdx = await findBackupCode(code, user.totp_backup_codes);
		}
		if (!totpOk && backupIdx < 0) {
			return sendError(res, 'Invalid 2FA code.', 401, 'CODE_INVALID');
		}
		// If a backup code was used, drop it from the array. We
		// use arrayLiteral to format the new array (preserves
		// ordering + escaping).
		if (!totpOk && backupIdx >= 0 && user.totp_backup_codes) {
			const remaining = user.totp_backup_codes.filter((_, i) => i !== backupIdx);
			await db
				.prepare('UPDATE users SET totp_backup_codes = ?::text[] WHERE id = ?')
				.run(arrayLiteral(remaining), user.id);
			log.info({
				msg: 'backup_code_used',
				user_id: user.id,
				remaining: remaining.length,
			});
		}
		// Update last_login (best effort).
		await db
			.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
			.run(user.id)
			.catch(() => undefined);
		const token = signAuthToken({ sub: user.id, role: user.role });
		sendSuccess(
			res,
			{ token, user: publicUser(user), method: totpOk ? 'totp' : 'backup_code' },
			200,
			'2FA verified'
		);
	} catch (err) {
		sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// 4) disable — turn 2FA off. Requires the user's PASSWORD so
//    a stolen session token alone cannot disable 2FA.
// ═══════════════════════════════════════════════════════════
auth2faRouter.post('/disable', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = disableSchema.safeParse(req.body);
		if (!v.success) {
			return sendError(res, 'Invalid input: ' + v.error.message, 400, 'VALIDATION_ERROR');
		}
		const user = (await db
			.prepare('SELECT id, password_hash FROM users WHERE id = ? AND deleted_at IS NULL')
			.get(req.user!.id)) as { id: number; password_hash: string } | undefined;
		if (!user) throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
		// We must re-fetch the full row to verify the password (the
		// existing middleware helper takes a stored hash string).
		// Re-use the same path as /api/auth/login.
		const verifyModule = await import('../middleware.js' as string).catch(() => null);
		// Fallback: in-line scrypt verify (we don't want a runtime
		// dynamic import for a hot path — keep this self-contained).
		// The hash format is `scrypt$<base64-salt>$<base64-key>` (set
		// by hashPassword() in middleware.ts).
		const { scrypt: scryptCb, timingSafeEqual } = await import('crypto');
		const { promisify } = await import('util');
		const scryptAsync = promisify(scryptCb) as (
			password: string,
			salt: Buffer,
			keylen: number
		) => Promise<Buffer>;
		const parts = user.password_hash.split('$');
		if (parts.length !== 3 || parts[0] !== 'scrypt') {
			return sendError(res, 'Invalid stored hash format.', 500, 'INTERNAL');
		}
		const salt = Buffer.from(parts[1], 'base64');
		const expected = Buffer.from(parts[2], 'base64');
		const derived = await scryptAsync(v.data.password, salt, expected.length);
		if (derived.length !== expected.length || !timingSafeEqual(derived, expected)) {
			return sendError(res, 'Invalid password.', 401, 'AUTH_INVALID');
		}
		void verifyModule; // (unused — kept for symmetry with /auth/login)
		// Deactivate and clear secrets.
		await db
			.prepare(
				`UPDATE users
				    SET two_factor_enabled = FALSE,
				        totp_secret = NULL,
				        totp_backup_codes = '{}'::text[],
				        totp_enabled_at = NULL
				  WHERE id = ?`
			)
			.run(user.id);
		log.info({
			msg: 'totp_disabled',
			user_id: user.id,
		});
		sendSuccess(
			res,
			{ user: publicUser({ ...(await loadUser(user.id))!, two_factor_enabled: false }) },
			200,
			'2FA disabled'
		);
	} catch (err) {
		sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// 5) backup-codes/regenerate — issue a fresh batch of 10 codes
//    and invalidate the old ones. Requires authentication (a
//    stolen session token can rotate codes — the threat model
//    is "attacker has my session AND wants to lock me out",
//    which is acceptable; rotating codes does NOT weaken
//    authentication because the TOTP secret is unchanged).
// ═══════════════════════════════════════════════════════════
auth2faRouter.post('/backup-codes/regenerate', requireAuth, async (req: Request, res: Response) => {
	try {
		const user = await loadUser(req.user!.id);
		if (!user) throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
		if (!user.two_factor_enabled) {
			return sendError(res, '2FA is not enabled. Enable it first.', 400, 'NOT_ENABLED');
		}
		const newCodes = generateBackupCodes();
		const hashed = await Promise.all(newCodes.map(hashBackupCode));
		await db
			.prepare('UPDATE users SET totp_backup_codes = ?::text[] WHERE id = ?')
			.run(arrayLiteral(hashed), user.id);
		log.info({
			msg: 'backup_codes_regenerated',
			user_id: user.id,
			count: newCodes.length,
		});
		sendSuccess(
			res,
			{ backup_codes: newCodes },
			200,
			'New backup codes generated. Save them — they are not shown again.'
		);
	} catch (err) {
		sendError(res, err);
	}
});
