# `scripts/` — project-level helpers

> **Last reorganized:** 2026-07-05 (per MIGRATION_EXECUTION_PLAN.md v2.7.8 §38 R-7 execution)
> **Why this structure:** 25 active files grew organically from 0 → 25 across rounds. Without sub-foldering, future contributors cannot find the right script. Per ADR-0003 (SSOT) and §30.4 Sprint 2 (R-7) of the canonical plan, `scripts/` is now organized by **function** (DB lifecycle, DevOps, Quality, Maintenance).

Standalone Node + PowerShell scripts that operate on the project (not the app package).
None of them are bundled into the API container.

## Layout (4 canonical sub-folders)

| Sub-folder | Count | Purpose | When to use |
|---|---:|---|---|
| [`db/`](db/) | 5 | DB lifecycle (setup, seed, audit, switch, drop) | Anything that touches the PostgreSQL state |
| [`devops/`](devops/) | 6 | Local + container lifecycle (autostart, build, docker, install) | Build, run, deploy the stack |
| [`quality/`](quality/) | 8 | Quality gates (lint, format, test, typecheck, verify) | Mirrors `app/package.json` `scripts:` for Windows users |
| [`maintenance/`](maintenance/) | 6 | One-off helpers (scan-unused, e2e-step1, start-api/vite) | Ad-hoc utilities that don't fit elsewhere |

**Total:** 25 active files + this README.md = 26 entries in `scripts/`.

---

## `scripts/db/` — Database lifecycle (5 files)

| Script | What it does |
|---|---|
| `db-setup.cjs` | Applies the 8-file pipeline (`migrations/0001_baseline.sql` + `schema.sql` + `schema-extra.sql` + `views.sql` + `functions.sql` + `triggers.sql` + `roles.sql` + `seed.sql`) plus any pending `migrations/NNNN_*.sql` to the external Postgres. Connects as the `postgres` superuser (one-time setup), then the runtime app uses the `noufex_app` role. |
| `gen-seed-hashes.cjs` | Generates real `scrypt$<salt>$<hash>` hashes for the seed users. Edit the `SEED_USERS` table in this script and run `node scripts/db/gen-seed-hashes.cjs` to print `UPDATE users SET password_hash = ...` statements to paste into `database/seed.sql`. |
| `drop-test-db.cjs` | Drops the test DB (`noufex_test`). Use before re-running `db:setup` against the test profile. |
| `switch-db.ps1` | Switches the active DB by editing `.env` between dev/staging profiles. |
| `audit-db.cjs` | Audits the current DB state (table counts, FK integrity, orphaned rows). Read-only. |

## `scripts/devops/` — Local + container lifecycle (6 files)

| Script | What it does |
|---|---|
| `autostart.bat` | Auto-launches the dev stack on Windows logon. |
| `autostart.ps1` | PowerShell version of `autostart.bat`. |
| `install-autostart.ps1` | Installs `autostart.bat` into the Windows startup folder. |
| `build.ps1` | `cd app && npm run build` → writes `scripts/_build.out` + `_build_exit.txt`. |
| `docker-build.ps1` | `docker build -t noufex:latest .` using only the allowlisted build args (no `.env` secret leak). Writes `scripts/_docker_build.out`. |
| `docker-run.ps1` | Recreate `Nouf-ex` container with `--env-file .env`, wait 25s, dump status + last 30 log lines. |

## `scripts/quality/` — Quality gates (8 files)

These mirror `app/package.json` `scripts:` for Windows users.

| Script | What it does | npm equivalent |
|---|---|---|
| `lint.ps1` | `cd app && npm run lint` → writes `scripts/_lint.out` + `_lint_exit.txt`. | `npm run lint` |
| `format.ps1` | `cd app && npm run format` (Prettier write). | `npm run format` |
| `format-check.ps1` | `cd app && npm run format:check` (Prettier check, CI mode). | `npm run format:check` |
| `typecheck.ps1` | `cd app && npm run typecheck` → writes `scripts/_tc_exit.txt`. | `npm run typecheck` |
| `test.ps1` | `cd app && npm test` → writes `scripts/_test.out` + `_test_exit.txt`. | `npm test` |
| `test-stack.ps1` | End-to-end stack smoke (API + DB + container health). | (no equivalent) |
| `test-summary.cjs` | Run `vitest --reporter=verbose` and print a clean summary. | `npm run test:ui` (interactive) |
| `verify-fresh.cjs` | Verify the DB is in fresh-seed state after `db:setup`. | (no equivalent) |

## `scripts/maintenance/` — One-off helpers (6 files)

| Script | What it does |
|---|---|
| `scan-unused.cjs` | Find unused dependencies in `app/package.json`. |
| `scan-unused-v2.cjs` | Improved version of `scan-unused.cjs` with stricter heuristics. |
| `e2e-step1.ps1` | Manual end-to-end test runner (step 1: bootstrap test data). |
| `cross-check-helpers-doc.ps1` | Verifies that every public function exported by `tests/e2e/helpers/PS_TestHelpers.ps1` is also documented in `docs/testing/templates/PS_TESTHELPERS_REFERENCE.md`. Run after editing either file. |
| `start-api.bat` | Launches the API server in a separate window. Used by VSCode tasks. |
| `start-vite.bat` | Launches the Vite dev server in a separate window. Used by VSCode tasks. |

---

## Running

From the repo root:

```sh
node scripts/db/db-setup.cjs              # or: cd app && npm run db:setup
node scripts/db/gen-seed-hashes.cjs       # generate scrypt hashes for seed users
node scripts/quality/test-summary.cjs     # run vitest with clean summary
```

From `app/`, the `npm run db:setup` script invokes `scripts/db/db-setup.cjs` via a
relative path (`../scripts/db/db-setup.cjs`).

## VSCode Task Integration

Two VSCode tasks (`🚀 Start API Server (tsx dev)` and `🎨 Start Vite Dev Server (5173)`)
call the `.bat` files in `scripts/maintenance/` via `${workspaceFolder}/scripts/maintenance/start-api.bat`
and `${workspaceFolder}/scripts/maintenance/start-vite.bat` respectively. See `.vscode/tasks.json`.

## CI Integration

`.github/workflows/ci.yml` invokes the DB setup via:

```yaml
- name: Run db:setup
  run: node ../scripts/db/db-setup.cjs
```

(2 places: line 270 `db:setup`, line 315 `Apply schema + seed`.)

## Conventions

- Pure Node.js (no transpilation needed). Keep Node scripts as `.cjs` so
  they work with our CommonJS toolchain.
- PowerShell scripts must use `.ps1` extension and have `#Requires -Version 5.1`
  header for compatibility.
- Windows batch scripts (`.bat`) are reserved for `start-api.bat` / `start-vite.bat`
  / `autostart.bat` which need to launch in a separate window (PowerShell cannot).
- Never reach into `app/`'s internals — these are project-level tools.
- Never commit `.env`; load it from `path.resolve(__dirname, '../.env')`.

## Migration history

| Date | Change | Reference |
|---|---|---|
| 2026-07-05 | Reorganized 25 active files into 4 canonical sub-folders | [MIGRATION_EXECUTION_PLAN.md §38 R-7](../docs/planning/MIGRATION_EXECUTION_PLAN.md) |
| Earlier rounds | Round-2 cleanup; Round-4/Round-5 new helpers added | See CHANGELOG.md |