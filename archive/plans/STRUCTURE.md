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
├── CONTRIBUTING.md                 ← Contribution guide
├── CHANGELOG.md                    ← Recent changes
├── CODE_OF_CONDUCT.md              ← Community standards (CC v2.1)
├── SECURITY.md                     ← Security policy + SLAs
├── LICENSE                         ← MIT (Phase L)
├── Dockerfile                      ← Container image definition
├── docker-compose.yml              ← Local stack orchestration
│
├── mkdocs.yml                      ← MkDocs config (Phase L)
├── requirements-docs.txt           ← Python deps for docs (Phase L)
├── release-please-config.json      ← CHANGELOG automation (Phase L)
├── .markdown-link-check.json       ← Link-check config (Phase L)
│
├── app/                            ← Single npm package: frontend + backend
├── database/                       ← PostgreSQL schema + migrations
├── docker/                         ← Docker support files
├── docs/                           ← Active documentation (Diátaxis-organized)
├── tests/                          ← All test code (cross-cutting)
├── scripts/                        ← Project-level utility scripts
├── mcp-server/                     ← MCP server package
│
├── archive/                        ← Historical files (read-only)
│   ├── audit/                      ← Past code audits
│   └── research/                   ← Past research docs
│
├── .env.example                    ← Environment template (committed)
├── .env                            ← Live secrets (gitignored)
├── .dockerignore                   ← Docker build context exclusions
├── .gitignore                      ← VCS exclusions
├── .gitattributes                  ← EOL + linguist policy (Phase M)
├── .prettierrc.json                ← Root Prettier config (Phase M)
├── .vscode/                        ← Editor config (tasks, launch, settings)
├── .github/                        ← GitHub Actions + Copilot config
│   ├── workflows/                  ← ci + deploy-staging + deploy-prod + docs + link-check
│   ├── ISSUE_TEMPLATE/             ← bug + feature + config
│   ├── dependabot.yml              ← weekly PRs
│   ├── CODEOWNERS                  ← 12 ownership sections
│   ├── PULL_REQUEST_TEMPLATE.md    ← 18-item checklist
│   └── SECRETS.md                  ← Secrets guide
│
└── .husky/                         ← Pre-commit hook (lint-staged)
```

> **Restructuring (2026-07-03):** PowerShell wrappers (`build.ps1`, `tc.ps1`,
> `test.ps1`, `lint.ps1`, `format.ps1`, `format-check.ps1`, `docker-build.ps1`,
> `docker-run.ps1`) were moved from the repository root into `scripts/`. The
> root now contains zero `.ps1` files; see the `scripts/` detailed tree below
> for their new location.

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
│   ├── pages/
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
│       └── __tests__/              ← Component unit tests + a11y suite (vitest-axe, 2026-07-03)
│   └── __tests__/                  ← Cross-cutting a11y tests (vitest-axe, P2-09) — target for `npm run test:a11y`
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
├── schema-extra.sql                ← Extra tables (9 application tables: payments, coupons, refunds, inventory_log, …)
├── views.sql                       ← 4 read-only views (security_invoker)
├── functions.sql                   ← 7 PL/pgSQL trigger functions + cleanup helpers
├── triggers.sql                    ← 9 trigger definitions (business logic)
├── roles.sql                       ← 3 PostgreSQL roles + GRANTs (noufex_app, noufex_owner, noufex_readonly) + postgres superuser
├── seed.sql                        ← Idempotent demo data (gated by `noufex.allow_seed`)
│
└── migrations/                     ← Incremental schema changes (0001–0024)
    └── 0024_production_hardening.sql   ← Production hardening (ownership, grants, 2FA sync, last_login_at) — pending superuser apply
    ├── README.md
    ├── 0001_baseline.sql
    ├── 0002_add_cart_variant.sql
    ├── ...
    └── 0013_inventory_log_trigger_definer.sql
```

---

### `docs/` — Documentation

> **Convention:** Per the _Diátaxis_ documentation framework
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

> **Restructured (2026-07-03):** the 8 PowerShell wrappers that used to live
> at the repository root were consolidated into `scripts/`. The folder now
> contains ~46 files in total (8 PowerShell wrappers + 38 utility scripts).
> The tree below is a representative sample of the most-used entries; see
> [`scripts/README.md`](https://github.com/nashwanzaher/nouf-ex/blob/main/scripts/README.md)
> for the full index.

```
scripts/
├── README.md
├── build.ps1                       ← Root build helper (moved from /)
├── tc.ps1                          ← TypeScript type-check (moved from /)
├── test.ps1                        ← Vitest runner (moved from /)
├── lint.ps1                        ← ESLint runner (moved from /)
├── format.ps1                      ← Prettier write (moved from /)
├── format-check.ps1                ← Prettier check (moved from /)
├── docker-build.ps1                ← Docker image build (moved from /)
├── docker-run.ps1                  ← Docker compose runner (moved from /)
├── db-setup.cjs                    ← Apply schema + seed (one-time CLI)
├── verify-fresh.cjs                ← DB-vs-schema freshness check
├── e2e-step1.ps1                   ← E2E test runner (step 1)
├── switch-db.ps1                   ← Swap between dev/test DBs
├── audit-db.cjs                    ← Schema/seed integrity audit
├── autostart.ps1                   ← Windows autostart
└── install-autostart.ps1           ← Register autostart task
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

## 📊 Implementation Status per Folder (snapshot 2026-07-02)

> Verified by `ls -R` + `grep -R` pass. Status legend: ✅ live & exercised
> in tests · 🔄 live but partial · ⏳ TODO per MASTER_PLAN.

| Folder                               | Status   | Notes                                                      |
|--------------------------------------|----------|------------------------------------------------------------|
| `app/` (root)                        | ✅       | TS strict, ESLint 0, Vitest 779 passed                     |
| `app/src/`                           | ✅       | 22 routes wired, all pages smoke-tested                     |
| `app/src/pages/admin/`               | 🔄       | 4/6 pages on real API (UsersManagement + StoresManagement + DisputesManagement + AdminOverview partial). ReportsAnalytics + AdminDashboard still mock-data (tracked in K.1). |
| `app/src/pages/Home/`                | ✅       | 9 sub-sections on static data by design                     |
| `app/src/pages/seller/`              | ✅       | All 3 dashboard pages on real API                          |
| `app/src/pages/customer/`            | ✅       | All 6 pages on real API                                    |
| `app/src/lib/`                       | ✅       | `format.ts`, `utils.ts`, `cart-sync.ts` — all unit-tested  |
| `app/server/`                        | ✅       | 19 routers, 91 endpoint declarations                       |
| `app/server/tests/`                  | ✅       | `api-server.test.ts` + `schema.test.ts` (40+ tests)        |
| `app/server/lib/notifications/`      | ✅       | 13 i18n templates + 8 event triggers (Phase C.1)            |
| `app/server/lib/payments/`           | ✅       | Stripe + Paymob + stub providers                           |
| `database/`                          | ✅       | 30 tables, 13 fns, 10 triggers, 4 views, 3 roles           |
| `database/migrations/`               | ✅       | 13 incremental migrations (idempotent)                     |
| `docs/architecture/`                 | ✅       | 5 reference docs (overview, api, database, security, ER)  |
| `docs/development/`                  | ✅       | 5 how-to guides (incl. ci-cd, debugging)                   |
| `docs/operations/`                   | ✅       | 4 ops docs (incl. backup-restore, monitoring, deployment)  |
| `docs/planning/`                     | ✅       | Roadmap + competitive analysis + risks register            |
| `docs/testing/`                      | ✅       | 18 PHASE design specs + 4 standards documents              |
| `tests/e2e/`                         | ✅       | 18 PHASE scripts + 17 smoke scripts + helpers             |
| `tests/reports/`                     | 🔄       | 5/18 PHASE scripts failing in batch runs due to rate-limit cascade (test-infra, no code bug — see PHASE 12-15 specs) |
| `scripts/`                           | ✅       | ~46 utility scripts (db-setup, verify-fresh, e2e-step1, plus the 8 PowerShell wrappers moved from root on 2026-07-03) |
| `mcp-server/`                        | ✅       | TS server, builds via own `tsconfig.json`                  |
| `docker/`                            | ✅       | single `entrypoint.sh`                                     |
| `.github/`                           | ✅       | workflows/ + Dependabot + CODEOWNERS + issue templates     |
| `.github/workflows/`                 | ✅       | ci.yml (6 jobs — includes **Run accessibility (a11y) tests** step since 2026-07-03, P2-09) + deploy-staging.yml + deploy-prod.yml |
| `.vscode/`                           | ✅       | Tasks include every PHASE script + dev servers            |
| `archive/audit/`                     | ✅       | Read-only — 11 historical audits                           |
| `archive/research/`                  | ✅       | Read-only — 11 historical research notes                   |
| Root `.md` files                     | ✅       | README + CHANGELOG + CONTRIBUTING + CODE_OF_CONDUCT + SECURITY + MASTER_PLAN + STRUCTURE — all current |

> Generated by `ls -R --color=never | head -200; grep -R "\bvi\." app/server/tests 2>/dev/null | wc -l`
> - the actual MASTER_PLAN §11 reconciliation. Run yourself with the
> one-liner in [`docs/development/debugging.md`](development/debugging.md) §13.

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
| "Where are the a11y tests?" | `app/src/pages/__tests__/a11y.test.tsx` (`vitest-axe`, run with `npm run test:a11y`) |
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
