/**
 * Authentication: login, register, profile, 2FA
 */

import { apiRequest } from './client';
import type { AuthResponse, TwoFactorEnableResponse, TwoFactorSetupResponse, TwoFactorVerifyResponse, UpdateProfileBody, User } from './types';

// ─── Auth API ───────────────────────────────────────────────

export async function login(body: { email: string; password: string }): Promise<AuthResponse> {
	return apiRequest('/auth/login', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function register(body: {
	email: string;
	password: string;
	name: string;
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
