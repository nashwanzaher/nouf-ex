# Changelog

> **Format:** [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/) ·
> **Versioning:** [Semantic Versioning 2.0.0](https://semver.org/) ·
> **Last updated:** 2026-06-28

All notable changes to **Nouf-ex** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Changed
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
  + separate `dotenv.config()` with the side-effect import `import 'dotenv/config'`
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
