# Changelog

> **Format:** [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) ·
> **Versioning:** [Semantic Versioning 2.0.0](https://semver.org/) ·
> **Last updated:** 2026-07-11

All notable changes to **Nouf-ex** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Documentation consolidated into 10 canonical files following Tier-1 (GitHub) + Diátaxis guidance.
- Auth model migrated from `localStorage` Bearer tokens to `Secure; HttpOnly; SameSite=Strict` cookie (see [.github/SECURITY.md](.github/SECURITY.md)).
- 9 bloated documentation files removed (≈ 510 KB).

### Added
- [Schema.org](https://schema.org) `SoftwareApplication` JSON-LD + meta tags in [README.md](README.md).
- `OWASP API Top-10 (2023) + ISO/IEC 25010 + NIST SSDF` conformance baseline (see [docs/README.md §4](docs/README.md#4-explanation-understanding-oriented)).
- ADR-0006 (HttpOnly-cookie auth) and ADR-0007 (OWASP/ISO/NIST baseline).

### Security
- HttpOnly-cookie session mitigates XSS-leak-of-token.
- TLS-only via reverse-proxy with HSTS preload-ready header.

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

[Unreleased]: https://github.com/nashwanzaher/nouf-ex/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nashwanzaher/nouf-ex/releases/tag/v0.1.0
