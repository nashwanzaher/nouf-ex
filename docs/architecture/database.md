# Database — Nouf-ex

Nouf-ex uses **one external PostgreSQL 17 server** as the single source
of truth. The API container connects to it; nothing is created, migrated,
or seeded inside the container. SQLite is not used anywhere.

---

## 1. Connection

| Item              | Value (production)                                            |
| ----------------- | ------------------------------------------------------------- |
| Engine            | PostgreSQL **17** (external — already running on the host)    |
| Database          | `noufex_db`                                                   |
| **Runtime user**  | **`noufex_app`** (least-privilege role — no superuser)        |
| Runtime password  | set in `.env` (`CHANGE_ME_APP` placeholder in `.env.example`) |
| Port              | `5432`                                                        |
| Connection string | `postgresql://noufex_app:<pw>@localhost:5432/noufex_db`       |

The **`postgres`** superuser is used **only** for the one-time
`npm run db:setup` to create the `noufex_app` role, schema, and seed.
After that, the app connects as `noufex_app` with only the GRANTs it
needs (see `database/roles.sql`).

From inside the Docker container, `localhost` is the container itself, so
`docker-compose.yml` overrides `DB_HOST=host.docker.internal` and adds an
`extra_hosts` mapping for Linux.

---

## 2. Where things live

| Concern                  | Location                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| `.env` template          | [`.env.example`](../.env.example)                                 |
| Live `.env` (gitignored) | `.env`                                                            |
| Base schema              | [`database/schema.sql`](../database/schema.sql)                   |
| Extra tables             | [`database/schema-extra.sql`](../database/schema-extra.sql)       |
| Read-only views          | [`database/views.sql`](../database/views.sql)                     |
| PL/pgSQL functions       | [`database/functions.sql`](../database/functions.sql)             |
| Trigger definitions      | [`database/triggers.sql`](../database/triggers.sql)               |
| Roles + GRANTs           | [`database/roles.sql`](../database/roles.sql)                     |
| Demo seed data           | [`database/seed.sql`](../database/seed.sql)                       |
| Incremental migrations   | [`database/migrations/`](../database/migrations/)                 |
| One-time setup CLI       | [`scripts/db-setup.cjs`](../scripts/db-setup.cjs)                 |
| PgDb wrapper             | [`app/server/db/pg-wrapper.cts`](../app/server/db/pg-wrapper.cts) |
| API server               | [`app/server/index.ts`](../app/server/index.ts)                   |
| Schema README            | [`database/README.md`](../database/README.md)                     |

---

## 3. Environment variables

`app/server/index.ts` reads connection info in this order:

1. `DATABASE_URL` (single connection string)
2. `DB_HOST` + `DB_PORT` + `DB_NAME` + `DB_USER` + `DB_PASSWORD`

If **neither** is set, the server **throws** at startup:

```
DATABASE_URL is not set. Copy .env.example to .env and fill in
DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (or set DATABASE_URL directly).
```

The runtime `.env`:

```env

# .env (committed version lives in .env.example)

DB_HOST=localhost
DB_PORT=5432
DB_NAME=noufex_db
DB_USER=noufex_app
DB_PASSWORD=CHANGE_ME_APP
DATABASE_URL=postgresql://noufex_app:CHANGE_ME_APP@localhost:5432/noufex_db
DB_SSL=false                          # set "true" in production when Postgres requires TLS
```

When running inside Docker, `docker-compose.yml` overrides these to point at
`host.docker.internal`:

```yaml
DB_USER: noufex_app
DB_PASSWORD: "CHANGE_ME_APP"
DATABASE_URL: postgresql://noufex_app:CHANGE_ME_APP@host.docker.internal:5432/noufex_db
DB_SSL: "false"
```

---

## 4. Schema overview (30 tables: 27 application + 3 system)

> **Updated 2026-06-29** — verified via `grep -c 'CREATE TABLE' database/*` →
> 17 in [`schema.sql`](../../database/schema.sql) + 10 in
> [`schema-extra.sql`](../../database/schema-extra.sql) + 4 in
> [`migrations/`](../../database/migrations) = **30 unique** (one table
> is re-declared across two files; deduped). One of these (`orders` /
> `payments`) also has an `audit_*` shadow for compliance.

| Layer             | Tables / files                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **Identity**      | `users`                                                                                                    |
| **Catalog**       | `categories`, `stores`, `products`, `product_variants`, `product_images`, `subscriptions`                  |
| **Commerce**      | `orders`, `order_items`, `cart_items`, `wishlist`, `payments`, `coupons`, `coupon_usage`, `refunds`        |
| **Engagement**    | `reviews`, `addresses`, `notifications`, `messages`, `disputes`                                            |
| **Operations**    | `shipping_methods`, `inventory_log`, `transactions`, `store_balance`, `store_followers`, `admin_audit_log` |
| **Rate limiting** | `rate_limit_buckets` (DB-backed sliding-window counters for the API; see `migrations/0004`)                |
| **Analytics**     | `search_logs` (append-only; every `/api/search` hit; see `migrations/0009`)                                |
| **Meta**          | `schema_migrations` (tracks applied migrations)                                                            |

The 27 application tables (counted by the totals: 6 Identity/Catalog

- 6 Commerce + 8 Engagement/Operations + 3 Analytics/Identity + 4
  Rate limiting/Meta) are the user-facing domain. The 3 system tables
  (`rate_limit_buckets`, `search_logs`, `schema_migrations`) are
  infrastructure that the API manages on the user's behalf — they are
  not part of the public data model and should not appear in any
  storefront query. `schema_migrations` is created by the bootstrap
  migration `0001_baseline.sql`; the other two are added by
  `migrations/0004` and `migrations/0009` respectively.

PG 17 conventions applied across the schema:

- `GENERATED ALWAYS AS IDENTITY` (replaces `SERIAL`)
- `TIMESTAMPTZ` everywhere
- `citext` for case-insensitive email
- 25+ CHECK constraints (price > 0, stock >= 0, rating 0-5, …)
- 30+ FKs with explicit `ON DELETE` (`RESTRICT` for orders, `CASCADE` for personal data)
- 60+ indexes (B-tree, partial, GIN for FTS, BRIN for time-series)
- Soft delete: `deleted_at TIMESTAMPTZ` on user-facing tables

---

## 5. Views, functions, triggers

| File                     | Purpose                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `database/views.sql`     | `v_product_with_store`, `v_store_stats`, `v_order_summary`, `v_low_stock` (all `security_invoker`) |
| `database/functions.sql` | 7 PL/pgSQL trigger functions (set_updated_at, orders state machine, stock decrement, …)            |
| `database/triggers.sql`  | 9 trigger definitions wiring functions to tables                                                   |

The triggers keep `orders.timeline`, `products.review_count/rating`,
`products.stock` + `inventory_log`, and `stores.products_count` in sync
**at the database layer** — the API code only INSERTs rows; the trigger
handles the math atomically inside the row's lock.

---

## 6. Roles and GRANTs

| Role              | Purpose                             | Grants                                                                                                              |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `postgres`        | one-time setup (DDL, role creation) | ALL                                                                                                                 |
| `noufex_owner`    | owns schema objects                 | ALL on schema                                                                                                       |
| **`noufex_app`**  | **runtime app connection**          | SELECT/INSERT/UPDATE/DELETE on user-data tables; **NO** write to `admin_audit_log`, `inventory_log`, `transactions` |
| `noufex_readonly` | analytics / BI                      | SELECT only                                                                                                         |

See [`database/roles.sql`](../database/roles.sql) for the full GRANT spec.

---

## 7. Migrations infrastructure

Each schema change lives as a numbered file:

```
database/migrations/
├── README.md                      ← workflow
└── 0001_baseline.sql              ← tracks initial schema + seed
```

To add a change:

1. Create `database/migrations/NNNN_description.sql` (next number, e.g. `0002_add_loyalty_table.sql`).
2. Use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` so the migration is safe to re-run.
3. Wrap in `BEGIN; … COMMIT;`.
4. The next `npm run db:setup` applies it and records the version in `schema_migrations`.

For destructive changes (DROP COLUMN, RENAME) include an `EXISTS` check
in a `DO $$ … $$` block before applying.

---

## 8. First-time setup

```sh

# 1. Connect as the postgres superuser (one-time on the host)

psql -h localhost -U postgres -c "CREATE DATABASE noufex_db;"

# 2. Run db-setup (as postgres — creates roles + schema + seed)

cd app
npm run db:setup

# 3. (Optional) Switch the runtime to the noufex_app role

psql -h localhost -U postgres -d noufex_db -c "ALTER ROLE noufex_app WITH PASSWORD 'your-real-password';"
```

`db-setup.cjs` runs the files in this order (all idempotent):

```
1. migrations/0001_baseline.sql   ── creates schema_migrations tracking table
2. schema.sql                     ── base tables + indexes + CHECK constraints
3. schema-extra.sql               ── payments, coupons, refunds, balances, audit
4. views.sql                      ── read convenience views (security_invoker)
5. functions.sql                  ── PL/pgSQL trigger functions
6. triggers.sql                   ── wires functions to tables
7. roles.sql                      ── noufex_app + GRANTs
8. seed.sql                       ── demo data (idempotent via ON CONFLICT)
9. any pending migrations/NNNN_*.sql
```

After `db-setup` succeeds, the **app** connects as `noufex_app` (not
`postgres`).

---

## 9. Demo credentials (seed only)

| Email                            | Password      | Role     |
| -------------------------------- | ------------- | -------- |
| `admin@noufex.com`               | `admin123`    | admin    |
| `ahmed@gmail.com`                | `customer123` | customer |
| `sara@gmail.com`                 | `customer123` | customer |
| `omar@gmail.com`                 | `customer123` | customer |
| `fatima@spice-yemen.com`         | `merchant123` | merchant |
| `hassan@dates-yemen.com`         | `merchant123` | merchant |
| `mohammed@handicrafts-yemen.com` | `merchant123` | merchant |
| `khalid@electronics-yemen.com`   | `merchant123` | merchant |
| `noor@perfume-yemen.com`         | `merchant123` | merchant |
| `layla@mokha-coffee.com`         | `merchant123` | merchant |

Passwords are stored as `scrypt$<salt_b64>$<hash_b64>` (regenerate via
`scripts/gen-seed-hashes.cjs`).

---

## 10. PgDb wrapper

`app/server/db/pg-wrapper.cts` is a thin async wrapper around `pg.Pool` that mimics
the parts of the old `better-sqlite3` API the API code was written against.
Callers should treat `?` placeholders as `$1, $2, ...` rewriting transparently
handled by the wrapper, and remember all methods are `async`:

```ts
const rows = await db.prepare("SELECT * FROM products WHERE id = ?").all(id);
const one = await db.prepare("SELECT * FROM users WHERE id = ?").get(id);
await db.tx(async (txDb) => {
  /_ BEGIN / COMMIT _/
});
```

SQL fragments the wrapper normalises on the way in:

| SQLite idiom      | Postgres replacement |
| ----------------- | -------------------- |
| `datetime('now')` | `CURRENT_TIMESTAMP`  |
| `is_<col> = 1`    | `is_<col> = TRUE`    |
| `is_<col> = 0`    | `is_<col> = FALSE`   |

JSONB columns return parsed JS values; `BOOLEAN` columns return real
booleans (no `0/1` round-trip needed).
