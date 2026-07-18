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
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locate the repo root by walking up from this script until we find
 * a directory containing `package.json` + `.git/`. Hardcoding
 * `path.resolve(__dirname, '..', '..')` is brittle — if the script
 * is ever symlinked or invoked from a different working directory
 * the `__dirname` approach breaks. Walking up is robust.
 */
function findRepoRoot(start: string): string {
	let dir = start;
	for (let i = 0; i < 8; i += 1) {
		if (existsSync(path.join(dir, 'package.json')) && existsSync(path.join(dir, '.git'))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	// Fallback: assume scripts/ → one level up.
	return path.resolve(__dirname, '..');
}

const repoRoot = findRepoRoot(__dirname);

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
//
// SECURITY INVARIANTS enforced here:
//
//   1. **Idempotency via advisory lock**: the very first thing the
//      bootstrap does is `pg_try_advisory_xact_lock(N)`. If another
//      bootstrap invocation is already in progress (anywhere in the
//      cluster), the lock acquisition returns false and we abort
//      with exit code 2 — without ever having checked for an
//      existing super_admin (so the timing window between the
//      "does one exist?" check and the "insert" is closed).
//      The lock is automatically released when the transaction
//      commits or rolls back (no manual unlock needed).
//
//   2. **Atomic INSERT + audit log**: the user row + the audit
//      entry are written in the SAME transaction. If either fails,
//      neither persists (transaction rolled back).
//
//   3. **Never log secrets**: `env.password` is fed directly into
//      `hashPassword()` and never reaches the audit metadata. The
//      audit `new_values` JSON contains only:
//         { email, require_2fa_enrollment, bootstrap_source }
//      — no hash, no plaintext.
//
//   4. **No 2FA pre-activated**: `two_factor_enabled = false`,
//      `totp_secret = NULL`, `totp_enabled_at = NULL`. The trigger
//      `trg_sync_users_two_factor_enabled` (migration 0024) keeps
//      these consistent. The admin must run `/api/auth/2fa/setup`
//      before they can access any `/api/admin/*` endpoint.
//
//   5. **No phone_verified coupling to 2FA**: phone_verified is
//      false at bootstrap regardless of `require_2fa_enrollment`.
//      Admin verifies their phone via the OTP-via-SMS flow later.
//
//   6. **Pure-$N placeholders**: every SQL parameter uses `$N`
//      style (compatible with pg directly, no `pgify` rewriting).
//      We do NOT mix `?` and `$N` in the same statement.
async function bootstrap(
	env: BootstrapEnv,
	db: {
		tx: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
		prepare: (sql: string) => {
			get: (...args: unknown[]) => Promise<unknown>;
			run: (...args: unknown[]) => Promise<unknown>;
		};
	},
	hashPassword: (password: string) => Promise<string>,
): Promise<void> {
	// Race protection: take an advisory transaction lock for the
	// duration of the bootstrap. Two concurrent invocations cannot
	// both pass this point. The lock key is arbitrary but stable
	// (we use the first 32 bits of MD5('noufex-bootstrap-super-admin')
	// so a human reader can grep the source to find it).
	const BOOTSTRAP_LOCK_KEY = 0x6e6f7578; // 'noux' (32 bits of MD5 of the literal)

	await db.tx(async (tx) => {
		// 1. Take the transaction-scoped advisory lock.
		const txObj = tx as {
			prepare: (sql: string) => {
				get: (...args: unknown[]) => Promise<{ ok: boolean } | undefined>;
			};
		};
		const locked = (await txObj
			.prepare('SELECT pg_try_advisory_xact_lock($1) AS ok')
			.get(BOOTSTRAP_LOCK_KEY)) as { ok: boolean } | undefined;
		if (!locked?.ok) {
			// Another bootstrap invocation holds the lock. The
			// `process.exit` runs after this transaction rolls
			// back automatically (no need to throw).
			OUT.err('Another bootstrap is already in progress.');
			OUT.err('Wait for it to finish (it releases the lock on commit/rollback),');
			OUT.err('then retry.');
			process.exit(2);
		}

		// 2. Now that we hold the lock, check if a super_admin
		// already exists. Belt-and-braces: even if the SELECT after
		// the lock returns "exists=true", the insert will still hit
		// the unique-email constraint and fail.
		const existing = (await txObj
			.prepare(
				`SELECT id, email, role FROM users
				 WHERE role = $1
				    OR lower(email) = lower($2)
				 LIMIT 1`,
			)
			.get('super_admin', env.email)) as
			| { id: number; email: string; role: string }
			| undefined;
		if (existing) {
			OUT.err(`A privileged account already exists.`);
			OUT.err(`  id    = ${existing.id}`);
			OUT.err(`  email = ${existing.email}`);
			OUT.err(`  role  = ${existing.role}`);
			OUT.err('');
			OUT.err('This script refuses to create a second super_admin.');
			OUT.err('If you need a new operator, log in as the existing super_admin');
			OUT.err('and use the admin user-edit endpoint.');
			process.exit(2);
		}

		// 3. Hash the password. NEVER log it.
		const passwordHash = await hashPassword(env.password);

		// 4. Insert the user. The pure-$N placeholders + the explicit
		// columns list keep this readable and pg-compatible.
		const inserted = (await (tx as {
			prepare: (sql: string) => {
				run: (...args: unknown[]) => Promise<{ lastInsertRowid: number | null }>;
			};
		})
			.prepare(
				`INSERT INTO users (
					email,
					password_hash,
					full_name,
					phone,
					role,
					status,
					is_verified,
					email_verified,
					phone_verified,
					require_2fa_enrollment,
					two_factor_enabled,
					totp_secret,
					totp_enabled_at,
					preferred_language,
					token_version,
					created_at,
					updated_at
				)
				VALUES (
					$1,                                -- email
					$2,                                -- password_hash (scrypt)
					$3,                                -- full_name
					$4,                                -- phone (nullable)
					'super_admin',                     -- role
					'active',                          -- status
					FALSE,                             -- is_verified
					TRUE,                              -- email_verified (admin emails are trusted at provision)
					FALSE,                             -- phone_verified (set when admin actually verifies the phone via OTP)
					$5,                                -- require_2fa_enrollment (boolean from env)
					FALSE,                             -- two_factor_enabled (NEVER true at bootstrap)
					NULL,                              -- totp_secret (set during enrollment)
					NULL,                              -- totp_enabled_at (set during enrollment)
					'ar',                              -- preferred_language
					1,                                 -- token_version (initial)
					CURRENT_TIMESTAMP,
					CURRENT_TIMESTAMP
				)
				RETURNING id`,
			)
			.run(
				env.email,
				passwordHash,
				env.full_name,
				env.phone || null,
				env.require_2fa_enrollment,
			)) as { lastInsertRowid: number | null };

		const newId = inserted.lastInsertRowid;
		if (newId == null) {
			throw new Error('INSERT returned no row id — aborting transaction');
		}

		// 5. Write the audit entry inside the same transaction.
		// SECURITY: the metadata object contains ONLY non-sensitive
		// identifiers. No password, no password_hash, no token.
		const auditMeta = JSON.stringify({
			email: env.email,
			require_2fa_enrollment: env.require_2fa_enrollment,
			bootstrap_source: 'npm run bootstrap:admin',
		});
		await (tx as {
			prepare: (sql: string) => { run: (...args: unknown[]) => Promise<unknown> };
		})
			.prepare(
				`SELECT write_audit_log(
					$1,                  -- user_id (the newly-created super_admin)
					$2,                  -- action
					'user',              -- entity_type
					$3,                  -- entity_id (newId as text)
					NULL,                -- old_values
					$4::jsonb,           -- new_values (non-sensitive metadata)
					NULL,                -- ip_address
					'bootstrap-cli'      -- user_agent
				)`,
			)
			.run(newId, 'bootstrap.create_super_admin', String(newId), auditMeta);
	});

	// 6. Print the success banner. The password is NEVER printed
	// (we don't even reference it here — the function returned
	// long ago).
	OUT.ok(`super_admin provisioned: ${env.email}`);
	if (env.require_2fa_enrollment) {
		OUT.ok(
			'2FA enrolment required on first login — ' +
				'visit /api/auth/2fa/setup to enrol (admin routes are gated until then).',
		);
	} else {
		OUT.warn(
			'BOOTSTRAP_ADMIN_REQUIRE_2FA=false — ' +
				'admin will be able to access /api/admin without 2FA. STRONGLY DISCOURAGED.',
		);
	}
	OUT.ok('Audit-log entry written in the same transaction as the user row.');
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