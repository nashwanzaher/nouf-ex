# `database/` — noufex_db schema and seed

This directory is the **single source of truth** for the `noufex_db`
PostgreSQL schema. It is **not** created inside the Docker image — it
lives on the host and is applied once via `npm run db:setup`.

## Files

| File                       | Purpose                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `schema.sql`               | Base tables + indexes + CHECK constraints (PG 17 IDENTITY, TIMESTAMPTZ) |
| `schema-extra.sql`         | Payments, coupons, refunds, balances, audit log                       |
| `views.sql`                | `v_product_with_store`, `v_store_stats`, `v_order_summary`, `v_low_stock` |
| `functions.sql`            | PL/pgSQL functions used by triggers                                    |
| `triggers.sql`             | Wires functions to tables (`updated_at`, stock decrement, etc.)       |
| `roles.sql`                | Creates `noufex_app` (least-privilege) + GRANTs; idempotent           |
| `seed.sql`                 | Demo data — 10 users (with **real scrypt hashes**), 24 products, etc. |
| `README.md`                | This file                                                              |
| `migrations/`              | Sequential incremental migrations (`NNNN_short_description.sql`)       |
| `migrations/0001_baseline.sql` | Marks the initial schema + seed as applied                      |

## Applying

From the project root, **as the `postgres` superuser** (one-time):

```sh
cd app
npm run db:setup
```

The script connects via `DATABASE_URL` (or the `DB_*` env vars in `.env`),
then applies the files in this order:

```
1. migrations/0001_baseline.sql   ── creates schema_migrations tracking table
2. schema.sql                    ── base tables, indexes, CHECK constraints
3. schema-extra.sql              ── payments, coupons, refunds, balances, audit
4. views.sql                     ── read convenience views (security_invoker)
5. functions.sql                 ── PL/pgSQL trigger functions
6. triggers.sql                  ── wires functions to tables
7. roles.sql                     ── noufex_app role + GRANTs
8. seed.sql                      ── demo data (idempotent via ON CONFLICT)
9. any pending migrations/NNNN_*.sql
```

Every step is **idempotent** (`IF NOT EXISTS` / `OR REPLACE` / `ON CONFLICT`).
Re-running is safe.

## Editing the schema

1. **For additive changes**, add a new file `database/migrations/NNNN_short_description.sql`
   and let `db-setup.cjs` apply it the next time it runs.
2. **For destructive changes** (DROP COLUMN, RENAME), wrap in `BEGIN; ... COMMIT;`
   and check `information_schema` first. Never edit an already-applied migration.
3. **Update `seed.sql`** only if you want the change to apply to fresh installs.
4. **Update `database/README.md` schema overview** if you added/removed tables.

## Demo credentials (seed only)

| Email                          | Password    | Role     |
| ------------------------------ | ----------- | -------- |
| `admin@noufex.com`             | `admin123`  | admin    |
| `ahmed@gmail.com`              | `customer123` | customer |
| `sara@gmail.com`               | `customer123` | customer |
| `omar@gmail.com`               | `customer123` | customer |
| `fatima@spice-yemen.com`       | `merchant123` | merchant |
| `hassan@dates-yemen.com`       | `merchant123` | merchant |
| `mohammed@handicrafts-yemen.com` | `merchant123` | merchant |
| `khalid@electronics-yemen.com` | `merchant123` | merchant |
| `noor@perfume-yemen.com`       | `merchant123` | merchant |
| `layla@mokha-coffee.com`       | `merchant123` | merchant |

> Passwords are stored as `scrypt$<salt_b64>$<hash_b64>` (see
> `scripts/db/gen-seed-hashes.cjs`). Regenerate hashes by editing that script
> and re-running it.

## Production roles

The app connects as **`noufex_app`**, NOT as `postgres`. The `postgres`
superuser is only needed for one-time migrations / db-setup.

| Role              | Purpose                          | Grants |
| ----------------- | -------------------------------- | ------ |
| `postgres`        | superuser — DDL, role creation   | ALL    |
| `noufex_owner`    | owns schema objects               | ALL on schema |
| `noufex_app`      | **runtime app connection**       | SELECT/INSERT/UPDATE/DELETE on user-data tables; **NO** write to audit log |
| `noufex_readonly` | analytics / BI                   | SELECT only |

See `database/roles.sql` for the full GRANT spec.
