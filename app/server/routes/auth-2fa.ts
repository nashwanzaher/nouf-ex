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
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import {
    arrayLiteral,
    findBackupCode,
    generateBackupCodes,
    hashBackupCode,
} from '../lib/backup-codes.ts';
import { ErrorCodes } from '../lib/error-codes.ts';
import { verifyPartialToken } from '../lib/partial-token.ts';
import { db, HttpError, log, requireAuth, sendError, sendSuccess, verifyPassword } from '../lib/shared.ts';
import { generateSecret, otpauthUrl, verifyTotp } from '../lib/totp.ts';
import { signAuthToken } from '../middleware.ts';

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

// ── Rate limiter (N2) ────────────────────────────────────────────────
//
// SECURITY (C-2, audit 2026-06-30): the previous implementation
// kept a per-process `Map<bucket, Map<ip, count>>`. With a single
// Node process that worked; under multi-replica deployment each
// replica had its own Map, so a determined attacker could rotate
// through replicas and effectively triple their budget. We now
// call the DB-backed `consume_rate_limit()` function defined in
// migration 0018 so the budget is shared across replicas.
//
// Per-request budget:
//   2fa_verify        5 / min / IP   TOTP brute-force on login
//   2fa_setup        10 / hour / IP  one-time enrollment, cap mis-use
//   2fa_enable       10 / min / IP   TOTP code check on enrollment
//   2fa_disable       5 / min / IP   password check (matches /auth/login)
//   2fa_backup_codes  5 / min / IP   rotation cap, abuse prevention

/** Increment-and-check via the DB-backed `consume_rate_limit()`
 *  function. Returns true if the request is within budget, false
 *  if it is rate-limited. On DB error we FAIL OPEN — a transient
 *  outage should not lock users out of their own accounts; the
 *  tradeoff is a brief window of higher attack surface during
 *  outages, which is preferable to a self-DoS. The error is
 *  logged so an operator notices. */
async function checkRate(
	bucket: string,
	ip: string,
	windowMs: number,
	max: number,
): Promise<boolean> {
	try {
		const row = (await db
			.prepare('SELECT allowed FROM consume_rate_limit($1, $2, $3, $4)')
			.get(bucket, ip, windowMs, max)) as { allowed: boolean } | undefined;
		if (!row) return true;
		return row.allowed === true;
	} catch (err) {
		log.warn({
			msg: 'rate_limit_db_error',
			bucket,
			ip,
			error: (err as Error).message,
		});
		return true;
	}
}

/** Resolve the client IP for rate-limiting. Mirrors the precedence
 *  in middleware.ts: req.ip first, then socket, then 'anon'. */
function clientIp(req: Request): string {
	return req.ip || req.socket?.remoteAddress || 'anon';
}

const RATE_LIMITS = {
	verify: {
		bucket: '2fa_verify',
		windowMs: 60_000,
		max: 5,
		message: 'Too many 2FA attempts. Try again in a minute.',
	},
	setup: {
		bucket: '2fa_setup',
		windowMs: 60 * 60 * 1000,
		max: 10,
		message: 'Too many 2FA setup requests. Try again in an hour.',
	},
	enable: {
		bucket: '2fa_enable',
		windowMs: 60_000,
		max: 10,
		message: 'Too many 2FA enable attempts. Try again in a minute.',
	},
	disable: {
		bucket: '2fa_disable',
		windowMs: 60_000,
		max: 5,
		message: 'Too many 2FA disable attempts. Try again in a minute.',
	},
	backupCodes: {
		bucket: '2fa_backup_codes',
		windowMs: 60_000,
		max: 5,
		message: 'Too many backup-code regenerations. Try again in a minute.',
	},
} as const;

/** Build an Express middleware that enforces a per-IP rate limit
 *  via the DB-backed `consume_rate_limit()`. Async because the
 *  lookup goes over the wire to Postgres. The middleware runs
 *  BEFORE requireAuth on each protected route so an attacker
 *  without a valid token still burns the bucket — the goal of
 *  the limiter is to bound *attempts*, not successful calls. */
function rateLimitMiddleware(
	bucket: string,
	windowMs: number,
	max: number,
	message: string,
): RequestHandler {
	return async (req, res, next) => {
		if (!(await checkRate(bucket, clientIp(req), windowMs, max))) {
			return sendError(res, message, 429, 'RATE_LIMITED');
		}
		next();
	};
}

const limitVerify = rateLimitMiddleware(
	RATE_LIMITS.verify.bucket,
	RATE_LIMITS.verify.windowMs,
	RATE_LIMITS.verify.max,
	RATE_LIMITS.verify.message,
);
const limitSetup = rateLimitMiddleware(
	RATE_LIMITS.setup.bucket,
	RATE_LIMITS.setup.windowMs,
	RATE_LIMITS.setup.max,
	RATE_LIMITS.setup.message,
);
const limitEnable = rateLimitMiddleware(
	RATE_LIMITS.enable.bucket,
	RATE_LIMITS.enable.windowMs,
	RATE_LIMITS.enable.max,
	RATE_LIMITS.enable.message,
);
const limitDisable = rateLimitMiddleware(
	RATE_LIMITS.disable.bucket,
	RATE_LIMITS.disable.windowMs,
	RATE_LIMITS.disable.max,
	RATE_LIMITS.disable.message,
);
const limitBackupCodes = rateLimitMiddleware(
	RATE_LIMITS.backupCodes.bucket,
	RATE_LIMITS.backupCodes.windowMs,
	RATE_LIMITS.backupCodes.max,
	RATE_LIMITS.backupCodes.message,
);

// Sweeper for the DB-backed limiter lives in `cleanup_rate_limit_buckets()`
// (migration 0018) and is invoked from the maintenance endpoint
// `POST /api/admin/maintenance/cleanup-audit-logs` and from the
// function-call form. There is no per-process Map to sweep any more.

/** Test-only: clear the DB-backed rate-limit buckets used by the
 *  2FA endpoints. Calls `cleanup_rate_limit_buckets()` to wipe
 *  every row in the 2FA_* bucket prefix. Not part of the public API. */
export async function __reset2faRateLimitsForTests(): Promise<void> {
	try {
		await db.prepare("DELETE FROM rate_limit_buckets WHERE bucket LIKE '2fa_%'").run();
	} catch {
		/* ignore — best effort */
	}
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
			  WHERE id = ? AND deleted_at IS NULL`,
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
auth2faRouter.post('/setup', limitSetup, requireAuth, async (req: Request, res: Response) => {
	try {
		const user = await loadUser(req.user!.id);
		if (!user) throw new HttpError(404, 'User not found', { code: ErrorCodes.NOT_FOUND });
		if (user.two_factor_enabled) {
			return sendError(
				res,
				'2FA is already enabled. Disable it first to re-enroll.',
				409,
				ErrorCodes.ALREADY_ENABLED,
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
				  WHERE id = ?`,
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
			'2FA setup ready. Confirm with /enable to activate.',
		);
	} catch (err) {
		sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// 2) enable — confirm enrollment with a TOTP code.
//    The secret must already be on the row (via /setup).
// ═══════════════════════════════════════════════════════════
auth2faRouter.post('/enable', limitEnable, requireAuth, async (req: Request, res: Response) => {
	try {
		const v = enableSchema.safeParse(req.body);
		if (!v.success) {
			return sendError(res, 'Invalid input: ' + v.error.message, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const user = await loadUser(req.user!.id);
		if (!user) throw new HttpError(404, 'User not found', { code: ErrorCodes.NOT_FOUND });
		if (user.two_factor_enabled) {
			return sendError(res, '2FA is already enabled.', 409, ErrorCodes.ALREADY_ENABLED);
		}
		if (!user.totp_secret) {
			return sendError(
				res,
				'2FA setup was not started. Call POST /api/auth/2fa/setup first.',
				400,
				'NOT_SET_UP',
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
				  WHERE id = ?`,
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
			'2FA enabled. Save your backup codes — they are not shown again.',
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
auth2faRouter.post('/verify', limitVerify, async (req: Request, res: Response) => {
	try {
		const v = verifySchema.safeParse(req.body);
		if (!v.success) {
			return sendError(res, 'Invalid input: ' + v.error.message, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const partial = await verifyPartialToken(v.data.partial_token);
		if (!partial) {
			return sendError(res, 'Invalid or expired partial token.', 401, ErrorCodes.PARTIAL_INVALID);
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
		// SECURITY (C-3): stamp the current token_version so the
		// freshly-issued bearer survives subsequent revocations
		// only when the caller is actually still authenticated.
		const versionRow = (await db
			.prepare('SELECT token_version FROM users WHERE id = ?')
			.get(user.id)) as { token_version: number } | undefined;
		const token = signAuthToken({
			sub: user.id,
			role: user.role,
			ver: versionRow?.token_version ?? 0,
		});
		sendSuccess(
			res,
			{ token, user: publicUser(user), method: totpOk ? 'totp' : 'backup_code' },
			200,
			'2FA verified',
		);
	} catch (err) {
		sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// 4) disable — turn 2FA off. Requires the user's PASSWORD so
//    a stolen session token alone cannot disable 2FA.
// ═══════════════════════════════════════════════════════════
auth2faRouter.post('/disable', limitDisable, requireAuth, async (req: Request, res: Response) => {
	try {
		const v = disableSchema.safeParse(req.body);
		if (!v.success) {
			return sendError(res, 'Invalid input: ' + v.error.message, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const user = (await db
			.prepare('SELECT id, password_hash FROM users WHERE id = ? AND deleted_at IS NULL')
			.get(req.user!.id)) as { id: number; password_hash: string } | undefined;
		if (!user) throw new HttpError(404, 'User not found', { code: ErrorCodes.NOT_FOUND });
		const ok = await verifyPassword(v.data.password, user.password_hash);
		if (!ok) {
			return sendError(res, 'Invalid password.', 401, 'AUTH_INVALID');
		}
		// Deactivate and clear secrets.
		await db
			.prepare(
				`UPDATE users
				    SET two_factor_enabled = FALSE,
				        totp_secret = NULL,
				        totp_backup_codes = '{}'::text[],
				        totp_enabled_at = NULL
				  WHERE id = ?`,
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
			'2FA disabled',
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
auth2faRouter.post(
	'/backup-codes/regenerate',
	limitBackupCodes,
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const user = await loadUser(req.user!.id);
			if (!user) throw new HttpError(404, 'User not found', { code: ErrorCodes.NOT_FOUND });
			if (!user.two_factor_enabled) {
				return sendError(res, '2FA is not enabled. Enable it first.', 400, ErrorCodes.NOT_ENABLED);
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
				'New backup codes generated. Save them — they are not shown again.',
			);
		} catch (err) {
			sendError(res, err);
		}
	},
);
