# `scripts/` — project-level helpers

Standalone Node scripts that operate on the project (not the app package).
None of them are bundled into the API container.

| Script              | What it does                                                |
| ------------------- | ----------------------------------------------------------- |
| `db-setup.cjs`      | Applies the 8-file pipeline (`migrations/0001_baseline.sql` + `schema.sql` + `schema-extra.sql` + `views.sql` + `functions.sql` + `triggers.sql` + `roles.sql` + `seed.sql`) plus any pending `migrations/NNNN_*.sql` to the external Postgres. Connects as the `postgres` superuser (one-time setup), then the runtime app uses the `noufex_app` role. |
| `gen-seed-hashes.cjs` | Generates real `scrypt$<salt>$<hash>` hashes for the seed users. Edit the `SEED_USERS` table in this script and run `node scripts/gen-seed-hashes.cjs` to print `UPDATE users SET password_hash = ...` statements to paste into `database/seed.sql`. |
| `test-summary.cjs`  | Run `vitest --reporter=verbose` and print a clean summary.  |
| `cross-check-helpers-doc.ps1` | Verifies that every public function exported by `tests/e2e/helpers/PS_TestHelpers.ps1` is also documented in `docs/testing/templates/PS_TESTHELPERS_REFERENCE.md`. Run after editing either file. |

## Running

From the repo root:

```sh
node scripts/db-setup.cjs        # or: cd app && npm run db:setup
```

From `app/`, the `npm run db:setup` script invokes `db-setup.cjs` via a
relative path (`../scripts/db-setup.cjs`).

## Conventions

- Pure Node.js (no transpilation needed). Keep these scripts as `.cjs` so
  they work with our CommonJS toolchain.
- Never reach into `app/`'s internals — these are project-level tools.
- Never commit `.env`; load it from `path.resolve(__dirname, '../.env')`.
