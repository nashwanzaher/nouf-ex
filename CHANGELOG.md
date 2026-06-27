# Changelog

> **Format:** [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/) ·
> **Versioning:** [Semantic Versioning 2.0.0](https://semver.org/) ·
> **Last updated:** 2026-06-28

All notable changes to **Nouf-ex** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Fixed
- **2026-06-28** — `app/server/routes/cart.cts` — Fixed route shadowing where
  the general `GET /:userId` catch-all was registered first, blocking
  `GET /count/:userId` and `DELETE /clear/:userId` (Phase 4 E2E:
  7 failing assertions). Routes are now ordered specific → general.
  Added ownership guard on `GET /:userId` (URL param now enforced
  against `req.user.id`; admin bypass preserved). Added 3 Vitest
  regression tests for the guard.
- **2026-06-28** — Docs contradictions cleanup (Wave 1). Unified 11
  references of `pg-wrapper.cjs` → `pg-wrapper.cts` (C1); aligned
  `docs/testing/README.md` PHASES status with `MASTER_PLAN.md`
  (17 Done + 1 In Progress, was 5 Done + 13 Pending) (C12+N2);
  converted 10 stale `docs/audit/*` and `docs/research/*` links
  to `archive/` (N3); deleted empty `docs/audit/` and
  `docs/research/` directories (N1); moved `git_commit.log` and
  `git_push.log` to `logs/`, deleted root screenshots (N4+N5+N6).

### Changed
- **2026-06-27** — Repository restructured into an academic Diátaxis-aligned
  layout. New folders: `tests/`, `docs/{architecture,development,operations,
  planning,testing}/`. All `phase*.ps1` and test logs moved into `tests/`.
- **2026-06-27** — Adopted IEEE 829-2008 + ISO/IEC/IEEE 29119 + ISTQB CTFL
  for the testing program. Standards documented under
  [`docs/testing/standards/`](docs/testing/standards/).
- **2026-06-27** — Created reusable PowerShell test helpers
  ([`tests/e2e/helpers/PS_TestHelpers.ps1`](tests/e2e/helpers/PS_TestHelpers.ps1)).

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

### Fixed
- **2026-06-27** — `app/server/index.ts` — Replaced `import dotenv from 'dotenv'`
  + separate `dotenv.config()` with the side-effect import `import 'dotenv/config'`
  to ensure `.env` is loaded BEFORE the shared module reads `process.env.DATABASE_URL`.

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
