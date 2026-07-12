# Nouf-ex — API Reference

> **Audience:** API consumers (frontend SPA + MCP clients + third-party integrators).
> **Last updated:** 2026-07-12
> **Source of truth:** [`apps/api/src/index.ts`](../../apps/api/src/index.ts) — the router mounts.

The API is a single **Express 5** server on port **3000**. Every endpoint under `/api/*` follows a strict envelope:

```json
{
  "success": true,
  "data": { /* endpoint-specific */ },
  "message": "optional human message",
  "request_id": "uuid-v4"
}
```

Errors:
```json
{
  "success": false,
  "error": "human-readable message",
  "code": "STABLE_MACHINE_CODE",
  "details": [ /* optional, e.g. Zod issues */ ],
  "request_id": "uuid-v4"
}
```

---

## Router map (18 routers under `/api/*`)

| Mount | Router | Auth | Cache | Endpoints |
|---|---|---|---|---|
| `/api/admin` | `adminRouter` + `adminExtrasRouter` | admin | — | 12 + 13 |
| `/api/auth` | `authRouter` | mixed | — | 8 |
| `/api/auth/2fa` | `auth2faRouter` | mixed | — | 4 |
| `/api/cart` | `cartRouter` | customer | — | 5 |
| `/api/coupons` | `couponsRouter` | customer | — | 2 |
| `/api/messages` | `messagesRouter` | any | — | 6 |
| `/api/notifications` | `notificationsRouter` | any | — | 3 |
| `/api/orders` | `ordersRouter` | any | — | 3 |
| `/api/payments` | `paymentsRouter` | mixed | — | 5 |
| `/api/refunds` | `refundsRouter` | customer + admin | — | 2 |
| `/api/reviews` | `reviewsRouter` | mixed | — | 2 |
| `/api/seller` | `sellerRouter` | merchant | — | 18 |
| `/api/shipping` | `shippingRouter` | — | 300s | 1 |
| `/api/stats` | `statsRouter` | — | 30s | 1 |
| `/api/store-followers` | `storeFollowersRouter` | any | — | 3 |
| `/api/wishlist` | `wishlistRouter` | any | — | 3 |
| `/api` (catalog) | `catalogRouter` | — | 60s | 10 |
| `/api` (health) | inline | — | — | 2 (`/api/health`, `/api/ready`) |

---

## Authentication

- **Cookie**: `noufex_token` (HttpOnly, SameSite=Strict, Secure in prod)
- **Format**: `base64url({sub,role,ver,exp}).base64url(hmac)`
- **TTL**: 7 days
- **Bumping `token_version`** at logout/change-password instantly invalidates all tokens

### CSRF protection

All mutating endpoints require:
1. `noufex_csrf` cookie (non-HttpOnly)
2. `noufex_csrf_h` cookie (HttpOnly, matches the first)
3. `x-csrf-token` header echoing the same value

Get a token: `GET /api/auth/csrf` → `{success: true, data: {token: "..."}}`

Exempt routes: `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/refresh`, `/api/auth/csrf`, `/api/health`, `/api/ready`.

---

## Rate limits

| Bucket | Default | Purpose |
|---|---|---|
| `auth` | 20/15min/IP | Login attempts |
| `webhook` | 120/min/IP | Payment provider webhooks |
| `health` | 30/s/IP (in-memory) | Health probe spam |

Headers on 429: `Retry-After: <seconds>`.

---

## Stable error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod schema failed |
| `UNAUTHORIZED` | 401 | No/invalid token |
| `FORBIDDEN` | 403 | Role/ownership check failed |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` / `DUPLICATE` | 409 | Unique violation / state machine |
| `PAYLOAD_TOO_LARGE` | 413 | >1 MB |
| `RATE_LIMITED` | 429 | Bucket exhausted |
| `CSRF_INVALID` | 403 | CSRF token missing or wrong |
| `INTERNAL_ERROR` | 500 | Unhandled error |
| `DATABASE_ERROR` | 500 | PG error |
| `SERVICE_UNAVAILABLE` | 503 | DB unreachable |

---

## Common endpoints (high-level)

### Auth

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, name, role?}` | 201 + `{user, token}` |
| POST | `/api/auth/login` | `{email, password}` | 200 + `{user, token}` OR `{requires_2fa, partial_token}` |
| POST | `/api/auth/logout` | — | 200 + bumps `token_version` |
| GET | `/api/auth/me` | — | 200 + `{user}` |
| PATCH | `/api/auth/me` | `{full_name?, phone?, ...}` | 200 + `{user}` |
| POST | `/api/auth/change-password` | `{current_password, new_password}` | 200 + bumps `token_version` |
| POST | `/api/auth/forgot-password` | `{email}` | 200 + `{ok}` (dev: includes `reset_token`) |
| POST | `/api/auth/reset-password` | `{token, new_password}` | 200 + bumps `token_version` |
| GET | `/api/auth/csrf` | — | 200 + `{token}` (cookie set) |

### 2FA

| Method | Path | Body |
|---|---|---|
| POST | `/api/auth/2fa/setup` | — (Bearer) → `{secret, otpauth_url, backup_codes}` |
| POST | `/api/auth/2fa/enable` | `{code}` (Bearer) → `{enabled}` |
| POST | `/api/auth/2fa/verify` | `{partial_token, code}` → `{token}` |
| POST | `/api/auth/2fa/disable` | `{password}` (Bearer) |

### Catalog (public)

| Method | Path | Query |
|---|---|---|
| GET | `/api/products` | `category, search, store, minPrice, maxPrice, sort, limit, offset` |
| GET | `/api/products/:id` | `reviewLimit, reviewOffset` |
| GET | `/api/products/featured` | — |
| GET | `/api/products/deals` | — |
| GET | `/api/stores` | `limit, offset` |
| GET | `/api/stores/:id` | — |
| GET | `/api/stores/:id/reviews` | — |
| GET | `/api/categories` | — |
| GET | `/api/categories/:slug` | — |
| GET | `/api/search` | `q (required), category, store, minPrice, maxPrice, sort, limit, offset` |

### Customer (Bearer)

| Method | Path | Body |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/addresses` | address CRUD |
| GET | `/api/cart/:userId` | — |
| POST | `/api/cart` | `{productId, quantity, variant?}` |
| PUT | `/api/cart/:id` | `{quantity, variant?}` |
| DELETE | `/api/cart/:id` | — |
| POST | `/api/orders` | `{items[], shippingAddress?, paymentMethod?, notes?, couponCode?}` |
| GET | `/api/orders` | (admin: `?customerId=`) |
| GET | `/api/orders/:id` | — |
| POST | `/api/refunds` | `{order_id, amount, reason}` |

### Seller (Bearer + role:merchant)

| Method | Path | Body |
|---|---|---|
| GET | `/api/seller/stores/me` | — |
| POST | `/api/seller/stores` | `{store_name, ...}` (G2 fix) |
| PATCH | `/api/seller/stores/:id` | `{store_name?, ...}` |
| GET/POST | `/api/seller/products` | list / create |
| GET/PATCH/DELETE | `/api/seller/products/:id` | product CRUD |
| POST | `/api/seller/products/:id/images` | `{url, alt_text?, ...}` |
| GET | `/api/seller/orders?status=` | — |
| POST | `/api/seller/orders/:id/status` | `{status, tracking_number?, note?}` (forward-only state machine) |
| GET | `/api/seller/analytics` | — |
| GET | `/api/seller/inventory` | — |
| GET | `/api/seller/payouts?limit=&offset=` | — |
| GET | `/api/seller/dashboard` | — |

### Admin (Bearer + role:admin)

**Users / stores / products / orders / disputes:**
- GET `/api/admin/users?role=&status=&limit=&offset=`
- GET `/api/admin/stores?is_active=&is_verified=&limit=&offset=`
- GET `/api/admin/products?is_active=&is_featured=&store_id=&category_id=&limit=&offset=`
- GET `/api/admin/orders?status=&payment_status=&limit=&offset=`
- GET `/api/admin/disputes?status=&priority=&limit=&offset=`
- GET `/api/admin/orders-with-people` (with `customer_name`, `customer_email`, `store_name`)
- GET `/api/admin/audit-log?action=&entity_type=&user_id=&limit=&offset=`
- PATCH `/api/admin/users/:id` `{status?, role?, is_verified?, ...}` (with SELF_BAN/SELF_DEMOTE guards)
- PATCH `/api/admin/stores/:id`
- PATCH `/api/admin/products/:id`
- PATCH `/api/admin/orders/:id/status`
- PATCH `/api/admin/disputes/:id`

**Phase-2 admin CRUD (`admin-extras.ts`):**
- Categories: GET/POST/PATCH/DELETE `/api/admin/categories`
- Coupons: GET/POST/PATCH/DELETE `/api/admin/coupons`
- Reviews: GET/PATCH/DELETE `/api/admin/reviews`
- Settings: GET `/api/admin/settings`, PATCH `/api/admin/settings/:key` (with auto-redaction)
- Broadcast: POST `/api/admin/notifications/broadcast`
- Stats: GET `/api/admin/stats`, `/api/admin/stats/timeseries`, `/api/admin/stats/by-governorate`
- Maintenance: POST `/api/admin/maintenance/cleanup-audit-logs`

### Payments

| Method | Path | Body | Auth |
|---|---|---|---|
| GET | `/api/payments/methods` | — | public |
| POST | `/api/payments/webhook/:method` | raw provider payload | provider (rate-limited 120/min) |
| POST | `/api/payments` | `{order_id, amount, currency, method, transaction_id?}` | customer |
| GET | `/api/payments/order/:orderId` | — | customer (owner) / admin |
| POST | `/api/payments/:id/confirm` | — | admin |

---

## Cache-Control headers

| Path | TTL |
|---|---|
| `/api` (catalog) | 60s + `stale-while-revalidate=30` |
| `/api/stats/home` | 30s + 15s |
| `/api/shipping/methods` | 300s + 150s |

All others: `no-store` (mutations + per-user data).

---

## Standard query parameters

- `limit`: 1..100, default 20 (admin/listing endpoints)
- `offset`: ≥0, default 0
- `q`: search query (full-text search)

---

## Response compression

Express middleware compresses responses >1KB with gzip.

---

## See also

- [Database schema](database.md)
- [Security model](security.md)
- [Workflow diagrams](workflow.md)
- [API source](https://github.com/nashwanzaher/nouf-ex/tree/main/apps/api/src)
