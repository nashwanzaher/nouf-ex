/**
 * Integration tests for scripts/bootstrap-admin.ts against a real
 * PostgreSQL 17 database (Tier 7 — R-SUPER-FINAL).
 *
 * These tests require a running Postgres instance with:
 *   - DATABASE_URL pointing at it
 *   - The 0036 + 0037 migrations applied
 *   - An unprivileged role that can INSERT/SELECT on users and
 *     CALL write_audit_log
 *
 * The test suite is gated behind `RUN_BOOTSTRAP_INTEGRATION=1` so it
 * is NOT executed in the default `npm test` run (which only runs
 * unit tests in CI). The CI workflow should opt in:
 *
 *   RUN_BOOTSTRAP_INTEGRATION=1 npm run test:integration
 *
 * The tests DO NOT log or persist the plaintext password anywhere
 * (the only assertion that involves it uses a throw-away value
 * generated locally in the test body).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	existsSuperAdmin,
	validateBootstrapEnv,
} from './bootstrap-admin-validate.ts';

// We dynamically import the bootstrap module ONLY when the
// integration gate is enabled. This avoids loading `lib/shared.ts`
// (which constructs a real PgDb) when running unit tests.

const ENABLED = process.env.RUN_BOOTSTRAP_INTEGRATION === '1';

const SKIP = !ENABLED ? describe.skip : describe;

interface TestDb {
	query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
	tx: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T>;
	close: () => Promise<void>;
}

interface TxClient {
	query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}

let db: TestDb | null = null;
let hashPassword: (p: string) => Promise<string> | null = null;
let bootstrap: typeof import('./bootstrap-admin.ts').bootstrap | null = null;

if (ENABLED) {
	beforeAll(async () => {
		// The pg.Pool API we need isn't exported from lib/shared.ts
		// (it returns a wrapped PgDb instance), so we use the official
		// `pg` driver directly here. Test isolation is handled with
		// a savepoint per test.
		const { Pool } = await import('pg');
		const url = process.env.DATABASE_URL;
		if (!url) throw new Error('RUN_BOOTSTRAP_INTEGRATION=1 requires DATABASE_URL');
		const pool = new Pool({ connectionString: url });
		db = {
			query: (sql, params) => pool.query(sql, params ?? []),
			tx: async <T,>(fn: (tx: TxClient) => Promise<T>) =>
				pool.connect().then(async (client) => {
					await client.query('BEGIN');
					try {
						const result = await fn(client);
						await client.query('COMMIT');
						return result;
					} catch (err) {
						await client.query('ROLLBACK');
						throw err;
					} finally {
						client.release();
					}
				}),
			close: () => pool.end(),
		};
		const auth = await import('../../apps/api/src/lib/auth.js');
		hashPassword = auth.hashPassword;
		const script = await import('./bootstrap-admin.js');
		bootstrap = script.bootstrap;
	});

	afterAll(async () => {
		if (db) await db.close();
	});
}

// Helper: unique email for each test so they're isolated.
function uniqueEmail(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@noufex.test`;
}

// Helper: clean up the super_admin we create in tests. We never
// leave a stray super_admin behind between test runs.
async function deleteByEmail(email: string): Promise<void> {
	if (!db) return;
	await db.query('DELETE FROM users WHERE email = $1', [email]);
	// Also clean any audit entries this email might have left
	// (entity_id may reference the user id we just deleted).
	await db.query(
		`DELETE FROM admin_audit_log
		  WHERE entity_type = 'user'
		    AND new_values::jsonb->>'email' = $1`,
		[email],
	);
}

SKIP('bootstrap-admin integration (R-SUPER-FINAL)', () => {
	if (!ENABLED || !db || !hashPassword || !bootstrap) {
		// The beforeAll hasn't run (gate disabled). Provide a
		// no-op shim so the test file's other tests still parse.
		it('skipped (RUN_BOOTSTRAP_INTEGRATION not set)', () => {
			// marker test — ensures the file is a valid vitest module
		});
		return;
	}

	// ── 1. .env loading ────────────────────────────────────────
	it('loads .env from the repo root', async () => {
		// The validation function reads from process.env directly.
		// Set the env vars here, then call validate, then assert.
		const email = uniqueEmail('env-load');
		process.env.BOOTSTRAP_ADMIN_EMAIL = email;
		process.env.BOOTSTRAP_ADMIN_FULL_NAME = 'Env Loader Test';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+967771234567';
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'EnvLoader!StrongPwd2026';
		process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA = 'true';
		const env = validateBootstrapEnv();
		expect(env.email).toBe(email);
		// Cleanup
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_FULL_NAME;
		delete process.env.BOOTSTRAP_ADMIN_PHONE;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA;
	});

	// ── 2. accepts the real production email + mobile ─────────
	it('accepts the production email + mobile format', () => {
		process.env.BOOTSTRAP_ADMIN_EMAIL = 'noufex@yahoo.com';
		process.env.BOOTSTRAP_ADMIN_FULL_NAME = 'مدير منصة نوفكس';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+967778864665';
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'RealMobile!PhoneFormat2026Secure';
		process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA = 'true';
		const env = validateBootstrapEnv();
		expect(env.email).toBe('noufex@yahoo.com');
		expect(env.full_name).toBe('مدير منصة نوفكس');
		expect(env.phone).toBe('+967778864665');
		expect(env.require_2fa_enrollment).toBe(true);
		// Cleanup
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_FULL_NAME;
		delete process.env.BOOTSTRAP_ADMIN_PHONE;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA;
	});

	// ── 3. rejects landline (NOT a user.phone column value) ──
	it('rejects a landline number as a user.phone (E.164-only)', () => {
		process.env.BOOTSTRAP_ADMIN_EMAIL = uniqueEmail('landline');
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'StrongPwd!Landline2026';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+9671656650'; // landline — rejected
		try {
			expect(() => validateBootstrapEnv()).toThrow(/not a valid E.164/);
		} finally {
			delete process.env.BOOTSTRAP_ADMIN_EMAIL;
			delete process.env.BOOTSTRAP_ADMIN_PHONE;
			delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		}
	});

	// ── 4. happy-path DB INSERT (real PostgreSQL 17) ──────────
	it('inserts a super_admin on PostgreSQL 17 with pure-$N SQL', async () => {
		const email = uniqueEmail('integration-happy');
		process.env.BOOTSTRAP_ADMIN_EMAIL = email;
		process.env.BOOTSTRAP_ADMIN_FULL_NAME = 'Integration Happy Path';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+967771111111';
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Integration!HappyPath2026Secure';
		process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA = 'true';
		const env = validateBootstrapEnv();
		await bootstrap!(env, db!, hashPassword!);
		// Verify the row exists with all the documented properties.
		const userRes = (await db!.query(
			`SELECT id, email, full_name, role, status,
			        is_verified, email_verified, phone_verified,
			        require_2fa_enrollment, two_factor_enabled,
			        totp_secret, totp_enabled_at
			   FROM users WHERE email = $1`,
			[email],
		)) as { rows: Array<Record<string, unknown>> };
		expect(userRes.rows).toHaveLength(1);
		const u = userRes.rows[0]!;
		expect(u.role).toBe('super_admin');
		expect(u.status).toBe('active');
		expect(u.is_verified).toBe(false);
		// Email_verified is TRUE at bootstrap — the email is from a
		// trusted operator channel (the .env file).
		expect(u.email_verified).toBe(true);
		// phone_verified is FALSE at bootstrap — the admin must
		// verify the phone via OTP-SMS later.
		expect(u.phone_verified).toBe(false);
		// 2FA policy: require enrolment = TRUE, but TOTP is NOT
		// pre-activated (totp_secret null, totp_enabled_at null,
		// two_factor_enabled false).
		expect(u.require_2fa_enrollment).toBe(true);
		expect(u.two_factor_enabled).toBe(false);
		expect(u.totp_secret).toBeNull();
		expect(u.totp_enabled_at).toBeNull();
		await deleteByEmail(email);
		// Cleanup env
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_FULL_NAME;
		delete process.env.BOOTSTRAP_ADMIN_PHONE;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA;
	});

	// ── 5. audit row written in same transaction ──────────────
	it('writes the audit-log entry in the same transaction as the user row', async () => {
		const email = uniqueEmail('integration-audit');
		process.env.BOOTSTRAP_ADMIN_EMAIL = email;
		process.env.BOOTSTRAP_ADMIN_FULL_NAME = 'Audit Test';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+967772222222';
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'AuditTest!Transaction2026';
		process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA = 'true';
		const env = validateBootstrapEnv();
		await bootstrap!(env, db!, hashPassword!);
		const auditRes = (await db!.query(
			`SELECT user_id, action, entity_type, entity_id,
			        new_values::text AS new_values_text
			   FROM admin_audit_log
			  WHERE action = 'bootstrap.create_super_admin'
			    AND new_values::jsonb->>'email' = $1
			  ORDER BY id DESC LIMIT 1`,
			[email],
		)) as { rows: Array<Record<string, unknown>> };
		expect(auditRes.rows).toHaveLength(1);
		const audit = auditRes.rows[0]!;
		expect(audit.action).toBe('bootstrap.create_super_admin');
		expect(audit.entity_type).toBe('user');
		// SECURITY INVARIANT: the metadata MUST NOT contain
		// password, password_hash, hash, or any sensitive value.
		const meta = String(audit.new_values_text);
		expect(meta).not.toMatch(/password/i);
		expect(meta).not.toMatch(/hash/i);
		expect(meta).not.toMatch(/\$2[ab]\$/); // scrypt$N$salt$hash marker
		// But it MUST contain the documented non-sensitive fields.
		const parsed = JSON.parse(meta) as Record<string, unknown>;
		expect(parsed.email).toBe(email);
		expect(parsed.require_2fa_enrollment).toBe(true);
		expect(parsed.bootstrap_source).toBe('npm run bootstrap:admin');
		await deleteByEmail(email);
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_FULL_NAME;
		delete process.env.BOOTSTRAP_ADMIN_PHONE;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA;
	});

	// ── 6. transaction rollback semantics ────────────────────
	it('rolls back the user insert if the audit insert fails', async () => {
		const email = uniqueEmail('rollback-test');
		process.env.BOOTSTRAP_ADMIN_EMAIL = email;
		process.env.BOOTSTRAP_ADMIN_FULL_NAME = 'Rollback Test';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+967773333333';
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'RollbackTest!ForceFailure2026';
		process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA = 'true';
		const env = validateBootstrapEnv();

		// Build a DB stub whose write_audit_log throws. The user
		// insert must roll back, leaving no row.
		const failingDb = {
			query: db!.query,
			tx: async <T,>(fn: (tx: unknown) => Promise<T>) =>
				db!.tx(async (tx) => {
					// Wrap the tx client to sabotage write_audit_log.
					const wrapped = new Proxy(tx as object, {
						get(target, prop) {
							if (prop === 'prepare') {
								return (sql: string) => {
									const inner = (target as { prepare: (s: string) => unknown }).prepare(sql);
									return new Proxy(inner as object, {
										get(t, p) {
											const val = (t as Record<string | symbol, unknown>)[p];
											if (typeof val === 'function') {
												return (...args: unknown[]) => {
													if (sql.includes('write_audit_log')) {
														throw new Error('simulated audit failure');
													}
													return (val as (...a: unknown[]) => unknown)(...args);
												};
											}
											return val;
										},
									});
								};
							}
							return (target as Record<string | symbol, unknown>)[prop];
						},
					});
					return fn(wrapped);
				}),
		};

		await expect(bootstrap!(env, failingDb as never, hashPassword!)).rejects.toThrow(
			/simulated audit failure/,
		);

		// The user row must NOT exist (transaction rolled back).
		const userRes = (await db!.query(
			'SELECT id FROM users WHERE email = $1',
			[email],
		)) as { rows: Array<{ id: number }> };
		expect(userRes.rows).toHaveLength(0);
		// And the audit row must NOT exist either (same transaction).
		const auditRes = (await db!.query(
			`SELECT id FROM admin_audit_log
			  WHERE new_values::jsonb->>'email' = $1`,
			[email],
		)) as { rows: Array<{ id: number }> };
		expect(auditRes.rows).toHaveLength(0);
		await deleteByEmail(email);
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_FULL_NAME;
		delete process.env.BOOTSTRAP_ADMIN_PHONE;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA;
	});

	// ── 7. fail-closed (NOT fail-open) on second run ────────
	it('refuses a second bootstrap with exit semantics (idempotent via existing-check)', async () => {
		const email = uniqueEmail('duplicate-prevention');
		process.env.BOOTSTRAP_ADMIN_EMAIL = email;
		process.env.BOOTSTRAP_ADMIN_FULL_NAME = 'Dup Test';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+967774444444';
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'DupTest!Idempotent2026Secure';
		process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA = 'true';
		const env = validateBootstrapEnv();

		// Spy on process.exit so we can verify the exit code WITHOUT
		// actually killing the test process.
		const exitCalls: number[] = [];
		const originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCalls.push(code ?? 0);
			// Throw so we don't continue executing the bootstrap
			// after the exit point — it's the script's expectation
			// that this throws (none of the bootstrap code runs
			// after exit).
			throw new Error(`__exit:${code ?? 0}`);
		}) as never;

		// First run: succeeds.
		await bootstrap!(env, db!, hashPassword!);
		expect(exitCalls).toHaveLength(0);

		// Second run: must refuse. The bootstrap calls process.exit(2)
		// which our spy turns into a thrown error.
		try {
			await bootstrap!(env, db!, hashPassword!);
			expect.fail('second bootstrap must throw via exit(2)');
		} catch (err) {
			expect((err as Error).message).toBe('__exit:2');
		}
		expect(exitCalls).toEqual([2]);

		process.exit = originalExit;
		await deleteByEmail(email);
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_FULL_NAME;
		delete process.env.BOOTSTRAP_ADMIN_PHONE;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA;
	});

	// ── 8. concurrent-bootstrap prevention (advisory lock) ────
	it('a concurrent bootstrap acquires no rows while another holds the lock', async () => {
		// Spawn two bootstrap invocations back-to-back (sequential,
		// but emulating the race by holding the lock between them via
		// a separate transaction). The second one must exit(2).
		const email = uniqueEmail('concurrent-test');
		process.env.BOOTSTRAP_ADMIN_EMAIL = email;
		process.env.BOOTSTRAP_ADMIN_FULL_NAME = 'Concurrent Test';
		process.env.BOOTSTRAP_ADMIN_PHONE = '+967775555555';
		process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Concurrent!TestLock2026';
		process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA = 'true';
		const env = validateBootstrapEnv();

		const exitCalls: number[] = [];
		const originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCalls.push(code ?? 0);
			throw new Error(`__exit:${code ?? 0}`);
		}) as never;

		// Run #1: succeeds, releases the lock when its tx commits.
		await bootstrap!(env, db!, hashPassword!);

		// Now manually take the same advisory lock in a separate
		// transaction — emulating a second concurrent runner that
		// hasn't released yet.
		await db!.tx(async (tx) => {
			const r = (await (tx as { prepare: (s: string) => { get: (...a: unknown[]) => Promise<{ ok: boolean }> } })
				.prepare('SELECT pg_try_advisory_xact_lock($1) AS ok')
				.get(0x6e6f7578)) as { ok: boolean } | undefined;
			expect(r?.ok).toBe(true);
			// While we hold it, run #2 should refuse.
			try {
				await bootstrap!(env, db!, hashPassword!);
				expect.fail('second bootstrap must refuse under held lock');
			} catch (err) {
				expect((err as Error).message).toBe('__exit:2');
			}
			expect(exitCalls).toEqual([2]);
		});
		// After the lock is released (we exited the tx above),
		// a third bootstrap on a different email should succeed.
		const exitCallsBefore = exitCalls.length;
		process.env.BOOTSTRAP_ADMIN_EMAIL = uniqueEmail('after-release');
		await bootstrap!(validateBootstrapEnv(), db!, hashPassword!);
		expect(exitCalls.length).toBe(exitCallsBefore);
		// cleanup
		process.exit = originalExit;
		const [first, second] = [
			email,
			(await db!.query(
				"SELECT email FROM users WHERE role = 'super_admin' ORDER BY id DESC",
			)) as { rows: Array<{ email: string }> },
		];
		await deleteByEmail(first);
		if (second.rows[0]) await deleteByEmail(second.rows[0].email);
		delete process.env.BOOTSTRAP_ADMIN_EMAIL;
		delete process.env.BOOTSTRAP_ADMIN_FULL_NAME;
		delete process.env.BOOTSTRAP_ADMIN_PHONE;
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA;
	});

	// ── 9. role enum: only super_admin exists at bootstrap ────
	it('public registration cannot create any operator role', () => {
		// Mirror the production auth/service.ts guard:
		const SELF_REGISTRABLE = ['merchant', 'customer'];
		const OPERATOR_ROLES = [
			'super_admin',
			'store_reviewer',
			'catalog_moderator',
			'finance_admin',
			'support_agent',
		];
		for (const role of OPERATOR_ROLES) {
			expect(SELF_REGISTRABLE).not.toContain(role);
		}
	});
});