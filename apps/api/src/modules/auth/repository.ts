/**
 * Auth repository — pure database access for users / sessions.
 */
import { db } from '../../lib/shared.ts';
import type { AuthRole } from '../../lib/types.ts';

export type AuthUserRow = {
	id: number;
	email: string;
	full_name: string;
	avatar: string | null;
	role: AuthRole;
	status: string;
	is_verified: boolean;
	phone: string | null;
	preferred_language: string | null;
	gender: string | null;
	password_hash: string;
	last_login: string | null;
	created_at: string;
	token_version: number;
	two_factor_enabled?: boolean;
};

export async function createUser(input: {
	email: string;
	passwordHash: string;
	name: string;
	role: 'customer' | 'merchant';
}): Promise<number | null> {
	const { email, passwordHash, name, role } = input;
	const result = (await db
		.prepare(
			`INSERT INTO users (email, password_hash, full_name, role, status, is_verified, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 'active', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			 RETURNING id`,
		)
		.run(email, passwordHash, name, role)) as { lastInsertRowid: number | null };
	return result.lastInsertRowid ?? null;
}

export async function findUserByEmail(email: string): Promise<AuthUserRow | undefined> {
	return (await db
		.prepare(
			`SELECT id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender,
			        password_hash, last_login, created_at, token_version, two_factor_enabled
			 FROM users WHERE email = ?`,
		)
		.get(email)) as AuthUserRow | undefined;
}

export async function findUserById(id: number) {
	return (await db
		.prepare(
			`SELECT id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender,
			        last_login, created_at
			 FROM users WHERE id = ?`,
		)
		.get(id)) as Record<string, unknown> | undefined;
}

export async function getTokenVersion(id: number): Promise<number | undefined> {
	const row = (await db.prepare('SELECT token_version FROM users WHERE id = ?').get(id)) as
		| { token_version: number }
		| undefined;
	return row?.token_version;
}

export async function updateLastLogin(id: number): Promise<void> {
	await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(id).catch(() => undefined);
}

export async function bumpTokenVersion(id: number): Promise<void> {
	await db
		.prepare('UPDATE users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
		.run(id);
}

export async function updateProfile(
	id: number,
	setClause: string,
	params: unknown[],
): Promise<Record<string, unknown> | undefined> {
	return (await db
		.prepare(
			`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
			 RETURNING id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender,
			         last_login, created_at`,
		)
		.get(...params, id)) as Record<string, unknown> | undefined;
}

export async function getPasswordHash(id: number): Promise<string | undefined> {
	const row = (await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id)) as
		| { password_hash: string }
		| undefined;
	return row?.password_hash;
}

export async function setPasswordHash(id: number, hash: string): Promise<void> {
	await db
		.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
		.run(hash, id);
}

export async function setPasswordHashAndBumpVersion(id: number, hash: string): Promise<void> {
	await db
		.prepare(
			'UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
		)
		.run(hash, id);
}
