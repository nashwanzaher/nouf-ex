# `app/src/` — Frontend SPA

React 19 + TypeScript + Vite single-page app that talks to the Express
API at `app/server/`. Ships a PWA service worker for offline shell.

## Layout

```
app/src/
├── main.tsx                  # ReactDOM.createRoot — bootstraps <App />
├── App.tsx                   # Routes — every page is React.lazy()
├── App.css / index.css       # Tailwind base + custom CSS variables
│
├── components/               # Cross-page UI primitives
│   ├── Layout.tsx            # Navbar/Footer/BottomNav shell
│   ├── ErrorBoundary.tsx     # Catches render-phase exceptions
│   ├── ProtectedRoute.tsx    # RBAC guard (customer|merchant|admin)
│   ├── Skeletons.tsx         # Reusable loading placeholders
│   ├── Toast.tsx             # AppContext-aware toast renderer
│   └── ui/                   # shadcn/ui-style primitives (Card, Button, …)
│
├── context/                  # React Context providers
│   ├── AppContext.tsx        # Auth + i18n + cart-from-server bridging
│   └── CartContext.tsx       # Client-side cart mutation API
│
├── hooks/                    # Data hooks (React+fetch wrappers)
│   └── useApi.ts             # Public hooks: useProducts, useOrders, …
│                             # Admin hooks: useAdminStats, useAdminUsers…
│                             # Seller hooks: useSellerStore, useSellerDashboard…
│
├── lib/                      # Non-React utilities
│   ├── api.ts                # Typed fetch wrapper + type-only contracts
│   ├── format.ts             # formatMoney / formatMoneyCompact / parseMoney
│   ├── utils.ts              # cn(), general-purpose helpers
│   └── cart-sync.ts          # Bridges AppContext ↔ CartContext ↔ /api/cart
│
├── i18n/                     # i18next setup
│   ├── config.ts             # Detector + fallback chain
│   └── locales/{ar,en,zh}.json  # Source strings
│
├── pages/                    # Route pages (one folder per area)
│   ├── Home/                 # index.tsx + 11 sub-section components
│   ├── auth/                 # Login, Register, Forgot/Reset password
│   ├── customer/             # Customer dashboard + orders/wishlist/…
│   ├── seller/               # Merchant dashboard, products, orders, analytics
│   ├── admin/                # Admin users/stores/products/orders/…
│   ├── ProductDetail.tsx
│   ├── StorePage.tsx
│   ├── Categories.tsx
│   ├── Deals.tsx
│   ├── Checkout.tsx
│   ├── SearchResults.tsx
│   └── NotFound.tsx
│
└── tests/                    # Test setup (loaded by vitest.config.ts)
```

## Path conventions

- Source code uses the `@/` alias for `app/src/` (configured in
  `tsconfig.app.json` `paths` and `vitest.config.ts` `resolve.alias`).
  Always import as `@/lib/...` or `@/hooks/...` — never `../../../`.
- Component files are PascalCase (`ProductCard.tsx`); utilities are
  camelCase (`formatMoney`). Hooks always start with `use` (`useApi`).
- CSS Modules use the matching `.module.css` suffix next to the
  component (`CustomerDashboard.module.css` ↔ `CustomerDashboard.tsx`).
  Tailwind utility classes are the default for any non-CSS-module page.

## Routes (`App.tsx`)

Every page is `React.lazy()`-loaded so the initial bundle stays small:

| Route                              | Roles                              |
| ---------------------------------- | ---------------------------------- |
| `/` `/search` `/product/:id` `/store/:id` `/categories` `/deals` | public |
| `/checkout`                        | customer, merchant, admin           |
| `/auth/login` `/register` `/forgot-password` `/reset-password` | public |
| `/customer` `/orders` `/wishlist` `/reviews` `/addresses` `/notifications` | customer, merchant, admin |
| `/seller` `/products` `/orders` `/analytics` | merchant, admin |
| `/admin` `/users` `/overview` `/stores` `/disputes` `/reports` | admin |
| `*`                                | NotFound                            |

`ProtectedRoute` is the single source of truth for role gating — never
add ad-hoc role checks in a component.

## i18n

- Source strings live in `app/src/i18n/locales/{ar,en,zh}.json`.
- Components use `const { t } = useTranslation()` and pass a fallback
  to every `t('...', 'English fallback')` so a missing key still
  renders.
- To add a key:
  1. Add it to **en** first (canonical).
  2. Mirror to **ar** and **zh** (machine translations OK for dev;
     human review required before any release).
  3. The CI lint catches keys used by `t('…')` that aren't in any
     locale (see `docs/testing/standards/google-style.md`).

## Data hooks

`app/src/hooks/useApi.ts` mirrors `app/src/lib/api.ts` one-to-one. For
every exported server-side endpoint there is a hook named
`use<Resource>` returning `{ data, loading, error, refetch }`:

```tsx
const { data: stats, loading } = useAdminStats();
```

- All hooks internally use `useDataHook(fetcher)` which:
  - Adds an `AbortController` to every fetch (kills in-flight requests
    on unmount or dep change).
  - Returns `data: undefined` on first render (not `null`) so callers
    using default destructuring get the fallback immediately.
  - Silently swallows `AbortError`.

To add a new hook:
1. Add the underlying function to `app/src/lib/api.ts` (typed return!).
2. Add a `use<Name>` hook in `app/src/hooks/useApi.ts` that wraps
   `useDataHook((signal) => get<Name>(args, { signal }))`.
3. Stub it in `app/src/pages/__tests__/ui-smoke.test.tsx` so the smoke
   suite doesn't break for pages that render it.

## Testing patterns

- **Unit tests** — vitest. Co-locate as `__tests__/<name>.test.tsx`
  next to the module under test, or as `<name>.test.tsx` side-by-side.
- **Smoke render** — `app/src/pages/__tests__/ui-smoke.test.tsx` renders
  every page under `<AppProvider><CartProvider>` and asserts "no
  throw". Catches missing mocks and hooks returning unhandled null.
- **DOM project vs server project** — `vitest.config.ts` declares two
  projects. UI files run in `happy-dom`; server tests run in plain
  `node` with `pg` mocked.
- See `docs/testing/standards/google-style.md` for naming conventions
  and `no-restricted-syntax` rules.

## Adding a new page (checklist)

1. Create the file under `app/src/pages/<area>/<Name>.tsx`.
2. Register the route in [`App.tsx`](./App.tsx):
   - `const <Name> = lazyPage(() => import('./pages/<area>/<Name>'));`
   - `<Route path="/<slug>" element={guard([roles], <Name>)} />` if
     gated, or `<Route path="/<slug>" element={<Name>} />` if public.
3. Wire data via a hook from `@/hooks/useApi` — never call `fetch` from
   a component directly.
4. If the page needs an API wrapper that doesn't exist yet, add it to
   `app/src/lib/api.ts` (typed return) + corresponding hook in
   `useApi.ts` + smoke-test stub.
5. Add a UI smoke test fixture under
   `app/src/pages/__tests__/ui-smoke.test.tsx`.
6. Add the i18n keys (en first, then ar, then zh).

## Linting / type / build

```sh
# from app/
npm run typecheck       # tsc --noEmit (uses tsconfig.app.json)
npm run lint            # eslint . (uses eslint.config.js)
npm run format          # prettier --write .
npm run test            # vitest run (57 files, ~776 tests)
npm run build           # vite build → dist/ + service worker
npm run api             # tsx server/index.ts
```

## Conventions summarised

- **No `fetch()` in components** — go through `lib/api.ts` so headers,
  abort, and envelope parsing stay in one place.
- **No `console.log`** in committed code — use the structured logger
  or `useApp().addToast`.
- **No `any`** — every API surface is typed in `lib/api.ts`; cast at
  the boundary if you must.
- **i18n keys always have a fallback** to `t('admin.navUsers', 'Users')`
  so a missing translation is obvious in render but never blank.
