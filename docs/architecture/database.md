# Nouf-ex — Database Schema Reference

> **Audience:** backend developers, DBAs, MCP clients (db tools).
> **Last updated:** 2026-07-12
> **Source of truth:** [`packages/db/schema.sql`](../../packages/db/schema.sql) + 30 migrations in [`packages/db/migrations/`](../../packages/db/migrations/)

---

## Quick facts

- **PostgreSQL 17**
- **32 tables** (16 in `schema.sql` + 10 in `schema-extra.sql` + 6 in migrations)
- **32 triggers** (17 dynamic `trg_<table>_set_updated_at` + 15 explicit)
- **~14 PL/pgSQL functions** (8 in `functions.sql` + ~6 in migrations)
- **4 views** with `security_invoker=true`
- **4 roles**: `postgres`, `noufex_owner`, `noufex_app`, `noufex_readonly`
- **30 migrations** numbered `0001_baseline.sql` … `0030_updated_at_triggers.sql`

---

## Entity-relationship overview

```
┌────────────────┐       ┌────────────────┐       ┌──────────────────┐
│     users      │───┬──│   addresses    │       │ store_followers   │
│  (customer,    │   │  │  (shipping)    │       │  (M:N users ↔    │
│   merchant,    │   │  └────────────────┘       │   stores)         │
│   admin)       │   │                            └──────────────────┘
└────────────────┘   │
        │           │   ┌────────────────┐       ┌──────────────────┐
        │           │   │    stores      │───────│   subscriptions  │
        │           ├──│  (merchant)    │       │  (merchant plans)│
        │           │   └────────────────┘       └──────────────────┘
        │           │           │
        │           │           │       ┌────────────────┐
        │           │           ├───────│   categories    │
        │           │           │       │  (self-ref tree)│
        │           │           │       └────────────────┘
        │           │           │                │
        │           │           │                ↓
        │           │           │       ┌────────────────┐
        │           │           └───────│    products     │
        │           │                   │ (store, cat)    │
        │           │                   └────────────────┘
        │           │                          │
        │           │              ┌───────────┼───────────┐
        │           │              ↓           ↓           ↓
        │           │   ┌─────────────┐  ┌────────────┐  ┌──────────────┐
        │           │   │product_     │  │product_    │  │product_images│
        │           │   │variants      │  │images      │  │              │
        │           │   └─────────────┘  └────────────┘  └──────────────┘
        │           │
        │           │   ┌────────────────┐       ┌──────────────────┐
        │           │   │   cart_items   │       │    wishlist       │
        │           │   │ (user × prod)  │       │   (user × prod)  │
        │           │   └────────────────┘       └──────────────────┘
        │           │
        │           │   ┌────────────────┐       ┌──────────────────┐
        │           │   │    orders      │───────│   order_items     │
        │           └───│  (customer,    │       │ (snapshot prod)   │
        │               │   store, status)│       └──────────────────┘
        │               └────────────────┘
        │                       │
        │                       ↓
        │               ┌────────────────┐       ┌──────────────────┐
        │               │   payments     │       │     refunds       │
        │               │  (status,      │       │  (status,         │
        │               │   provider)    │       │   resolved_by)    │
        │               └────────────────┘       └──────────────────┘
        │                       ↓
        │               ┌────────────────┐
        │               │  transactions  │  (store wallet ledger)
        │               └────────────────┘
        │
        │               ┌────────────────┐       ┌──────────────────┐
        ├───────────────│   reviews      │       │    disputes       │
        │               │ (product,      │       │  (order, status)  │
        │               │  customer)     │       └──────────────────┘
        │               └────────────────┘
        │
        │               ┌────────────────┐       ┌──────────────────┐
        ├───────────────│  notifications │       │     messages      │
        │               │ (user, type)   │       │ (sender, receiver)│
        │               └────────────────┘       └──────────────────┘
        │
        │               ┌────────────────┐       ┌──────────────────┐
        │               │ admin_audit_log│       │  inventory_log    │
        │               └────────────────┘       └──────────────────┘
```

---

## Tables (32)

### Auth & users (5)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Customer/merchant/admin accounts | `email CITEXT UNIQUE`, `password_hash`, `role`, `status`, `token_version`, `two_factor_enabled`, `totp_secret`, `totp_backup_codes TEXT[]`, `preferred_language`, `gender` |
| `subscriptions` | Merchant plans (free/starter/pro/enterprise) | UNIQUE active per store (partial index) |
| `rate_limit_buckets` | DB-backed rate limiter | `(bucket, key, count, reset_at)` |
| `used_jtis` | JWT replay protection (single-use) | `(jti, user_id, expires_at)` UNIQUE |
| `admin_audit_log` | Every admin mutation logged | `(user_id, action, entity_type, entity_id, old_values JSONB, new_values JSONB, ip_address INET, user_agent)` |

### Stores & products (8)

| Table | Purpose |
|---|---|
| `stores` | Merchant store (owner_id, slug, trust_level, response_rate, on_time_delivery, commission_rate, since_year, products_count, sales_count, followers_count) |
| `categories` | Self-referential tree (parent_id) with slug |
| `products` | Main catalog (name_ar/en/zh, price NUMERIC(12,2), stock, moq, weight, features TEXT[], specifications JSONB, badges TEXT[], rating, review_count, sold_count, view_count, deal_discount, search_tsv GENERATED STORED) |
| `product_variants` | Size/color/SKU per product (sku UNIQUE, attributes JSONB, price_delta) |
| `product_images` | Per-product images (is_primary, sort_order) |
| `inventory_log` | Append-only stock movements (change_amount, reason enum) |
| `store_balance` | 1:1 store wallet (available, pending, currency) |
| `store_followers` | M:N customers ↔ stores (notify_new_products, notify_offers) |

### Orders & payments (7)

| Table | Purpose |
|---|---|
| `orders` | Order header (order_number UNIQUE, status enum, payment_method enum, payment_status enum, subtotal/shipping_cost/discount/total NUMERIC, shipping_address JSONB, timeline JSONB) |
| `order_items` | Order lines with product_name snapshot (product_id FK, variant_id, unit_price, total_price) |
| `cart_items` | Server-side cart (user_id, product_id, variant_id, variant JSONB, quantity) UNIQUE(user,product,variant_id) |
| `payments` | Payment attempts (method enum, status enum, provider, provider_txn_id, provider_meta JSONB) |
| `transactions` | Store wallet ledger (type enum: order/withdrawal/refund/fee/adjustment, amount, balance_after) |
| `shipping_methods` | Global catalog (name_ar/en/zh, base_cost, per_kg_cost, estimated_days) |
| `refunds` | Customer-initiated refunds (status enum, admin_notes, resolved_by, resolved_at) |

### Interaction (6)

| Table | Purpose |
|---|---|
| `reviews` | Product reviews with verified-purchase guard (rating 1-5, title, comment, images TEXT[], is_verified, is_visible, helpful_count, merchant_reply, merchant_replied_at) |
| `wishlist` | M:N users ↔ products with optional notes UNIQUE(user,product) |
| `notifications` | In-app + transactional (type enum: order/message/review/promo/system/dispute/refund, data JSONB, is_read, read_at) |
| `messages` | Customer ↔ merchant chat (sender_id, receiver_id, store_id?, product_id?, order_id?, body, attachments JSONB) |
| `disputes` | Order disputes (type enum, status enum, priority enum, subject, description, evidence JSONB, refund_amount) |
| `addresses` | User shipping addresses (label, full_name, phone, governorate, city, district, street, building, lat/long, is_default) with partial UNIQUE INDEX for `is_default=TRUE` |

### Promotions & system (6)

| Table | Purpose |
|---|---|
| `coupons` | Coupons (code UNIQUE, type percentage/fixed, value, min_order_amount, max_discount, usage_limit, per_user_limit, store_id NULL=site-wide, starts_at, expires_at) |
| `coupon_usage` | Per-redemption audit (coupon_id, user_id, order_id, discount_amount) UNIQUE |
| `app_settings` | Key-value config (key VARCHAR(64) PK, value TEXT, updated_by, updated_at) with RLS — admin-only writes |
| `webhook_events` | Idempotency table for payment webhooks (provider, event_id, transaction_id, event_type, payload JSONB, processing_state) UNIQUE(provider,event_id,transaction_id,event_type) |
| `search_logs` | Analytics for `/api/search` (query, query_normalized, result_count, duration_ms, user_id, request_id) |
| `schema_migrations` | Migration tracking (version VARCHAR(20) PK, description, applied_at, checksum) |

---

## PL/pgSQL functions (8 + ~6)

| Function | Source | Purpose |
|---|---|---|
| `trg_set_updated_at()` | functions.sql | BEFORE UPDATE: set `NEW.updated_at = now()` |
| `trg_orders_state_machine()` | functions.sql | BEFORE UPDATE on `orders`: enforce legal state transitions |
| `trg_orders_append_timeline()` | functions.sql | BEFORE UPDATE on `orders`: append `{status, at, payment}` to `timeline` JSONB |
| `trg_order_items_decrement_stock()` | functions.sql (SECURITY DEFINER) | BEFORE INSERT on `order_items`: check + decrement stock, log to `inventory_log` |
| `trg_reviews_refresh_rating()` | functions.sql | AFTER INSERT/UPDATE/DELETE on `reviews`: refresh `products.rating` and `review_count` |
| `trg_products_refresh_store_count()` | functions.sql | AFTER INSERT/UPDATE/DELETE on `products`: refresh `stores.products_count` |
| `trg_refunds_resolve_payments()` | functions.sql (BEFORE INSERT OR UPDATE) | On `refunds.status='processed'`: flip `payments.status='refunded'`, check `orders.payment_status='paid'` |
| `trg_stores_refresh_*` (3 functions) | functions.sql | Refresh `stores.rating`, `review_count`, `followers_count`, `sales_count` |
| `coupon_discount_amount(type, value, max_discount, subtotal)` | 0005 | Compute discount for a coupon |
| `consume_rate_limit(bucket, key, window_ms, max)` | 0004 / 0018 | Token-bucket rate limiter |
| `cleanup_rate_limits()` | 0004 | Delete expired rate-limit rows |
| `cleanup_used_jtis()` | 0010 | Delete expired single-use JTIs |
| `cleanup_audit_logs(admin_interval, search_interval)` | 0016 | Retention purge (admin 2y, search 90d) |
| `admin_set_app_setting(key, value, user_id)` | 0023 (SECURITY DEFINER) | Write app_settings + audit |

---

## Views (4)

| View | Purpose | Security |
|---|---|---|
| `v_product_with_store` | product + store + category joined, filter `is_active=TRUE AND deleted_at IS NULL` | `security_invoker=true` |
| `v_store_stats` | store + denormalized counters + revenue + active_products | `security_invoker=true` |
| `v_order_summary` | order + customer + store + items_count + total_qty | `security_invoker=true` |
| `v_low_stock` | products with stock < 10 + store info (ops alert) | `security_invoker=true` |

---

## Roles & grants

| Role | Permissions |
|---|---|
| `postgres` | superuser — used only for `db:setup` |
| `noufex_owner` | DDL + grants (owns schema objects) |
| `noufex_app` | least-privilege RW on 26 tables + RO on 4 (`admin_audit_log`, `inventory_log`, `transactions`, `search_logs`) |
| `noufex_readonly` | SELECT only (for BI/reporting) |

`app_settings` uses **Row-Level Security** (migration 0023): `noufex_app` SELECT, `noufex_owner` UPDATE, writes go through `admin_set_app_setting()` SECURITY DEFINER function which also writes an audit entry.

`webhook_events` uses RLS (migration 0020): `noufex_app` SELECT/INSERT/UPDATE (only on `processing_state='received'`).

---

## Migrations (30)

Each migration is `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` → safe to re-apply. See [`packages/db/migrations/`](../../packages/db/migrations/) for the full list.

**Notable migrations:**
- `0009_search_backend.sql` — FTS with GIN index + `search_tsv` GENERATED column
- `0010_used_jtis.sql` — JWT replay protection
- `0016_audit_log_retention.sql` — `cleanup_audit_logs()` function
- `0017_token_version.sql` — per-user token revocation
- `0020_webhook_idempotency.sql` — payment webhook dedup
- `0022_coupon_atomicity.sql` — race-safe coupon redemption
- `0023_app_settings.sql` — runtime config + RLS
- `0030_updated_at_triggers.sql` — `updated_at` triggers for tables added after `triggers.sql`

---

## Seed data

- **10 users**: 1 admin, 3 customers, 6 merchants (admin@noufex.com / admin123, etc.)
- **18 categories**: 7 main + 11 sub (electronics, food, fashion, ...)
- **7 stores**: Yemen Spice House, Queen Perfumes, Jawf Dates, Yemen Handicrafts, Yemen Electronics, Mokha Coffee, Incense & Perfumes
- **24 products**: Sidr Honey, Mokha Coffee, Majdool Dates, Cambodian Oud, Smartphones, ...
- **8 orders**: in various states (delivered, shipped, processing, pending, confirmed, cancelled)
- **4 coupons**: WELCOME10, FREESHIP, YEMEN25, SPICE20

Run `npm run db:setup` (host as `postgres` superuser) — gated by `noufex.allow_seed='on'`.

---

## MCP tools for the DB

The MCP server (`apps/mcp-server/src/db-tools.ts`) exposes:
- `db_list_tables`, `db_describe_table`, `db_list_views`, `db_list_functions`, `db_list_triggers`
- `db_get_migrations`, `db_stats`, `db_sample_rows`, `db_query` (read-only)

See [`api.md`](api.md) and the MCP server source for details.

---

## See also

- [API reference](api.md)
- [Security model](security.md)
- [ER diagram (Mermaid)](er-diagram.md)
- [Schema SQL](../../packages/db/schema.sql)
