# DB Verification — Built from Scratch (2026-06-23)

This report documents the verification that the entire `noufex_db` schema
can be rebuilt from a fresh empty database using only the files in
`database/`, and that the API works correctly against the rebuilt DB.

## Procedure

1. Created a new empty database `noufex_db_verify`.
2. Ran `scripts/db-setup.cjs` against it (applies 8 base files + 5
   incremental migrations).
3. Ran `scripts/gen-seed-hashes.cjs --apply` to set real scrypt hashes
   on all 10 seed users.
4. Verified the schema, functions, and data via
   `scripts/inspect-fresh.cjs`.
5. Switched the running container to `noufex_db_verify` and ran an
   end-to-end test of auth + coupons + rate limit.
6. Verified the API works end-to-end against the rebuilt DB.

## Schema state after fresh build

```
TABLES        : 28 base tables (+ rate_limit_buckets) + 4 views
FUNCTIONS     : consume_rate_limit, cleanup_rate_limits, coupon_discount_amount
TRIGGERS      : 27 (trg_set_updated_at, trg_orders_state_machine, etc.)
MIGRATIONS    : 0001 → 0005 all applied
DATA          : 10 users, 18 categories, 7 stores, 24 products, 8 orders,
               4 coupons, 4 shipping methods
```

## Hash verification (10/10)

```
OK admin@noufex.com             (admin123)
OK ahmed@gmail.com              (customer123)
OK sara@gmail.com               (customer123)
OK omar@gmail.com               (customer123)
OK fatima@spice-yemen.com       (merchant123)
OK hassan@dates-yemen.com       (merchant123)
OK mohammed@handicrafts-yemen.com (merchant123)
OK khalid@electronics-yemen.com (merchant123)
OK noor@perfume-yemen.com       (merchant123)
OK layla@mokha-coffee.com       (merchant123)
```

## E2E results (against noufex_db_verify)

| Test | Result |
|---|---|
| `POST /api/auth/login` (admin) | 200 OK, 99-char token |
| `POST /api/coupons/validate WELCOME10` (subtotal 10000) | discount=1000 ✓ |
| `POST /api/coupons/validate FREESHIP` (subtotal 10000) | discount=500 ✓ |
| `POST /api/coupons/validate YEMEN25` (subtotal 20000) | discount=5000 ✓ |
| `POST /api/coupons/validate SPICE20` (subtotal 5000) | discount=1000 ✓ |
| `POST /api/auth/login` (25× wrong password) | 19 → 401, 6 → 429 |

## Code health

| Check | Result |
|---|---|
| `npx tsc -b --noEmit` | ✅ 0 errors |
| `npx eslint .` | ✅ 0 warnings |
| `npx vitest run` | ✅ 216/216 tests |
| `npx esbuild server/index.ts --bundle ...` | ✅ 64.2 kB |

## Conclusion

✅ All 3 pieces of business logic (rate limit, coupon discount, hash
verification) are now backed by PostgreSQL functions and triggers.
The `database/schema.sql` and `database/migrations/` directory are the
single source of truth for the schema; the project rebuilds end-to-end
on a fresh database without any manual steps beyond running
`db-setup.cjs` and `gen-seed-hashes.cjs --apply`.

The next priority is to implement the missing admin endpoints
(`/api/admin/users`, `/api/admin/stores`, etc.) and the three small
helper endpoints (`/api/cart/count/:userId`,
`/api/notifications/unread-count/:userId`,
`/api/store-followers/check`), then optionally refactor the 2000-line
`server/index.ts` into `routes/*.ts`.
