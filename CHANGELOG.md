# Changelog

> **Format:** [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/) ·
> **Versioning:** [Semantic Versioning 2.0.0](https://semver.org/) ·
> **Last updated:** 2026-06-28

All notable changes to **Nouf-ex** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **2026-06-29** — `app/src/lib/format.ts` + 5 pages — **K.3 complete**.
  Created the central `formatMoney(amount, options)` helper and
  `formatMoneyCompact()` (k/m suffixes) and `parseMoney()` (Arabic-Indic
  digit support). Supports `YER` (default), `USD`, `SAR`, `AED`, `EUR`
  out of the box via the `Currency` type. Replaced **8 hardcoded `} YER`
  literals** in Checkout (4), SellerDashboard (3 in KpiCard + 2 inline
  in OrderRow/ProductRow), CustomerDashboard, CustomerOrders, and
  Wishlist. Also deleted 3 duplicate `formatYER/formatYer` helpers.
  Added **20 unit tests** in `src/lib/__tests__/format.test.ts`
  covering: locale-specific digit formatting (Arabic-Indic), currency
  symbol selection per language, k/m compact format, NaN/Infinity
  safety, and Arabic-Indic digit parsing (٠-٩, ٫, ٬).
  **Bonus: fixed pre-existing Checkout test failure** (`shows the cart
total in the summary` was failing due to locale-aware `toLocaleString()`
  producing different output in different Node.js versions).
- **2026-06-29** — `app/src/i18n/locales/{en,ar,zh}.json` — **K.2 complete**.
  Added **171 i18n keys** to each locale (en went from 828 → 999 keys).
  These are the keys referenced by `t('...', fallback)` calls in the
  React codebase that were missing from all three locales. Most notable
  additions: `seller.dashboard.*` (12), `seller.*` product-wizard (64),
  `seller.*` orders page (18), `seller.*` analytics page (14),
  `addresses.*` (21), `nav.*` (5), `search.ui.*` (4), `product.badge.*` (2),
  `errors.notFound.*` (2), `home.tradeAssurance` (1), `categories.ui.*` (1).
  Values sourced from the existing English fallbacks in the JSX/TSX;
  ZH/AR values mirror EN (translator review needed for production).
- **2026-06-29** — `app/src/lib/api.ts` + `app/src/hooks/useApi.ts` +
  `app/src/App.tsx` — **K.1 foundation.** Added 12 admin-specific
  TypeScript interfaces (`AdminUser`, `AdminStore`, `AdminProduct`,
  `AdminOrder`, `AdminDispute`, `AdminAuditLogEntry`, `AdminStats`,
  plus 5 update-body types — all mirroring the exact shapes of the
  existing /api/admin/* server responses in
  [`app/server/routes/admin.cts`](app/server/routes/admin.cts)).
  Added 12 client functions: 7 GETs (`getAdminUsers`,
  `getAdminStores`, `getAdminProducts`, `getAdminOrders`,
  `getAdminDisputes`, `getAdminAuditLog`, `getAdminStats`) and 5
  PATCHes (`patchAdminUser`, `patchAdminStore`,
  `patchAdminProduct`, `patchAdminOrderStatus`,
  `patchAdminDispute`). Each wraps `URLSearchParams` for clean query
  construction. Added 7 hooks (`useAdminUsers`, …) that follow the
  exact one-liner pattern of the existing `useSeller*` hooks
  (reusing `useDataHook` for AbortController + 401 handling).
  Added 5 new `<Route>` entries in
  [`App.tsx`](app/src/App.tsx): `/admin/users`, `/admin/overview`,
  `/admin/stores`, `/admin/disputes`, `/admin/reports` — all
  guarded with `role=['admin']`. Page refactor (using these hooks
  + the 6 mock-data arrays) follows in the next commit.
- **2026-06-29** — `app/src/pages/admin/UsersManagement.tsx` — **K.1
  page refactor #1 (UsersManagement).** Removed the 178-line
  `usersData` mock array. Replaced client-side role/status text
  matching with the `useAdminUsers({ role, is_active, limit, offset })`
  hook — the server now does the role/status filtering via SQL
  `WHERE`, the client only handles the free-text search. Added a
  `mapAdminUserToView(user: AdminUser): UserRecord` mapper that
  renames the API fields (`full_name`→`name`, `created_at`→`registeredDate`,
  `last_login`→`lastLogin`) so the table column shape stays unchanged.
  Status enum migrated from the old 3-value `{active, suspended, pending}`
  to the real 3-value `{active, suspended, banned}` from
  `server/routes/admin.cts:46-58` — `pending` is gone (the API never
  had it; the mock added it by mistake). `toggleStatus(user.id)`
  replaced with a real `useCallback(async (target: UserRecord) => {...
  await patchAdminUser(target.id, { status: next }); ... addAppToast({...});
  ... await refetchUsers() })` — wired through the new `useApp()` toast
  with `type: 'success' | 'error'` (the actual Toast interface shape).
  Pagination changed: removed the client-side slice and
  `paginatedUsers` array — the page now trusts the server's
  `usersResponse.total` for `totalPages` and sends `limit` + `offset`
  as query params on every refetch. Dropped the governorate
  filter, store-name column, governorate row in the detail modal,
  and the "إجمالي الطلبات" panel — none of those are exposed by
  the API. Added `formatDate()` and `formatDateTime()` helpers for
  ISO timestamps. `governorates` array + `MapPin` import dropped
  (the modal no longer has a map pin). 768 → 610 lines (-159).
  Validated: `npx tsc` 0 errors, `npx eslint` 0 issues,
  `npx prettier` clean.
- **2026-06-29** — `app/src/hooks/useApi.ts` — **K.5 complete**. Removed **6
  unused hooks** + **5 unused imports**: `useUsers` (read stale
  `/data/users.json` — will be replaced by `useAdminUsers` in K.1),
  `useCartItems` (read localStorage `noufex_cart` — CartContext is
  source of truth), `useServerCart` (replaced by CartContext for
  anonymous users), `useOrder` (no consumer — re-introduce when a
  CustomerOrderDetail page is built), `useFeaturedProducts` /
  `useDeals` (replaced by `useProducts({ featured: true })` /
  `useProducts({ onSale: true })`). File went from 467 → 423 lines
  (-44). The seller hooks (`useSellerStore`, `useSellerProduct`,
  `useSellerOrder`, `useSellerAnalytics`, `useSellerInventory`,
  `useSellerPayouts`) were audited and KEPT — they're needed by the
  upcoming K.1 (Admin pages → API) task.
- **2026-06-29** — **Deep audit + cleanup pass.** After completing K.2
  - K.3 + K.5, a comprehensive ground-truth audit was run. Findings:
    fixed broken `/customer/profile` link in `CustomerSidebar.tsx` (the
    route never existed → pointed to NotFound; user profile data is
    already in `/customer` via `CustomerDashboard`); corrected DB table
    count from 29 → 30 across [`MASTER_PLAN.md`](docs/MASTER_PLAN.md) (5
    occurrences) and [`docs/architecture/database.md`](docs/architecture/database.md);
    rewrote §11.1 numeric claims with verified ground-truth (counted via
    `grep`, `git ls-tree`, etc.); rebalanced §11.3 remaining-tasks count
    to 24 (after deleting the 3 struck-through Done rows from K.2/K.3/K.5);
    added new 🛤️ **5-year technical roadmap** section spanning Pre-Launch
    → Beta (Q3 2026) → PMF (Q4 2026) → Year 1 (2027) → Scale (2028-29) →
    Mature (2030-31), each with concrete file/code references. Real gaps
    filed as K.1 (P0, 4 admin pages still on mock data) and K.6 (5 admin
    pages with no route).

### Changed

- **2026-06-29** — `docs/MASTER_PLAN.md` + `docs/architecture/database.md` —
  Master roadmap corrected: §11.1 KPI table rewritten with **ground-truth
  verified** numbers (TS 0, ESLint 0, Vitest 751 passed, 30 DB tables,
  YER hardcoded 0); §11.3 rebalanced to 24 remaining (K.2/K.3/K.5 rows
  deleted — they were struck-through but still counted in the list);
  DB table count 29 → 30 throughout.
- **2026-06-29** — `docs/MASTER_PLAN.md` — Pre-existing flaky tests
  documented: `Checkout.test.tsx > shows the cart total in the summary`
  and `ProductDetail.test.tsx > renders the product name, price and
store info` fail at `screen.findAllByText(/25,000|12,500/)` due to
  `toLocaleString()` locale-aware formatting breaking the regex match.
  Verified on `main` WITHOUT K.2 changes (same failures). Pre-existing
  test bug, NOT caused by K.2. Tracked in §11.8 Risk Register.
- **2026-06-28** — `docs/MASTER_PLAN.md` — Replaced guessed numbers with values
- **2026-06-28** — `docs/MASTER_PLAN.md` — Replaced guessed numbers with values
  measured directly from the code after running `npm run typecheck/lint/test/build`
  on `main`. Header table now reports: Vitest **4.1.9** (was "Vitest 2"),
  **732 passed · 3 skipped** across 55 test files, **30 unique DB tables**
  (was 29), **13 functions** (was 7), **10 triggers** (was 9), **91 router
  declarations** across 19 route files (was 74), **22 React Router routes**
  (was 23/49). Phase K §2 line counts corrected from guessed 4,800 to measured
  4,742 across 6 admin pages. Phase K §4 hardcoded-YER count corrected from
  "5+ / 7" to verified **8**. Phase K §8 missing-routes count corrected from
  "2" to verified **4** (`/admin/audit-log`, `/admin/products`, `/admin/orders`,
  `/customer/messages`).
- **2026-06-28** — `docs/MASTER_PLAN.md` — PHASE test status table rebuilt
  from actual `tests/reports/phase*.log` files (LastWrite 2026-06-28). Real
  numbers: 00=18/0, 02=42/0, 03=24/0, 04=27/0, 05=**3/12 FAIL**,
  06=**2/10 FAIL**, 07=34/0, 08=**8/12 FAIL**, 09=**5/17 FAIL**,
  12=16/5 (documented), 13=**1/12 FAIL**, 14=19/0, 15=**1/6 FAIL**,
  16=21/0. The optimistic "17 PHASES Done" was based on isolated runs;
  the batch run (PHASE 17 regression) trips the `/api/auth/*` rate-limit
  bucket after PHASE 0-4, causing cascading 401s. Root cause is
  test-infra (no `reset-rate-limit.cjs` between phases), **not** a code bug.
- **2026-06-28** — `docs/architecture/overview.md` — Stack table updated
  to Vitest 4.1.9 with verified 732 passed/3 skipped.
- **2026-06-28** — `docs/planning/roadmap.md` — Stack table updated:
  DB now 30 tables + 10 triggers + 13 functions + 3 roles; API now 91
  router declarations / 19 route files; Frontend now 22 wired routes
  (not 49); Tests now 732 passed · 3 skipped across 55 files.
- **2026-06-28** — `docs/MASTER_PLAN.md` — Status line for PHASE 4
  flipped from "🔄 In Progress 20/27" to "✅ Done 27/27" (verified by
  reading `tests/reports/phase04_cart.log`, LastWrite 2026-06-28 01:33).
- **2026-06-27** — Repository restructured into an academic Diátaxis-aligned
  layout. New folders: `tests/`, `docs/{architecture,development,operations,
planning,testing}/`. All `phase*.ps1` and test logs moved into `tests/`.
- **2026-06-27** — Adopted IEEE 829-2008 + ISO/IEC/IEEE 29119 + ISTQB CTFL
  for the testing program. Standards documented under
  [`docs/testing/standards/`](docs/testing/standards/).
- **2026-06-27** — Created reusable PowerShell test helpers
  ([`tests/e2e/helpers/PS_TestHelpers.ps1`](tests/e2e/helpers/PS_TestHelpers.ps1)).

### Removed

- **2026-06-29** — K.3 cleanup — Deleted 3 duplicate currency formatters
  (`formatYER` in `CustomerDashboard.tsx`, `formatYer` in
  `CustomerOrders.tsx` and `Wishlist.tsx`). All call-sites now use
  `formatMoney()` / `formatMoneyCompact()` from the new
  `app/src/lib/format.ts` helper. Also removed dead code: `COUNTRY_DEFAULT`
  constant in `Checkout.tsx` (was only used by the now-replaced `} YER` literal).

### Fixed

- **2026-06-29** — **K.3 bonus** — Fixed pre-existing flaky test
  `Checkout.test.tsx > shows the cart total in the summary`. The test
  was searching for `/25,000/` (Latin comma) but the page was rendering
  `25.000` (locale-aware period) in some Node.js versions. Switching to
  `formatMoney()` produces a stable format that always matches the test
  regex. The same fix likely fixes the other `25,000` / `12,500`
  mismatches in `ProductDetail.test.tsx` (still failing — separate bug
  related to product card rendering, not the formatter).

### Fixed

- **2026-06-28** — `app/server/routes/cart.cts` — Fixed route shadowing where
  the general `GET /:userId` catch-all was registered first, blocking
  `GET /count/:userId` and `DELETE /clear/:userId` (Phase 4 E2E:
  7 failing assertions). Routes are now ordered specific → general.
  Added ownership guard on `GET /:userId` (URL param now enforced
  against `req.user.id`; admin bypass preserved). Added 3 Vitest
  regression tests for the guard.
- **2026-06-28** — `app/src/pages/seller/SellerDashboard.tsx` —
  `aria-selected={filter === f ? 'true' : 'false'}` — ARIA spec
  requires literal strings, not boolean expressions. Verified by
  Vitest: 732 passed · 3 skipped.
- **2026-06-28** — Docs contradictions cleanup (Wave 1). Unified 11
  references of `pg-wrapper.cjs` → `pg-wrapper.cts` (C1); aligned
  `docs/testing/README.md` PHASES status with `MASTER_PLAN.md`
  (17 Done + 1 In Progress, was 5 Done + 13 Pending) (C12+N2);
  converted 10 stale `docs/audit/*` and `docs/research/*` links
  to `archive/` (N3); deleted empty `docs/audit/` and
  `docs/research/` directories (N1); moved `git_commit.log` and
  `git_push.log` to `logs/`, deleted root screenshots (N4+N5+N6).
- **2026-06-28** — `docs/MASTER_PLAN.md` — Fixed typography glitch
  where the Wave-1 emoji (📋) was rendered as `` (mojibake from
  Latin-1 ↔ UTF-8 round-trip). Restored to 📋 (U+1F4CB).
- **2026-06-27** — `app/server/index.ts` — Replaced `import dotenv from 'dotenv'`
  - separate `dotenv.config()` with the side-effect import `import 'dotenv/config'`
    to ensure `.env` is loaded BEFORE the shared module reads `process.env.DATABASE_URL`.

### Added

- **2026-06-27** — PHASE 02 — Public Catalog E2E tests (catalog list/filters,
  product detail, featured, deals, stores, store reviews, categories tree,
  category by slug). Script: [`tests/e2e/phase02_public_catalog.ps1`](tests/e2e/phase02_public_catalog.ps1).
- **2026-06-27** — PHASE 03 — Search + Filters + Pagination E2E tests.
  Script: [`tests/e2e/phase03_search_filters.ps1`](tests/e2e/phase03_search_filters.ps1).
- **2026-06-27** — Master Test Plan
  ([`docs/testing/PHASE_TEST_TASKS.md`](docs/testing/PHASE_TEST_TASKS.md))
  with all 18 PHASES documented.
- **2026-06-27** — Repository map
  ([`docs/STRUCTURE.md`](docs/STRUCTURE.md)).
- **2026-06-27** — Testing hub, E2E guide, conventions, and three standards
  reference documents.

---

## [0.1.0] — 2026-06-21

### Added

- Initial release of Nouf-ex (B2B/B2C e-commerce platform, Yemen market).
- Frontend (React 19 + Vite 7 + Tailwind + shadcn/ui, AR/EN/ZH i18n).
- Backend (Express 5 + PostgreSQL 17 + `pg`).
- 29 database tables (26 application + 3 system) with PL/pgSQL triggers.
- 4 PostgreSQL roles (least-privilege).
- Authentication: scrypt password hashing + HMAC JWT + optional 2FA/TOTP.
- 14 routers covering: auth, catalog, cart, orders, payments, coupons,
  refunds, reviews, wishlist, addresses, notifications, messages, shipping,
  store-followers, admin, admin-read, auth-2fa.
- 16 smoke scripts + PHASE 0, 1, 1-R e2e scripts.
- 666 passing Vitest tests across 53 files.

---

[Unreleased]: https://example.com/noufex/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/noufex/releases/tag/v0.1.0
