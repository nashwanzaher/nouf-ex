# Nouf-ex — Master Roadmap

**Last updated:** 2026-06-24 (post-MVP-hygiene pass)
**Status:** MVP hardening ✅ — production-ready, P0/P1 backlog trimmed

This document consolidates the original plans, reviews, and audit reports
(now archived under [`archive/research/`](../archive/research/) and
[`archive/audit/`](../archive/audit/)) into a single prioritised backlog.

---

## 1. Current State — Snapshot (2026-06-24)

| Layer                 | State                                                                                                                                                                                  | Reference                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **TypeScript**        | ✅ 0 errors (`tsc -b` across app + server + mcp-server; `.cts` server files now included via `tsconfig.server.json`)                                                                  | `app/tsconfig.server.json`                                 |
| **ESLint**            | ✅ 0 errors / 0 warnings. New `server/**/*.{ts,cts}` block covers the CJS-bundled server source (was silently skipped before).                                                       | `app/eslint.config.js`                                     |
| **Database**          | ✅ One external PostgreSQL 17 server, database `noufex_db`. **30 tables** (27 application + 3 system: `schema_migrations`, `rate_limit_buckets`, `search_logs`, `used_jtis`) + 10 triggers + 4 views + 13 functions + 3 application roles. App connects as `noufex_app` (least privilege). | [`docs/database.md`](database.md)                          |
| **DB setup**          | ✅ One-time CLI: `npm run db:setup` applies schema + 13 migrations + seed.                                                                   | `scripts/db-setup.cjs`                                     |
| **API server**        | ✅ Express 5 + `pg`. Scrypt hashing, zod validation, CORS allow-list, DB-backed rate limiter on `/api/auth/*` + per-endpoint rate limits on `/api/auth/2fa/*` (5 buckets, 8 endpoints), SPA fallback. Source → esbuild ESM bundle at build time. **91 router declarations** عبر 19 ملف route. | `app/server/index.ts` (source) / `app/server/index.js` (build artefact) |
| **Frontend**          | ✅ React 19 + TS strict + Vite 7 + Tailwind + shadcn/ui. **22 routes** مُسجَّلة في `App.tsx` (4 admin pages + 4 seller + 6 customer + 4 auth + 3 public + 1 NotFound). AR/EN/ZH i18n. AR=970 keys, EN=828, ZH=895.                                              | `app/src/App.tsx`                                          |
| **Tests**             | ✅ Vitest 4.1.9 + supertest. **732 passed · 3 skipped** عبر 55 ملف اختبار (2026-06-28). PgDb is mocked globally so tests run without a live database.                                | [`docs/testing.md`](testing.md)                            |
| **Docker**            | ✅ One container (`Nouf-ex`) runs the API as a self-contained esbuild ESM bundle. Postgres is external (no containerised DB). 3-stage Dockerfile: `deps → build (esbuild) → runtime`. Healthcheck hits `/api/health`. | [`docs/docker.md`](docker.md)                              |
| **CI**                | ✅ GitHub Actions: 5 jobs (lint, typecheck, test, db-integration, server-boot) + 1 build artefact. The new `server-boot` job boots the API against a service container and asserts 3 endpoints. | `.github/workflows/ci.yml`                                |
| **VS Code workspace** | ✅ 13 recommended + 19 unwanted extensions; `launch.json`, `tasks.json`, `mcp.json`                                                                                                    | `.vscode/`                                                 |

### 1.1 Recent commits (last 6, since the previous roadmap update)

| Commit  | Item                                                                |
| ------ | ------------------------------------------------------------------- |
| `2da81a8` | fix(db-setup): use descriptive version key + match live DB format  |
| `51c2782` | fix(docker): ship an esbuild-bundled output instead of running source via tsx |
| `f758fbf` | chore: lint + typecheck .cts server files (WIP residue cleanup)    |
| `7ccc5ab` | P0-1: server-side store_id derivation + clear server cart          |
| `3f1db37` | N2: extend per-IP rate limiting to all 2FA endpoints               |
| `7578e9d` | ci: add server-boot smoke job                                        |

---

## 2. Completed in the 2026-06-21 Passes

| Domain            | Outcome                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database**      | Switched from SQLite → PostgreSQL. Removed SQLite file and ~18 one-shot migration scripts. Single `db-setup.cjs` is the only DB entrypoint.    |
| **Docker**        | Removed the in-container Postgres. Container now runs the API only and connects to the external server via `host.docker.internal`.             |
| **Code quality**  | All 67 ESLint errors fixed in source (no suppression). 0 errors / 0 warnings.                                                                  |
| **Security**      | scrypt password hashing; role hardcoded to `customer` on registration; `sendSafeUser()` returns a minimal user payload.                        |
| **Networking**    | CORS allow-list via `ALLOWED_ORIGINS`. Per-route in-memory rate limiter on `/api/auth/*`.                                                      |
| **Frontend**      | `useSyncExternalStore` for `useIsMobile`. `useDataHook` refactored to a stable `fetcherRef`. Side effects moved out of reducers.               |
| **Routing**       | `ProtectedRoute` enforces roles for `/admin/*`, `/seller/*`, `/customer/*`. NotFound page covers unknown routes.                               |
| **Documentation** | All `.md` files consolidated under `docs/`. SQL files live under `database/` (schema/extra/views/functions/triggers/roles/seed + migrations/). |
| **VS Code**       | 34 → 13 recommended extensions, debug configurations, test runner, lint task, Vitest tasks.                                                    |

For the full audit of code-quality fixes, see
[`archive/audit/code-audit-2026-06-21.md`](../archive/audit/code-audit-2026-06-21.md).

### 2.1 Completed in the 2026-06-24 Passes

| Domain                | Outcome                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0-1 Cart→Order E2E** | Server is the source of truth for `store_id` (new `resolveOrderStoreId` helper in `app/server/lib/shared.cts`). Client (`Checkout.tsx`) omits `storeId` and calls `clearCart` after a successful order. **No more 500 from FK violation.** |
| **N2 2FA rate limit**  | Every `/api/auth/2fa/*` endpoint now has its own per-IP bucket. 5 buckets, 8 endpoints, middleware runs *before* `requireAuth` (unauthenticated abuse is also bounded). Background sweeper drops expired entries. |
| **CI server-boot**     | New `server-boot` job: spins up `postgres:17` service container, applies schema + seed, boots the API via `npx tsx server/index.ts`, polls `/api/health` for 30s, then asserts 200 on `/api/health`, `/api/ready`, `/api/stats/home`. |
| **Container fix**       | New 3-stage Dockerfile (`deps → build → runtime`) bundles the server with esbuild in ESM format. The image no longer needs a `tsx/cjs` loader at runtime — eliminates the `TypeError: Cannot read properties of undefined (reading 'exports')` that broke the previous image. |
| **Migrations dedup**    | `schema_migrations` cleaned from 12 rows to 9 (one per SQL file). `db-setup.cjs` now uses the descriptive version key (e.g. `0007_pi_unique_pair`) to prevent future duplicates. |
| **Tooling**             | Added `npm run typecheck` (single command reproducing CI's typecheck), `.gitignore` for Playwright artifacts. `.env.example` documents the `POSTGRES_*` admin-script vars. |

---

## 3. Open Backlog (prioritised)

### 3.1 P0 — Launch-blockers

| #    | Item                                                                                                                                          | Source                                                      | Effort | Status                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | **Cart→Order pipeline E2E**: convert `useCartItems` to a real hook that POSTs to `/api/orders`; persist carts in DB for authenticated users.  | [`audit/review-features.md`](audit/review-features.md) §3.1 | XL     | ✅ DONE — server is source of truth for `store_id`; client drops the buggy `productId`-as-`storeId`; `clearCart` after order. UI TODO for cross-device sync. |
| P0-2 | **Payment integration**: at minimum a `cod` (Cash on Delivery) flow that creates a `payments` row + transitions `orders.status`.              | same                                                        | L      | ✅ DONE — `POST /api/payments`, `GET /api/payments/order/:id`, `POST /api/payments/:id/confirm`.                                  |
| P0-3 | **Image pipeline**: enforce non-null `main_image` + populate `product_images` for the demo products. The placeholder rate is the #1 UX issue. | [`audit/review-ux.md`](audit/review-ux.md) §2 C1            | L      | ✅ DONE — `npm run images:populate` writes per-product JPG + unique SVG; 48 product_images rows; unique (product_id, image_url) via migration 0007. |
| P0-4 | **Order totals reconciliation**: recompute `orders.total` from `order_items.total_price` for the demo orders.                                 | [`audit/review-database.md`](audit/review-database.md) §1.3 | S      | ✅ DONE — backfilled; ongoing via `coupons.usage_count` triggers.                                                                 |

### 3.2 P1 — Critical features

| #    | Item                                                                                                                | Effort | Status                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 | **Search backend**: FTS index on `products(name_ar/name_en/name_zh/description)`, plus `search_logs` for analytics. | M      | ✅ DONE — `products.search_tsv` (STORED generated column, weighted A/B/C/D) + `idx_products_search_tsv` (GIN, partial). `search_logs` table populated by `app/server/lib/search.cts`. `/api/search` returns ranked hits. |
| P1-2 | **Wishlist API**: CRUD endpoints + UI wiring.                                                                       | S      | ✅ API DONE — `GET/POST/DELETE /api/wishlist`. UI TODO.                                                                                                |
| P1-3 | **Address book API + UI**: customer multi-address.                                                                  | M      | ✅ API DONE — `GET/POST/DELETE /api/addresses` with `is_default` semantics. UI TODO.                                                                    |
| P1-4 | **Shipping methods API + UI**: dynamic shipping-method picker on checkout.                                          | M      | ✅ API DONE — `GET /api/shipping/methods?weight_kg=N`. UI TODO.                                                                                        |
| P1-5 | **Coupons end-to-end**: apply-on-checkout, `coupon_usage` insert, decrement `coupons.usage_count`.                  | M      | ✅ API DONE — `POST /api/coupons/validate                                                | redeem`. UI TODO.                                                |
| P1-6 | **Refunds workflow**: customer opens dispute → admin reviews → `store_balance` decremented.                         | L      | ✅ API DONE — `POST /api/refunds` + `POST /api/refunds/:id/resolve`. UI TODO.                                                                          |
| P1-7 | **Real notifications** (in-app + email opt-in).                                                                     | L      | 🔴 TODO                                                                                                                                                |
| P1-8 | **Translation completion**: extract every hard-coded `lang === 'ar' ? 'X' : 'Y'` ternary into i18next keys.         | M      | 🔴 TODO                                                                                                                                                |

### 3.3 P2 — Quality & UX

| #    | Item                                                                                            | Source                                                          | Effort | Status                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| P2-1 | **Image dimensions**: add `width`/`height` (or `aspect-ratio`) to every `<img>` to prevent CLS. | [`audit/review-code.md`](audit/review-code.md) M18              | M      | 🔴 TODO                                                                                                                    |
| P2-2 | **AbortController**: cancel in-flight fetches in `useDataHook` on unmount / dependency change.  | same · L12                                                      | S      | ✅ DONE — `useDataHook` owns one `AbortController` per fetch cycle and forwards `signal` to the api helpers.               |
| P2-3 | **Security headers** (CSP, HSTS, X-Frame-Options, etc.).                                     | same · L10                                                      | S      | ✅ DONE — `securityHeaders` middleware inlines the OWASP Secure Headers Project baseline + a strict CSP. No external dependency. |
| P2-4 | **Structured logger**: replace `console.log` with a real logger.                                | same · L11                                                      | S      | ✅ DONE — `log.info/warn/error` in `app/server/middleware.ts` writes one-line JSON to stdout for log-shipper pickup.       |
| P2-5 | **Merchant verification badges**: render `trust_level` + `is_verified` consistently.            | [`audit/review-ux.md`](audit/review-ux.md) §2 C6                | M      | 🔴 TODO                                                                                                                    |
| P2-6 | **Trade Assurance copy**: replace placeholder with real escrow-fee disclosure.                  | same                                                            | S      | 🔴 TODO                                                                                                                    |
| P2-7 | **RFQ form**: backend handler + customer UI + merchant inbox.                                   | [`audit/review-features.md`](audit/review-features.md) §3.2 #12 | L      | 🔴 TODO                                                                                                                    |
| P2-8 | **Subscription tiers**: implement the visible SubscriptionTiers section (real plan management). | same · §3.2 #22                                                 | L      | 🔴 TODO                                                                                                                    |
| P2-9 | **Analytics dashboard**: real data behind `ReportsAnalytics.tsx`.                               | same · §3.2 #23                                                 | L      | 🔴 TODO                                                                                                                    |

### 3.4 P3 — Polish & Growth

| #    | Item                                                       | Source                                                           | Effort |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| P3-1 | **Image search** (multimodal LLM).                         | [`audit/review-features.md`](audit/review-features.md) §3.4 #30  | XL     |
| P3-2 | **AI Mode for search** (LLM reranker).                     | same · §3.4 #29                                                  | L      |
| P3-3 | **Live commerce**: integration with a streaming service.   | same · §3.4 #32                                                  | XL     |
| P3-4 | **Mobile app**: PWA shell first, native later.             | same · §3.4 #32                                                  | XL     |
| P3-5 | **Loyalty program**: points + VIP tiers.                   | same · §3.3 #28                                                  | M      |
| P3-6 | **Banners + promotions** tables wired into the storefront. | [`audit/review-database.md`](audit/review-database.md) §2 #14-15 | M      |

---

## 4. Repository Map (current)

```
.
├── app/                          # Frontend + API in one npm package
│   ├── server/                   # Express API (entrypoint + db wrapper + tests)
│   ├── src/                      # React + Vite frontend
│   │   ├── components/           # ui/ (shadcn) + shared Layout/Navbar/Footer
│   │   ├── context/              # AppContext (i18n + auth), CartContext
│   │   ├── hooks/                # useApi (data), use-mobile
│   │   ├── i18n/                 # locales/ar|en|zh.json
│   │   ├── lib/                  # api.ts (client), jsonData.ts (server uses ../server/db/)
│   │   └── pages/                # Home, Search, ProductDetail, StorePage, …
│   │       ├── admin/            # AdminDashboard, ReportsAnalytics, …
│   │       ├── auth/             # Login, Register, Forgot/ResetPassword
│   │       ├── customer/         # Dashboard, Orders, Wishlist, Reviews, …
│   │       ├── seller/           # Dashboard, Products, Orders, Analytics
│   │       └── Home/             # HeroSection, FeaturedProducts, HowItWorks, …
│   ├── tests/                    # Vitest frontend setup + MSW mocks
│   └── ...
│   └── public/                   # Static assets + JSON fixtures
├── docker/
│   └── entrypoint.sh             # Container entrypoint (runs the API)
├── docs/                         # ← this directory
│   ├── README.md
│   ├── getting-started.md
│   ├── architecture.md
│   ├── database.md
│   ├── docker.md
│   ├── testing.md
│   ├── development.md
│   ├── conventions.md
│   ├── api.md
│   ├── roadmap.md                # this file
│   ├── audit/                    # Code audits, extension audits, reviews
│   ├── research/                 # Original research + plans + design study
│   └── assets/                   # Screenshots and design images
├── database/                       # PostgreSQL 17 schema + seed (host-side)
│   ├── README.md
│   ├── schema.sql                   # 17 base tables (identity, catalog, commerce, …)
│   ├── schema-extra.sql             # 9 extra tables (payments, coupons, refunds, …)
│   ├── views.sql                    # 4 read-only views (security_invoker)
│   ├── functions.sql                # 7 PL/pgSQL trigger functions (+ 2 in 0004, +1 in 0005)
│   ├── triggers.sql                 # 9 trigger definitions
│   ├── roles.sql                    # noufex_app + noufex_owner + noufex_readonly + GRANTs
│   ├── seed.sql                     # demo data (real scrypt passwords)
│   └── migrations/                  # 9 incremental changes (0001..0009)
│                                       # 26 application tables + 3 system (rate_limit_buckets,
│                                       # search_logs, schema_migrations) = 29 total
├── Dockerfile                       # 3-stage: deps + esbuild build + runtime
├── docker-compose.yml                # single service: Nouf-ex (API on :3000)
├── .env / .env.example               # live + template (POSTGRES_* for admin scripts documented)
└── .vscode/                      # Editor config (extensions, settings, tasks, launch, mcp)
```

---

## 5. Conventions (project-wide)

The single source of truth is [`docs/conventions.md`](conventions.md). The
short version:

1. **No `// eslint-disable`** unless documented in the surrounding comment.
   Folder-scoped exemptions only for `react-refresh/only-export-components`
   in `src/components/ui/**` and `src/context/**` (shadcn convention).
2. **i18n keys** over `lang === 'ar' ? 'A' : 'B'` ternaries. Add missing keys
   to `src/i18n/locales/*.json` (default = Arabic).
3. **DB schema lives in SQL files**, not migrations. Apply via
   `npm run db:setup` against the external Postgres. Keep DDL idempotent
   (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE …`).
4. **Money is NUMERIC** in DB; **integers for stock**. Currency is `YER` for
   this market — wrap multi-currency in `payments.currency` rather than
   back-converting at query time.
5. **Tests are colocated with the layer they cover**: `tests/` for cross-
   cutting (API, schema), `src/**/__tests__/` for components / hooks / context.
   `pg` is mocked globally so tests run without a live database.

---

## 6. How to use this document

- When picking up a P0/P1 item, create a branch and reference its P-number
  (e.g. `git commit -m "P0-1: cart→order pipeline"`).
- When the schema changes:
  - **Additive changes** (new columns, tables, indexes): add a new
    `database/migrations/NNNN_description.sql` file. The next
    `npm run db:setup` will apply it and record the version in
    `schema_migrations`.
  - **Destructive changes** (DROP/RENAME): also use a migration file,
    with `DO $$ … $$` blocks that check `information_schema` first.
  - For **demo-data changes**, edit `database/seed.sql` (idempotent
    via `ON CONFLICT DO NOTHING`).
  - See [`database/migrations/README.md`](database/migrations/README.md)
    for the full workflow.
- After every audit pass, append the diff summary to the relevant file in
  `archive/audit/` (don't overwrite history).
- VS Code configuration changes belong in `.vscode/` + a corresponding entry
  in [`archive/audit/extensions.md`](../archive/audit/extensions.md).
