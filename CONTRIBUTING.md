# Contributing

Thanks for helping build Nouf-ex. This file is a short, opinionated
overview. The longer source of truth is [`docs/conventions.md`](docs/conventions.md).

## Repository layout (TL;DR)

| Path                            | What's there                                         |
| ------------------------------- | ---------------------------------------------------- |
| `app/src/`                      | Frontend (React 19 + Vite 7)                         |
| `app/server/`                   | Backend (Express 5 + `pg`)                           |
| `app/tests/`                    | Frontend tests + MSW mocks                           |
| `app/server/tests/`             | Backend tests (api-server + schema)                  |
| `database/`                     | SQL schema + seed (applied by `npm run db:setup`)    |
| `scripts/`                      | Project-level helpers (db-setup.cjs, test-summary)   |
| `docs/`                         | All documentation                                    |
| `docker/`                       | Container entrypoint                                 |

## Workflow

1. Pick an item off [`docs/roadmap.md`](docs/roadmap.md) (or open an issue
   if there's nothing that fits).
2. Branch from `main`:
   - `feat/<scope>` — new feature
   - `fix/<scope>` — bug fix
   - `chore/<scope>` — tooling, docs, housekeeping
   - `audit/<date>` — periodic cleanup pass
3. Make focused commits. One logical change per commit.
4. Open a PR. Reference the roadmap ID in the title when applicable
   (`P0-1: cart→order pipeline E2E`).
5. Squash-merge after review.

## Before pushing

From the `app/` directory:

```sh
npm run lint      # 0 errors, 0 warnings expected
npm test          # all green
npx tsc --noEmit -p tsconfig.app.json
```

## Code style

See [`docs/conventions.md`](docs/conventions.md). The short version:

- TypeScript strict, 2-space indent, LF.
- No `// eslint-disable` comments. Fix the warning.
- i18n keys (`ar` default) over inline ternaries.
- All DB writes go through `db.prepare(...).run/all/get` inside the
  PgDb wrapper; multi-step writes go in `db.tx(...)`.

## Adding schema changes

The schema is split across `database/{schema,schema-extra,views,functions,triggers,roles,seed}.sql`.
Additive changes go into `database/migrations/NNNN_*.sql`. See
[`database/migrations/README.md`](database/migrations/README.md) for the
full workflow.

1. **New column / table / index** → create
   `database/migrations/NNNN_short_description.sql` with idempotent DDL
   (`ADD COLUMN IF NOT EXISTS`, etc.). The next `npm run db:setup`
   applies it and records the version in `schema_migrations`.
2. **Editing an existing object** (table structure, view definition, …)
   → edit the file in `database/` that owns it, **and** add a new
   migration if the change is destructive (DROP/RENAME).
3. **New demo data** → edit `database/seed.sql` (use `ON CONFLICT DO NOTHING`).
4. **New trigger / function** → edit `database/functions.sql` and
   `database/triggers.sql` (both idempotent).
5. **Permissions** → edit `database/roles.sql`.
6. Keep DDL idempotent everywhere (`IF NOT EXISTS`, `OR REPLACE`).
7. Re-run `npm run db:setup` locally to verify.
8. Update [`docs/database.md`](docs/database.md) and the test in
   `app/server/tests/schema.test.ts` if you added/removed tables.
9. Mention the schema change in the PR description.

## Adding an API endpoint

1. Add the handler to `app/server/index.ts`.
2. Validate input with `zod`.
3. Add a typed wrapper to `app/src/lib/api.ts` (frontend client).
4. Document it in [`docs/api.md`](docs/api.md).
5. Add a smoke test in `app/server/tests/api-server.test.ts`.

## Adding a UI page

1. Add the route in `app/src/App.tsx` (and gate it with `ProtectedRoute`
   if it needs auth).
2. Co-locate the page under `app/src/pages/<area>/`. Split large pages
   into sections (see how `app/src/pages/Home/` is organised).
3. Add an i18n key under `src/i18n/locales/ar.json` first, then `en.json` and
   `zh.json`.
4. Snapshot tests live in `app/src/<area>/__tests__/` (see
   [`docs/testing.md`](docs/testing.md)).

## Reviewing a PR

Checklist:

- [ ] Linked to a roadmap item or an issue.
- [ ] Tests cover the new behaviour.
- [ ] Docs updated where the contract changed.
- [ ] No secrets committed.
- [ ] `npm run lint` and `npm test` pass.
- [ ] No new `// eslint-disable` or `// @ts-ignore`.

## Communication

Issues and PRs are the primary venue. Be specific in titles; lead with the
"why" in the body.
