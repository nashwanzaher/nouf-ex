# Testing Structure — Canonical Reference

> **Last verified:** 2026-07-05 (per MIGRATION_EXECUTION_PLAN.md v2.8.1 §41 R-3 execution)
> **Status:** All counts and paths verified against actual filesystem
> **Authority:** This document supersedes §13 of MIGRATION_EXECUTION_PLAN.md for testing-specific structure
> **Purpose:** Single canonical reference for Nouf-ex test organization. Explains the heterogeneous 3-tier pattern and when to add new tests where.

This document is the **canonical reference** for how tests are organized in the Nouf-ex project. The pattern is **heterogeneous by design** (not a uniform `__tests__/` everywhere) because the test runner has **two distinct projects** with different environments, and the test subjects span server-side (Node) and browser-side (DOM) code.

## TL;DR — The 3-Tier Pattern

| Tier | Where | Environment | What it tests | Total files |
|------|-------|-------------|---------------|------------:|
| **Server tests** | `app/server/tests/` | `node` (pg mocked) | API routes, server helpers, db wrapper | **33** |
| **Frontend tests** | `app/src/**/__tests__/` | `happy-dom` (RTL + MSW) | Components, hooks, context, lib, pages | **32** |
| **E2E (manual/CI)** | `tests/e2e/` | Live stack | Full stack via PowerShell + curl | **18 PHASE + 17 smoke** |
| **Setup & mocks** | `app/tests/` | (used by Vitest) | Vitest setup, MSW handlers, fixtures | **1 setup + 4 mock modules** |

**Total Vitest tests:** 65 files / ~720 tests passing + 3 skipped (per §11.3 audit).

---

## Tier 1 — Server Tests (`app/server/tests/`)

### Layout

```
app/server/tests/
├── api-server.test.ts              # Full API integration via supertest
├── schema.test.ts                  # Parses database/*.sql and asserts structure
├── addresses-router.test.ts        # Route-specific unit tests
├── admin-mutations.test.ts
├── admin-read-router.test.ts
├── auth-2fa.test.ts
├── auth-router.test.ts
├── backup-codes.test.ts
├── cart-router.test.ts
├── catalog-router.test.ts
├── coupons-router.test.ts
├── customer-mutations.test.ts
├── health-rate-limit.test.ts
├── notifications/                  # (subfolder for grouped notification tests)
├── notifications-and-admin-products.test.ts
├── notifications-router.test.ts
├── orders-router.test.ts
├── partial-token.test.ts
├── payments-router.test.ts
├── pg-wrapper.test.ts              # Tests app/server/db/pg-wrapper.cts
├── populate-product-images.test.ts
├── refunds-router.test.ts
├── reviews-router.test.ts
├── search.test.ts
├── security-fixes.test.ts
├── seller-router.test.ts
├── settings.test.ts
├── shipping-router.test.ts
├── stats-router.test.ts
├── store-followers-router.test.ts
├── test-helpers.test.ts
├── test-token.ts                   # (helper, not a test)
├── totp.test.ts
└── wishlist-router.test.ts
```

**Total: 33 files** (32 `.test.ts` + 1 helper).

### Vitest Configuration

Defined in [`app/vitest.config.ts`](../../app/vitest.config.ts) under `projects[0]` (named `server`):

```typescript
{
  name: 'server',
  environment: 'node',
  setupFiles: [path.resolve(__dirname, 'tests/setup.ts')],
  include: [
    'tests/**/*.test.{js,ts,tsx,cjs,mjs}',
    'server/tests/**/*.test.{js,ts,tsx,cjs,mjs}',
  ],
}
```

### When to add a new server test

| If you're testing… | Add to… | File naming |
|--------------------|---------|-------------|
| An API route handler | `app/server/tests/<route>-router.test.ts` | `<route>-router.test.ts` |
| A server-side helper (e.g., `app/server/lib/totp.ts`) | `app/server/tests/<helper>.test.ts` | `<helper>.test.ts` |
| Database schema validation | `app/server/tests/schema.test.ts` | Append to existing |
| Full API integration (multiple routes) | `app/server/tests/api-server.test.ts` | Append to existing |
| Auth / JWT / partial-token logic | `app/server/tests/auth-router.test.ts` (or new file) | Group by domain |

---

## Tier 2 — Frontend Tests (`app/src/**/__tests__/`)

### Layout (co-located pattern)

Frontend tests follow the **co-located pattern**: each test file lives next to the code it tests, in a `__tests__/` subfolder. This is a deliberate choice (see ADR-0005 / Vitest project structure guide).

```
app/src/
├── __tests__/a11y/                 # Cross-component a11y tests (4 files)
│   ├── a11y-types.d.ts
│   ├── AdminDashboard.a11y.test.tsx
│   ├── CustomerDashboard.a11y.test.tsx
│   └── ReportsAnalytics.a11y.test.tsx
├── components/__tests__/           # Component tests (8 files)
│   ├── BottomNav.test.tsx
│   ├── ErrorBoundary.test.tsx
│   ├── Footer.test.tsx
│   ├── Layout.test.tsx
│   ├── Navbar.test.tsx
│   ├── ProtectedRoute.test.tsx
│   ├── Skeletons.test.tsx
│   └── Toast.test.tsx
├── context/__tests__/              # React context tests (2 files)
│   ├── AppContext.test.tsx
│   └── CartContext.test.tsx
├── hooks/__tests__/                # Custom hooks tests (3 files)
│   ├── use-mobile.test.ts
│   ├── useApi.test.tsx
│   └── useCheckoutHooks.test.tsx
├── lib/__tests__/                  # Frontend lib tests (4 files)
│   ├── api.test.ts
│   ├── cart-sync.test.ts
│   ├── format.test.ts
│   └── utils.test.ts
└── pages/__tests__/                # Page-level tests (14 files)
    ├── a11y.test.tsx               # (multi-page a11y sweep)
    ├── Categories.test.tsx
    ├── Checkout.test.tsx
    ├── Deals.test.tsx
    ├── ForgotPassword.test.tsx
    ├── Login.test.tsx
    ├── NotFound.test.tsx
    ├── ProductDetail.test.tsx
    ├── Register.test.tsx
    ├── ResetPassword.test.tsx
    ├── SearchResults.test.tsx
    ├── StorePage.test.tsx
    ├── ui-smoke.test.tsx           # (cross-page UI smoke)
    └── Wishlist.test.tsx
```

**Total: 32 files** (28 standard `.test.{ts,tsx}` + 4 dedicated `.a11y.test.tsx`).

### Vitest Configuration

Defined in [`app/vitest.config.ts`](../../app/vitest.config.ts) under `projects[1]` (named `dom`):

```typescript
{
  name: 'dom',
  environment: 'happy-dom',
  setupFiles: [path.resolve(__dirname, 'tests/setup.ts')],
  include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
}
```

### Why `.a11y.test.tsx` (not `.test.tsx`)?

The 4 files in `app/src/__tests__/a11y/` use the suffix `.a11y.test.tsx` (not `.test.tsx`) to enable selective execution via the npm script:

```jsonc
// app/package.json
"test:a11y": "vitest run --dir src/__tests__/a11y"
```

This lets CI run a11y tests separately with a stricter gate (zero axe violations).

### When to add a new frontend test

| If you're testing… | Add to… | File naming |
|--------------------|---------|-------------|
| A component in `app/src/components/` | `app/src/components/__tests__/<Name>.test.tsx` | `<Name>.test.tsx` |
| A page in `app/src/pages/` | `app/src/pages/__tests__/<Page>.test.tsx` | `<Page>.test.tsx` |
| A React context | `app/src/context/__tests__/<Name>.test.tsx` | `<Name>.test.tsx` |
| A custom hook | `app/src/hooks/__tests__/<hook-name>.test.ts` | `<hook-name>.test.ts` |
| A frontend lib (format, utils, etc.) | `app/src/lib/__tests__/<name>.test.ts` | `<name>.test.ts` |
| Cross-cutting a11y for an admin page | `app/src/__tests__/a11y/<Page>.a11y.test.tsx` | `<Page>.a11y.test.tsx` |

---

## Tier 3 — E2E Tests (`tests/e2e/`)

### Layout

```
tests/e2e/
├── helpers/                        # PowerShell helper functions
├── smoke/                          # Quick smoke scripts (~17 files)
├── reports/                        # Test run output (gitignored)
├── e2e-step1.ps1                   # (manual bootstrap script)
└── phases/                         # (Documentation only; actual scripts in root)
    ├── PHASE_00_HEALTH_AUTH.md
    ├── PHASE_01_PROFILE_ADDRESSES.md
    ├── ...
    └── PHASE_17_FULL_REGRESSION.md
```

**Total: 18 PHASE scripts + 17 smoke scripts + ~20 docs in `phases/`.**

### When to run

E2E tests run **against a live stack** (npm run api + Vite dev server + PostgreSQL). They are NOT part of `npm test`. They are invoked manually or via CI workflow `ci.yml` job `server-boot` (smoke subset only).

---

## Setup & Mocks (`app/tests/`)

### Layout

```
app/tests/
├── setup.ts                        # Vitest global setup (MSW server, polyfills)
└── mocks/                          # MSW handlers + fixtures
    ├── fetch-spy.ts
    ├── handlers.ts
    ├── server.ts                   # MSW server instance
    └── fixtures/                   # (18 JSON fixture files)
```

### Why this folder isn't named `__tests__/`

`app/tests/` is the **Vitest setup root** (not a test directory). It contains:

- **`setup.ts`** — imported by `setupFiles` in `vitest.config.ts`
- **`mocks/`** — MSW handlers + fetch spies used by tests via `setup.ts`

The folder is **deliberately named `tests/` (plural, top-level)** to distinguish it from co-located `__tests__/` folders. The `tests/**/*.test.{js,ts,...}` glob in `vitest.config.ts` does NOT match this folder because it has no `.test.` files.

---

## Why the pattern is heterogeneous (not uniform)

### Decision rationale

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **A. All in `app/tests/`** (one big folder) | Easy to find | Loses co-location; tests far from code | ❌ Rejected |
| **B. All co-located `__tests__/`** | Co-location everywhere | Server tests don't have a "near" code home; breaks Vitest projects | ❌ Rejected |
| **C. Hybrid (current)** | Co-location for frontend (where it matters), dedicated `server/tests/` for backend | Heterogeneous — needs this doc | ✅ **Chosen** |

### What would change if we switched

The Vitest 4 project structure allows changing `include` patterns without code moves. But:

- Moving `app/server/tests/` → `app/src/server/__tests__/` would require renaming 33 files and updating CI paths
- The current pattern aligns with the **Vitest project separation**: 2 projects with different environments

Per MIGRATION_EXECUTION_PLAN.md §27 R3 phase ("no file moves — would break imports"), the heterogeneous pattern is **stable** and **documented here** as the canonical reference.

---

## Quality Gates

| Gate | Command | Target |
|------|---------|--------|
| TypeScript | `cd app && npx tsc -b --noEmit` | exit 0 |
| ESLint | `cd app && npx eslint .` | exit 0 |
| Vitest (full) | `cd app && npm test` | 720+ passed |
| Vitest (a11y only) | `cd app && npm run test:a11y` | 13 passed, 0 axe violations |
| Vitest (coverage) | `cd app && npm run test:coverage` | ≥50% lines, ≥55% functions (per §30 R-4 thresholds) |
| Vitest (UI) | `cd app && npm run test:ui` | interactive |

See MIGRATION_EXECUTION_PLAN.md §30 R-4 for the coverage thresholds rationale (set just below baseline for regression prevention without flapping).

---

## How to add a new test (decision tree)

```
START
  │
  ├─ Testing API/route/server lib?
  │   └─ → Add to app/server/tests/
  │         (named after the file/feature tested)
  │
  ├─ Testing React component/hook/context/page/lib?
  │   └─ → Add co-located in app/src/<dir>/__tests__/
  │         (mirror the source folder structure)
  │
  ├─ Testing a11y across multiple components?
  │   └─ → Add to app/src/__tests__/a11y/<Name>.a11y.test.tsx
  │         (uses the `.a11y.test.tsx` suffix for npm run test:a11y)
  │
  └─ Testing full-stack E2E (live server)?
      └─ → Add to tests/e2e/ as a PowerShell script
            (or extend tests/e2e/smoke/ for quick smoke)
```

---

## Cross-references

- **Vitest config:** [`app/vitest.config.ts`](../../app/vitest.config.ts) (2 projects: `server` + `dom`)
- **Test runner:** Vitest 4.1.9 (per `app/package.json`)
- **Test framework:** [vitest.dev/guide/structure](https://vitest.dev/guide/structure)
- **ADRs:**
  - [ADR-0005: TypeScript Project References](../../planning/adr/0005-tsconfig-project-references.md)
  - [ADR-0003: SSOT Production Monolith](../../planning/adr/0003-ssot-production-monolith.md)
- **Related docs:**
  - [overview.md](overview.md) — what we test (the pyramid)
  - [conventions.md](conventions.md) — testing conventions
  - [standards/](../../docs/testing/standards/) — standards docs
  - [templates/](../../docs/testing/templates/) — test scaffolding templates
- **Migration history:** This document was created per MIGRATION_EXECUTION_PLAN.md v2.8.1 §41 R-3 execution (2026-07-05)
