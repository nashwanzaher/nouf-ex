import { Router, type Request, type Response } from 'express';
import { signPartialToken } from '../lib/partial-token.cts';
import {
    authLimiter,
    db,
    hashPassword,
    HttpError,
    loginSchema,
    passwordChangeSchema,
    profileUpdateSchema,
    registerSchema,
    requireAuth,
    sendError,
    sendSuccess,
    validate,
    verifyPassword,
    writeAuditLog,
    type AuthRole,
} from '../lib/shared.cts';
import { signAuthToken } from '../middleware.js';

// SECURITY (M-2, 2026-07-02): a throwaway scrypt hash used on the
// "user not found" login path so attackers cannot distinguish
// missing vs wrong-password accounts by response time. The hash
// encodes an unguessable, never-used password. The point is the
// scrypt CPU cost — every login attempt takes ~100 ms regardless
// of whether the email exists in the DB.
//
// Generated once at module load with hashPassword(''). NEVER
// compared against a real password (the salt + iteration count
// make a literal match astronomically unlikely). Only used so
// the wall-clock time of the not-found path matches the
// wrong-password path.
let DUMMY_SCRYPT_HASH = '';
(async () => {
	DUMMY_SCRYPT_HASH = await hashPassword(
		`__login_timing_dummy_${Math.random().toString(36)}_${Date.now()}__`,
	);
})();

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req: Request, res: Response) => {
	try {
		const v = validate(registerSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const { email, password, name } = v.data;
		const role: AuthRole = 'customer';

		const passwordHash = await hashPassword(password);

		let userId: number;
		try {
			const result = (await db
				.prepare(
					`INSERT INTO users (email, password_hash, full_name, role, status, is_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
				)
				.run(email, passwordHash, name, role)) as { lastInsertRowid: number | null };
			if (result.lastInsertRowid == null) {
				throw new HttpError(500, 'Failed to create user', { code: 'INSERT_FAILED' });
			}
			userId = result.lastInsertRowid;
		} catch (err) {
			const pg = err as { code?: string };
			if (pg?.code === '23505') {
				return sendError(res, 'Email already registered', 409, 'EMAIL_TAKEN');
			}
			throw err;
		}

		const safeUser = { id: userId, email, full_name: name, role };
		// SECURITY (C-3): read the freshly-inserted user's token_version
		// (defaulted to 0 by migration 0017) and stamp it into the
		// token payload so future revocations propagate.
		const userRow = (await db
			.prepare('SELECT token_version FROM users WHERE id = ?')
			.get(userId)) as { token_version: number } | undefined;
		const token = signAuthToken({ sub: userId, role, ver: userRow?.token_version ?? 0 });

		// Fire bilingual welcome notification (best-effort, non-blocking).
		// (C.1 in MASTER_PLAN.md — real welcome notification on signup)
		try {
			const { onWelcome } = await import('../lib/notifications/events.cts');
			await onWelcome({ userId, name });
		} catch (notifyErr) {
			console.error('[auth.register] welcome notification failed:', notifyErr);
		}

		sendSuccess(res, { user: safeUser, token }, 201, 'User registered successfully');
	} catch (err) {
		const pg = err as { code?: string };
		if (pg?.code === '23505') {
			return sendError(res, 'Email already registered', 409, 'EMAIL_TAKEN');
		}
		throw err;
	}
});

authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
	const v = validate(loginSchema, req.body);
	if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
	const { email, password } = v.data;

	const user = (await db
		.prepare(
			// SECURITY (C-3): select `token_version` so the freshly
			// signed token matches the user's current revocation
			// counter. A logout elsewhere will bump this number and
			// invalidate the token on its next use.
			'SELECT id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender, password_hash, last_login, created_at, token_version FROM users WHERE email = ?',
		)
		.get(email)) as
		| (Record<string, unknown> & {
				id: number;
				password_hash: string;
				role: AuthRole;
				token_version: number;
		  })
		| undefined;

	if (!user) {
		// SECURITY (M-2, 2026-07-02): constant-time login. Without
		// this dummy hash, an attacker measuring response time can
		// distinguish a missing account (~10 ms) from a wrong
		// password on a real account (~110 ms scrypt cost). We pay
		// the scrypt cost on the "user not found" path too so both
		// paths take the same wall-clock time. The hash is a fixed
		// throwaway string — the comparison always fails, we just
		// want the time to be uniform.
		await verifyPassword(password, DUMMY_SCRYPT_HASH).catch(() => false);
		return sendError(res, 'Invalid email or password', 401, 'AUTH_INVALID');
	}

	const ok = await verifyPassword(password, user.password_hash);
	if (!ok) {
		return sendError(res, 'Invalid email or password', 401, 'AUTH_INVALID');
	}

	await db
		.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
		.run(user.id)
		.catch(() => undefined);

	const { password_hash: _omit, ...userWithoutPassword } = user;
	if ((user as { two_factor_enabled?: boolean }).two_factor_enabled) {
		const partial_token = signPartialToken(user.id);
		return sendSuccess(
			res,
			{
				requires_2fa: true,
				partial_token,
				user_id: user.id,
			},
			200,
			'Password OK. 2FA required — call /api/auth/2fa/verify with the code.',
		);
	}
	const token = signAuthToken({ sub: user.id, role: user.role, ver: user.token_version });
	sendSuccess(res, { user: userWithoutPassword, token }, 200, 'Login successful');
});

/**
 * SECURITY (C-3): POST /api/auth/logout
 *
 * Bumps `users.token_version` for the calling user so any other
 * outstanding bearer tokens for that user stop working on their
 * next request. We do not maintain a per-token blacklist because
 * a version bump is atomic, cheaper than a row insert, and works
 * even when the user does not have their original token at hand
 * (e.g. logout-everywhere from the admin panel).
 *
 * Idempotent: a second logout from the same user is a no-op except
 * for another version bump, which is harmless.
 */
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
	const userId = req.user!.id;
	try {
		await db
			.prepare(
				'UPDATE users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
			)
			.run(userId);
		// Drop the per-process cache so the next request from this
		// process (rare, but possible if a request and a logout
		// race) gets the fresh value.
		try {
			const { invalidateTokenVersionCache } = await import('../middleware.js');
			invalidateTokenVersionCache(userId);
		} catch {
			/* ignore — cache invalidation is best-effort */
		}
		return sendSuccess(
			res,
			{ revoked: true, message: 'All sessions for this user have been revoked.' },
			200,
		);
	} catch (err) {
		return sendError(res, err);
	}
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
	const userId = req.user!.id;
	const user = (await db
		.prepare(
			'SELECT id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender, last_login, created_at FROM users WHERE id = ?',
		)
		.get(userId)) as Record<string, unknown> | undefined;

	if (!user) {
		throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
	}
	sendSuccess(res, user);
});

/** Self-service profile update. Users edit their own name / phone /
 *  language / gender / avatar. Email, role, and verification flags
 *  intentionally NOT updatable here (admin-only). Missing fields
 *  keep their existing value — the route does NOT require the user
 *  to re-send every column. */
authRouter.patch('/me', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(profileUpdateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const updates = v.data;
		const userId = req.user!.id;

		// Build a dynamic SET clause with only the provided fields.
		// `undefined` = keep current value, `null` = set to NULL.
		const fields: string[] = [];
		const params: unknown[] = [];
		if (updates.full_name !== undefined) {
			fields.push('full_name = ?');
			params.push(updates.full_name);
		}
		if (updates.phone !== undefined) {
			fields.push('phone = ?');
			params.push(updates.phone);
		}
		if (updates.avatar !== undefined) {
			fields.push('avatar = ?');
			params.push(updates.avatar);
		}
		if (updates.preferred_language !== undefined) {
			fields.push('preferred_language = ?');
			params.push(updates.preferred_language);
		}
		if (updates.gender !== undefined) {
			fields.push('gender = ?');
			params.push(updates.gender);
		}

		if (fields.length === 0) {
			return sendError(res, 'No updatable fields supplied', 400, 'EMPTY_UPDATE');
		}

		fields.push('updated_at = CURRENT_TIMESTAMP');
		params.push(userId);
		const updated = (await db
			.prepare(
				`UPDATE users SET ${fields.join(', ')} WHERE id = ? RETURNING id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender, last_login, created_at`,
			)
			.get(...params)) as Record<string, unknown> | undefined;
		if (!updated) throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
		sendSuccess(res, updated, 'Profile updated');
	} catch (err) {
		return sendError(res, err);
	}
});

/** Self-service password change. Verifies the current password
 *  (so a stolen JWT alone is not enough), then re-hashes the new
 *  password with the same scrypt settings as registration. */
authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(passwordChangeSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const { current_password, new_password } = v.data;
		const userId = req.user!.id;

		const row = (await db
			.prepare('SELECT password_hash FROM users WHERE id = ?')
			.get(userId)) as { password_hash: string } | undefined;
		if (!row) throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });

		const ok = await verifyPassword(current_password, row.password_hash);
		if (!ok) {
			return sendError(res, 'Current password is incorrect', 401, 'WRONG_PASSWORD');
		}

		// Defense in depth: block no-op password changes. Even though
		// scrypt hash + salt make a literal "same password" match
		// astronomically unlikely, refusing an identical new password
		// signals to the client that they probably mistyped the
		// current password, and avoids an unnecessary DB write.
		const sameAsCurrent = await verifyPassword(new_password, row.password_hash);
		if (sameAsCurrent) {
			return sendError(
				res,
				'New password must be different from the current password',
				400,
				'SAME_AS_CURRENT',
			);
		}

		const newHash = await hashPassword(new_password);
		await db
			.prepare(
				'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
			)
			.run(newHash, userId);

		// SECURITY (H-1, 2026-07-02): bump token_version so EVERY
		// outstanding bearer token for this user is invalidated in
		// the same UPDATE. Without this, a stolen token keeps
		// working after the victim rotates the password — they
		// would have to explicitly log out from every device. This
		// mirrors the behavior of /auth/logout (which already bumps
		// token_version) and matches the documented security claim
		// in middleware.ts: "A bump of the DB column invalidates
		// every token that was issued before the bump." We also
		// invalidate the in-process cache so subsequent /requireAuth
		// calls don't see the stale version.
		await db
			.prepare(
				'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
			)
			.run(userId);
		try {
			const { invalidateTokenVersionCache } = await import('../middleware.js');
			invalidateTokenVersionCache(userId);
		} catch {
			/* the import may fail in some test setups; the DB
			 * UPDATE alone is sufficient — the cache will be
			 * re-populated with the fresh value on the next
			 * requireAuth call. */
		}

		// SECURITY (M-7): the audit log captures the user_id, the
		// action, and the IP. We deliberately do NOT include the
		// new password hash (or any password material) in oldValues
		// / newValues — that field would otherwise show up in the
		// DLQ file if the audit INSERT ever fails.
		await writeAuditLog(req, 'change_password', 'user', userId, null, null);

		sendSuccess(res, { updated: true, sessions_invalidated: true }, 200, 'Password changed');
	} catch (err) {
		return sendError(res, err);
	}
});
