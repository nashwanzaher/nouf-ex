import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	authLimiter,
	hashPassword,
	verifyPassword,
	registerSchema,
	loginSchema,
	profileUpdateSchema,
	passwordChangeSchema,
	HttpError,
	type AuthRole,
} from '../lib/shared.cts';
import { signAuthToken } from '../middleware.js';
import { signPartialToken } from '../lib/partial-token.cts';

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
		const token = signAuthToken({ sub: userId, role });
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
			'SELECT id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender, password_hash, last_login, created_at FROM users WHERE email = ?',
		)
		.get(email)) as
		| (Record<string, unknown> & { id: number; password_hash: string; role: AuthRole })
		| undefined;

	if (!user) {
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
	const token = signAuthToken({ sub: user.id, role: user.role });
	sendSuccess(res, { user: userWithoutPassword, token }, 200, 'Login successful');
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

		sendSuccess(res, { updated: true }, 200, 'Password changed');
	} catch (err) {
		return sendError(res, err);
	}
});
