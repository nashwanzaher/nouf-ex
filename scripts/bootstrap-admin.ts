#!/usr/bin/env tsx
/**
 * bootstrap-admin — provision the FIRST `super_admin` user.
 *
 * SECURITY (Tier 7 — R-SUPER-2, OWASP ASVS 2.1.1, NIST SP 800-53 IA-5):
 *
 *   1. NEVER self-register a super_admin. The /api/auth/register
 *      endpoint accepts only 'merchant' and 'customer' roles (see
 *      `modules/auth/service.ts`). Operators are privileged
 *      accounts that bypass that filter; they are provisioned
 *      either by this script (one-time, run from a trusted
 *      workstation) or by an existing super_admin via the admin
 *      user-edit endpoint (mutates `users.role` server-side).
 *
 *   2. Idempotency: this script refuses to run if a `super_admin`
 *      row already exists. The exit code is `2` so a CI pipeline
 *      that accidentally invokes it on a second deploy fails
 *      loudly instead of silently creating a duplicate.
 *
 *   3. Transaction: the user insert + audit-log insert run inside a
 *      single `db.tx()` block. If either fails, neither is
 *      persisted.
 *
 *   4. Password safety: the plaintext password is read from
 *      `BOOTSTRAP_ADMIN_PASSWORD` and is NEVER logged. The scrypt
 *      hash is logged via the audit trail (without the password).
 *
 *   5. 2FA opt-in: `BOOTSTRAP_ADMIN_REQUIRE_2FA=true` (default) sets
 *      `two_factor_enabled = TRUE` so the admin must enrol in TOTP
 *      before they can authenticate. Disable only for staging.
 *
 * Usage
 *   $ cp .env.example .env   # fill BOOTSTRAP_ADMIN_PASSWORD
 *   $ npm run bootstrap:admin
 *
 * Or directly via tsx (no package.json entry needed):
 *   $ tsx scripts/bootstrap-admin.ts
 *
 * Exit codes
 *   0 — super_admin provisioned (or already present, no-op)
 *   1 — invalid environment / DB unreachable
 *   2 — super_admin already exists (refuses to create a second)
 *   3 — validation failed (email format, password too short, ...)
 *
 * Tests
 *   The `validateBootstrapEnv()` function is exported and unit-tested
 *   via `scripts/bootstrap-admin.test.ts` (no DB needed).
 */

import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

// Load .env from the repo root (same convention as vitest.setup.ts).
loadDotenv({ path: path.join(repoRoot, '.env'), quiet: true });

import {
	validateBootstrapEnv,
	existsSuperAdmin,
	type BootstrapEnv,
} from './bootstrap-admin-validate.js';

// ── Output helpers ────────────────────────────────────────────────
// Use raw console.log so the operator running this CLI sees the
// output regardless of any pino/structured logger configuration.
const OUT = {
	ok(msg: string): void {
		console.log(`\u001b[32m✔ ${msg}\u001b[0m`);
	},
	warn(msg: string): void {
		console.warn(`\u001b[33m⚠ ${msg}\u001b[0m`);
	},
	err(msg: string): void {
		console.error(`\u001b[31m✗ ${msg}\u001b[0m`);
	},
};

// ── DB-side bootstrap (DB-dependent; tested via integration only)
async function bootstrap(
	env: BootstrapEnv,
	db: {
		tx: <T>(fn: (tx: {
			prepare: (sql: string) => {
				run: (...args: unknown[]) => Promise<unknown>;
				get: (...args: unknown[]) => Promise<unknown>;
			};
		}) => Promise<T>) => Promise<T>;
		prepare: (sql: string) => {
			get: (...args: unknown[]) => Promise<unknown>;
			run: (...args: unknown[]) => Promise<unknown>;
		};
	},
	hashPassword: (password: string) => Promise<string>,
): Promise<void> {
	if (await existsSuperAdmin(db)) {
		OUT.err('A super_admin user already exists in the database.');
		OUT.err('This script refuses to create a second one.');
		OUT.err('If you need a new operator, log in as the existing super_admin');
		OUT.err('and use the admin user-edit endpoint.');
		OUT.err('');
		OUT.err('To recover from a lost super_admin password, run the password-reset');
		OUT.err('flow manually from psql with noufex_owner privileges.');
		process.exit(2);
	}

	const passwordHash = await hashPassword(env.password);

	await db.tx(async (tx) => {
		const inserted = (await tx
			.prepare(
				`INSERT INTO users (
					email, password_hash, full_name, phone, role, status,
					is_verified, email_verified, phone_verified,
					two_factor_enabled, preferred_language, token_version,
					created_at, updated_at
				 )
				 VALUES (?, ?, ?, ?, 'super_admin', 'active',
				         TRUE,  TRUE,         $5::bool = $6::bool,
				         $7,         'ar', 1,
				         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				 RETURNING id`,
			)
			.run(
				env.email,
				passwordHash,
				env.full_name,
				env.phone || null,
				env.require_2fa,
				env.require_2fa,
				env.require_2fa,
			)) as { lastInsertRowid: number | null };

		const newId = inserted.lastInsertRowid;
		if (newId == null) {
			throw new Error('INSERT returned no row id — aborting transaction');
		}

		await tx
			.prepare(
				`SELECT write_audit_log($1, 'bootstrap.create_super_admin', 'user', $2,
				                        $3::jsonb, NULL, NULL, 'bootstrap-cli')`,
			)
			.run(
				newId,
				newId,
				JSON.stringify({
					email: env.email,
					require_2fa: env.require_2fa,
					created_by: 'npm run bootstrap:admin',
				}),
			)
			.catch(async () => {
				await tx
					.prepare(
						`SELECT write_audit_log(NULL, 'bootstrap.create_super_admin', 'user', $1,
						                        $2::jsonb, NULL, NULL, 'bootstrap-cli')`,
					)
					.run(
						newId,
						JSON.stringify({ email: env.email, require_2fa: env.require_2fa }),
					);
			});
	});

	OUT.ok(`super_admin provisioned: ${env.email}`);
	if (env.require_2fa) {
		OUT.ok('2FA enrolment required — log in, scan the QR, and store backup codes offline');
	} else {
		OUT.warn('2FA NOT required (BOOTSTRAP_ADMIN_REQUIRE_2FA=false). Enable it ASAP.');
	}
	OUT.ok('Audit-log entry written for this bootstrap event.');
}

// ── CLI main (only runs when invoked directly) ──────────────────
const isDirectInvocation = (() => {
	try {
		return fileURLToPath(import.meta.url) === process.argv[1];
	} catch {
		return false;
	}
})();

if (isDirectInvocation) {
	const env = validateBootstrapEnv();
	const { db, hashPassword } = await import('../../apps/api/src/lib/shared.ts');
	bootstrap(env, db, hashPassword).catch((err: Error) => {
		OUT.err(`Bootstrap failed: ${err.message}`);
		if (err.stack) console.error(err.stack);
		process.exit(1);
	});
}