# Database — Nouf-ex

Nouf-ex uses **one external PostgreSQL 17 server**. The API container
connects to it; nothing is created, migrated, or seeded inside the
container. SQLite is not used.

---

## 1. Connection

| Item                | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| Engine              | PostgreSQL **17** (external — already running on the host)      |
| Database            | `noufex_db`                                                    |
| Username            | `postgres`                                                     |
| Password            | `CHANGE_ME` (replace with your real password)                  |
| Port                | `5432`                                                         |
| Connection string   | `postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db`     |

From inside the Docker container, `localhost` is the container itself, so
`docker-compose.yml` overrides `DB_HOST=host.docker.internal` and adds an
`extra_hosts` mapping for Linux.

---

## 2. Where things live

| Concern                | Location                                              |
| ---------------------- | ----------------------------------------------------- |
| `.env` template        | [`.env.example`](../.env.example)                     |
| Live `.env` (gitignored) | `.env`                                              |
| Schema DDL (base)      | [`database/schema.sql`](../database/schema.sql)           |
| Schema DDL (extras)    | [`database/schema-extra.sql`](../database/schema-extra.sql) |
| Seed data              | [`database/seed.sql`](../database/seed.sql)               |
| One-time setup CLI     | [`scripts/db-setup.cjs`](../scripts/db-setup.cjs) |
| PgDb wrapper           | [`app/server/db/pg-wrapper.cjs`](../app/server/db/pg-wrapper.cjs)   |
| API server             | [`app/server/index.ts`](../app/server/index.ts)           |

---

## 3. Environment variables

`app/server/index.ts` reads connection info in this order:

1. `DATABASE_URL` (single connection string)
2. `DB_HOST` + `DB_PORT` + `DB_NAME` + `DB_USER` + `DB_PASSWORD`
3. Built-in fallback: `postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db`

```env
# .env (committed version lives in .env.example)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=noufex_db
DB_USER=postgres
DB_PASSWORD=CHANGE_ME
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db
```

When running inside Docker, `docker-compose.yml` overrides these to point at
`host.docker.internal`:

```yaml
DB_HOST: host.docker.internal
      DATABASE_URL: postgresql://postgres:CHANGE_ME@host.docker.internal:5432/noufex_db
```

---

## 4. Schema overview

| Layer          | Tables / files                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Identity**   | `users`                                                                                                    |
| **Catalog**    | `categories`, `stores`, `products`, `product_images`, `product_variants`, `subscriptions`                  |
| **Commerce**   | `orders`, `order_items`, `cart_items`, `wishlist`, `payments`, `coupons`, `coupon_usage`, `refunds`         |
| **Engagement** | `reviews`, `addresses`, `notifications`, `messages`, `disputes`                                            |
| **Operations** | `shipping_methods`, `inventory_log`, `transactions`, `store_balance`, `store_followers`, `admin_audit_log` |

All DDL uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`,
so re-running `db:setup` is safe. The schema is intentionally **not** a
migration framework: changes go into the SQL files and are re-applied
idempotently.

For per-table detail, see the two SQL files directly. They are heavily
commented and the only authoritative source.

---

## 5. First-time setup

```sh
# 1. Confirm the database exists (one-time, on the host)
psql -h localhost -U postgres -c "CREATE DATABASE noufex_db;"

# 2. Apply schema + seed (idempotent — safe to re-run)
cd app
npm run db:setup
```

`db-setup.cjs`:

- Loads `.env` from the repo root.
- Connects to `DATABASE_URL`.
- Runs the three SQL files in this order:
  1. `database/schema.sql`
  2. `database/schema-extra.sql`
  3. `database/seed.sql`

Output:

```
[db:setup] target: postgresql://postgres:***@localhost:5432/noufex_db
[db:setup] applying database/schema.sql (14283 bytes)…
[db:setup] applying database/schema-extra.sql (8510 bytes)…
[db:setup] applying database/seed.sql (84488 bytes)…
[db:setup] done.
```

---

## 6. Running the API

| Mode                        | Command                          | `DB_HOST`               |
| --------------------------- | -------------------------------- | ----------------------- |
| Direct (Node)               | `npm run api`                    | `localhost` (from `.env`) |
| Direct (Node, alt env)      | `DATABASE_URL=… npm run api`     | as in URL               |
| Docker (Win/Mac)            | `docker compose up -d --build`   | `host.docker.internal` (built-in) |
| Docker (Linux)              | `docker compose up -d --build`   | `host.docker.internal` (via `extra_hosts`) |

The API connects on startup and serves the SPA from `dist/` if present.

---

## 7. PgDb wrapper

`app/server/db/pg-wrapper.cjs` is a thin async wrapper around `pg.Pool` that mimics
the parts of the old `better-sqlite3` API the API code was written against.
Callers should treat `?` placeholders as `$1, $2, ...` rewriting transparently
handled by the wrapper, and remember all methods are `async`:

```ts
const rows = await db.prepare('SELECT * FROM products WHERE id = ?').all(id);
const one  = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
await db.tx(async (txDb) => { /* BEGIN / COMMIT */ });
```

SQL fragments the wrapper normalises on the way in:

| SQLite idiom           | Postgres replacement        |
| ---------------------- | --------------------------- |
| `datetime('now')`      | `CURRENT_TIMESTAMP`         |
| `is_<col> = 1`         | `is_<col> = TRUE`           |
| `is_<col> = 0`         | `is_<col> = FALSE`          |

JSONB columns return parsed JS values; `BOOLEAN` columns return real
booleans (no `0/1` round-trip needed).
