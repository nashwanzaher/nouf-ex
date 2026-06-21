# `database/` — SQL files

This directory holds the canonical PostgreSQL schema and seed data for
Nouf-ex. It is the **only** place DDL lives; there is no migration framework.

| File                       | Purpose                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `schema.sql`               | Base tables + core indexes (14 tables).                     |
| `schema-extra.sql`         | Extra tables (payments, coupons, refunds, …) + extra indexes. |
| `seed.sql`                 | Idempotent seed data for the demo dataset.                  |

## Applying

From the project root (one-time, on the host):

```sh
cd app
npm run db:setup
```

The script (`scripts/db-setup.cjs`) reads `.env`, connects via `pg`, and
applies the three files in order. All DDL uses `IF NOT EXISTS`, so
re-running the script is a no-op.

## Editing

When changing the schema, edit the file that already contains the table(s)
you're modifying. Keep DDL idempotent and add new tables to `schema-extra.sql`
if they don't belong to the core catalog.

After editing:

1. Update [`../app/server/tests/schema.test.ts`](../app/server/tests/schema.test.ts)
   if you added/removed tables.
2. Update [`../docs/database.md`](../docs/database.md) — schema overview section.
3. Re-run `npm run db:setup` locally to verify.
