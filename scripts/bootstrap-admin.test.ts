/**
 * Unit tests for scripts/bootstrap-admin-validate.ts.
 *
 * Pure-function tests — no DB, no async fixtures, runs in < 50ms.
 * The DB-side `bootstrap()` function is tested separately via
 * the integration suite (which spins up a real PG container).
 */
import { describe, expect, it } from 'vitest';
import {
	validateBootstrapEnv,
	existsSuperAdmin,
	EMAIL_RE,
	MIN_PASSWORD_LEN,
	PLACEHOLDER_VALUES,
} from './bootstrap-admin-validate.ts';

const validEnv = {
	BOOTSTRAP_ADMIN_EMAIL: 'admin@noufex.test',
	BOOTSTRAP_ADMIN_FULL_NAME: 'Admin User',
	BOOTSTRAP_ADMIN_PHONE: '+967771234567',
	BOOTSTRAP_ADMIN_PASSWORD: 'StrongPassword!2026Secure',
	BOOTSTRAP_ADMIN_REQUIRE_2FA: 'true',
};

describe('validateBootstrapEnv', () => {
	it('returns a clean BootstrapEnv when all values are valid', () => {
		const env = validateBootstrapEnv(validEnv);
		expect(env.email).toBe('admin@noufex.test');
		expect(env.full_name).toBe('Admin User');
		expect(env.phone).toBe('+967771234567');
		expect(env.password).toBe('StrongPassword!2026Secure');
		expect(env.require_2fa_enrollment).toBe(true);
	});

	it('defaults full_name to "مدير منصة نوفكس" when unset', () => {
		const env = validateBootstrapEnv({
			...validEnv,
			BOOTSTRAP_ADMIN_FULL_NAME: undefined,
		});
		expect(env.full_name).toBe('مدير منصة نوفكس');
	});

	it('defaults require_2fa_enrollment to true (safer default)', () => {
		const env = validateBootstrapEnv({
			...validEnv,
			BOOTSTRAP_ADMIN_REQUIRE_2FA: undefined,
		});
		expect(env.require_2fa_enrollment).toBe(true);
	});

	it('treats BOOTSTRAP_ADMIN_REQUIRE_2FA=false as opt-out', () => {
		const env = validateBootstrapEnv({
			...validEnv,
			BOOTSTRAP_ADMIN_REQUIRE_2FA: 'false',
		});
		expect(env.require_2fa_enrollment).toBe(false);
	});

	it('treats any non-"false" value as opt-in', () => {
		const env = validateBootstrapEnv({
			...validEnv,
			BOOTSTRAP_ADMIN_REQUIRE_2FA: 'no',
		});
		expect(env.require_2fa_enrollment).toBe(true);
	});

	it('rejects missing email', () => {
		expect(() =>
			validateBootstrapEnv({ ...validEnv, BOOTSTRAP_ADMIN_EMAIL: '' }),
		).toThrow(/BOOTSTRAP_ADMIN_EMAIL is not set/);
	});

	it('rejects invalid email format', () => {
		expect(() =>
			validateBootstrapEnv({ ...validEnv, BOOTSTRAP_ADMIN_EMAIL: 'not-an-email' }),
		).toThrow(/not a valid address/);
	});

	it('rejects missing password', () => {
		expect(() =>
			validateBootstrapEnv({ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: '' }),
		).toThrow(/BOOTSTRAP_ADMIN_PASSWORD is not set/);
	});

	it('rejects password shorter than the minimum', () => {
		expect(() =>
			validateBootstrapEnv({ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: 'short' }),
		).toThrow(/is 5 chars; minimum is 16/);
	});

	it('rejects placeholder passwords', () => {
		// The empty string is rejected earlier (as "not set"); the
		// remaining placeholder values are explicit markers that
		// must NOT be used as a real password.
		for (const placeholder of PLACEHOLDER_VALUES) {
			if (placeholder === '') continue;
			try {
				validateBootstrapEnv({ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: placeholder });
				expect.fail(`should have rejected placeholder ${JSON.stringify(placeholder)}`);
			} catch (err) {
				expect((err as Error).message).toContain('looks like a placeholder');
			}
		}
	});

	it('accepts a strong password of exactly the minimum length', () => {
		const env = validateBootstrapEnv({
			...validEnv,
			BOOTSTRAP_ADMIN_PASSWORD: 'A'.repeat(MIN_PASSWORD_LEN),
		});
		expect(env.password.length).toBe(MIN_PASSWORD_LEN);
	});

	it('rejects invalid phone format when provided', () => {
		expect(() =>
			validateBootstrapEnv({ ...validEnv, BOOTSTRAP_ADMIN_PHONE: 'abc' }),
		).toThrow(/not a valid E.164/);
	});

	it('accepts missing phone (optional)', () => {
		const env = validateBootstrapEnv({
			...validEnv,
			BOOTSTRAP_ADMIN_PHONE: '',
		});
		expect(env.phone).toBe('');
	});

	it('exports the email regex and min length for documentation', () => {
		expect(EMAIL_RE.test('a@b.c')).toBe(true);
		expect(EMAIL_RE.test('no-at-sign')).toBe(false);
		expect(MIN_PASSWORD_LEN).toBe(16);
	});
});

describe('existsSuperAdmin (idempotency check)', () => {
	function makeStubDb(rows: Array<{ ok: number }>): {
		prepare: (sql: string) => { get: () => Promise<{ ok: number } | undefined> };
	} {
		return {
			prepare: () => ({
				get: async () => rows[0],
			}),
		};
	}

	it('returns true when a super_admin row is present', async () => {
		expect(await existsSuperAdmin(makeStubDb([{ ok: 1 }]))).toBe(true);
	});

	it('returns false when the query returns nothing', async () => {
		expect(await existsSuperAdmin(makeStubDb([]))).toBe(false);
	});

	it('uses the role literal "super_admin" (regression: legacy "admin" would never match)', async () => {
		const calls: string[] = [];
		const db = {
			prepare: (sql: string) => {
				calls.push(sql);
				return { get: async () => ({ ok: 1 }) };
			},
		};
		await existsSuperAdmin(db);
		// The prepared statement uses $1 as a placeholder; verify the
		// bootstrap-admin.ts passes the literal 'super_admin' when
		// calling db.prepare(sql).get(...). We spy on db.prepare via
		// a wrapper.
		const prepared = calls[0] ?? '';
		expect(prepared).toContain('FROM users');
		expect(prepared).toContain('WHERE role = $1');

		// Now check the actual argument passed at .get().
		let capturedArg: unknown;
		const db2 = {
			prepare: () => ({
				get: async (arg: unknown) => {
					capturedArg = arg;
					return { ok: 1 };
				},
			}),
		};
		await existsSuperAdmin(db2);
		expect(capturedArg).toBe('super_admin');
	});
});