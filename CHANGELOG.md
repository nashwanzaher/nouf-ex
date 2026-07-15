# Changelog

> **Format:** [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) ·
> **Versioning:** [Semantic Versioning 2.0.0](https://semver.org/) ·
> **Last updated:** 2026-07-14

All notable changes to **Noufex** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security
- **Fixed: delivery-agent module had no auth middleware on 12 routes.** Every handler called `req.user!.id` but `requireAuth` was never added to the router. Added `requireAuth` to all 12 routes (`register`, `profile`, `location`, `orders`, `dashboard`, `available-orders`, `accept`, `status`, `go-online`, `go-offline`). Found via systematic controller audit (19 modules checked → 3 missing auth, 2 legitimately public).
- `docker-compose.yml` overrides `DATABASE_URL` inside the container to a `host.docker.internal` URL so the host's actual database password never leaves the host's `.env`.

### Changed
- Frontend tests moved from 264/298 → **298/298 (100% passing)** after 11 fixes across 13 files: i18n locale sync (1352 keys per file), placeholder matchers for v2 Register/ResetPassword forms, AppProvider wrappers for a11y tests, `useServerWishlist` mock added, AppContext mock via `importOriginal` for coexistence with real `AppProvider`.
- Backend tests from 582/622 → **617/622 (99.2% passing)** after 9 fixes: path corrections (`database/` → `packages/db/`), route shape updates (`/:userId` → `/` for notifications/wishlist), TODOKEN_REVOKED code acceptance, combined password+token_version UPDATE detection in auth-router mock.
- `clean` scripts in every workspace now use `node -e` + `fs.rmSync` instead of Unix `rm -rf` so they work on Windows without WSL.
- `docker-compose.yml` now forces `DB_HOST=host.docker.internal` and rewrites `DATABASE_URL` to match.
- Documentation consolidated into 10 canonical files following Tier-1 (GitHub) + Diátaxis guidance.
- Auth model migrated from `localStorage` Bearer tokens to `Secure; HttpOnly; SameSite=Strict` cookie.

## [0.1.0] — 2026-07-09

### Added
- Catalog: products, variants, images, categories, stores, search.
- Cart, wishlist, orders, refunds, disputes, reviews.
- Coupons with DB-enforced atomicity and refund-on-cancel.
- Webhooks (Stripe / Paymob stubs) with idempotent dedup.
- 2FA (TOTP) with scrypt-hashed backup codes.
- i18n: Arabic (RTL default) / English / Chinese.
- DB-backed atomic rate limiter.
- Audit log with structured redaction.
- PWA with Workbox cache strategies.
- CI: GitHub Actions — lint · typecheck · Vitest · build · axe a11y · DB integration · server-boot.

### Changed
- Migrated DB schema through 30 incremental migrations (0001 → 0030); consolidated SSOT.
- Adopted Diátaxis for documentation, OWASP API Top 10 for security posture, OWASP ASVS 4.0.3 as verifier checklist, IEEE 829 + ISO/IEC/IEEE 29119 + ISTQB CTFL for test documentation.

[Unreleased]: https://github.com/nashwanzaher/Noufex/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nashwanzaher/Noufex/releases/tag/v0.1.0
