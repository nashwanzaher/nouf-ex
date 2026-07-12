# Nouf-ex — Architecture Overview

> **Single source of truth:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — this file is a short summary suitable for newcomers.
> **Last updated:** 2026-07-12

## What is Nouf-ex?

Nouf-ex is a **B2B/B2C e-commerce marketplace** targeting **Yemen and the Middle East**, modeled on Alibaba/Taobao. It is built as a **monorepo** of:

- A **React 19 + Vite 7** SPA storefront (Arabic RTL, English, Chinese)
- An **Express 5 + TypeScript** REST API on Node.js 20
- A **PostgreSQL 17** database with 32 tables and 32 triggers

---

## 1. Technology stack (single-table view)

| Layer | Tech | Version |
|---|---|---|
| **Database** | PostgreSQL | 17 |
| **API** | Node.js + Express + `pg` | 20.x / 5.2.1 |
| **Hashing** | scrypt (Node built-in) | — |
| **JWT** | HMAC-SHA256 (Node built-in) | — |
| **Validation** | Zod | 4.3.5 |
| **Frontend** | React + Vite | 19.2 / 7.2.4 |
| **Routing** | React Router | 7.6.1 |
| **Styling** | Tailwind CSS + shadcn/ui | 3.4.19 |
| **i18n** | i18next | 26.3.1 |
| **PWA** | vite-plugin-pwa + Workbox | 1.3.0 |
| **Charts** | recharts | 2.15.4 |
| **Tests** | Vitest + Supertest + axe-core | 4.1.9 |
| **Container** | Docker (node:20-alpine + tini) | — |
| **AI tooling** | MCP server + Docker MCP Gateway | 1.0.4 |

---

## 2. Repository layout (monorepo + npm workspaces + Turbo 2.10.4)

```
nouf-ex/
├── apps/
│   ├── web/         @noufex/web         React 19 SPA         (port 8080 dev)
│   ├── api/         @noufex/api         Express 5 API        (port 3000)
│   ├── mcp-server/  @noufex/mcp-server  MCP server (stdio)
│   └── e2e/         @noufex/e2e         PowerShell scripts
├── packages/
│   ├── db/          @noufex/db          7 SQL + 30 migrations
│   ├── shared/      @noufex/shared      types + constants
│   ├── typescript-config/
│   └── eslint-config/
├── docker/mcp-gateway/                  SSE listener (port 8811)
├── docs/                                Diátaxis-compliant
├── scripts/                             dev/ops utilities
└── logs/                                audit DLQ
```

---

## 3. Runtime topology

| Process | Port | Purpose |
|---|---|---|
| Vite dev server | **8080** | SPA hot-reload (proxies `/api/*` → :3000) |
| Express API | **3000** | REST API + serves SPA bundle in production |
| PostgreSQL 17 | **5432** | External DB (host.docker.internal or remote) |
| MCP Gateway | **8811** | SSE transport for AI clients (Bearer auth) |
| MCP server | stdio | Read-only introspection of code + DB + docs |

---

## 4. Frontend architecture

- **React 19 + Vite 7 + TypeScript**
- **React Router 7** with `lazyPage()` for code-splitting
- **React Context** (AppContext, CartContext) — no Redux/Zustand
- **30+ typed hooks** (`useDataHook`, `useProducts`, `useAdminStats`, ...)
- **12 feature modules** (auth, products, cart, checkout, orders, home, customer, seller, admin, messages, shipping, coupons)
- **47 pages** (8 public + 5 auth + 12 customer + 7 seller + 15 admin)
- **PWA** with Workbox cache (CSP nonce injected per request)
- **i18n**: ar (RTL default) / en / zh

---

## 5. Backend architecture

- **Express 5** with **18 routers** under `/api/*`:
  - `/api/admin`, `/api/auth`, `/api/auth/2fa`, `/api/cart`, `/api/coupons`
  - `/api/messages`, `/api/notifications`, `/api/orders`, `/api/payments`
  - `/api/refunds`, `/api/reviews`, `/api/seller`, `/api/shipping`
  - `/api/store-followers`, `/api/stats`, `/api/wishlist`
  - `/api` (catalog: products, stores, categories, search)
- **18 modules** under `apps/api/src/modules/` (Pattern A: routes/controller/service/repository; Pattern B: thin wrapper)
- **15 lib utilities** in `apps/api/src/lib/` (auth, csrf, validation, settings, audit, ...)
- **Middleware**: securityHeaders → cors → JSON (rawBody capture) → CSRF → optionalAuth → requestLogger
- **Background jobs**: audit-cleanup cron (03:00 daily UTC), rate-limit cleanup (60s)

---

## 6. Database

- **PostgreSQL 17** with **32 tables**, **32 triggers**, **8 PL/pgSQL functions**, **4 views**, **30 migrations**
- **4 roles**: postgres (superuser), noufex_owner (DDL), noufex_app (least-privilege), noufex_readonly (BI)
- **All migrations** are idempotent (`IF NOT EXISTS`, `ON CONFLICT`)
- **Seed data**: 10 users + 18 categories + 7 stores + 24 products + 8 orders + ...

---

## 7. Security model

- **Auth**: HttpOnly cookies + scrypt + HMAC-SHA256 + per-user `token_version`
- **CSRF**: double-submit cookie (`noufex_csrf` + `noufex_csrf_h` + `x-csrf-token` header)
- **2FA**: TOTP (RFC 6238) + 10 backup codes (single-use, scrypt-hashed)
- **Rate limiting**: DB-backed via `consume_rate_limit()` PL/pgSQL function
- **CSP**: per-request nonce, 32-capability Permissions-Policy denylist
- **HSTS**: 1 year + includeSubDomains + preload
- **Audit log**: every admin mutation writes to `admin_audit_log` with 17-key redactor

---

## 8. CI/CD

5 GitHub workflows in `.github/workflows/`:
1. `ci.yml` — 7 jobs (docs-presence → lint → typecheck → mcp-server → test → build → db-integration → server-boot)
2. `deploy-staging.yml` — auto-deploy on push to main
3. `deploy-prod.yml` — semver tag + ancestor-of-main + automatic rollback
4. `docs.yml` — MkDocs build + GitHub Pages
5. `link-check.yml` — `markdown-link-check` matrix (nightly + PR)

---

## 9. AI tooling (MCP)

- **18 tools** across 4 families: `db_*` (9), `code_*` (3), `api_*` (3), `docs_*` (3)
- **5 catalog tools** exposed via `docker/mcp-gateway/catalog.yaml`
- **Bearer token** authentication on `:8811/sse`
- **stdio** transport for direct MCP client integration

---

## 10. Documentation structure (Diátaxis)

- **Tutorials**: getting started + run-an-order (planned)
- **How-to guides**: contributor workflow, CI/CD, debugging, deployment
- **Reference**: API, database, security, testing standards
- **Explanation**: architecture decisions, market research, risk register

See [`docs/README.md`](../../docs/README.md) for the full table of contents.

---

## Next steps for readers

1. Read [`docs/README.md`](../../docs/README.md) — full documentation index
2. Read [`BACKLOG.md`](../../docs/BACKLOG.md) — pending work and known issues
3. Run locally: `npm install && npm run db:setup && npm run dev`
4. Run tests: `npm test`
5. Run E2E: `pwsh apps/e2e/e2e/phase00_health_auth.ps1`
