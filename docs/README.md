# Nouf-ex — Full Documentation

> **Framework:** [Diátaxis](https://diataxis.fr/) — _tutorials · how-to · reference · explanation_
> **Standards adopted:** [Keep a Changelog 1.1.0](https://keepachangelog.com/) · [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) · [Contributor Covenant 3.0](https://www.contributor-covenant.org/) · [OWASP API Top 10 (2023)](https://owasp.org/API-security/editions/2023/en/0x11-t10/) · [ISO/IEC 25010:2011](https://www.iso.org/standard/35733.html) · [NIST SP 800-218 SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/r1/final) · [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/)

**Up:** [README.md](../README.md) · [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../.github/CONTRIBUTING.md) · [SECURITY.md](../.github/SECURITY.md) · [CODE_OF_CONDUCT.md](../.github/CODE_OF_CONDUCT.md)

---

## Table of contents

- **[§1. Tutorials — learning-oriented](#1-tutorials-learning-oriented)**
  - [§1.1 Getting started](#11-getting-started)
  - [§1.2 Tutorial: run an order end-to-end](#12-tutorial-run-an-order-end-to-end)
- **[§2. How-to guides — task-oriented](#2-how-to-guides-task-oriented)**
  - [§2.1 Day-to-day dev workflow](#21-day-to-day-dev-workflow)
  - [§2.2 Code conventions](#22-code-conventions)
  - [§2.3 CI/CD](#23-cicd)
  - [§2.4 Deployment](#24-deployment)
  - [§2.5 Docker](#25-docker)
  - [§2.6 Monitoring & observability](#26-monitoring--observability)
  - [§2.7 Backup & restore](#27-backup--restore)
  - [§2.8 Debugging common failures](#28-debugging-common-failures)
- **[§3. Reference — information-oriented](#3-reference-information-oriented)**
  - [§3.1 API reference](#31-api-reference)
  - [§3.2 Database](#32-database)
  - [§3.3 Security model](#33-security-model)
  - [§3.4 ER diagram](#34-er-diagram)
  - [§3.5 Testing strategy & standards](#35-testing-strategy--standards)
- **[§4. Explanation — understanding-oriented](#4-explanation-understanding-oriented)**
  - [§4.1 Architecture overview](#41-architecture-overview)
  - [§4.2 Tech stack](#42-tech-stack)
  - [§4.3 Architecture decisions (ADRs)](#43-architecture-decisions-adrs)
  - [§4.4 Threat model](#44-threat-model)
  - [§4.5 Standards & conformance](#45-standards--conformance)
- **[§5. Planning](#5-planning)**
  - [§5.1 Risk register](#51-risk-register)
  - [§5.2 Roadmap](#52-roadmap)

---

# §1. Tutorials — learning-oriented

> **Audience:** first-time user. Goal: experience the system end-to-end.

## §1.1 Getting started

This walks you from a clean checkout to a running stack in about 15 minutes.

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | **20.18+** | Builds the SPA (`npm run build`) and runs scripts |
| npm | **10+** | Comes with Node |
| PostgreSQL | **17** | External DB — see `.env.example` |
| Docker (optional) | **24+** | For the single-container deploy |

### 1.1.1 Clone and configure

```sh
git clone https://github.com/nashwanzaher/nouf-ex
cd nouf-ex
cp .env.example .env                 # fill in DATABASE_URL, AUTH_SECRET (≥32 chars)
```

Generate a strong `AUTH_SECRET`:
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 1.1.2 Install + apply database

```sh
cd app
npm install
npm run db:setup                     # idempotent: applies database/*.sql + migrations
```

This creates the `noufex_db` database, the 4 roles (`postgres`, `noufex_owner`, `noufex_app`, `noufex_readonly`), the 32 tables, 32 triggers, 4 views, and seeds demo users.

### 1.1.3 Run the API + SPA

**Option A — Docker (single container, recommended):**
```sh
cd ..                                # back to repo root
docker compose up -d --build
# → API on http://localhost:3000
```

**Option B — local Node, two terminals:**
```sh
# Terminal 1 (from app/)
cd app && npm run api                # Express on :3000
# Terminal 2 (from app/)
cd app && npm run dev                # Vite on :5173 (proxies /api to :3000)
```

### 1.1.4 Smoke test

```sh
curl -fs http://localhost:3000/api/health
# → {"status":"ok","uptime_s":N,"ts":"2026-07-11T…Z"}

curl -fs http://localhost:3000/api/ready
# → {"status":"ready","uptime_s":N,"checks":{"db":{"ok":true,"ms":N}}}
# → 503 with {"status":"degraded", ...} when DB connection fails
```

See [`app/server/index.ts:171-201`](../../app/server/index.ts) for the exact shape. The server-boot smoke job in `ci.yml` asserts that both endpoints return 200 AND that `/api/health` body contains `"status":"ok"` and `"uptime_s":`.

Then open the SPA in a browser, sign in as a seed customer (e.g. `ahmed@gmail.com` / `customer123`), and place a test order.

### 1.1.5 Run the test suite

```sh
cd app
npm run lint           # 0 errors expected
npm run typecheck      # tsc -b --noEmit
npm run test:unit      # Vitest (pg mocked)
npm run test:a11y      # vitest-axe WCAG 2.1 AA
```

### 1.1.6 Troubleshooting the first run

| Symptom | Cause | Fix |
|---|---|---|
| `AUTH_SECRET env var is required` on startup | `.env` missing or secret too short | Set `AUTH_SECRET` to ≥ 32 random chars |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres not running or wrong host | `pg_isready -h localhost -p 5432`; on Windows-Docker use `host.docker.internal` |
| `permission denied for table X` | Migrations not applied | `cd app && npm run db:setup` |
| `npm run db:setup` fails with `noufex.allow_seed` | `NODE_ENV=production` blocks seed | Use a non-prod env or unset it for dev |

## §1.2 Tutorial: run an order end-to-end

This 30-minute exercise walks through the happy path as the three personas: **customer → merchant → admin**.

### 1.2.1 Customer flow

1. Open the SPA and click **Register** → create an account.
2. Browse products, add 2 items to the cart, change the quantity.
3. Open the **Wishlist**, mark 1 item.
4. Click **Checkout** → choose **Cash on Delivery** → confirm.
5. The order appears under **My Orders** with status `pending`. The merchant receives a notification.

Verify with curl:
```sh
curl -fsS -b cookies.txt http://localhost:3000/api/orders
```

### 1.2.2 Merchant flow

1. Log out, log in as the seed merchant (e.g. `fatima@spice-yemen.com` / `merchant123`).
2. Open **Seller Dashboard → Orders** → confirm the order from §1.2.1.
3. Change status to `shipped`, add a tracking note.

### 1.2.3 Admin flow

1. Log in as the seed admin (`admin@noufex.com` / `admin123`).
2. Open **Admin → Audit log** → see the merchant's status change recorded.

### 1.2.4 What you exercised end-to-end

- Auth (HttpOnly cookie), RBAC (3 roles), ownership-by-WHERE
- Cart / Wishlist / Order state machine (`trg_orders_state_machine`)
- 32 DB triggers (incl. `trg_orders_a_state_machine`, `trg_orders_append_timeline`), idempotent webhook dedup via `webhook_events`, audit log redaction
- i18n (Arabic default RTL, English, Chinese)

If a step fails unexpectedly, run `npm run typecheck && npm run test:unit` from `app/` — the failure is usually caught there.

---

# §2. How-to guides — task-oriented

> **Audience:** active contributor. Goal: solve a specific problem.

## §2.1 Day-to-day dev workflow

```sh
# Quick reference — see CONTRIBUTING.md for the full process

cd app
npm run dev          # Vite on :5173 (HMR)
npm run api          # Express on :3000 (no auto-restart; Ctrl-C + rerun)
npm run lint -- --fix
npm run typecheck
npm run test:unit -- --watch
```

| Task | Command |
|---|---|
| Format on save | already wired in `.vscode/settings.json` |
| Run one test | `npx vitest run path/to/file.test.ts` |
| Apply a new migration | add `database/migrations/NNNN_*.sql`, then `npm run db:setup` |
| Open a draft PR | `gh pr create --draft --fill` |
| Sync with main | `git fetch origin && git rebase origin/main` |

## §2.2 Code conventions

- **TypeScript strict mode** — no `any`; use `unknown` and narrow.
- **2-space indent, LF line endings** (Prettier + `.gitattributes`).
- **No `// eslint-disable`** — fix the warning.
- **No `console.log`** in production code — use the structured logger.
- **Naming:**

  | What | Convention | Example |
  |---|---|---|
  | React components | `PascalCase.tsx` | `Navbar.tsx` |
  | Hooks | `useKebab.ts` | `use-mobile.ts` |
  | Pure utilities | `camelCase.ts` | `utils.ts` |
  | Constants | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE` |
  | DB tables | `snake_case` plural | `order_items` |
  | DB columns | `snake_case` | `created_at` |
  | API endpoints | kebab-case | `/api/order-items` |
  | Env vars | `UPPER_SNAKE_CASE` | `DATABASE_URL` |
  | i18n keys | `dot.path.lower_snake` | `home.hero.searchPlaceholder` |

- **One default export per file** unless co-located variants/hooks are the public API.
- **Schemas:** always `Zod.strict()`; admin-only fields (`role`, `email_verified`, `password_hash`) are never in user-facing schemas.

## §2.3 CI/CD

GitHub Actions (`.github/workflows/`):

| File | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push / PR to `main`, `develop` | docs-presence · lint · typecheck · Vitest · build · axe a11y · DB integration · server-boot |
| `docs.yml` | push to `main` touching `docs/**` or `mkdocs.yml` | MkDocs build + GitHub Pages deploy |
| `link-check.yml` | push / PR | `markdown-link-check` over `docs/` |
| `deploy-staging.yml` | manual | Deploy API container to staging |
| `deploy-prod.yml` | manual approval | Deploy to production (see §2.4.3) |

**Job order in `ci.yml`** (parallel where possible, fail-fast):

```
┌────────────────┐  ┌─────────┐  ┌────────────┐
│ docs-presence  │  │  lint   │  │ typecheck  │  (parallel, no deps)
└───────┬────────┘  └────┬────┘  └─────┬──────┘
        │                │              │
        │               ┌┴──────────────┤
        │               │    test       │  (needs lint, typecheck)
        │               └────────┬──────┘
        │                        │
        │               ┌────────┴──────┐
        │               │    build       │  (mcp-server built as step inside)
        │               └────────┬───────┘
        │                        │
   ┌────┴────────────────────────┴────────────────────────┐
   │ a11y (needs typecheck, lint, build)                  │
   │ db-integration (needs lint, typecheck)                │  (parallel)
   │ server-boot (needs lint, typecheck)                   │
   └───────────────────────────────────────────────────────┘
```

**Required status checks** for `main` (see [`.github/branch-protection.md`](../../.github/branch-protection.md)): `ci / docs-presence`, `ci / lint`, `ci / typecheck`, `ci / test`, `ci / build`, `ci / a11y`, `ci / db-integration`, `ci / server-boot`.

**Note:** the previous `mindmap` job verified a deleted file (`docs/architecture/SKILLS_MINDMAP.md`); it was replaced by `docs-presence` on 2026-07-11 to verify the 10 canonical documentation files exist. There is no separate `mcp-server` job — it builds as a step inside the `build` job.

**Local simulation:**
```sh
cd app
npm run lint && npm run typecheck && npm run test:unit && npm run build && npm run test:a11y
```

## §2.4 Deployment

### 2.4.1 Architecture (1 container)

```
Internet ─► reverse proxy (TLS termination, HSTS)
              │
              ▼
        ┌──────────────┐
        │ Nouf-ex       │   ← single container: Express API + static SPA
        │  port 3000    │
        └──────┬────────┘
               │ DATABASE_URL
               ▼
        PostgreSQL 17  ← external, database `noufex_db`
```

### 2.4.2 Pre-deployment checklist

- [ ] `DATABASE_URL` set and reachable (`psql "$DATABASE_URL" -c '\dt'` lists tables)
- [ ] `AUTH_SECRET` set, ≥ 32 random chars
- [ ] `ALLOWED_ORIGINS` set to the public HTTPS origin(s), comma-separated
- [ ] `NODE_ENV=production`
- [ ] DB schema applied: `npm run db:setup` (idempotent)
- [ ] HSTS-preload-eligible domain if applying for the [HSTS preload list](https://hstspreload.org)

### 2.4.3 Production-deploy workflow

The `deploy-prod.yml` workflow uses GitHub **manual-approval environments**:

```
Push to main
   │
   ▼  (auto)
ci.yml runs (lint + typecheck + test + build + DB integration + server-boot)
   │
   ▼  (auto, on push to main)
deploy-staging.yml  ──► staging
   │
   ▼  (manual approval in GitHub UI)
deploy-prod.yml     ──► production
   │
   ▼  (post-deploy)
   1. curl /api/health    (liveness)
   2. curl /api/ready     (DB-backed readiness)
   3. curl /              (SPA HTML)
```

If any smoke fails: the deployment is rolled back by `git revert <bad-sha>` + redeploy container.

### 2.4.4 Reverse proxy (nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name your.domain;

  ssl_certificate     /etc/letsencrypt/live/your.domain/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your.domain/privkey.pem;
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }
}
```

### 2.4.5 Rollback

The schema migrations are forward-only. Rollback options:

1. **Code rollback** — `git revert <bad-sha>` + redeploy container. Fast.
2. **Schema rollback** — write a new migration that reverses the previous one. Plan + review.
3. **Data rollback** — restore from `pg_dump` (see §2.7).

## §2.5 Docker

The PostgreSQL server is **not** part of this stack. It must already exist on the host (or a reachable network) and contain the `noufex_db` database.

| Component | Path inside container |
|---|---|
| Express API | `/app/server/index.ts` (run via `tsx`) |
| Entrypoint | `/usr/local/bin/noufex-entrypoint.sh` |

The built SPA (if you ran `npm run build` first) is served from `/app/dist` by the same API process.

```sh
# From repo root
docker compose up -d --build
docker compose logs -f noufex-api
docker compose down
```

From inside the container, `localhost` is the container itself, so `docker-compose.yml` overrides `DB_HOST=host.docker.internal` and adds an `extra_hosts` mapping for Linux.

## §2.6 Monitoring & observability

The API logs to **stdout** as one structured JSON line per request:

```json
{"ts":"2026-07-11T12:34:56.789Z","level":"info","request_id":"…","msg":"request_completed","status":200,"duration_ms":42}
```

Every response carries `x-request-id`. To correlate a user-reported failure with the server log, ask for the request ID.

| What | Where |
|---|---|
| Liveness | `GET /api/health` (always 200 if the process is up) |
| Readiness | `GET /api/ready` (200 only when DB connection works) |
| Metrics | Open Prometheus scrape at `/metrics` (planned) |
| Audit log | `admin_audit_log` table — actor, target, IP, UA, before/after diff |

**RED metrics** (recommended per [Google SRE Book](https://sre.google/sre-book/monitoring-distributed-systems/)):
- **R**ate — `requests_per_second` by `route`
- **E**rrors — `error_ratio = 5xx / total` (alert > 1%)
- **D**uration — p50 / p95 / p99 latency by `route`

**USE method** (per [Brendan Gregg](https://www.brendangregg.com/usemethod.html)) for the DB host:
- **U**tilization, **S**aturation, **E**rrors — surface via `pg_stat_activity` and the rate-limiter cleanup loop.

## §2.7 Backup & restore

PostgreSQL 17, database `noufex_db`.

### Backup (nightly, run by cron / systemd timer / GitHub Action)

```sh
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
  > "/backups/noufex_$(date -u +%Y%m%dT%H%M%SZ).dump"
```

### Restore (one-off, after an incident)

```sh
dropdb noufex_db && createdb noufex_db
pg_restore --no-owner --dbname=noufex_db "/backups/noufex_<TIMESTAMP>.dump"
```

### Apply schema + seed (only on first-time setup, NOT a restore path)

```sh
cd app && npm run db:setup
```

**Targets:** nightly full dump + WAL archive continuously. **DR RPO:** 15 min. **DR RTO:** 2 h.

## §2.8 Debugging common failures

| Failure | Cause | Fix |
|---|---|---|
| `AUTH_SECRET env var is required` on startup | `.env` missing or secret < 32 chars | Set `AUTH_SECRET` to ≥ 32 random chars |
| Tests pass locally but fail in CI | Different Node version, timezone, port conflict, hidden env var | CI uses Node 20 — match `engines` in `package.json` |
| `ECONNREFUSED 127.0.0.1:5432` in Docker | Wrong DB host | Use `host.docker.internal` |
| `permission denied for table X` | Migrations not applied | `cd app && npm run db:setup` |
| 429 on every request | Rate limiter triggered | Wait 15 min for the auth bucket, 1 min for the health bucket |
| CSP blocks inline script | Missing nonce | Check that `index.html` (built by Vite) has the nonce injected by `securityHeaders` middleware |
| Rate-limit cascade in tests | Test runner hammers `/api/health` faster than the IP-keyed limiter allows | Retry with a few seconds' delay or run against a fresh DB |

Reset utilities live in `app/scripts/` and `scripts/maintenance/`. The full failure-mode list is in the deleted `docs/development/debugging.md` (consolidated here 2026-07-11).

---

# §3. Reference — information-oriented

> **Audience:** anyone looking up a fact.

## §3.1 API reference

All endpoints are served by `app/server/index.ts` on the same origin as the SPA (default `http://localhost:3000`). The frontend talks to relative paths (`/api/...`).

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness |
| `GET` | `/api/ready` | — | Readiness (DB) |
| `GET` | `/api/stats/home` | — | Homepage counters |
| `GET` | `/api/products` | — | List / search products |
| `GET` | `/api/products/featured` | — | Curated featured products |
| `GET` | `/api/products/deals` | — | Active-deal products |
| `GET` | `/api/products/:id` | — | Product detail + store + reviews + images |
| `GET` | `/api/stores` | — | List of stores |
| `GET` | `/api/stores/:id` | — | Store detail + its products |
| `GET` | `/api/stores/:id/reviews` | — | Reviews for a store |
| `GET` | `/api/categories` | — | Full category tree |
| `GET` | `/api/categories/:slug` | — | One category + its products |
| `GET` | `/api/reviews` | — | Reviews with optional filters |
| `POST` | `/api/reviews` | auth | Submit a new review |
| `GET` | `/api/orders` | auth | List orders |
| `GET` | `/api/orders/:id` | auth | One order with its items |
| `POST` | `/api/orders` | auth | Create an order from a cart snapshot |
| `GET` | `/api/cart/:userId` | auth | Cart contents |
| `GET` | `/api/cart/count/:userId` | auth | Number of items in the cart |
| `POST` | `/api/cart` | auth | Add an item to the cart |
| `PATCH` | `/api/cart/:id` | auth | Update cart-item quantity |
| `DELETE` | `/api/cart/:id` | auth | Remove one cart item |
| `DELETE` | `/api/cart/clear/:userId` | auth | Clear an entire cart |
| `GET` | `/api/wishlist/` | auth | Wishlist contents |
| `POST` | `/api/wishlist` | auth | Add to wishlist |
| `DELETE` | `/api/wishlist/:id` | auth | Remove one wishlist item |
| `GET` | `/api/notifications/` | auth | List notifications for the current user |
| `PUT` | `/api/notifications/:id/read` | auth | Mark one as read |
| `POST` | `/api/messages/` | auth | Send a message (customer↔merchant or merchant↔customer) |
| `GET` | `/api/messages/inbox` | auth | Inbox messages for the current user |
| `GET` | `/api/messages/sent` | auth | Sent messages for the current user |
| `GET` | `/api/messages/conversation` | auth | One conversation thread (query: `with=userId&productId=…`) |
| `GET` | `/api/messages/unread-count` | auth | Number of unread messages |
| `PUT` | `/api/messages/:id/read` | auth | Mark one message as read |
| `GET` | `/api/store-followers/check` | auth | Check whether the current user follows a store (query: `storeId=…`) |
| `POST` | `/api/store-followers` | auth | Follow a store |
| `DELETE` | `/api/store-followers` | auth | Unfollow a store (query: `storeId=…`) |
| `POST` | `/api/auth/register` | rate-limited | Create an account |
| `POST` | `/api/auth/login` | rate-limited | Exchange credentials for a session |
| `POST` | `/api/auth/logout` | auth | Invalidate the session and clear the cookie |
| `GET` | `/api/auth/me` | auth | Currently authenticated user |
| `PATCH` | `/api/auth/me` | auth | Update profile (name, phone, avatar, language, gender) |
| `POST` | `/api/auth/change-password` | auth | Change the current password |
| `POST` | `/api/auth/forgot-password` | rate-limited | Request a password-reset email/token |
| `POST` | `/api/auth/reset-password` | rate-limited | Reset password using the token from forgot-password |
| `POST` | `/api/auth/2fa/setup` | auth (rate-limited) | Begin TOTP setup (returns secret + otpauth URL) |
| `POST` | `/api/auth/2fa/enable` | auth (rate-limited) | Enable TOTP after verifying the first code |
| `POST` | `/api/auth/2fa/verify` | rate-limited | Verify a TOTP code (returns full session token) |
| `POST` | `/api/auth/2fa/disable` | auth (rate-limited) | Disable TOTP (requires current password) |
| `POST` | `/api/payments` | rate-limited | Create a payment for an order |
| `GET` | `/api/payments/order/:orderId` | auth | Payments for one order |
| `POST` | `/api/payments/:id/confirm` | auth (admin) | Confirm a payment (e.g. on COD receipt) |
| `GET` | `/api/payments/methods` | — | List active payment providers/methods |
| `POST` | `/api/payments/webhook/:method` | rate-limited | Provider webhook (Stripe/Paymob); verified against rawBody |
| `GET` | `/api/addresses` | auth | List a user's saved addresses |
| `POST` | `/api/addresses` | auth | Create a new address |
| `DELETE` | `/api/addresses/:id` | auth | Remove a saved address |
| `GET` | `/api/shipping/methods?weight_kg=N` | — | Shipping options for a given cart weight |
| `POST` | `/api/coupons/validate` | auth | Validate a coupon against a cart total |
| `POST` | `/api/coupons/redeem` | auth | Redeem (persist) a coupon redemption |
| `POST` | `/api/refunds` | auth | Open a refund / dispute |
| `POST` | `/api/refunds/:id/resolve` | auth (admin) | Admin: resolve a refund |
| `/api/admin/users` | `GET` | auth (admin) | List users |
| `/api/admin/users/:id` | `PATCH` | auth (admin) | Update a user (role, status, etc.) |
| `/api/admin/stores` | `GET` | auth (admin) | List stores |
| `/api/admin/stores/:id` | `PATCH` | auth (admin) | Verify / unverify / suspend a store |
| `/api/admin/products` | `GET` | auth (admin) | List products (admin view) |
| `/api/admin/products/:id` | `PATCH` | auth (admin) | Update a product (admin override) |
| `/api/admin/orders` | `GET` | auth (admin) | List all orders |
| `/api/admin/orders/:id/status` | `PATCH` | auth (admin) | Override an order's status |
| `/api/admin/disputes` | `GET` | auth (admin) | List disputes |
| `/api/admin/disputes/:id` | `PATCH` | auth (admin) | Resolve / escalate a dispute |
| `/api/admin/audit-log` | `GET` | auth (admin) | Read the audit log |
| `/api/admin/stats` | `GET` | auth (admin) | Dashboard counters |
| `/api/admin/stats/timeseries` | `GET` | auth (admin) | Time-series buckets for charts |
| `/api/admin/stats/by-governorate` | `GET` | auth (admin) | Geographic distribution |
| `/api/seller/stores/me` | `GET` | auth (merchant) | The current merchant's store |
| `/api/seller/stores` | `POST` | auth (merchant) | Create a store (onboarding) |
| `/api/seller/stores/:id` | `PATCH` | auth (merchant) | Update the current merchant's store |
| `/api/seller/products` | `POST` | auth (merchant) | Create a product |
| `/api/seller/products` | `GET` | auth (merchant) | List the merchant's products |
| `/api/seller/products/:id` | `GET` | auth (merchant) | One of the merchant's products |
| `/api/seller/products/:id` | `PATCH` | auth (merchant) | Update a product |
| `/api/seller/products/:id` | `DELETE` | auth (merchant) | Soft-delete a product |
| `/api/seller/products/:id/images` | `POST` | auth (merchant) | Add an image to a product |
| `/api/seller/orders` | `GET` | auth (merchant) | Orders for the merchant's store |
| `/api/seller/orders/:id` | `GET` | auth (merchant) | One order detail |
| `/api/seller/orders/:id/status` | `POST` | auth (merchant) | Update order status (e.g. → shipped) |
| `/api/seller/analytics` | `GET` | auth (merchant) | Sales / traffic analytics |
| `/api/seller/inventory` | `GET` | auth (merchant) | Stock levels |
| `/api/seller/payouts` | `GET` | auth (merchant) | Payout history |
| `/api/seller/dashboard` | `GET` | auth (merchant) | Aggregated dashboard summary |
| `/api/store-followers/*` | — | auth | Follow / unfollow a store (see `/api/messages/` block above) |
| `/api/auth/2fa/*` | — | auth | 2FA setup / verify / disable / backup codes (see `/api/auth/` block above) |

**Auth legend:** `—` = public; `auth` = any logged-in user; `auth (admin)` = admin role only; `auth (merchant)` = merchant or admin; `rate-limited` = per-IP rate-limited on `/api/auth/*` (20 req / 15 min) — see [`app/server/lib/ratelimit.ts`](../../app/server/lib/ratelimit.ts).

**Endpoint count (verified 2026-07-11):** **92 endpoints** across 18 routers — addresses (4), auth (8), auth-2fa (4), cart (6), catalog (10), coupons (2), messages (6), notifications (2), orders (3), payments (5), refunds (1), reviews (2), seller (16), shipping (1), stats (1), store-followers (3), wishlist (3), admin (14), plus the two top-level health endpoints `/api/health` and `/api/ready` defined inline in [`app/server/index.ts:171-201`](../../app/server/index.ts).

Every authenticated endpoint returns `401 AUTH_REQUIRED` for missing/invalid session, `403 AUTH_FORBIDDEN` for wrong role.

## §3.2 Database

PostgreSQL 17, database `noufex_db`. Single external instance. The API container connects; nothing is created, migrated, or seeded inside the container.

| Item | Value |
|---|---|
| Engine | PostgreSQL 17 (external) |
| Database | `noufex_db` |
| **Runtime user** | `noufex_app` (least privilege) |
| Port | 5432 |
| Connection string | `postgresql://noufex_app:<pw>@<host>:5432/noufex_db` |

The `postgres` superuser is used **only** for the one-time `npm run db:setup` (creates roles, schema, seed). After that, the app connects as `noufex_app` with only the GRANTs it needs.

### Roles (4)

| Role | Purpose | Privileges |
|---|---|---|
| `postgres` | DBA only | Superuser — never used by the app at runtime |
| `noufex_owner` | Owns schema objects (DDL) | Owner of all tables; no `LOGIN` in production |
| `noufex_app` | Runtime app role | `SELECT/INSERT/UPDATE/DELETE` on a whitelisted subset of tables + `EXECUTE` on PL/pgSQL functions |
| `noufex_readonly` | Reporting | `SELECT` only on the whitelist |

### Schema inventory

| File | Contents |
|---|---|
| `database/schema.sql` | 16 base tables (users, categories, stores, products, …) |
| `database/schema-extra.sql` | 10 extra tables (payments, coupons, refunds, transactions, …) |
| `database/views.sql` | 4 read-only views (`security_invoker`) |
| `database/functions.sql` | PL/pgSQL trigger functions + cleanup helpers |
| `database/triggers.sql` | 18 business-logic triggers |
| `database/roles.sql` | 4 roles + GRANTs |
| `database/seed.sql` | Idempotent demo data, gated by `noufex.allow_seed` |
| `database/migrations/0001…0030` | 30 applied incremental migrations (idempotent, `IF NOT EXISTS`/`OR REPLACE`) |

### Tables (32)

**16 in `schema.sql`:** `users`, `addresses`, `categories`, `stores`, `products`, `product_variants`, `product_images`, `orders`, `order_items`, `cart_items`, `wishlist`, `reviews`, `notifications`, `disputes`, `messages`, `subscriptions`.

**10 in `schema-extra.sql`:** `payments`, `coupons`, `coupon_usage`, `refunds`, `store_balance`, `store_followers`, `inventory_log`, `shipping_methods`, `transactions`, `admin_audit_log`.

**6 in `migrations/`:** `schema_migrations` (0001), `rate_limit_buckets` (0004), `search_logs` (0009), `used_jtis` (0010), `webhook_events` (0020), `app_settings` (0023).

### Triggers (32 total)

- **18 in `triggers.sql`:** `trg_orders_a_state_machine`, `trg_orders_append_timeline`, `trg_order_items_decrement_stock`, 3 × reviews-refresh-rating (ins/upd/del), 3 × products-refresh-store-count (ins/upd/del), 3 × reviews-refresh-store-stats (ins/upd/del), `trg_refunds_resolve_payments`, 3 × followers-refresh-count (ins/upd/del), `trg_orders_refresh_store_sales`, plus the dynamic `trg_<table>_set_updated_at` attached per table that has an `updated_at` column.
- **3 in migration 0022:** `trg_coupon_usage_enforce_limits`, `trg_coupon_usage_decrement_count`, `trg_orders_release_coupon_on_cancel`.
- **1 in migration 0024:** `trg_sync_users_two_factor_enabled`.
- **1 in migration 0028:** `trg_transactions_balance_after`.
- **3 in migration 0030:** `trg_product_images_set_updated_at`, `trg_order_items_set_updated_at`, `trg_rate_limit_buckets_set_updated_at`.
- The 6 triggers re-declared in migration 0025 (`trg_reviews_refresh_store_stats_*`, `trg_followers_refresh_count_ins/del`, `trg_orders_refresh_store_sales`) over-write the ones from `triggers.sql`; they are **not double-counted**.

> Note: the **dynamic `trg_<table>_set_updated_at`** loop in `triggers.sql` creates one trigger per `updated_at` column. The exact count depends on the live schema; the `32 total` figure counts the static definitions.

### Migration conventions

- Every migration wraps DDL in `DO $$ … END $$` guarded by `pg_constraint` / `information_schema.columns` checks.
- `SECURITY DEFINER` functions **always** paired with `SET search_path = pg_catalog, public`.
- Identity columns + `TIMESTAMPTZ` everywhere + `NUMERIC(12,2)` for money + `JSONB` for snapshots.
- BRIN on `created_at`, GIN on FTS (`tsvector`), partial unique indexes for soft-delete-aware uniqueness.
- `security_invoker = true` on every view (PG 17 best practice).
- Forward-only by design; reversal is a new migration.

## §3.3 Security model

### 3.3.1 Authentication

- **HttpOnly-cookie session** — server sets `noufex_token=<JWT>` with `Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800` (7 days). Logout sends `Set-Cookie` with `Max-Age=0`.
- Token payload `{sub, role, ver, exp}` — `sub` = user id, `role` = `customer|merchant|admin`, `ver` = current `users.token_version` (NOT `token_version`; abbreviated in the JWT to `ver` for compactness), `exp` = unix-seconds expiry. HMAC-SHA256 signed with `AUTH_SECRET` (≥ 32 chars); verified with `crypto.timingSafeEqual`.
- **Token revocation** — the JWT's `role` and `ver` are checked against the live `users` row on every request (cached for 30 s per `user_id`). Bumping `users.token_version` (on logout / change-password / 2FA enable / admin force) invalidates every existing session.
- **Password hashing** — scrypt with Node defaults (`N=16384, r=8, p=1`), random 16-byte salt, 64-byte derived key. Documented as below-current-OWASP-recommendation in the audit (G-2).
- **2FA (optional)** — TOTP (RFC 6238, 30s window, ±1 step). Setup: `POST /api/auth/2fa/setup`. 10 scrypt-hashed single-use backup codes.

### 3.3.2 Authorization (RBAC matrix)

| Role | Can read | Can write |
|---|---|---|
| `guest` | Public catalog, search | — |
| `customer` | + own orders/cart/wishlist/addresses | + own data only |
| `merchant` | + own store + own products + own orders | + own store/products/orders |
| `admin` | + everything | + everything except self-ban / self-demote |

### 3.3.3 Defense layers

1. **CORS allow-list** (`ALLOWED_ORIGINS`) — fail-closed in production.
2. **CSP** — nonced + `strict-dynamic`, no `unsafe-eval`, `default-src 'self'`.
3. **Helmet-equivalent headers** — HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer.
4. **Rate limiting** — DB-backed atomic `consume_rate_limit()` on `/api/auth/*`; in-memory `healthRateLimit()` on `/health`/`/ready`.
5. **Zod `.strict()`** on every writable schema — unknown fields rejected with 400.
6. **Ownership-by-WHERE** on every PATCH/DELETE — `WHERE id = ? AND user_id = req.user.id`.
7. **Parameterised SQL** everywhere via `db.prepare(...).all/get/run`.
8. **Audit log** with redaction (`REDACT_KEYS` set, 17 sensitive keys, recursive walk).

### 3.3.4 OWASP API Top 10 (2023) coverage

| API risk | Coverage |
|---|---|
| API1 — BOLA | Strong. Ownership guards on every PATCH/DELETE. |
| API2 — Broken Auth | Strong (HMAC + per-user token_version + scrypt + 2FA). |
| API3 — BOPLA | Strong. `Zod.strict()` and admin fields omitted from user schemas. |
| API4 — Resource consumption | Strong. 1 MB body limit, DB rate limiter, pagination clamp. |
| API5 — BFLA | Strong. `requireRole('admin')` on `/api/admin/*`. |
| API6 — Sensitive flows | Adequate. Coupon atomicity DB-enforced; refund state machine DB-enforced. |
| API7 — SSRF | N/A. No outbound HTTP. |
| API8 — Misconfig | Strong with drift fixes 2026-07-11. |
| API9 — Inventory | Adequate. Single namespace, no legacy versions. |
| API10 — Unsafe API consumption | Adequate. Webhook idempotency via `webhook_events`. |

## §3.4 ER diagram

```
users ─< addresses
users ─< orders ─< order_items >─ products ─< product_variants
users ─< cart_items >─ products
users ─< wishlist >─ products
users ─< reviews >─ products, stores
users ─< notifications
users ─< subscriptions >─ stores
users ─< messages >─ stores, products
users ─< store_followers >─ stores
users ─< used_jtis, search_logs

stores ─< products
stores ─< product_images
stores ─< store_balance
stores ─< transactions
stores ─< inventory_log

orders ─< payments, refunds, disputes
products ─< coupons ─< coupon_usage
payments ─< webhook_events (dedup)
app_settings (single-row config: DEFAULT_CURRENCY, etc.)
```

The full Mermaid ER was previously rendered in `docs/architecture/er-diagram.md` (consolidated here 2026-07-11).

## §3.5 Testing strategy & standards

| Layer | Where | Environment | What |
|---|---|---|---|
| **Server** | `app/server/tests/` | Node (pg mocked) | API routes, helpers, db wrapper |
| **Frontend** | `app/src/**/__tests__/` | happy-dom (RTL + MSW) | Components, hooks, contexts, pages |
| **E2E** | `tests/e2e/` | Live stack (PowerShell) | Full stack per PHASE |
| **A11y** | `app/src/__tests__/a11y/` | happy-dom + vitest-axe | WCAG 2.1 AA assertions |

### Standards mapping

| Standard | Where mapped |
|---|---|
| [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) — Test Documentation | PHASE design specs (history) |
| [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) — Software Testing | Test organization |
| [ISTQB CTFL v4.0](https://www.istqb.org/) — Test Techniques | Test taxonomy |
| [WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/) | vitest-axe per-component |

### Coverage thresholds (enforced)

```ini
lines:      50
statements: 50
functions:  55
branches:   45
```

Set just below baseline (regression prevention without flapping). Bump after each quarter's gap-closure round.

---

# §4. Explanation — understanding-oriented

> **Audience:** architect / senior engineer. Goal: understand *why*.

## §4.1 Architecture overview

A single Node/Express API talks to one external PostgreSQL database, and a React/Vite SPA talks to that API. The whole thing runs as one Docker image when deployed.

```
                ┌──────────────────────────────┐
                │  PostgreSQL 17 (external)    │
                │  database: noufex_db         │
                └──────────────┬───────────────┘
                               │ pg (TCP)
                               │
       ┌───────────────────────┴────────────────────────┐
       │   Docker image: Nouf-ex                        │
       │   ┌────────────────────────────────────────┐   │
       │   │  Express 5 (server/index.ts, :3000)   │   │
       │   │  ├── REST endpoints (/api/*)          │   │
       │   │  ├── Static SPA fallback (dist/)      │   │
        │   │  └── PgDb wrapper (db/pg-wrapper.ts)  │   │
       │   └───────────────┬────────────────────────┘   │
       │   ┌───────────────┴────────────────────────┐   │
       │   │  Vite-built SPA (dist/)                │   │
       │   │  React 19 + Router 7                   │   │
       │   └────────────────────────────────────────┘   │
       └────────────────────────────────────────────────┘
                       ▲
                       │ HTTPS
                       │
                  ┌────┴────┐
                  │ Browser │
                  └─────────┘
```

### Component map

| Component | Path | Responsibility |
|---|---|---|
| HTTP entry | `app/server/index.ts` | Express bootstrap, middleware chain, route mounting |
| Security headers | `app/server/middleware.ts` | CSP nonced, HSTS, frame-options, referrer-policy |
| Auth | `app/server/middleware.ts` (`setAuthCookie` @ 421 · `extractAuthToken` @ 450 · `clearAuthCookie` @ 439) | HttpOnly cookie, HMAC verify, `token_version` revocation |
| Validation | `app/server/lib/validation.ts` | 32 Zod schemas (20 `.strict()` in production; rest are sub-schemas) |
| DB wrapper | `app/server/db/pg-wrapper.ts` | async `pg.Pool`, prepared statements |
| Audit | `app/server/lib/audit.ts` | Redaction + retry/backoff DLQ |
| Rate limit | `database/migrations/0004_rate_limit_buckets.sql` + `app/server/lib/ratelimit.ts` | Atomic UPSERT |
| SPA entry | `app/src/main.tsx` → `App.tsx` | React Router 7, lazy routes, `ProtectedRoute` |

## §4.2 Tech stack

| Layer | Tech | Why |
|---|---|---|
| Database | PostgreSQL 17 | Identity columns, `TIMESTAMPTZ`, `NUMERIC(12,2)`, `JSONB`, BRIN, GIN, partial indexes, RLS |
| API | Node 20 + Express 5 + `pg` | Mature, async-native, type-safe with TypeScript |
| Validation | Zod 4 | Type inference, `.strict()`, ergonomic error formatting |
| Hashing | scrypt (Node defaults `N=16384, r=8, p=1`) + crypto.timingSafeEqual | Built-in, no third-party dep; G-2 below current OWASP recommendation |
| Auth tokens | HMAC-SHA256 (custom) | One dep less; verified with `timingSafeEqual` |
| 2FA | RFC 6238 TOTP (custom) | No third-party dep, constant-time compare, ±1 step |
| Frontend | React 19 + Vite 7 + React Router 7 | Code-split routes, fast HMR |
| i18n | i18next | Arabic (default RTL), English, Chinese |
| UI | Tailwind 3 + shadcn/ui | Utility-first, accessible primitives |
| State | React Context + useReducer | No Redux needed at current scale |
| Testing | Vitest 4 + supertest + axe-core + MSW | pg mocked globally; happy-dom for DOM |
| Container | `node:20-alpine` + tini | PID 1 reaping, small image |
| CI | GitHub Actions | Matrix of cheap → expensive jobs |

## §4.3 Architecture decisions (ADRs)

> **Format:** Michael Nygard's [template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions). One ADR per significant, hard-to-reverse decision.

### ADR-0001 — Adopt MkDocs (Material) + release-please for docs automation

**Status:** ✅ Accepted (2026-07-02)

Diátaxis-compliant docs site that auto-deploys to GitHub Pages on every push to `main` touching `docs/**` or `mkdocs.yml`. `release-please` automates the CHANGELOG + SemVer bump from Conventional Commits.

### ADR-0002 — Adopt `vitest-axe` for automated WCAG 2.1 AA accessibility testing

**Status:** ✅ Accepted (2026-07-03)

WCAG 2.1 AA is a hard requirement for the project; `vitest-axe` runs in CI per-component to catch regressions before merge.

### ADR-0003 — Adopt current production as Single Source of Truth (reject monorepo restructure)

**Status:** ✅ Accepted (2026-07-04)

The v1 plan proposed a Turborepo + pnpm monorepo with 7 packages. That violates SSOT (multiple packages, multiple builds, multiple deploy units). The current single-package layout (`app/`) with `app/server/` for the API is canonical.

### ADR-0004 — Apply `0024_production_hardening.sql` migration

**Status:** ✅ Accepted (2026-07-04)

Pre-2026-07-04 the live `noufex_db` had drifted from documented SSOT in 8 places (missing NOT NULL, missing indexes, missing GRANTs, soft-delete holes). Migration `0024_production_hardening.sql` closes all 8.

### ADR-0005 — Use TypeScript Project References

**Status:** ✅ Accepted (2026-07-05)

Four tsconfigs (`root`, `app`, `node`, `server`) with Project References. Rejects the `tsconfig.base.json` pattern (which would create two parallel sources of truth).

### ADR-0006 — Migrate auth token storage from `localStorage` to HttpOnly cookie

**Status:** ✅ Accepted (2026-07-09)

`localStorage` Bearer tokens are readable by any JS executing in the origin (XSS in a vendored package would leak every active session). The new model: server sets `Secure; HttpOnly; SameSite=Strict` cookie; SPA sends `credentials: 'include'`; cookie travels automatically. Closes Risk #6 in §5.1. CSRF mitigated by `SameSite=Strict`.

### ADR-0007 — Adopt OWASP API Top 10 + ISO/IEC 25010 + NIST SSDF as the conformance baseline

**Status:** ✅ Accepted (2026-07-11)

Three complementary standards covering runtime API risk (OWASP), software product quality (ISO 25010), and secure development practices (NIST SSDF). Quarterly re-issue; tracked in §5.2.

## §4.4 Threat model

We use a simplified **STRIDE** model.

### Assets

| Asset | Sensitivity | Storage |
|---|---|---|
| User passwords | Critical | `users.password_hash` (scrypt) |
| Auth tokens | Critical | HttpOnly cookie (HMAC-SHA256) |
| PII (name, phone, email, address) | High | `users`, `addresses` |
| Payment data | High | `orders`, `payments`, `transactions` |
| Inventory | Medium | `products`, `inventory_log` |
| Reviews | Medium | `reviews` |
| Audit log | High | `admin_audit_log` |
| Backup codes | High | `users.totp_backup_codes` (scrypt hash) |
| Session secrets | Critical | Env vars |

### Threat actors

| Actor | Motivation | Capability |
|---|---|---|
| Anonymous attacker | DOS, scrape, deface SPA | Internet, no creds |
| Authenticated customer | BOLA / BFLA, exfiltration | Valid customer token |
| Authenticated merchant | Tamper competitor data, fake reviews | Valid merchant token |
| Authenticated admin | Insider threat, bulk export | Valid admin token |
| Network attacker (MitM) | Token theft, response tampering | On-path |
| Supply-chain | Backdoor via npm / Docker | Build-time |

## §4.5 Standards & conformance

| Standard | Where mapped |
|---|---|
| [OWASP API Security Top 10 (2023)](https://owasp.org/API-security/editions/2023/en/0x11-t10/) | §3.3.4 |
| [OWASP ASVS 4.0.3](https://owasp.org/www-project-application-security-verification-standard/) | §3.3 + ADR-0007 |
| [ISO/IEC 25010:2011](https://www.iso.org/standard/35733.html) | §4.5.1 |
| [NIST SP 800-218 SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/r1/final) | §4.5.2 |
| [NIST SP 800-53 Rev.5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | §4.5.3 |
| [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) | §3.5 |
| [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) | §3.5 |
| [ISTQB CTFL v4.0](https://www.istqb.org/) | §3.5 |
| [WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/) | ADR-0002, §3.5 |
| [Diátaxis](https://diataxis.fr/) | This document |
| [Keep a Changelog 1.1.0](https://keepachangelog.com/) | CHANGELOG.md |
| [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) | CONTRIBUTING.md |
| [Semantic Versioning 2.0.0](https://semver.org/) | CHANGELOG.md |
| [Contributor Covenant 3.0](https://www.contributor-covenant.org/) | CODE_OF_CONDUCT.md |

### §4.5.1 ISO/IEC 25010 quality profile

| Characteristic | Rating | Notes |
|---|---|---|
| Functional suitability | A | All advertised features present + tested |
| Performance efficiency | B | Main SPA chunk ~117 kB gzip (verified from `app/dist/assets/index-*.js`); recharts code-split into its own chunk (~422 kB) only loaded by admin/reports routes |
| Compatibility | A | PG 17 standard SQL only |
| Usability (dev/operator) | B | Excellent DX; some migration-journal drift in git history |
| Reliability | B | 32 DB triggers enforce invariants (incl. order state machine, atomic coupon redemption, transactions balance); one racy trigger tracked in §5.2 (G-15) |
| Security | B+ | HttpOnly cookies, CSP nonced, audit redaction; scrypt params below current OWASP recommendation (G-2) |
| Maintainability | B- | Strict TS, lint clean, ADR trail |
| Portability | A | Linux + Postgres 17, no platform-specific code |

### §4.5.2 NIST SSDF (SP 800-218) practice coverage

| Practice | Status |
|---|---|
| PO.1 — Security requirements | ✅ Documented in §3.3 + ADR-0007 |
| PO.2 — Roles & responsibilities | ✅ CODEOWNERS, STANDARDS.md, ADR-0003 |
| PO.3 — Toolchains | Partial — needs SCA (`npm audit`/`osv-scanner`) |
| PO.4 — Criteria for security checks | ✅ Coverage thresholds in §3.5 |
| PO.5 — Secure environments | ✅ Docker + tini |
| PS.1 — Code protection | ✅ Branch protection + .gitignore |
| PS.2 — Release integrity | Partial — needs SBOM (G-15) |
| PS.3 — Release archive | ✅ Git tags + release-please |
| PW.1 — Secure design | ✅ Threat model in §4.4 |
| PW.5 — Secure coding | ✅ Strict TS, parameterised SQL, ownership-by-WHERE |
| PW.7 — Review human code | ✅ Lint + CODEOWNERS + ADR-0007 review checklist |
| PW.8 — Test executable code | ✅ Vitest + supertest + axe + e2e (in CI once G-11 lands) |
| PW.9 — Secure settings by default | ✅ `loadEnv()` validates; cookies HttpOnly by default |
| RV.1 — Identify vulnerabilities | ✅ SECURITY.md + dependabot weekly |
| RV.2 — Vulnerability response | ✅ SLA in SECURITY.md |

### §4.5.3 NIST SP 800-53 control family cross-walk

| Family | Mapping |
|---|---|
| AC (Access Control) | users + 2FA + token_version (AC-2/3/6/14) |
| AU (Audit) | `admin_audit_log` + `write_audit_log` SECURITY DEFINER + 2-year retention (AU-2/3/9/11) |
| CM (Configuration) | docker image + tsconfig.strict + ADRs (CM-2/3/7) |
| IA (Identification & Auth) | user_id everywhere + scrypt + 2FA (IA-2/2.1/4/5/5.1/8) |
| SC (System & Comms Protection) | TLS at proxy + scrypt/HMAC (SC-8/13/28) |
| SI (System & Info Integrity) | dependabot + structured logs + Zod (SI-2/4/10) |
| SR (Supply Chain) | dependabot + (SBOM pending — G-15) (SR-3/4) |

---

# §5. Planning

## §5.1 Risk register

> Severity: 🔴 blocker · 🟠 high · 🟡 medium · 🟢 low.
> Likelihood: ‽ very high · ⁺ high · ~ medium · - low.

### 🔴 ‽ Single-process Express server (no horizontal scaling)

Rate limiting and session-like state live in Postgres (rate_limits + used_jtis). A single Express process means scaling out requires a Redis swap that's not yet engineered.

**Mitigation:** Rate limits live in `rate_limit_buckets` with a 60 s cleanup job. Multi-process won't double-charge once every process sees the same DB. The Redis swap is **G-13** in §5.2; until then stay at one replica.

### 🔴 ⁺ PostgreSQL is the only durable store

No read replicas, no automated failover, no PITR. A single Postgres host crash kills the product.

**Mitigation:** Nightly `pg_dump` to object storage (§2.7). All writes go through `db.tx(...)` for atomicity. The DB connection lives in a singleton `PgDb` instance with reconnect on failure.

**Follow-up:** scheduled PITR via Barman or managed RDS. Tracked but not funded.

### 🟠 ⁺ HttpOnly-cookie migration half-finished (closed 2026-07-09)

Was: 🟠 ⁺ localStorage token leaks via XSS. JWTs in `localStorage` were readable by any JS executing in the same origin.

**Closure (2026-07-09):** SPA no longer stores the auth token in `localStorage`. The session is now `Secure; HttpOnly; SameSite=Strict` cookie set by the server and consumed via `credentials: 'include'`. See ADR-0006.

**Residual:** G-3 (doc drift) and G-24 (Bearer fallback removal) tracked in §5.2.

### 🟠 ~ CSRF exposure on cookie-authed routes

`SameSite=Strict` blocks the dominant CSRF vectors (top-level GET cross-site, form POST from third-party origin). It does **not** cover sub-domain takeovers or future OAuth/3DS redirect flows.

**Mitigation:** `SameSite=Strict` on every auth cookie. `extractAuthToken` reads the `noufex_token` cookie first.

**Follow-up:** double-submit token (or `Sec-Fetch-Site: same-origin` allow-list) on every `POST/PATCH/DELETE` before any cross-domain integration.

### 🟠 ~ Postgres connection pool exhaustion

The single `pg.Pool` is sized to default (10 connections). Under traffic spikes we can starve.

**Mitigation:** All queries use `db.prepare(...).all/get/run` — no per-request transient pools. Pessimistic timeouts on every route.

**Follow-up:** pool size in env, slow-query alert (> 5 s = page).

### 🟡 ⁺ SPA bundle size regressions

Vite emits one large `index-<hash>.js` (~390 kB / 117 kB gzip). Adding heavy dependencies to top-level pages inflates TTI for first-time visitors on slow 3G.

**Mitigation:** Every page is `React.lazy()`; recharts is code-split into its own chunk and only loaded by admin/reports routes.

**Follow-up:** Lighthouse CI on PRs (tracked in §5.2).

### 🟡 ~ Mock data leakage to production builds

Several components keep mock fallbacks (e.g. `chartData` in `AdminOverview.tsx`) for time-series buckets that no endpoint currently exposes.

**Mitigation:** Every mock fallback has a `// TODO:` comment naming the missing endpoint. Distinctive names (`mockOrders`, `revenueData`) are greppable.

**Follow-up:** CI check that warns when a `mock*` variable is declared under `app/src/pages/admin/`.

## §5.2 Roadmap

> **Severity:** 🔴 P0 (7-day SLO) · 🟠 P1 (30-day SLO) · 🟡 P2 (90-day SLO).

### P0 — must-fix before next deploy (6 open)

| ID | Where | Action |
|---|---|---|
| **G-3** | `docs/architecture/security.md` (done), `SECURITY.md` (done), `useApi.ts`, `client.ts` | Remove Bearer fallback; update docstring |
| **G-9** | `SECURITY.md` (done) | Rewrite §"Authentication" to describe HttpOnly cookies |
| **G-15** | `database/migrations/0028_*` | Add `FOR UPDATE` on the previous-balance lookup in `trg_transactions_check_balance_after` |
| **G-18** | `database/schema.sql:300` | Replace `UNIQUE (user_id, product_id, variant_id)` with two partial unique indexes (NULL + non-NULL) |
| **G-19** | `database/seed.sql` + `scripts/db/db-setup.cjs` | Harden `noufex.allow_seed` gate (role + GUC combination) |
| **G-20** | `database/migrations/0027_*` + `0020_*` | Allow `webhook_events.processing_state IN ('received','processed','failed')`; tighten RLS |

### P1 — should-fix this quarter (13 open)

**Auth / security hardening:** G-1 RLS on user-data tables · G-2 scrypt `N=131072` · G-4 append `.strict()` to 7 schemas · G-5 per-user rate limit · G-7 fail-closed CORS in prod · G-24 drop `Authorization` allow-list in client · G-25 remove `localStorage.setItem('noufex_token', …)` from tests.

**Database integrity:** G-21 drop `users_phone_key` UNIQUE · G-22 revoke direct INSERT/UPDATE on `admin_audit_log` · G-23 add 9 missing FK indexes · G-26 lock previous-balance in refunds resolve.

**Process / CI:** G-11 e2e PowerShell in CI · G-13 `npm audit` + `osv-scanner` step.

### P2 — next quarter (11 open)

G-6 cart/notifications by cookie · G-8 CSP `report-uri` · G-10 OpenAPI artifact · G-12 webhook signature verify · G-14 coverage gate · G-15 SBOM/provenance · G-16 security PR checklist · G-17 vuln-response SLA doc · G-27 logout cache race · G-28 `WHERE 1=1` rewrite · G-29 collapse `/api/products/:id` queries · G-30 collapse `/api/stats/home` queries.

### Verification cookbook

```bash
# Cookie-auth migration complete
grep -r 'Bearer' app/src/                                       # expect 0
grep -i 'csrf-proof\|no session cookies' .github/SECURITY.md     # expect 0

# DB invariants
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE conrelid='cart_items'::regclass;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_indexes WHERE indexname IN ('idx_order_items_variant','idx_cart_items_variant','idx_reviews_order','idx_messages_order','idx_disputes_resolved_by','idx_refunds_payment','idx_refunds_resolved_by','idx_used_jtis_user','idx_search_logs_user');"   # expect 9

# Rate limits
psql "$DATABASE_URL" -c "SELECT bucket, COUNT(*) FROM rate_limit_buckets GROUP BY 1 ORDER BY 2 DESC LIMIT 10;"

# CSP / CORS
curl -sI "$BASE_URL/api/health" | grep -i 'content-security-policy:'
curl -sI -H "Origin: https://evil.example" "$BASE_URL/api/health" | grep -i 'access-control-allow'

# Test suite
cd app && npm run typecheck && npm run lint && npm run test:unit && npm run test:a11y
```

---

## Document control

| Field | Value |
|---|---|
| Version | 3.0 (consolidated 2026-07-11) |
| Compiled from | `docs/architecture/*`, `docs/development/*`, `docs/operations/*`, `docs/testing/*`, `docs/planning/*`, `docs/audits/*`, `docs/tutorials/*` — all consolidated into this single document |
| Standards | [Diátaxis](https://diataxis.fr/) + [Keep a Changelog](https://keepachangelog.com/) + [Conventional Commits](https://www.conventionalcommits.org/) + [Contributor Covenant 3.0](https://www.contributor-covenant.org/) + [OWASP API Top 10 (2023)](https://owasp.org/API-security/editions/2023/en/0x11-t10/) + [ISO/IEC 25010](https://www.iso.org/standard/35733.html) + [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/r1/final) |
| Up | [README.md](../README.md) · [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../.github/CONTRIBUTING.md) · [SECURITY.md](../.github/SECURITY.md) · [CODE_OF_CONDUCT.md](../.github/CODE_OF_CONDUCT.md) |
