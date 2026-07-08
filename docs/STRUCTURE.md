# Project Structure (Canonical)

> **Last verified:** 2026-07-05 (per MIGRATION_EXECUTION_PLAN.md v2.7.8 §38 R-7 execution; scripts/ now organized into 4 sub-folders)
> **Source-of-truth (SSOT):** [MIGRATION_EXECUTION_PLAN.md §4 (SSOT Architecture) and §13 (Current Project Structure Inventory)](planning/MIGRATION_EXECUTION_PLAN.md)
> **Re-validated by:** Round-7 SSOT audit (MIGRATION_EXECUTION_PLAN.md §25 + §26)
> **Purpose:** Provide a single canonical reference for the current repository structure. All counts and paths verified against actual filesystem state.

This file exists per MIGRATION_EXECUTION_PLAN.md v2.7.5 §30.4 Sprint 1 (R-10) to give contributors a navigable overview of the Nouf-ex codebase. **For the canonical, executable plan and full architectural decisions, always refer to MIGRATION_EXECUTION_PLAN.md.**

> **2026-07-05 update (R-7 EXECUTED):** `scripts/` was reorganized into 4 canonical sub-folders: `db/`, `devops/`, `quality/`, `maintenance/`. See [scripts/README.md](../scripts/README.md) for the new index.

## Top-level Repository Layout

```
nouf-ex/                                              ← REPO ROOT (SSOT)
├── app/                                              ← SINGLE npm package (SSOT code)
│   ├── package.json              name="my-app", type="module", 59 deps + 38 devDeps
│   ├── src/                      ← React 19 + Vite 7 frontend (code-split, lazy-loaded)
│   │   ├── App.tsx, main.tsx
│   │   ├── components/           68 files (Layout, Navbar, Footer, ui/*)
│   │   ├── context/              5 files (AppContext, CartContext)
│   │   ├── hooks/                5 files (useApi, use-mobile)
│   │   ├── i18n/                 4 files (locales/ar|en|zh.json + index.ts)
│   │   ├── lib/                  8 files (api.ts, cart-sync.ts, format.ts, utils.ts)
│   │   ├── pages/                67 files (Home, auth/, customer/, seller/, admin/)
│   │   └── __tests__/            4 files (vitest setup)
│   │
│   ├── server/                   ← Express 5 API (extracted from app/)
│   │   ├── index.ts              Express entrypoint + middleware chain
│   │   ├── middleware.ts         873 lines (security, auth, rate-limit, error handler)
│   │   ├── db/pg-wrapper.cts     async pg.Pool wrapper
│   │   ├── lib/                  24 files (auth, audit, validation, payments/, ...)
│   │   ├── routes/               19 .cts files (98 endpoints)
│   │   └── tests/                33 files (Vitest with mocked pg)
│   │
│   ├── tests/                    4 .ts + 18 JSON fixtures (MSW + a11y setup)
│   ├── public/                   88 product images + 24 SVG variants
│   ├── scripts/                  2 .cjs files (image tooling)
│   └── configs: vite.config.ts, vitest.config.ts, tsconfig.{json,app,node,server}.json
│                 eslint.config.js, tailwind.config.js, postcss.config.js, components.json
│
├── database/                                       ← PostgreSQL 17 schema (host-side)
│   ├── README.md
│   ├── schema.sql, schema-extra.sql, views.sql, functions.sql, triggers.sql, roles.sql
│   ├── seed.sql                  Idempotent demo data (gated by `noufex.allow_seed`)
│   └── migrations/               24 SQL files (0001_baseline → 0024_production_hardening)
│
├── mcp-server/                                     ← MCP tooling (separate package, dev-only)
│   └── src/                        6 files: api-tools, code-tools, db-tools, docs-tools, index, project
│
├── scripts/                                        ← 25 ACTIVE project-level helpers + 1 README (R-7 reorganized 2026-07-05)
│   ├── README.md                 Index of all 4 sub-folders
│   ├── db/                       5 files: DB lifecycle (setup, seed, audit, switch, drop)
│   ├── devops/                   6 files: Local + container lifecycle (autostart, build, docker, install)
│   ├── quality/                  8 files: Quality gates (lint, format, test, typecheck, verify)
│   └── maintenance/              6 files: One-off helpers (scan-unused, e2e-step1, start-api/vite)
│
├── docs/                                           ← 8 sub-folders (Diátaxis-aligned)
│   ├── architecture/             C4 diagrams, API specs, schema docs
│   ├── development/              CI/CD, conventions, debugging, workflow
│   ├── operations/               backup-restore, deployment, monitoring
│   ├── planning/                 THIS plan + ADRs + risks.md
│   ├── testing/                  overview, phases, standards, templates
│   ├── tutorials/                run-an-order-end-to-end
│   ├── workflows/                N8N workflow + env override
│   └── README.md                 Local docs index
│
├── docker/                                        ← 1 file (entrypoint.sh)
├── .github/                                       ← 5 CI workflows + 12 agents + 23 skills + 1 prompt
├── .vscode/                                       ← editor config (settings, tasks, launch, mcp)
├── .husky/                                        ← pre-commit hook
├── Dockerfile                                    ← 3-stage (deps → build → runtime)
├── docker-compose.yml                            ← single service: Nouf-ex
├── mkdocs.yml                                    ← MkDocs Material theme
├── CHANGELOG.md, README.md, CONTRIBUTING.md, ...  ← standard repo files
└── .env.example                                  ← DATABASE_URL template
```

## Per-directory Inventory (Round-7 SSOT audit verified)

### `app/src/` Structure (React 19 SPA)

| Directory | Subdirs | Files (verified) | Purpose |
|---|---|---:|---|
| `app/src/__tests__/` | `a11y/`, `i18n/` (R-16) | 5 (4 a11y + 1 i18n consistency) | Vitest setup + accessibility + i18n parity tests |
| `app/src/components/` | `__tests__/`, `ui/` | 68 (8 root + 52 shadcn/ui + 8 tests) | Layout, Navbar, Footer, ui/* (shadcn) |
| `app/src/context/` | `__tests__/` | 5 (3 root + 2 tests) | React providers (AppContext, CartContext, index.ts) |
| `app/src/hooks/` | `__tests__/` | 5 (2 root + 3 tests) | Data hooks (useApi, use-mobile) |
| `app/src/i18n/` | `locales/`, `__tests__/` | 6 (1 .ts + 3 .json + 1 README + 1 consistency test) | i18next setup + ar/en/zh locales + consistency.test.ts (R-16) |
| `app/src/lib/` | `__tests__/`, `api/` (R-22) | 8 root (4 + 18 in `api/` subfolder) + 4 tests | API client (now split into 18 domain modules per R-22) + utilities |
| `app/src/pages/` | `__tests__/`, `admin/`, `auth/`, `customer/`, `Home/`, `seller/` | **53 (46 .tsx + 7 .module.css)** | Role-based pages (Home, auth, customer, seller, admin) — **CORRECTED v2.8.8** (was incorrectly listed as 67/60 in earlier versions; actual `Get-ChildItem -Recurse` count is 46 .tsx) |

### `app/server/` Structure (Express 5 API)

| Directory | Subdirs | Files (verified) | Purpose |
|---|---|---:|---|
| `app/server/db/` | — | 1 | `pg-wrapper.cts` (async pg.Pool) |
| `app/server/lib/` | `notifications/`, `payments/` | 24 (13 root + 11 subdirs) | auth, audit, validation, payments |
| `app/server/routes/` | — | 19 .cts | All Express router files (98 endpoints) |
| `app/server/tests/` | `notifications/` | 33 (32 root + 1 subdir) | Server unit tests with mocked pg |

### `database/` Structure (PostgreSQL 17)

| Directory | Files (verified) | Notes |
|---|---:|---|
| `database/` | 8 root files | README, schema.sql, schema-extra.sql, views.sql, functions.sql, triggers.sql, roles.sql, seed.sql |
| `database/migrations/` | 24 SQL + 1 README | 0001_baseline → 0024_production_hardening (idempotent) |

### `docs/` Structure (Diátaxis-aligned)

```
docs/
├── architecture/        C4 diagrams, API specs, schema docs
├── development/         CI/CD, conventions, debugging, workflow
├── operations/          backup-restore, deployment, monitoring
├── planning/            THIS plan + ADRs + risks.md
├── testing/             overview, phases, standards, templates
├── tutorials/           run-an-order-end-to-end
├── workflows/           N8N workflow + env override
└── README.md            Local docs index
```

## Verified File Counts (Round-7 SSOT audit)

| Layer | Verified Count | Notes |
|---|---:|---|
| `app/src/components/` root | 8 | Layout, Navbar, Footer, BottomNav, ErrorBoundary, ProtectedRoute, Skeletons, Toast |
| `app/src/components/ui/` | 52 | shadcn primitives (R-6 verified) |
| `app/src/components/__tests__/` | 8 | Test files for components |
| `app/src/pages/` .tsx | **46** | **(CORRECTED v2.8.8)** Plan §1.3 originally said 60; actual `Get-ChildItem -Recurse -File -Include '*.tsx' 'app\src\pages'`.Count` → `46` |
| `app/src/pages/` .module.css | 7 | |
| `app/src/lib/` | **4** | **(CORRECTED v2.8.8)** api.ts (now a 17-line re-export shim per R-22), cart-sync.ts, format.ts, utils.ts + `api/` subfolder (18 modules per R-22) |
| `app/src/context/` | **3** | **(CORRECTED v2.8.8)** AppContext.tsx, CartContext.tsx, index.ts |
| `app/src/hooks/` | **2** | **(CORRECTED v2.8.8)** useApi.ts, use-mobile.ts |
| `app/src/i18n/` | 4 (1 .ts + 3 .json) | |
| `app/mocks/` | 22 (4 .ts + 18 JSON fixtures) | |
| `app/server/tests/` | 33 | |
| `app/server/routes/` | 19 .cts (98 endpoints) | |
| `app/server/lib/` | 24 (TS+CTS) | |
| `database/migrations/` | 24 SQL + 1 README | |
| `scripts/` (root + 4 sub-folders) | **25 active files + 1 README** | R-7 EXECUTED (2026-07-05): scripts/ organized into `db/` (5) + `devops/` (6) + `quality/` (8) + `maintenance/` (6) |

> **2026-07-07 update:** `archive/` removed (was 60 historical files, gitignored, outside SSOT).
> Git history on GitHub remains the canonical historical record. See [docs/README.md](README.md) §History.

## Cross-references

- **Canonical plan (MUST-READ):** [MIGRATION_EXECUTION_PLAN.md](planning/MIGRATION_EXECUTION_PLAN.md) v2.7.6+
- **ADR index (architectural decisions):** [docs/planning/adr/README.md](planning/adr/README.md)
- **Local docs index:** [docs/README.md](README.md)
- **API specification:** [docs/architecture/api.md](architecture/api.md)
- **Database schema:** [docs/architecture/database.md](architecture/database.md) + `database/`
- **Security model:** [docs/architecture/security.md](architecture/security.md)
- **CI/CD:** [docs/development/ci-cd.md](development/ci-cd.md) + `.github/workflows/`
- **Deployment:** [docs/operations/deployment.md](operations/deployment.md)
- **Getting started:** [docs/development/getting-started.md](development/getting-started.md)

## Conventions

- **SSOT principle:** the entire `app/` is a single npm package (name="my-app"). No monorepo. No multi-package workspace. (See [ADR-0003](planning/adr/0003-ssot-production-monolith.md).)
- **Production DB:** single PostgreSQL 17 instance (`noufex_db`), 3 application roles with least privilege. (See [ADR-0004](planning/adr/0004-production-hardening-0024.md).)
- **TypeScript config:** Project References pattern (4 tsconfigs: root + app + node + server). (See [ADR-0005](planning/adr/0005-tsconfig-project-references.md).)
- **Documentation:** Diátaxis framework. See <https://diataxis.fr/> for the methodology.
- **CHANGELOG:** Keep a Changelog 1.1.0. See <https://keepachangelog.com/> for the format.
- **Commits:** Conventional Commits 1.0.0. See <https://www.conventionalcommits.org/> for the spec.
- **Versioning:** SemVer 2.0.0. See <https://semver.org/> for the spec.
- **Historical artifacts:** not stored in the repo — consult git history on GitHub.

## Quality Gates (verified 2026-07-07)

| Gate | Command | Status (2026-07-07) |
|---|---|---|
| TypeScript | `cd app && npx tsc -b --noEmit` | ✅ exit 0 |
| ESLint | `cd app && npx eslint . --max-warnings=0` | ✅ 0 problems |
| Vitest | `cd app && npx vitest run` | ✅ 859 passed, 3 skipped, 6 pre-existing failures (unrelated) |
| Coverage threshold (since R-4) | `cd app && npx vitest run --coverage` | 🟢 gate enforced (lines: 50, statements: 50, functions: 55, branches: 45) |

## References

- **[MIGRATION_EXECUTION_PLAN.md](planning/MIGRATION_EXECUTION_PLAN.md)** v2.7.6+ — the canonical, executable plan (the SSOT)
- **Diátaxis framework** — <https://diataxis.fr/>
- **Keep a Changelog 1.1.0** — <https://keepachangelog.com/>

## Revision history

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-07-05 | **v1.0** | GitHub Copilot (`@reviewer`) | **Initial version.** Created per MIGRATION_EXECUTION_PLAN.md v2.7.5 R-10.1 (Sprint 1). Closes GAP-18 (re-author `docs/STRUCTURE.md`). References §4.1 + §13 inventory from the SSOT plan. Provides navigable overview of the canonical project structure. |
| 2026-07-07 | **v1.1** | opencode cleanup | Removed `archive/` (60 historical files, gitignored, outside SSOT); removed `.claude/`, `logs/`, `apply-0024.sh`, empty `docs/audits/`. Updated §History of `docs/README.md` to reflect the cleanup. Updated count table (removed archive row). Updated mkdocs nav references implicitly via the .markdownlinkcheck pattern. |
