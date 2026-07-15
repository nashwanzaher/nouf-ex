/**
 * Auth service — business logic between controllers and repositories.
 */
import { ErrorCodes } from '../../lib/error-codes.ts';
import { signResetToken, verifyResetToken } from '../../lib/reset-token.ts';
import {
	hashPassword,
	HttpError,
	verifyPassword,
	writeAuditLog,
	type AuthRole,
} from '../../lib/shared.ts';
import { signAuthToken, setAuthCookie, clearAuthCookie } from '../../middleware.ts';
import { log } from '../../lib/shared.ts';
import * as repo from './repository.ts';

let DUMMY_SCRYPT_HASH: string | null = null;
hashPassword('__login_timing_dummy__').then((h) => {
	DUMMY_SCRYPT_HASH = h;
});

// ── Account-level brute-force protection ───────────────────────────────
// SECURITY (OWASP ASVS 2.2.1, NIST SP 800-53 AC-7):
//   Per-IP rate limiting (authLimiter) protects against distributed
//   brute-force, but a single IP targeting many accounts needs a
//   second layer. We track consecutive failed logins per normalized
//   email and apply exponential backoff:
//     1-3 failures:  no delay
//     4-6 failures:  1s delay
//     7-9 failures:  3s delay
//     10+ failures:  5s delay (capped)
//   After 15 consecutive failures, the account is soft-locked for
//   15 minutes (all attempts return AUTH_INVALID immediately).
//   Successful login resets the counter.
//
//   The map is in-process (not shared across workers), which is
//   acceptable: with k8s replicas, the attacker hits a different
//   worker each time, but the per-IP authLimiter already limits
//   total attempts to 10/15min per IP. This layer adds per-email
//   throttling on top.

interface AccountFailureEntry {
	count: number;
	blockedUntil: number | null;
	lastFailureAt: number;
}
const accountFailures = new Map<string, AccountFailureEntry>();
const MAX_FAILURES_BEFORE_LOCK = 15;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_BACKOFF_MS = 5_000;

// Evict stale entries every 5 minutes to prevent unbounded memory growth.
setInterval(() => {
	const now = Date.now();
	for (const [email, entry] of accountFailures) {
		// Remove entries older than 30 minutes (lock window + buffer)
		if (now - entry.lastFailureAt > 30 * 60 * 1000) {
			accountFailures.delete(email);
		}
	}
}, 5 * 60 * 1000).unref();

function normalizeEmail(email: string): string {
	return email.toLowerCase().trim();
}

function getAccountFailureEntry(email: string): AccountFailureEntry | undefined {
	return accountFailures.get(normalizeEmail(email));
}

function recordLoginFailure(email: string): void {
	const key = normalizeEmail(email);
	const now = Date.now();
	const existing = accountFailures.get(key);

	if (existing) {
		existing.count++;
		existing.lastFailureAt = now;
		if (existing.count >= MAX_FAILURES_BEFORE_LOCK && !existing.blockedUntil) {
			existing.blockedUntil = now + LOCK_DURATION_MS;
			log.warn({
				msg: 'account_locked',
				email: key,
				failures: existing.count,
				lock_expires: new Date(existing.blockedUntil).toISOString(),
			});
		}
	} else {
		accountFailures.set(key, {
			count: 1,
			blockedUntil: null,
			lastFailureAt: now,
		});
	}
}

function clearLoginFailures(email: string): void {
	accountFailures.delete(normalizeEmail(email));
}

function getAccountBackoffMs(email: string): number {
	const entry = getAccountFailureEntry(email);
	if (!entry || entry.count < 4) return 0;
	if (entry.count < 7) return 1_000;
	if (entry.count < 10) return 3_000;
	return MAX_BACKOFF_MS;
}

function isAccountLocked(email: string): boolean {
	const entry = getAccountFailureEntry(email);
	if (!entry || !entry.blockedUntil) return false;
	if (Date.now() < entry.blockedUntil) return true;
	// Lock expired — clear it
	entry.blockedUntil = null;
	entry.count = 0;
	return false;
}

export type SafeUser = {
	id: number;
	email: string;
	full_name: string;
	role: AuthRole;
};

export async function register(input: {
	email: string;
	password: string;
	name: string;
	role?: string;
}): Promise<{ user: SafeUser; token: string }> {
	const { email, password, name } = input;
	const role: AuthRole = input.role === 'merchant' ? 'merchant' : 'customer';
	const passwordHash = await hashPassword(password);

	const userId = await repo.createUser({ email, passwordHash, name, role });
	if (userId == null) {
		throw new HttpError(500, 'Failed to create user', { code: ErrorCodes.INSERT_FAILED });
	}

	const tokenVersion = await repo.getTokenVersion(userId);
	const token = signAuthToken({ sub: userId, role, ver: tokenVersion ?? 0 });
	return { user: { id: userId, email, full_name: name, role }, token };
}

export type LoginResult =
	| { kind: 'auth'; user: Omit<repo.AuthUserRow, 'password_hash'> }
	| { kind: '2fa_required'; partial_token: string; user_id: number };

export async function login(input: {
	email: string;
	password: string;
}): Promise<LoginResult> {
	const { email, password } = input;

	// SECURITY (OWASP ASVS 2.2.1, NIST SP 800-53 AC-7):
	// Check account-level lockout before any DB work.
	if (isAccountLocked(email)) {
		// Still run dummy scrypt to preserve constant-time behavior.
		if (DUMMY_SCRYPT_HASH) {
			await verifyPassword(password, DUMMY_SCRYPT_HASH).catch(() => false);
		}
		throw new HttpError(401, 'Invalid email or password', { code: 'AUTH_INVALID' });
	}

	// Apply exponential backoff for accounts with repeated failures.
	const backoffMs = getAccountBackoffMs(email);
	if (backoffMs > 0) {
		await new Promise((r) => setTimeout(r, backoffMs));
	}

	const user = await repo.findUserByEmail(email);

	if (!user) {
		if (DUMMY_SCRYPT_HASH) {
			await verifyPassword(password, DUMMY_SCRYPT_HASH).catch(() => false);
		}
		recordLoginFailure(email);
		throw new HttpError(401, 'Invalid email or password', { code: 'AUTH_INVALID' });
	}

	const ok = await verifyPassword(password, user.password_hash);
	if (!ok) {
		recordLoginFailure(email);
		throw new HttpError(401, 'Invalid email or password', { code: 'AUTH_INVALID' });
	}

	// Successful login — clear all failure tracking for this account.
	clearLoginFailures(email);

	await repo.updateLastLogin(user.id);

	const { password_hash: _omit, ...userWithoutPassword } = user;
	if (user.two_factor_enabled) {
		const { signPartialToken } = await import('../../lib/partial-token.ts');
		const partial_token = signPartialToken(user.id);
		return { kind: '2fa_required', partial_token, user_id: user.id };
	}

	const token = signAuthToken({ sub: user.id, role: user.role, ver: user.token_version });
	return { kind: 'auth', user: { ...userWithoutPassword, token } as unknown as Omit<repo.AuthUserRow, 'password_hash'> };
}

export async function logout(userId: number): Promise<void> {
	await repo.bumpTokenVersion(userId);
}

export async function getMe(userId: number): Promise<Record<string, unknown>> {
	const user = await repo.findUserById(userId);
	if (!user) {
		throw new HttpError(404, 'User not found', { code: ErrorCodes.NOT_FOUND });
	}
	return user;
}

export async function updateProfile(
	userId: number,
	updates: Record<string, unknown>,
): Promise<Record<string, unknown>> {
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
		throw new HttpError(400, 'No updatable fields supplied', { code: 'EMPTY_UPDATE' });
	}

	const updated = await repo.updateProfile(userId, fields.join(', '), params);
	if (!updated) {
		throw new HttpError(404, 'User not found', { code: ErrorCodes.NOT_FOUND });
	}
	return updated;
}

export async function changePassword(input: {
	userId: number;
	current_password: string;
	new_password: string;
}): Promise<void> {
	const { userId, current_password, new_password } = input;
	const hash = await repo.getPasswordHash(userId);
	if (!hash) {
		throw new HttpError(404, 'User not found', { code: ErrorCodes.NOT_FOUND });
	}

	const ok = await verifyPassword(current_password, hash);
	if (!ok) {
		throw new HttpError(401, 'Current password is incorrect', { code: 'WRONG_PASSWORD' });
	}

	const sameAsCurrent = await verifyPassword(new_password, hash);
	if (sameAsCurrent) {
		throw new HttpError(400, 'New password must be different from the current password', {
			code: 'SAME_AS_CURRENT',
		});
	}

	const newHash = await hashPassword(new_password);
	await repo.setPasswordHashAndBumpVersion(userId, newHash);
}

export async function forgotPassword(email: string): Promise<{ reset_token?: string; expires_at?: string } | null> {
	const user = await repo.findUserByEmail(email);
	if (!user) return null;
	const { token, expiresAt } = signResetToken(user.id);
	return { reset_token: token, expires_at: expiresAt.toISOString() };
}

export async function resetPassword(input: {
	token: string;
	new_password: string;
}): Promise<number> {
	const { token, new_password } = input;
	const verified = await verifyResetToken(token);
	if (!verified) {
		throw new HttpError(400, 'Reset token is invalid or expired.', { code: ErrorCodes.PARTIAL_INVALID });
	}
	const userId = verified.sub;
	const newHash = await hashPassword(new_password);
	await repo.setPasswordHashAndBumpVersion(userId, newHash);
	return userId;
}

export { setAuthCookie, clearAuthCookie, signAuthToken, writeAuditLog };
