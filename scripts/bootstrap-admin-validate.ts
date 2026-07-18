/**
 * Pure validation for the bootstrap-admin CLI (Tier 7 — R-SUPER-2).
 *
 * Separated from `scripts/bootstrap-admin.ts` so the validation
 * logic can be unit-tested without importing the API source
 * (which has module-load side effects — it opens a PG pool).
 *
 * The CLI script imports `validateBootstrapEnv` from here and
 * imports `hashPassword` + `db` from `apps/api/src/lib/shared.ts`
 * separately. Tests import only this file.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const MIN_PASSWORD_LEN = 16;
export const PLACEHOLDER_VALUES = new Set([
	'',
	'REPLACE_WITH_STRONG_RANDOM',
	'changeme',
	'change-me',
	'CHANGE_ME',
	'password',
]);

export interface BootstrapEnv {
	email: string;
	full_name: string;
	phone: string;
	password: string;
	/**
	 * If true, the admin must enroll in TOTP on first login.
	 * At bootstrap time this is recorded as
	 * `users.require_2fa_enrollment = TRUE` but TOTP itself is
	 * NOT activated (`two_factor_enabled = false`,
	 * `totp_secret = null`, `totp_enabled_at = null`). The admin
	 * must run the `/api/auth/2fa/setup` flow before they can
	 * access any `/api/admin/*` endpoint (enforced by the
	 * `require2fa` middleware in `auth-2fa.ts`).
	 */
	require_2fa_enrollment: boolean;
}

export class BootstrapValidationError extends Error {
	readonly errors: string[];
	constructor(errors: string[]) {
		super(
			`Bootstrap validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}\n\n` +
				'Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in .env and retry.',
		);
		this.name = 'BootstrapValidationError';
		this.errors = errors;
	}
}

export function validateBootstrapEnv(env: NodeJS.ProcessEnv = process.env): BootstrapEnv {
	const email = (env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim();
	const full_name = (env.BOOTSTRAP_ADMIN_FULL_NAME ?? 'مدير منصة نوفكس').trim();
	const phone = (env.BOOTSTRAP_ADMIN_PHONE ?? '').trim();
	const password = env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
	const require_2fa_enrollment = (env.BOOTSTRAP_ADMIN_REQUIRE_2FA ?? 'true').toLowerCase() !== 'false';

	const errors: string[] = [];
	if (!email) errors.push('BOOTSTRAP_ADMIN_EMAIL is not set');
	else if (!EMAIL_RE.test(email))
		errors.push(`BOOTSTRAP_ADMIN_EMAIL is not a valid address: ${email}`);

	if (!full_name) errors.push('BOOTSTRAP_ADMIN_FULL_NAME is empty');
	if (phone && !/^\+?\d[\d\s-]{5,20}$/.test(phone))
		errors.push(`BOOTSTRAP_ADMIN_PHONE is not a valid E.164-ish number: ${phone}`);

	if (!password) errors.push('BOOTSTRAP_ADMIN_PASSWORD is not set');
	else if (PLACEHOLDER_VALUES.has(password))
		errors.push(
			'BOOTSTRAP_ADMIN_PASSWORD looks like a placeholder (REPLACE_WITH_STRONG_RANDOM or similar). ' +
				'Generate a real one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
		);
	else if (password.length < MIN_PASSWORD_LEN)
		errors.push(`BOOTSTRAP_ADMIN_PASSWORD is ${password.length} chars; minimum is ${MIN_PASSWORD_LEN}.`);

	if (errors.length > 0) throw new BootstrapValidationError(errors);

	return { email, full_name, phone, password, require_2fa_enrollment };
}

/**
 * DTO describing the operations the bootstrap script needs on the
 * DB pool. Defined here (instead of imported from shared.ts) so
 * tests can pass a fake implementation without pulling in the real
 * pg pool.
 */
export interface BootstrapDb {
	prepare: (sql: string) => {
		get: (...args: unknown[]) => Promise<unknown>;
		run: (...args: unknown[]) => Promise<unknown>;
	};
	tx: <T>(fn: (tx: BootstrapDb['prepare'] extends (...a: never) => infer R ? R : never) => Promise<T>) => Promise<T>;
}

/**
 * Idempotency check: refuse to run if a `super_admin` row exists.
 * Tested separately so we can pass a stub.
 */
export async function existsSuperAdmin(db: { prepare: (sql: string) => { get: () => Promise<unknown> } }): Promise<boolean> {
	const row = (await db
		.prepare('SELECT 1 AS ok FROM users WHERE role = $1 LIMIT 1')
		.get('super_admin')) as { ok: number } | undefined;
	return Boolean(row?.ok);
}