# Changelog

> **Format:** [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) ·
> **Versioning:** [Semantic Versioning 2.0.0](https://semver.org/) ·
> **Last updated:** 2026-07-14

All notable changes to **Nouf-ex** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Documentation consolidated into 10 canonical files following Tier-1 (GitHub) + Diátaxis guidance.
- Auth model migrated from `localStorage` Bearer tokens to `Secure; HttpOnly; SameSite=Strict` cookie (see [.github/SECURITY.md](.github/SECURITY.md)).
- 9 bloated documentation files removed (≈ 510 KB).
- `clean` scripts in every workspace now use `node -e` + `fs.rmSync` instead of Unix `rm -rf` so they work on Windows without WSL.
- `docker-compose.yml` now forces `DB_HOST=host.docker.internal` (and rewrites `DATABASE_URL` to match) so the container reaches the host's PostgreSQL regardless of what the developer set in `.env` for local dev.

### Fixed
- **Node 24 ↔ Turbo spawn incompatibility** — Node 24 rejected the bundled `@turbo/windows-64/bin/turbo.exe` with `EFTYPE`, breaking every `npm run *` script. Workaround documented in [FIX_GUIDE.md §1](FIX_GUIDE.md): use Node 20.18.0 LTS (matches the version pinned in `Dockerfile`, `apps/*/package.json` `engines`, and `.nvmrc`).
- **`db-setup.cjs` referenced `psql`-style `:VAR` substitutions** that node-pg does not understand. The script now substitutes `:'VAR_NAME'` patterns with the matching env value (or `DB_PASSWORD` as a fallback) before sending to PostgreSQL.
- **`db-setup.cjs` ran `roles.sql` and `seed.sql` before `migrations/`**, which failed because `roles.sql` GRANTs and `seed.sql` INSERTs reference tables introduced by migrations (`rate_limit_buckets`, `delivery_agents`, etc.). The pipeline was reordered: base SQL → migrations → roles → seed.
- **Migration `0001_baseline.sql` declared `schema_migrations.version VARCHAR(20)`** — too narrow for descriptive version names like `0031_delivery_agent_role` (21 chars). The column was widened to `VARCHAR(100)` with an idempotent `ALTER` so older deployments upgrade safely.
- **`seed.sql` products with `deal_discount` set had no `deal_ends_at`**, violating the `products_deal_pairing` CHECK constraint added in migration 0029. Both columns are now seeded together with a 30-day deal window.
- **`seed.sql` `transactions` of type `'fee'` had negative amounts**, violating the `transactions_amount_sign` CHECK constraint from migration 0027 (only `withdrawal` may be negative). Seed amounts flipped to positive; balance_after recomputed.
- **`apps/api/src/modules/delivery-agent/` had 9 TypeScript errors** (`as AgentRow` direct casts that ESLint forbids on `Promise<Record<string, unknown>>`). Casts rewritten with the `(... as unknown as T)` pattern used elsewhere in the codebase.
- **`apps/web/src/features/auth/components/Register.tsx` imported `detectIdentifier` from `./Login`** — moved to `./utils` in the auth restructure; the import path was stale.
- **`apps/web/src/features/customer/components/Reviews.tsx` used `useCallback` without importing it** — added to the `react` import.
- **`apps/web/vitest.config.ts` did not set `esbuild.jsx: 'automatic'` on the `dom` project** — Vitest 4 does NOT merge project-level esbuild with top-level, so 24 page smoke tests crashed with `ReferenceError: React is not defined`. Added explicit `esbuild` block to the `dom` project.
- **`apps/api` had no `vitest.config.ts`**, so 26 test files (out of 35) failed at module-load with "DATABASE_URL is not set". Created `apps/api/vitest.config.ts` + `vitest.setup.ts` that loads `.env` from the repo root via `dotenv`.
- **`.dockerignore` excluded the entire `scripts/` directory**, hiding `scripts/devops/docker-entrypoint.sh` that the Dockerfile COPYs. Switched the rule to `!scripts/devops/docker-entrypoint.sh` (allow-list).
- **`apps/mcp-server/src/project.ts` referenced the legacy `app/server/` and `database/` paths** (pre-2026-07-11 restructure). Updated to the current monorepo layout (`apps/api/src/`, `packages/db/`).
- **`.env.example` documented `database/roles.sql`** — the legacy path. Updated to `packages/db/roles.sql` + `packages/db/seed.sql`.

### Added
- [Schema.org](https://schema.org) `SoftwareApplication` JSON-LD + meta tags in [README.md](README.md).
- `OWASP API Top-10 (2023) + ISO/IEC 25010 + NIST SSDF` conformance baseline (see [docs/README.md §4](docs/README.md#4-explanation-understanding-oriented)).
- ADR-0006 (HttpOnly-cookie auth) and ADR-0007 (OWASP/ISO/NIST baseline).
- `apps/api/vitest.config.ts` + `vitest.setup.ts` — Vitest config that loads `.env` from the repo root, so the 597-test API suite can run from any working directory.
- `docs/STATUS_2026-07-14.md` — full build/test/Docker snapshot from the 2026-07-14 session (see [STATUS_2026-07-14.md](docs/STATUS_2026-07-14.md)).

### Security
- HttpOnly-cookie session mitigates XSS-leak-of-token.
- TLS-only via reverse-proxy with HSTS preload-ready header.
- `docker-compose.yml` overrides `DATABASE_URL` inside the container to a `host.docker.internal` URL so the host's actual database password never leaves the host's `.env`.

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
