/**
 * Auth controller — HTTP handlers. Delegates all business logic to the service.
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/error-codes.ts';
import {
	authLimiter,
	passwordResetLimiter,
	loginSchema,
	passwordChangeSchema,
	profileUpdateSchema,
	registerSchema,
	requireAuth,
	sendError,
	sendSuccess,
	validate,
} from '../../lib/shared.ts';
import { log } from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachAuthRoutes(router: import('express').Router) {
	router.post('/register', authLimiter, registerHandler);
	router.post('/login', authLimiter, loginHandler);
	router.post('/logout', requireAuth, logoutHandler);
	router.get('/me', requireAuth, meHandler);
	router.patch('/me', requireAuth, updateProfileHandler);
	router.post('/change-password', requireAuth, changePasswordHandler);
	router.post('/forgot-password', passwordResetLimiter, forgotPasswordHandler);
	router.post('/reset-password', passwordResetLimiter, resetPasswordHandler);
}

async function registerHandler(req: Request, res: Response) {
	try {
		const v = validate(registerSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const { email, password, name } = v.data;
		const requestedRole = (req.body as { role?: string } | null)?.role;
		const result = await service.register({ email, password, name, role: requestedRole });

		try {
			const { onWelcome } = await import('../../lib/notifications/events.ts');
			await onWelcome({ userId: result.user.id, name });
		} catch (notifyErr) {
			log.error({ msg: 'auth.register.notification_failed', error: (notifyErr as Error).message });
		}

		service.setAuthCookie(res, result.token);
		return sendSuccess(res, { user: result.user }, 201, 'User registered successfully');
	} catch (err) {
		const pg = err as { code?: string };
		if (pg?.code === '23505' || (err instanceof Error && err.message?.includes('23505'))) {
			return sendError(res, 'Email already registered', 409, ErrorCodes.DUPLICATE);
		}
		return sendError(res, err);
	}
}

async function loginHandler(req: Request, res: Response) {
	try {
		const v = validate(loginSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const result = await service.login(v.data);

		if (result.kind === '2fa_required') {
			return sendSuccess(
				res,
				{ requires_2fa: true, partial_token: result.partial_token, user_id: result.user_id },
				200,
				'Password OK. 2FA required — call /api/auth/2fa/verify with the code.',
			);
		}

		service.setAuthCookie(res, (result.user as { token?: string }).token ?? '');
		return sendSuccess(res, { user: result.user }, 200, 'Login successful');
	} catch (err) {
		return sendError(res, err);
	}
}

async function logoutHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		await service.logout(userId);
		try {
			const { invalidateTokenVersionCache } = await import('../../middleware.js');
			invalidateTokenVersionCache(userId);
		} catch {
			/* ignore */
		}
		service.clearAuthCookie(res);
		return sendSuccess(
			res,
			{ revoked: true, message: 'All sessions for this user have been revoked.' },
			200,
		);
	} catch (err) {
		return sendError(res, err);
	}
}

async function meHandler(req: Request, res: Response) {
	try {
		const user = await service.getMe(req.user!.id);
		return sendSuccess(res, user);
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateProfileHandler(req: Request, res: Response) {
	try {
		const v = validate(profileUpdateSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const updated = await service.updateProfile(req.user!.id, v.data);
		return sendSuccess(res, updated, 'Profile updated');
	} catch (err) {
		return sendError(res, err);
	}
}

async function changePasswordHandler(req: Request, res: Response) {
	try {
		const v = validate(passwordChangeSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const { current_password, new_password } = v.data;
		await service.changePassword({ userId: req.user!.id, current_password, new_password });
		try {
			const { invalidateTokenVersionCache } = await import('../../middleware.js');
			invalidateTokenVersionCache(req.user!.id);
		} catch {
			/* ignore */
		}
		await service.writeAuditLog(req, 'change_password', 'user', req.user!.id, null, null);
		return sendSuccess(res, { updated: true, sessions_invalidated: true }, 200, 'Password changed');
	} catch (err) {
		return sendError(res, err);
	}
}

async function forgotPasswordHandler(req: Request, res: Response) {
	try {
		const v = validate(z.object({ email: z.string().email().max(255) }), req.body);
		// SECURITY (OWASP ASVS 2.5.1, NIST SP 800-63B §5.1.1.2):
		// Always call the service regardless of validation success or email
		// existence. The previous implementation returned early on validation
		// failure, which leaked timing information (faster response = invalid
		// email format). We now always call the service with the validated
		// email (or a dummy on validation failure) so the response time is
		// constant.
		const email = v.ok ? v.data.email : 'invalid@placeholder.invalid';
		const result = await service.forgotPassword(email);
		// In dev, return the reset token for testing. In prod, always
		// return { ok: true } regardless of email existence.
		if (result && process.env.NODE_ENV !== 'production') {
			log.info({ msg: 'auth.forgot_password.issued' });
			return sendSuccess(
				res,
				{ ok: true, reset_token: result.reset_token, expires_at: result.expires_at },
				200,
			);
		}
		return sendSuccess(res, { ok: true }, 200);
	} catch (err) {
		return sendError(res, err);
	}
}

async function resetPasswordHandler(req: Request, res: Response) {
	try {
		const v = validate(
			z.object({
				token: z.string().min(10).max(2000),
				new_password: z.string().min(8).max(128),
			}),
			req.body,
		);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const userId = await service.resetPassword(v.data);
		try {
			const { invalidateTokenVersionCache } = await import('../../middleware.js');
			invalidateTokenVersionCache(userId);
		} catch {
			/* ignore */
		}
		await service.writeAuditLog(req, 'reset_password', 'user', userId, null, null);
		return sendSuccess(res, { updated: true, sessions_invalidated: true }, 200, 'Password reset');
	} catch (err) {
		return sendError(res, err);
	}
}
