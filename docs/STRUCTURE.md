# Nouf-ex — Project Structure (Academic Edition)

> **Standards applied:** [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) ·
> [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) ·
> [ISTQB CTFL](https://www.istqb.org/) ·
> [Google Style Guide](https://google.github.io/styleguide/) ·
> [Microsoft Docs — .NET Architecture Guides](https://learn.microsoft.com/en-us/dotnet/architecture/)

This document is the **canonical map** of the Nouf-ex repository. It is
maintained alongside the code and is the authoritative reference for
"where does X live?".

---

## 🏛️ Top-Level Layout

```
Nouf-ex/
├── README.md                       ← Project entry point
├── CONTRIBUTING.md                 ← Contribution guide (TBD)
├── Dockerfile                      ← Container image definition
├── docker-compose.yml              ← Local stack orchestration
├── LICENSE                         ← (TBD — not yet published)
│
├── app/                            ← Single npm package: frontend + backend
├── database/                       ← PostgreSQL schema + migrations
├── docker/                         ← Docker support files
├── docs/                           ← All documentation
├── tests/                          ← All test code (cross-cutting)
├── scripts/                        ← Project-level utility scripts
├── mcp-server/                     ← MCP server package
│
├── archive/                        ← Historical/moved files
│
├── .env.example                    ← Environment template (committed)
├── .env                            ← Live secrets (gitignored)
├── .gitignore
├── .vscode/                        ← Editor config (tasks, launch, settings)
├── .github/                        ← GitHub Actions workflows
│
└── .prettierrc.json
```

---

## 📂 Detailed Tree

### `app/` — Single npm package (frontend + backend)

> **Convention:** Per Microsoft's [monorepo guidance](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/architect-microservice-container-applications/maintain-microservice-apis),
> a single package keeps deployment simple while still separating
> client and server code into distinct sub-folders.

```
app/
├── README.md
├── package.json                    ← All deps (frontend + backend)
├── package-lock.json
│
├── tsconfig.json                   ← Root TS project references
├── tsconfig.app.json               ← Frontend tsconfig
├── tsconfig.server.json            ← Backend tsconfig
├── tsconfig.node.json              ← Node-only tools tsconfig
│
├── vite.config.ts                  ← Vite (frontend) configuration
├── vitest.config.ts                ← Vitest (tests) configuration
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js                ← ESLint 9 flat config
├── components.json                 ← shadcn/ui generator config
│
├── src/                            ← React 19 frontend (Vite)
│   ├── App.tsx                     ← Root component + router
│   ├── main.tsx                    ← Entry point
│   ├── index.css
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── Skeletons.tsx
│   │   ├── BottomNav.tsx
│   │   └── ui/                     ← shadcn/ui generated components
│   ├── context/
│   │   ├── AppContext.tsx          ← i18n + auth + toasts
│   │   └── CartContext.tsx         ← Shopping cart state
│   ├── data/                       ← Build-time JS fallbacks
│   ├── hooks/
│   │   ├── useApi.ts               ← Data fetching hooks
│   │   └── use-mobile.tsx
│   ├── i18n/                       ← i18next + locales (ar/en/zh)
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── ar.json
│   │       ├── en.json
│   │       └── zh.json
│   ├── lib/
│   │   ├── api.ts                  ← Typed API client
│   │   ├── cart-sync.ts
│   │   ├── jsonData.ts
│   │   └── utils.ts                ← cn() helper + class utilities
│   └── pages/
│       ├── Home/
│       ├── Home.tsx
│       ├── SearchResults.tsx
│       ├── ProductDetail.tsx
│       ├── StorePage.tsx
│       ├── Categories.tsx
│       ├── Deals.tsx
│       ├── Checkout.tsx
│       ├── NotFound.tsx
│       ├── auth/                   ← Login, Register, Password reset
│       ├── customer/               ← Customer dashboard pages
│       ├── seller/                 ← Merchant dashboard pages
│       ├── admin/                  ← Admin dashboard pages
│       └── __tests__/              ← Component unit tests
│
├── server/                         ← Express 5 backend
│   ├── index.ts                    ← Entry point (esbuild bundle target)
│   ├── index.js                    ← Built bundle (gitignored)
│   ├── middleware.ts               ← Auth, security headers, logger, rate limit
│   ├── routes/
│   │   ├── auth.cts
│   │   ├── auth-2fa.cts
│   │   ├── catalog.cts
│   │   ├── cart.cts
│   │   ├── orders.cts
│   │   ├── payments.cts
│   │   ├── coupons.cts
│   │   ├── refunds.cts
│   │   ├── reviews.cts
│   │   ├── addresses.cts
│   │   ├── wishlist.cts
│   │   ├── notifications.cts
│   │   ├── messages.cts
│   │   ├── shipping.cts
│   │   ├── stats.cts
│   │   ├── admin.cts
│   │   ├── admin-read.cts
│   │   └── store-followers.cts
│   ├── db/
│   │   └── pg-wrapper.cts          ← Async wrapper around `pg.Pool`
│   ├── lib/
│   │   ├── shared.cts              ← Schemas, helpers, db singleton
│   │   ├── search.cts
│   │   ├── totp.cts
│   │   ├── backup-codes.cts
│   │   ├── partial-token.cts
│   │   └── payments/
│   │       ├── registry.cts
│   │       ├── stripe.cts
│   │       ├── paymob.cts
│   │       ├── stub.cts
│   │       └── types.cts
│   ├── tests/                      ← Vitest + supertest (integration)
│   │   ├── api-server.test.ts
│   │   └── schema.test.ts
│   └── README.md
│
├── tests/                          ← Vitest unit tests (app-level)
│
├── public/                         ← Static assets (served by Vite)
│   ├── manifest.webmanifest
│   ├── data/
│   └── products/
│
├── dist/                           ← Built bundle (gitignored)
├── coverage/                       ← Vitest coverage output (gitignored)
└── scripts/                        ← (legacy — moved to ../../scripts/)
```

---

### `database/` — PostgreSQL schema

> **Convention:** Per PostgreSQL best practices, DDL lives in plain SQL
> files (no ORM), applied via `npm run db:setup`.

```
database/
├── README.md                       ← Database overview
│
├── schema.sql                      ← Base tables (16 application tables)
├── schema-extra.sql                ← Extra tables (10 tables: payments, coupons, …)
├── views.sql                       ← 4 read-only views (security_invoker)
├── functions.sql                   ← 7 PL/pgSQL trigger functions
├── triggers.sql                    ← 9 trigger definitions
├── roles.sql                       ← 4 PostgreSQL roles + GRANTs
├── seed.sql                        ← Idempotent demo data
├── seed-dev.sql                    ← Dev-only seed extensions
│
└── migrations/                     ← Incremental schema changes
    ├── README.md
    ├── 0001_baseline.sql
    ├── 0002_add_cart_variant.sql
    ├── ...
    └── 0013_inventory_log_trigger_definer.sql
```

---

### `docs/` — Documentation

> **Convention:** Per the *Diátaxis* documentation framework
> (https://diataxis.fr/), docs are split by intent.

```
docs/
├── README.md                       ← Documentation index
│
├── STRUCTURE.md                    ← THIS file — project map
│
├── architecture/                   ← ⟦explanation⟧ — How the system works
│   ├── overview.md                 ← (was: docs/architecture.md)
│   ├── api.md                      ← (was: docs/api.md)
│   └── database.md                 ← (was: docs/database.md)
│
├── development/                    ← ⟦how-to⟧ — Developer's daily companion
│   ├── getting-started.md          ← (was: docs/getting-started.md)
│   ├── workflow.md                 ← (was: docs/development.md)
│   ├── conventions.md              ← Coding conventions
│   └── docker.md                   ← (was: docs/docker.md)
│
├── planning/                       ← ⟦strategy⟧ — Where the project is going
│   ├── roadmap.md                  ← (was: docs/roadmap.md)
│   └── competitive-analysis.md      ← (was: docs/competitive-analysis-2026.md)
│
├── operations/                     ← ⟦how-to / deployment⟧
│   └── (deployment guides TBD)
│
├── testing/                        ← ⟦reference⟧ — Testing program
│   ├── README.md                   ← Testing hub
│   ├── PHASE_TEST_TASKS.md        ← Master Test Plan
│   ├── conventions.md             ← Test taxonomy + style
│   ├── overview.md                ← (was: docs/testing.md)
│   ├── standards/
│   │   ├── IEEE-829.md
│   │   ├── ISO-29119.md
│   │   └── ISTQB-CTFL.md
│   ├── phases/                    ← Per-PHASE test design specs
│   └── templates/
│       └── PS_TEST_HELPER.ps1
│
├── audit/                          ⟦historical⟧ — Past code reviews
├── research/                       ⟦historical⟧ — Past research notes
├── assets/                         ← Images, screenshots
└── workflows/                      ← Workflow diagrams
```

> **Diátaxis** (https://diataxis.fr/) is a documentation framework that
> categorises docs by intent: **tutorials** (learning), **how-to**
> (problem-solving), **reference** (information), **explanation**
> (understanding). We adopt this convention for navigability.

---

### `tests/` — Cross-cutting test suite

```
tests/
├── README.md                       ← Testing hub
│
├── e2e/                            ← End-to-end PowerShell scripts
│   ├── README.md
│   ├── helpers/
│   │   └── PS_TestHelpers.ps1
│   ├── phase00_health_auth.ps1
│   ├── phase01_profile_addresses.ps1
│   ├── phase01_profile_addresses_retest.ps1
│   ├── phase02_public_catalog.ps1
│   ├── phase03_search_filters.ps1
│   └── ... (15 more)
│
├── reports/                        ← Test execution logs
│   ├── phase02_public_catalog.log
│   ├── phase03_search_filters.log
│   └── ...
│
└── fixtures/                       ← Static test data (JSON)
```

> The `app/tests/` and `app/src/**/__tests__/` directories (not shown
> here) hold **Vitest unit and integration tests**, colocated with the
> code they cover.

---

### `scripts/` — Project-level utility scripts

```
scripts/
├── README.md
├── db-setup.cjs                    ← Apply schema + seed (one-time CLI)
├── gen-seed-hashes.cjs             ← Regenerate scrypt hashes for seed
├── test-summary.cjs                ← Clean vitest summary
├── audit-db.cjs
├── verify-fresh.cjs
├── autostart.bat                   ← Windows autostart
├── autostart.ps1
├── install-autostart.ps1
├── switch-db.ps1
├── drop-test-db.cjs
├── e2e-step1.ps1
└── README.md
```

---

### `docker/` — Docker support

```
docker/
└── entrypoint.sh                   ← Container entrypoint
```

> The main `Dockerfile` and `docker-compose.yml` live at the project root
> (per Docker convention).

---

### `mcp-server/` — MCP server package

```
mcp-server/
├── README.md
├── package.json
├── tsconfig.json
├── src/
└── scripts/
```

---

### `.vscode/` — Editor configuration

```
.vscode/
├── settings.json
├── tasks.json                      ← Run/Debug tasks (Phase scripts, etc.)
├── launch.json                     ← Debug configurations
├── extensions.json                 ← Recommended extensions
└── mcp.json                        ← MCP servers config
```

---

### `.github/` — CI/CD

```
.github/
└── workflows/
    └── ci.yml                      ← GitHub Actions
```

---

### `archive/` — Historical files

> Files that have outlived their original location are moved here
> (not deleted) to preserve git history.

---

## 📐 Architectural Decisions Recorded

For each major architectural decision, an **ADR** (Architecture
Decision Record) lives in [`docs/architecture/`](architecture/) under
a `<NN>-<slug>.md` filename.

> ADRs follow Michael Nygard's template (https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

---

## 🔗 Cross-Reference Map

| Question | Answer |
|----------|--------|
| "Where does the API run?" | `app/server/index.ts` (port 3000) |
| "Where is the DB connection?" | `app/server/db/pg-wrapper.cts` |
| "Where are the routes?" | `app/server/routes/*.cts` |
| "Where are the shared schemas?" | `app/server/lib/shared.cts` |
| "Where is the React root?" | `app/src/main.tsx` |
| "Where do E2E tests live?" | `tests/e2e/` |
| "Where are unit tests?" | `app/tests/`, `app/src/**/__tests__/` |
| "Where do reports go?" | `tests/reports/` |
| "Where is the master test plan?" | `docs/testing/PHASE_TEST_TASKS.md` |
| "Where is the DB schema?" | `database/*.sql` + `database/migrations/` |
| "Where are the Docker configs?" | Root `Dockerfile`, `docker-compose.yml`, `docker/` |
| "Where is the documentation index?" | `docs/README.md` and `docs/testing/README.md` |

---

## 📚 Standards Reference (full list)

- [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) — Test Documentation
- [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) — Software Testing
- [ISTQB CTFL v4.0](https://www.istqb.org/) — Testing Techniques
- [Google Style Guide](https://google.github.io/styleguide/) — Code style
- [Microsoft .NET Architecture Guides](https://learn.microsoft.com/en-us/dotnet/architecture/) — Project layout
- [Diátaxis](https://diataxis.fr/) — Documentation framework
- [Conventional Commits](https://www.conventionalcommits.org/) — Commit messages
- [Semantic Versioning](https://semver.org/) — Versioning
- [Keep a Changelog](https://keepachangelog.com/) — CHANGELOG format
- [12-Factor App](https://12factor.net/) — Configuration, dependencies, processes
- [Google Testing Blog](https://testing.googleblog.com/) — Test design
