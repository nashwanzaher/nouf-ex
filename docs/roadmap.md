# Nouf-ex — Master Roadmap

**Last updated:** 2026-06-21 (post-cleanup pass)
**Status:** Pre-MVP → MVP hardening in progress

This document consolidates the original plans, reviews, and audit reports
(now archived under [`docs/research/`](research/) and
[`docs/audit/`](audit/)) into a single prioritised backlog.

---

## 1. Current State — Snapshot (2026-06-21)

| Layer                 | State                                                                                                                                                                     | Reference                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **TypeScript**        | ✅ 0 errors                                                                                                                                                               | `tsc -b` (app + node + server projects) |
| **ESLint**            | ✅ 0 errors / 0 warnings                                                                                                                                                  | 67 → 0 in audit pass                    |
| **Database**          | ✅ One external PostgreSQL 17 server, database `noufex_db`. **27 tables** + 60+ indexes + 9 triggers + 4 views + 3 roles. App connects as `noufex_app` (least privilege). | [`docs/database.md`](database.md)       |
| **DB setup**          | ✅ One-time CLI: `npm run db:setup` applies schema + seed                                                                                                                 | `scripts/db-setup.cjs`                  |
| **API server**        | ✅ Express 5 + `pg`. Scrypt hashing, zod validation, CORS allow-list, in-memory rate-limiter, SPA fallback.                                                               | `app/server/index.ts`                   |
| **Frontend**          | ✅ React 19 + TS strict + Vite 7 + Tailwind + shadcn/ui. 23 routes. AR/EN/ZH i18n.                                                                                        | `app/src/App.tsx`                       |
| **Tests**             | ✅ Vitest + supertest. PgDb is mocked; no live DB required to run tests.                                                                                                  | [`docs/testing.md`](testing.md)         |
| **Docker**            | ✅ One container runs the API only. Postgres is external.                                                                                                                 | [`docs/docker.md`](docker.md)           |
| **VS Code workspace** | ✅ 13 recommended + 19 unwanted extensions; `launch.json`, `tasks.json`                                                                                                   | `.vscode/`                              |

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
[`docs/audit/code-audit-2026-06-21.md`](audit/code-audit-2026-06-21.md).

---

## 3. Open Backlog (prioritised)

### 3.1 P0 — Launch-blockers

| #    | Item                                                                                                                                          | Source                                                      | Effort | Status                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| P0-1 | **Cart→Order pipeline E2E**: convert `useCartItems` to a real hook that POSTs to `/api/orders`; persist carts in DB for authenticated users.  | [`audit/review-features.md`](audit/review-features.md) §3.1 | XL     | 🔴 TODO                                                                                          |
| P0-2 | **Payment integration**: at minimum a `cod` (Cash on Delivery) flow that creates a `payments` row + transitions `orders.status`.              | same                                                        | L      | ✅ DONE — `POST /api/payments`, `GET /api/payments/order/:id`, `POST /api/payments/:id/confirm`. |
| P0-3 | **Image pipeline**: enforce non-null `main_image` + populate `product_images` for the demo products. The placeholder rate is the #1 UX issue. | [`audit/review-ux.md`](audit/review-ux.md) §2 C1            | L      | ✅ DONE — `npm run images:populate` writes per-product JPG + unique SVG; 48 product_images rows; unique (product_id, image_url) via migration 0007. |
| P0-4 | **Order totals reconciliation**: recompute `orders.total` from `order_items.total_price` for the demo orders.                                 | [`audit/review-database.md`](audit/review-database.md) §1.3 | S      | ✅ DONE — backfilled; ongoing via `coupons.usage_count` triggers.                                |

### 3.2 P1 — Critical features

| #    | Item                                                                                                                | Effort | Status                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ | ----------------- |
| P1-1 | **Search backend**: FTS index on `products(name_ar/name_en/name_zh/description)`, plus `search_logs` for analytics. | M      | 🔴 TODO                                                                              |
| P1-2 | **Wishlist API**: CRUD endpoints + UI wiring.                                                                       | S      | ✅ API DONE — `GET/POST/DELETE /api/wishlist`. UI TODO.                              |
| P1-3 | **Address book API + UI**: customer multi-address.                                                                  | M      | ✅ API DONE — `GET/POST/DELETE /api/addresses` with `is_default` semantics. UI TODO. |
| P1-4 | **Shipping methods API + UI**: dynamic shipping-method picker on checkout.                                          | M      | ✅ API DONE — `GET /api/shipping/methods?weight_kg=N`. UI TODO.                      |
| P1-5 | **Coupons end-to-end**: apply-on-checkout, `coupon_usage` insert, decrement `coupons.usage_count`.                  | M      | ✅ API DONE — `POST /api/coupons/validate                                            | redeem`. UI TODO. |
| P1-6 | **Refunds workflow**: customer opens dispute → admin reviews → `store_balance` decremented.                         | L      | ✅ API DONE — `POST /api/refunds` + `POST /api/refunds/:id/resolve`. UI TODO.        |
| P1-7 | **Real notifications** (in-app + email opt-in).                                                                     | L      | 🔴 TODO                                                                              |
| P1-8 | **Translation completion**: extract every hard-coded `lang === 'ar' ? 'X' : 'Y'` ternary into i18next keys.         | M      | 🔴 TODO                                                                              |

### 3.3 P2 — Quality & UX

| #    | Item                                                                                            | Source                                                          | Effort |
| ---- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| P2-1 | **Image dimensions**: add `width`/`height` (or `aspect-ratio`) to every `<img>` to prevent CLS. | [`audit/review-code.md`](audit/review-code.md) M18              | M      |
| P2-2 | **AbortController**: cancel in-flight fetches in `useDataHook` on unmount / dependency change.  | same · L12                                                      | S      | ✅ DONE — `useDataHook` owns one `AbortController` per fetch cycle and forwards `signal` to the api helpers.         |
| P2-3 | **Helmet.js**: add security headers (CSP, HSTS, X-Frame-Options).                               | same · L10                                                      | S      | ✅ DONE — `securityHeaders` middleware inlines the OWASP Secure Headers Project baseline + a strict CSP.             |
| P2-4 | **Structured logger**: replace `console.log` with a real logger.                                | same · L11                                                      | S      | ✅ DONE — `log.info/warn/error` in `app/server/middleware.ts` writes one-line JSON to stdout for log-shipper pickup. |
| P2-3 | **Helmet.js**: add security headers (CSP, HSTS, X-Frame-Options).                               | same · L10                                                      | S      |
| P2-4 | **Structured logger**: replace `console.log` with a real logger.                                | same · L11                                                      | S      |
| P2-5 | **Merchant verification badges**: render `trust_level` + `is_verified` consistently.            | [`audit/review-ux.md`](audit/review-ux.md) §2 C6                | M      |
| P2-6 | **Trade Assurance copy**: replace placeholder with real escrow-fee disclosure.                  | same                                                            | S      |
| P2-7 | **RFQ form**: backend handler + customer UI + merchant inbox.                                   | [`audit/review-features.md`](audit/review-features.md) §3.2 #12 | L      |
| P2-8 | **Subscription tiers**: implement the visible SubscriptionTiers section (real plan management). | same · §3.2 #22                                                 | L      |
| P2-9 | **Analytics dashboard**: real data behind `ReportsAnalytics.tsx`.                               | same · §3.2 #23                                                 | L      |

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
│   ├── schema.sql                   # 16 base tables
│   ├── schema-extra.sql             # 9 extra tables (payments, coupons, refunds, …)
│   ├── views.sql                    # 4 read-only views (security_invoker)
│   ├── functions.sql                # 7 PL/pgSQL trigger functions
│   ├── triggers.sql                 # 9 trigger definitions
│   ├── roles.sql                    # noufex_app + noufex_owner + noufex_readonly + GRANTs
│   ├── seed.sql                     # demo data (real scrypt passwords)
│   └── migrations/                  # incremental schema changes (NNNN_*.sql)
├── Dockerfile
├── docker-compose.yml
├── .env / .env.example
└── .vscode/                      # Editor config (extensions, settings, tasks, launch)
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
  `docs/audit/` (don't overwrite history).
- VS Code configuration changes belong in `.vscode/` + a corresponding entry
  in [`docs/audit/extensions.md`](audit/extensions.md).
