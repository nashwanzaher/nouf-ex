# Testing Standards — Quick Reference

> **Audience**: everyone writing tests. **Last updated**: 2026-06-29.
> **Goal**: keep our test suite readable, fast, and reliable so the
> 776-test smoke suite stays maintainable as the codebase grows.

This is a condensed, project-flavored version of common industry
guidance (Google Test Blog, Kent C. Dodds, Testing Library docs).
Pick the rule that fits the situation; don't cargo-cult.

---

## 1. The Three Laws

1. **One behaviour per test.** A test name should read like a sentence
   that says "X does Y when Z". Split multi-assertion tests into
   multiple `it()` blocks.
2. **No I/O without setup.** If a test touches the network or DB,
   declare that intent in the filename (`api-server.test.ts`,
   `schema.test.ts`) and isolate the side-effect in `beforeAll`/`afterAll`.
3. **Tests are docs.** A future contributor reading the test name
   should know what the production code is supposed to do.

## 2. File & folder layout

```
app/
├── src/
│   ├── lib/
│   │   ├── format.ts
│   │   └── __tests__/
│   │       └── format.test.ts        ← co-located, mirrors the unit
│   ├── pages/
│   │   ├── __tests__/                ← page-level smoke tests
│   │   │   ├── ui-smoke.test.tsx
│   │   │   ├── Categories.test.tsx
│   │   │   └── …
│   │   └── ProductDetail.tsx
│   └── hooks/
│       └── useApi.ts
└── server/
    └── tests/
        ├── api-server.test.ts        ← supertest over the real app
        └── schema.test.ts            ← structural SQL checks
```

- `app/tests/setup.ts` is loaded by **every** Vitest project — it
  mocks `pg`, sets env defaults, and registers `@testing-library/jest-dom`.
- Use `__tests__` for "I want this test to live close to the code".

## 3. Naming

```ts
// GOOD
it('renders the welcome banner when the user is signed in', …)
it('throws ApiError with status 401 when token is expired', …)
it('groups orders by month when the response is paginated', …)

// BAD
it('test 1', …)
it('works', …)
it('handles user', …)  ← "handles" is meaningless
```

Pattern: **`<unit> <expected behaviour> when <condition>`**.

## 4. Arrange / Act / Assert

Every test should be visibly structured:

```ts
it('deducts shipping cost from the order total', () => {
  // Arrange — set up the world
  const items = [makeItem({ price: 10_000 }), makeItem({ price: 5_000 })];
  const shipping = makeShipping({ base_cost: 500 });

  // Act — exercise the unit
  const total = calculateOrderTotal(items, shipping);

  // Assert — what we expect
  expect(total).toBe(15_500);  // 10k + 5k + 500
});
```

If a test has `// Act` but no `// Arrange` and no `// Assert`
comments, it's usually a smell.

## 5. Mocks — `vi.mock` vs inline `vi.fn`

| Need                                          | Use                                  |
| --------------------------------------------- | ------------------------------------ |
| Mock an entire module's exports               | `vi.mock('@/lib/api', …)`            |
| Mock a single method in an already-real module | `vi.spyOn(obj, 'method')`            |
| Inline anonymous function mock                 | `vi.fn().mockReturnValue(...)`       |

Avoid `vi.fn()` for module-level work — it's a smell that the test
is reaching into internals it shouldn't know about.

## 6. Async tests

```ts
// GOOD — explicit done
it('loads the user profile', async () => {
  render(<Profile />);
  expect(await screen.findByText('Ahmed')).toBeInTheDocument();
});

// BAD — fire-and-forget; the test passes even if the assertion never runs
it('loads the user profile', () => {
  render(<Profile />);
  screen.findByText('Ahmed').then(t => expect(t).toBeInTheDocument());
});
```

The default `testTimeout` is 20 s. Anything that genuinely needs
more (e.g. large backend seed) should mark itself with
`it('…', { timeout: 60_000 }, async …)`.

## 7. The smoke render suite

`app/src/pages/__tests__/ui-smoke.test.tsx` is a special-case file.
It renders **every page** under `<AppProvider><CartProvider>` and
asserts it doesn't throw. It does NOT assert visual correctness.

Rules for keeping it healthy:

- Every new page must add a stub block in the `vi.mock('@/hooks/useApi', …)`
  factory. Otherwise the page tries to hit a real endpoint.
- Every new dependency imported by a page must NOT introduce side
  effects at import time. If `import 'some-lib'` runs `console.log`,
  silence it in setup.ts.
- It must stay under 25 s end-to-end. If it grows past that, the
  page boundary has gotten too expensive to render synchronously and
  should be split.

## 8. Coverage expectations

- **Unit tests** for any new pure function in `lib/`. Aim ≥ 90 %
  branch coverage on `lib/format.ts`, `lib/utils.ts`, `lib/jsonData.ts`.
- **Hook tests** for any new data hook. The smoke render suite covers
  "mounts without crashing"; a focused test covers "calls apiRequest
  with the right URL and forwards the result".
- **Route tests** for any new endpoint. Use supertest with the real
  Express app and a mocked `pg`.

## 9. Lints you'll trip if you don't

These are enforced by `eslint.config.js`. If the linter is unhappy,
your test is wrong, not the linter.

- `no-floating-promises` — every Promise must be `await`ed or
  `.then`-ed. Use `await render(...)` not `render(...).catch(...)`.
- `react-hooks/rules-of-hooks` — `it('…', () => { const [x, setX] =
  useState(); … })` will fail; the body must be the render function
  you give to `render()`.
- `@typescript-eslint/no-floating-promises` — return, don't fire.

## 10. Anti-patterns (don't do this)

```ts
// ❌ Don't rely on test order
let sharedUser;
it('test A', () => { sharedUser = createUser(); });
it('test B', () => { /_ uses sharedUser _/ });

// ❌ Don't snapshot large JSON blobs — it'll churn forever
expect(response).toMatchSnapshot();

// ❌ Don't mix server / DOM tests in one project
import { db } from '../../app/server/db';        // wrong project
```

## 11. Debugging a failing test

1. Run **just that file**: `npx vitest run path/to/file.test.ts`.
2. Add `--reporter=verbose` to see the full test name.
3. If it's a smoke suite failure: which page? Check that page's new
   imports against the `vi.mock` stubs in ui-smoke.test.tsx.
4. If it's an order-dependent flake: you've probably got shared state.
   Add a `beforeEach(() => vi.restoreAllMocks())`.

## 12. Naming conventions — tests file patterns

| Pattern                       | Where it lives                          |
| ----------------------------- | --------------------------------------- |
| `<unit>.test.ts(x)`           | same folder as `<unit>`, or in `__tests__` |
| `api-server.test.ts`          | `app/server/tests/`                     |
| `ui-smoke.test.tsx`           | `app/src/pages/__tests__/`              |
| `schema.test.ts`              | `app/server/tests/`                     |

That's it. When in doubt, look at the file next to the function you're
testing — the test should be discoverable from the production code
without searching the repo.

---

**Last reviewed by**: maintainers. **Sign-off**: this style is in
effect from 2026-06-29 forward.
