# Testing — Nouf-ex

Automated checks that exercise the project's critical paths so we know things
work before we ship.

## What we test

| Layer                | File                                          | What it covers                                                                                          |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **API server**       | [`app/server/tests/api-server.test.ts`](../app/server/tests/api-server.test.ts) | health endpoint, categories/stores/products endpoints, error handling, static fallback                  |
| **SQL schema files** | [`app/server/tests/schema.test.ts`](../app/server/tests/schema.test.ts)         | master + extra schemas declare the expected tables, dependency order is correct, data dump uses PG booleans |
| **PgDb wrapper**     | covered transitively through `api-server.test.ts` (via the global `pg` mock) and through `setup.ts`. | placeholder rewriting, SQL normalization, `.all/.get/.run`, transactions, `close()` are all exercised when the API server test runs. |

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

## Adding a new test

1. Pick the right layer (unit vs integration) and place the file accordingly.
2. If it touches the DB layer, rely on the global `pg` mock — no setup needed.
3. Run `npm run test:watch` while you write — Vitest re-runs only the affected
   tests on save.
4. Make sure `npm run test:coverage` still reports ≥ reasonable coverage for
   `src/lib/`.

## CI integration

`npm test` exits non-zero on any failure, so it can be wired into any CI
runner as-is:

```yaml
- run: cd app && npm ci
- run: cd app && npm test
```
