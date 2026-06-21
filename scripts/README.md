# `scripts/` — project-level helpers

Standalone Node scripts that operate on the project (not the app package).
None of them are bundled into the API container.

| Script              | What it does                                                |
| ------------------- | ----------------------------------------------------------- |
| `db-setup.cjs`      | Apply `database/*.sql` files to the external Postgres.     |
| `test-summary.cjs`  | Run `vitest --reporter=verbose` and print a clean summary.  |

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
