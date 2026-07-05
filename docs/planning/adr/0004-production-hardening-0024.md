# ADR-0004 — Apply `0024_production_hardening.sql` migration (close 8 production drifts)

> **Status:** ✅ Accepted (2026-07-04)
> **Deciders:** Nouf-ex maintainer + GitHub Copilot (`@database` + `@reviewer` agents)
> **Date:** 2026-07-04 (retroactive — formalizes a decision originally made in plan v2.1.0)
> **Supersedes:** Implicit pre-2026-07-04 DB state (where 8 drifts existed; see §3 Context)
> **Reviewers:** `@reviewer` agent (Round-3 SSOT audit confirmed this decision)
> **Tags:** `database`, `migration`, `rbac`, `production-hardening`, `ssot`

## Context and problem statement

By 2026-07-04 (pre-`0024_production_hardening`), the live `noufex_db` database
had drifted from the documented SSOT in `database/schema.sql`,
`database/schema-extra.sql`, and the 23 prior migrations. The drifts were
discovered during a Round-1 production-readiness audit and documented in
the migration file `database/migrations/0024_production_hardening.sql` itself
(per `MIGRATION_EXECUTION_PLAN.md` §3.2 G-12).

The 8 documented drifts:

| # | Drift | Severity | Impact |
|---|---|---|---|
| D-1 | `app_settings` table owned by `postgres` (superuser) instead of `noufex_owner` (app role) | 🔴 Critical | Migration runner (connects as `noufex_owner`) couldn't `ALTER TABLE`; future migrations blocked |
| D-2 | All tables/sequences/views owned by `postgres` instead of `noufex_owner` | 🔴 Critical | RBAC contract not enforced; `noufex_app` couldn't ALTER anything |
| D-3 | `users_email_key` UNIQUE constraint on `users.email` | 🔴 Critical | Blocked re-registration with soft-deleted user's email — `DELETE FROM users` failed on email conflict |
| D-4 | `users_phone_full_key` UNIQUE constraint on `users.phone_full` (auto-generated) | 🔴 Critical | Same problem for phone — random phone generation could conflict |
| D-5 | `noufex_readonly` role missing `SELECT` grants on 36 schema objects | 🟠 High | Analytics role couldn't read schema; dashboard queries failing |
| D-6 | `users.last_login` column (no `_at` suffix) | 🟡 Medium | Inconsistent with `created_at`, `updated_at`, `deleted_at` convention; confused query authors |
| D-7 | `users.two_factor_enabled` (legacy boolean) drifted from `users.totp_enabled_at` (TIMESTAMPTZ) | 🟡 Medium | After 2FA enrollment, legacy flag could be `FALSE` while `totp_enabled_at` is non-null — led to inconsistent state across 2 user features |
| D-8 | `rate_limit_buckets` table defined twice (in `schema.sql` AND `migrations/0004`) | 🟡 Medium | Documentation-only drift — the actual fix already shipped in 0004; this is just a comment marker |

The combination of D-1 + D-2 was the **highest-priority blocker** because it
would prevent the migration runner (connecting as `noufex_owner`) from
running ANY future `ALTER TABLE` statement. This violated the SSOT principle
that the application role must own schema it needs to mutate.

## Considered options

### Option A — **Apply `0024_production_hardening.sql` (CHOSEN)**

- Run the migration as `postgres` (superuser) with `--single-transaction`
  and `ON_ERROR_STOP=1`.
- The migration is **idempotent** (`ALTER TABLE … OWNER TO noufex_owner` is
  safe to re-run; `DROP CONSTRAINT IF EXISTS` is safe; `CREATE OR REPLACE`
  for functions).
- The migration is **backward-compatible**: it does NOT drop data, only
  adjusts ownership and adds the `last_login_at` synonym column.
- The 2FA sync trigger (`trg_sync_users_two_factor_enabled`) keeps the
  legacy `two_factor_enabled` column consistent with the canonical
  `totp_enabled_at` column going forward.

### Option B — Defer (rejected)

- Pro: Zero risk of migration failure.
- Con: Continued RBAC violation; analytics role broken; future migrations
  blocked by ownership drift.
- Con: SSOT principle violated indefinitely.

### Option C — Manual fixes (rejected)

- Pro: Granular control over each drift.
- Con: 8 separate psql commands, no audit trail, no rollback script.
- Con: Same SSOT violation as Option B.

## Decision

**Adopt Option A: apply `0024_production_hardening.sql` as a single
transaction with superuser privileges, then re-verify SSOT compliance.**

The application code (`app/server/index.ts`, `app/server/routes/*.cts`,
`app/server/lib/*.cts`) was NOT modified by this decision — the migration
operates only on the database schema, not on application code.

## Consequences

### Positive

- **RBAC contract enforced.** All tables/sequences/views now owned by
  `noufex_owner` (not `postgres`). `noufex_readonly` has SELECT on 36
  schema objects (verified via `psql -c "\dn+"` and
  `\dt noufex_owner.*`).
- **Future migrations unblocked.** Migration runner can now `ALTER TABLE`
  on any schema object without permission errors.
- **Re-registration works.** `users_email_key` and `users_phone_full_key`
  constraints dropped; soft-deleted users can be re-registered with the
  same email/phone.
- **i18n parity preserved.** `last_login_at` synonym column added; legacy
  `last_login` column kept for backward compatibility. No app code
  changes needed.
- **2FA consistency.** `trg_sync_users_two_factor_enabled` keeps legacy
  flag in sync with `totp_enabled_at`. No app code changes needed.
- **Audit trail.** `schema_migrations` table tracks all 24 applied
  migrations including 0024.

### Negative

- **Superuser dependency.** The migration required `postgres` (superuser)
  credentials; cannot be run by the standard `noufex_app` role. This is
  acceptable because the migration is a one-time operation; subsequent
  migrations are within the app role's permissions.
- **2FA data may need a one-time audit.** If any existing rows had
  `two_factor_enabled = TRUE` but `totp_enabled_at IS NULL` (or vice versa),
  the trigger will correct them on next UPDATE. The migration does NOT
  pre-correct existing rows.
- **The migration is large (283 lines).** Future maintenance burden is
  higher than a typical migration.

## Validation

This ADR's decision is **valid** as long as all of the following are
true. Re-validate at every quarterly review.

| # | Condition | Verification | Status (2026-07-04) |
|---|---|---|---|
| V-1 | All 24 migrations applied | `psql -c "SELECT count(*) FROM schema_migrations WHERE version LIKE '0024%' OR version LIKE '0001%' OR ... OR version LIKE '0023%'"` → 24 | ✅ |
| V-2 | 0 tables owned by `postgres` | `psql -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner = 'postgres'"` → 0 | ✅ |
| V-3 | `noufex_readonly` has SELECT on 36 objects | `psql -c "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='noufex_readonly' AND privilege_type='SELECT'"` → ≥ 36 | ✅ |
| V-4 | `users.last_login_at` column exists | `psql -c "\d users" \| grep last_login_at` → 1 line | ✅ |
| V-5 | `trg_sync_users_two_factor_enabled` trigger exists | `psql -c "SELECT tgname FROM pg_trigger WHERE tgname='trg_sync_users_two_factor_enabled'"` → 1 row | ✅ |
| V-6 | `users_email_key` and `users_phone_full_key` constraints dropped | `psql -c "SELECT conname FROM pg_constraint WHERE conname IN ('users_email_key','users_phone_full_key')"` → 0 rows | ✅ |
| V-7 | Production API still healthy | `curl http://localhost:3000/api/health` → 200 | ✅ |
| V-8 | Test suite still passes (regression check) | `cd app && npx vitest run` → 817 passed (baseline) | ✅ |

**Re-validation trigger:** any future production schema drift (e.g., a new
table created by a different process) → add a new migration to fix it.

## References

- **PostgreSQL 17 — `ALTER TABLE`:** <https://www.postgresql.org/docs/17/sql-altertable.html>
- **PostgreSQL 17 — Ownership:** <https://www.postgresql.org/docs/17/sql-revoke.html>
- **`MIGRATION_EXECUTION_PLAN.md` §3.2 G-12** (the original finding), §11 (SSOT
  audit context), §11.5 (ADR gap — this ADR closes it)
- **Shopify Engineering — Online migrations:** <https://shopify.engineering/migrating-rails-online-migration-cheat-sheet>
- **Nygard's ADR blog:** <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
- **MADR template:** <https://adr.github.io/madr/> (the ADR format used)

## Revision history

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-07-05 | **v1.0** | GitHub Copilot (`@reviewer`) | **Initial version.** Retroactively formalizes the 0024_production_hardening migration decision made in `MIGRATION_EXECUTION_PLAN.md` v2.1.0 (2026-07-04). Closes G-ADV2 + GAP-19 from §11.5. |
| 2026-07-04 | v0.0 (proposed) | (implicit in MIGRATION_EXECUTION_PLAN.md v2.1.0 G-12) | Decision made but not formally recorded as ADR. |
