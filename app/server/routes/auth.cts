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
           VALUES (?, ?, ?, ?, 'active', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
			'SELECT id, email, full_name, avatar, role, status, is_verified, phone, password_hash, last_login, created_at FROM users WHERE email = ?',
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
			'SELECT id, email, full_name, avatar, role, status, is_verified, phone, last_login, created_at FROM users WHERE id = ?',
		)
		.get(userId)) as Record<string, unknown> | undefined;

	if (!user) {
		throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
	}
	sendSuccess(res, user);
});
