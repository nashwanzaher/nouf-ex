# `app/server/` — Express API

The Express 5 server that powers Nouf-ex. Runs against the external
PostgreSQL 17 server via `pg`. The compiled SPA is also served from this
process when `app/dist/` is present.

## Layout

```
app/server/
├── index.ts                  # Express entrypoint (run via `tsx`)
├── db/
│   └── pg-wrapper.cts        # async wrapper around pg.Pool
│                             # (mimics the better-sqlite3 API the
│                             #  route handlers were written against)
└── tests/
    ├── api-server.test.ts    # supertest against the Express app
    └── schema.test.ts        # structural checks on database/*.sql
```

## Running

```sh
# from app/
npm run api                   # tsx server/index.ts (default port 3000)
npm run api:prod              # same with NODE_ENV=production
npm run api:build             # esbuild → server/index.js (single binary)
```

## Database access

All SQL goes through `db.prepare(...).all/get/run/tx`. The wrapper:

- Rewrites `?` placeholders → `$1, $2, ...` for `pg`.
- Normalises SQLite idioms (`datetime('now')`, `is_<col> = 1/0`) → Postgres.
- Exposes `db.tx(fn)` for `BEGIN / COMMIT / ROLLBACK`.

Add new helpers or zod schemas under `app/server/` (e.g. `schemas/`,
`middleware/`) as the surface grows.

## Tests

```sh
npm test                                      # all
npx vitest run app/server/tests/api-server    # one file
```

The `pg` driver is mocked globally in [`../tests/setup.ts`](../tests/setup.ts)
so the suite runs offline.
