# Contributing

Thanks for helping build Nouf-ex. This file is a short, opinionated
overview. The longer source of truth is
[`docs/development/conventions.md`](docs/development/conventions.md) and
the master plan is [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).
All contributors are expected to follow our
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Repository layout (TL;DR)

| Path                            | What's there                                         |
| ------------------------------- | ---------------------------------------------------- |
| `app/src/`                      | Frontend (React 19 + Vite 7)                         |
| `app/server/`                   | Backend (Express 5 + `pg`)                           |
| `app/mocks/`                    | Frontend tests + MSW mocks                           |
| `app/server/tests/`             | Backend tests (api-server + schema)                  |
| `database/`                     | SQL schema + seed (applied by `npm run db:setup`)    |
| `scripts/`                      | Project-level helpers (db-setup.cjs, test-summary)   |
| `docs/`                         | All documentation                                    |
| `docker/`                       | Container entrypoint                                 |

## Workflow

1. Pick an item off [`docs/planning/roadmap.md`](docs/planning/roadmap.md)
   (or open an issue if there's nothing that fits).
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

See [`docs/development/conventions.md`](docs/development/conventions.md).
The short version:

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
8. Update [`docs/architecture/database.md`](docs/architecture/database.md)
   and the test in `app/server/tests/schema.test.ts` if you
   added/removed tables.
9. Mention the schema change in the PR description.

## Adding an API endpoint

1. Add the handler to `app/server/index.ts` (or to a new file under
   `app/server/routes/<name>.cts` and register it in `app/server/index.ts`).
2. Validate input with `zod` (use `.strict()` so unknown fields are
   rejected).
3. Add a typed wrapper to `app/src/lib/api.ts` (frontend client) and a
   matching hook in `app/src/hooks/useApi.ts`.
4. Document it in [`docs/architecture/api.md`](docs/architecture/api.md).
5. Add a smoke test in `app/server/tests/api-server.test.ts` and a Vitest
   integration test co-located under `app/src/lib/__tests__/` if relevant.
6. If the endpoint is `/api/admin/*`, add it to the cross-reference in
   `app/src/pages/admin/UsersManagement.tsx` (or whichever admin page is
   affected) — see the ADMIN_GAP_REMEDIATION section in
   [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) §11.

## Adding a UI page

1. Add the route in `app/src/App.tsx` (and gate it with `ProtectedRoute`
   if it needs auth).
2. Co-locate the page under `app/src/pages/<area>/`. Split large pages
   into sections (see how `app/src/pages/Home/` is organised).
3. Add an i18n key under `src/i18n/locales/ar.json` first, then `en.json` and
   `zh.json`. Every `t('foo.bar')` call **must** include a literal English
   fallback so missing translations still render — see
   [`docs/development/conventions.md`](docs/development/conventions.md) §i18n.
4. Snapshot / component tests live in `app/src/<area>/__tests__/` (see
   [`docs/testing/conventions.md`](docs/testing/conventions.md)).
5. If you introduce a new cross-page piece of state, prefer the existing
   contexts (`AppContext`, `CartContext`) — see
   [`app/src/README.md`](app/src/README.md) for the data-flow rules.

## Reviewing a PR

Checklist:

- [ ] Linked to a MASTER_PLAN ID (e.g. `K.1`) or a GitHub issue.
- [ ] Tests cover the new behaviour (Vitest plus a PHASE script where
      relevant — see [`docs/testing/README.md`](docs/testing/README.md)).
- [ ] Docs updated where the contract changed (`docs/architecture/api.md`,
      `app/server/README.md`, `app/src/README.md` as appropriate).
- [ ] No secrets committed (`git diff --staged | grep -iE "password|secret|token" | grep -vE "CHANGE_ME|REDIRECTED|<32" || true`).
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all
      pass from `app/`.
- [ ] No new `// eslint-disable` or `// @ts-ignore`.
- [ ] CHANGELOG.md updated (one bullet per PR, under `[Unreleased]`).
- [ ] Conventional Commits format (`feat:`, `fix:`, `chore:`, `docs:`,
      `test:`, `refactor:`).

## Reporting vulnerabilities

If you discover a security issue (XSS, SQLi, auth bypass, secret leak, …)
follow [`SECURITY.md`](SECURITY.md) — **do not** file a public issue.

## Communication

- **Bugs & feature requests** → GitHub Issues with the appropriate
  template (`.github/ISSUE_TEMPLATE/`).
- **Security** → private, via [`SECURITY.md`](SECURITY.md).
- **Code of Conduct** violations → private, via the channels in
  [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Be specific in titles; lead with the **why** in the body. Cite the
MASTER_PLAN ID (e.g. `K.1`, `F.4`) when relevant so reviewers can grep
for context.
