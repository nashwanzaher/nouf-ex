/**
 * Authentication: login, register, profile, 2FA
 */

import { apiRequest } from './client';
import type { AuthResponse, TwoFactorEnableResponse, TwoFactorSetupResponse, TwoFactorVerifyResponse, UpdateProfileBody, User } from './types';

// ─── Auth API ───────────────────────────────────────────────

/**
 * Login response: either a real auth cookie is set (returns User)
 * OR a `requires_2fa: true` envelope is returned (the page must
 * then POST to /api/auth/2fa/verify with the partial_token). The
 * `AuthLoginResult` union captures both shapes. We renamed from
 * `LoginResult` to `AuthLoginResult` to avoid shadowing the global
 * browser type `LoginResult` (XPathResult).
 */
export type AuthLoginResult =
	| { kind: 'auth'; user: User }
	| { kind: '2fa_required'; partial_token: string; user_id: number };

export async function login(body: { email: string; password: string }): Promise<AuthLoginResult> {
	return apiRequest('/auth/login', {
		method: 'POST',
		body: JSON.stringify(body),
	}) as unknown as Promise<AuthLoginResult>;
}

export async function register(body: {
	email: string;
	password: string;
	name: string;
	// G5 fix 2026-07-11: clients can request 'merchant' at signup.
	// 'admin' is never accepted through the public endpoint.
	role?: 'customer' | 'merchant';
}): Promise<AuthResponse> {
	return apiRequest('/auth/register', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getCurrentUser(): Promise<User> {
	return apiRequest('/auth/me');
}

export async function updateProfile(body: UpdateProfileBody): Promise<User> {
	return apiRequest('/auth/me', {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function changePassword(body: {
	current_password: string;
	new_password: string;
}): Promise<{ updated: true }> {
	return apiRequest('/auth/change-password', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Password reset (G7 fix 2026-07-11) ────────────────────

/**
 * `forgotPassword(email)` asks the server to issue a reset token.
 * The server always returns 200 with `{ ok: true }`. In non-production
 * the response also includes `reset_token` so the page can drive the
 * full flow without SMTP set up. In production the token is only
 * delivered by email and the response contains `{ ok: true }` only.
 */
export type ForgotPasswordResult = {
	ok: true;
	reset_token?: string;
	expires_at?: string;
};

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
	return apiRequest('/auth/forgot-password', {
		method: 'POST',
		body: JSON.stringify({ email }),
	}) as Promise<ForgotPasswordResult>;
}

/**
 * `resetPassword(token, new_password)` consumes a reset token. On
 * success the user's `token_version` is bumped so every outstanding
 * bearer cookie becomes invalid (same defense-in-depth as
 * `changePassword`).
 */
export async function resetPassword(
	token: string,
	new_password: string,
): Promise<{ updated: true; sessions_invalidated: true }> {
	return apiRequest('/auth/reset-password', {
		method: 'POST',
		body: JSON.stringify({ token, new_password }),
	});
}

// ─── 2FA ─────────────────────────────────────────────────────

export async function setup2FA(): Promise<TwoFactorSetupResponse> {
	return apiRequest('/auth/2fa/setup', { method: 'POST' });
}

export async function enable2FA(body: { code: string }): Promise<TwoFactorEnableResponse> {
	return apiRequest('/auth/2fa/enable', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function verify2FA(body: {
	partial_token: string;
	code: string;
}): Promise<TwoFactorVerifyResponse> {
	return apiRequest('/auth/2fa/verify', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function disable2FA(body: { password: string }): Promise<{ disabled: boolean }> {
	return apiRequest('/auth/2fa/disable', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function regenerateBackupCodes(): Promise<{
	backup_codes: string[];
}> {
	return apiRequest('/auth/2fa/backup-codes/regenerate', { method: 'POST' });
}
