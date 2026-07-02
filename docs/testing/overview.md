# Testing — Nouf-ex

> **Last updated:** 2026-07-02 · **Status:** healthy — 779 passed, 3 skipped
> across 57 Vitest files · 18 PHASE PowerShell scripts · 17 smoke scripts.
> **Source of truth:** [`PHASE_TEST_TASKS.md`](PHASE_TEST_TASKS.md).

Automated checks that exercise the project's critical paths so we know things
work before we ship.

## What we test (the pyramid)

```text
                 ▲ E2E (slowest, smallest)
                ╱ ╲      18 PHASE PowerShell scripts
               ╱   ╲     + 17 smoke scripts
              ╱─────╲    (run against a live stack)
             ╱       ╲
            ╱         ╲   Integration (Vitest + supertest)
           ╱           ╲  ≈ 40 tests covering the Express app
          ╱             ╲ with the real DB layer, but `pg` mocked.
         ╱───────────────╲
        ╱                 ╲ Unit (Vitest, co-located)
       ╱                   ╲ ≈ 720 tests — utilities, hooks,
      ╱                     ╲ components, contexts, route handlers.
     ╱───────────────────────╲
```

We follow this ordering: most tests are unit, fewer are integration,
fewest are E2E. New code lands at the bottom of the pyramid first (unit)
and only climbs up when there is integration value to capture.

## What we test (concrete layers)

| Layer          | Where it lives                                | Runs against                | Tools                       |
|----------------|-----------------------------------------------|------------------------------|------------------------------|
| **E2E**        | `tests/e2e/phaseNN_*.ps1` (+ `smoke/`)         | Live `npm run api` + Vite dev| PowerShell 5.1 + `curl`     |
| **Integration**| `app/server/tests/api-server.test.ts`          | Express app, `pg` mocked    | Vitest 4 + supertest         |
| **SQL schema** | `app/server/tests/schema.test.ts`              | Parses `database/*.sql`     | Vitest 4 (no DB)            |
| **Frontend**   | `app/src/**/__tests__/**/*.test.{ts,tsx}`      | happy-dom env               | Vitest 4 + RTL + MSW        |
| **UI smoke**   | `app/src/pages/__tests__/ui-smoke.test.tsx`    | happy-dom env               | Vitest 4 + RTL              |

| What we explicitly **don't** test | Why                                              |
|------------------------------------|--------------------------------------------------|
| Real Postgres execution            | Slow, flaky on CI; `pg` is mocked throughout.    |
| Visual layout / CSS                | No visual regression tool wired up (track F.1).  |
| Cross-browser (Safari, Firefox)    | happy-dom is good-enough for our logic assertions. |
| Performance / load                 | Out of scope pre-launch (master plan §5-years).  |

The unit/integration tests **do not** need a live database. `pg` is mocked
globally in [`app/tests/setup.ts`](../app/tests/setup.ts), so the entire
suite runs offline.

## Running

All commands are run from the [`app/`](../app/) directory.

```bash

# Run all tests once

npm test

# Watch mode (re-runs on file change)

npm run test:watch

# Run with V8 coverage report → ./coverage/

npm run test:coverage

# Filter to a single file or pattern

npx vitest run server/tests/api-server.test.ts
```

## Layout

```
app/
├── vitest.config.ts        # vitest setup (aliases, coverage, timeouts)
├── tests/
│   ├── setup.ts            # dotenv + test env defaults + global pg mock
│   │                       # (loaded once for every test file; also sets
│   │                       #  a dummy DATABASE_URL so api-server.ts imports
│   │                       #  without throwing — pg is mocked anyway)
│   ├── api-server.test.ts  # Express routes — integration tests (DB mocked)
│   ├── schema.test.ts      # SQL files — structural assertions
│   ├── mocks/
│   │   ├── handlers.ts     # MSW handlers for fetch mocking
│   │   ├── browser.ts      # MSW browser worker
│   │   ├── server.ts       # MSW node server
│   │   ├── fetch-spy.ts    # Spy wrapper around window.fetch
│   │   └── fixtures/       # Static JSON fixtures (categories, orders, products, …)
│   └── README.md           # this file (now lives at docs/testing.md)
└── server/db/pg-wrapper.cts  # the PgDb wrapper under test
```

Component / hook / context tests live **next to the code they cover**:

```
src/
├── components/__tests__/   # BottomNav, Navbar, ProtectedRoute, Skeletons, Toast
├── context/__tests__/      # AppContext, CartContext
└── hooks/__tests__/        # useApi, use-mobile
```

## Conventions

- **Co-located unit tests** for code in `src/<layer>/` go in
  `src/<layer>/__tests__/<name>.test.{ts,tsx}`. Vitest picks them up via the
  `src/**/__tests__/**/*.test.{ts,tsx}` glob in [`vitest.config.ts`](../app/vitest.config.ts).
- **Cross-cutting tests** (API, schema, fixtures) live in `tests/` at the
  app root.
- Use Vitest's globals (`describe`/`it`/`expect`) — already enabled in
  `vitest.config.ts`.
- Use the global `vi.mock('pg', …)` from `setup.ts` to stub the driver; do
  **not** re-mock `pg` per-file unless you need different behaviour.
- Keep tests deterministic: prefer stubs and explicit return values over
  time-based or random fixtures.

## Live metrics (snapshot 2026-07-02)

| Metric                             | Value                                              |
|------------------------------------|----------------------------------------------------|
| Total Vitest tests                 | **779 passed · 3 skipped** across **57 files**     |
| Vitest version                     | **4.1.9**                                          |
| E2E PHASE scripts                  | **18** (numbered `phase00_…` → `phase17_…`)        |
| E2E smoke scripts                  | **17** (in `tests/e2e/smoke/`)                     |
| Average E2E runtime                | ~3 min per PHASE script (isolated run)             |
| Average Vitest runtime             | ~30 s full suite, ~12 s incremental               |
| Coverage (`npm run test:coverage`) | tracked per sprint; target ≥ 70% on `app/src/lib/` |
| Last green run                     | 2026-06-29 (commit `f1daef1` — see CHANGELOG)       |

> **How to regenerate these numbers:** `cd app && npm test` then
> `npm run test:summary` (`scripts/test-summary.cjs`).

## Convention cheatsheet

> The full version is in [`conventions.md`](conventions.md).
> The standards-mapping versions live under [`standards/`](standards/).

- **One behaviour per test.** Name reads like `<unit> <expected> when <condition>`.
- **AAA visible** — comment `// Arrange` / `// Act` / `// Assert` once each.
- **No I/O without setup.** Filename tells you: `api-server.test.ts` is
  server, `<page>.test.tsx` is UI.
- **MSW for fetch, mocks for modules.** Don't mix.
- **No real `pg`.** The global mock in `app/tests/setup.ts` is enough.
- **Helpers > copy-paste.** Add to `tests/e2e/helpers/PS_TestHelpers.ps1`
  or `app/src/lib/__tests__/test-utils.tsx`, not the next test file.

## Adding a new test

1. Pick the right layer (unit vs integration) and place the file accordingly.
2. If it touches the DB layer, rely on the global `pg` mock — no setup needed.
3. Run `npm run test:watch` while you write — Vitest re-runs only the affected
   tests on save.
4. Make sure `npm run test:coverage` still reports ≥ reasonable coverage for
   `src/lib/`.
5. If you add a new PHASE or smoke script, also add the design spec under
   `docs/testing/phases/` (see [`PHASE_TEST_TASKS.md`](PHASE_TEST_TASKS.md)).

## CI integration

The full pipeline is in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
(documented in [`../development/ci-cd.md`](../development/ci-cd.md) §D.1).
For an ad-hoc local run:

```yaml
- run: cd app && npm ci
- run: cd app && npm run lint
- run: cd app && npm run typecheck
- run: cd app && npm test
- run: cd app && npm run build
```

`npm test` exits non-zero on any failure, so it can be wired into any CI
runner as-is:

```yaml
- run: cd app && npm ci
- run: cd app && npm test
```

## When tests fail

1. Read the diff between the previous green and current run.
2. If the failure is a **route handler** → check `app/server/middleware.ts`
   and the relevant route file (`app/server/routes/<file>.cts`).
3. If the failure is a **frontend hook** → check the consumer + the
   underlying `lib/api.ts` function.
4. If the failure is a **PHASE script** → reset state with
   `node tests/e2e/reset-rate-limit.cjs` then re-run.
5. For the deep rabbit hole, follow
   [`../development/debugging.md`](../development/debugging.md).

## Status legend

| Symbol | Meaning                                                |
|--------|--------------------------------------------------------|
| ✅     | Live, passing on `main`                                 |
| 🔄     | Live but flaky under load (documented in the PHASE spec) |
| ⚠️     | Live but known-broken — see CHANGELOG §Unreleased       |
| ⏳     | Planned but not yet written                             |
