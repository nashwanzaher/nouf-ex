# Risk Register — Nouf-ex

> **Owner**: maintainers. **Last updated**: 2026-06-29.
> **Review cadence**: every sprint planning (typically weekly).
> **Severity**: 🔴 blocker · 🟠 high · 🟡 medium · 🟢 low.
> **Likelihood**: ‽ very high · ⁺ high · ~ medium · - low.

Risks are tracked in priority order (severity × likelihood). Each
entry has a single **owner** and a discrete **mitigation** that is
either an action already taken or a follow-up with a target milestone.

---

## 1. 🔴 ⁺ Single-process Express server (no horizontal scaling)

The Express server runs as a single Node process. Rate limiting and
session-like state (used-JTI rows) are stored in Postgres tables that
are themselves single-instance — scaling the API out requires a Redis
swap that's not yet engineered.

**Mitigation**: rate limits live in `rate_limits` (Postgres) with a
60 s cleanup job (`setInterval` in [`index.ts`](../../app/server/index.ts)),
so multi-process won't double-charge limits _once every process sees
the same DB_. The Redis swap is tracked as **Phase I.7**; until then
stay at one replica.

## 2. 🔴 ~ PostgreSQL is the only durable store

No read replicas, no automated failover, no PITR. A single Postgres
host crash kills the product.

**Mitigation**:
- Nightly `pg_dump` to object storage (operator concern — see
  [`docs/operations/backup-restore.md`](../operations/backup-restore.md)).
- All writes go through `db.tx(...)` for atomicity.
- DB connection lives in a singleton `PgDb` instance with reconnect
  on failure (`pg` driver default).

**Follow-up**: scheduled PITR via Barman or managed RDS. Tracked but
not funded.

## 3. 🟠 ⁺ SPA bundle size regressions

Vite emits one large `index-<hash>.js` (~390 kB / 117 kB gzip). Adding
heavy dependencies (a charting lib, a PDF renderer) to top-level pages
inflates TTI for first-time visitors on slow Yemeni 3G.

**Mitigation**:
- Every page is `React.lazy()` so the cost is paid only on navigation.
- `recharts` is code-split into its own chunk (`dist/assets/recharts-*.js`,
  ~432 kB) and only loaded by admin/reports routes.
- The `ui-smoke.test.tsx` mock-prunes non-essential deps so cold tests
  stay under 18 s.

**Follow-up**: Lighthouse CI on PRs (tracked as **F.1**). Add it
before any new chart-heavy page.

## 4. 🟠 ~ No CSRF protection on cookie-authed routes

Today the SPA authenticates with `Authorization: Bearer <token>` in
`localStorage`. There are no cookies, so CSRF is moot — **as long as
we never add session cookies**. The risk is regressing to a session-
cookie auth model.

**Mitigation**:
- [`middleware.ts`](../../app/server/middleware.ts) `optionalAuth`
  explicitly reads the `Authorization` header, not `req.cookies`.
- ESLint convention is to never `import cookie`/`set-cookie` in the
  SPA. (`grep -r cookie app/src` should remain empty.)

**Follow-up**: address this in a future "remember me" RFC **before**
any cookie auth is added.

## 5. 🟠 ~ Postgres connection pool exhaustion

The single `pg.Pool` is sized to default (10 connections). Under
traffic spikes (e.g. CSV export of audit log + admin list pages in
parallel) we can starve.

**Mitigation**:
- All queries use `db.prepare(...).all/get/run` — no per-request
  transient pools.
- Pessimistic `timeouts` on every route via `Promise.race(...)`
  for the readiness probe (template for others if needed).

**Follow-up**: pool size in env, and slow-query alert (>5 s = page).

## 6. 🟡 ⁺ `localStorage` token leaks via XSS

JWTs in `localStorage` are readable by any JS executing in the same
origin. An XSS in a vendored package would leak every active session.

**Mitigation**:
- CSP is set to deny-by-default with no `unsafe-eval` (see
  `securityHeaders` middleware).
- CSP-violation reports are not yet wired (no report-uri) — tracked
  below.
- Vendor packages are pinned exactly; `npm audit` runs in CI but the
  GitHub low-severity Dependabot (1 vuln, `vite`) is unresolved.

**Follow-up** (E.x):
- Add `report-uri` so violations surface in observability.
- Bump `vite` past the low-severity advisory.

## 7. 🟡 ~ Mock data leakage to production builds

Several components keep mock fallbacks (e.g. `chartData` in
`AdminOverview.tsx`) for time-series buckets that no endpoint
currently exposes. If a renderer path forgets the `data &&` guard
the fallback renders in production.

**Mitigation**:
- Every mock fallback is preceded by a `// TODO: C.7 …` comment
  naming the missing endpoint, so it's greppable and reviewable.
- `dev` mocks use distinctive names (`mockOrders`, `revenueData`)
  that the K.1 acceptance criterion (`grep` in MASTER_PLAN §11.3)
  flags.

**Follow-up**: add a CI check that warns when a `mock*` variable is
declared in a file under `app/src/pages/admin/`.

## 8. 🟡 ~ Recharts renders "0 width" warnings under happy-dom

Recharts' `ResponsiveContainer` emits a warning when its bounding rect
is 0×0 (no layout engine). The `ui-smoke.test.tsx` test stubs recharts
to silence this, but a test that forgets the stub will fail noisily.

**Mitigation**: `ui-smoke.test.tsx` mocks every recharts export
individually (see `vi.mock('recharts', ...)`). When adding a new
recharts component, add it to the stub list.

## 9. 🟡 - Time-series analytics endpoint not built

`AdminOverview.tsx` and `ReportsAnalytics.tsx` keep `chartData` mocks
because no endpoint returns monthly revenue / user / orders buckets.
Until C.7 ships, the dashboards show **fixture data** for those
sections only — confirmed by a TODO comment on every fixture array.

**Mitigation**: keep the fixture arrays behind a comment-block plus
the `data && …` guard so a future engineer can find them in one
search. See `app/src/pages/admin/AdminOverview.tsx:32` for the
canonical example.

## 10. 🟡 - Translation drift across ar/en/zh

`zh.json` keys were machine-translated as placeholders for K.2 and
have not had a human review pass. The UI won't break (the en fallback
is shown), but the platform reads as English in zh-CN.

**Mitigation**:
- Every `t('...', '...')` call has an English fallback as its second
  argument, so missing translations never break the UI.
- The translate pipeline is one placeholder file away from real
  strings — once human review funds it, only the JSON files change.

---

## Risk review process

1. New risks are added to the top of the list during weekly review.
2. The owner of each open mitigation surfaces progress in the standup.
3. A risk is **closed** when its mitigation is checked into `main`
   with a passing CI run, not when filed.
4. Risks older than 60 days with no movement are flagged in the next
   planning doc.

The TOP 5 (items 1–5) are considered "going to bite us if we don't
fix them"; items 6–10 are "manage and monitor".
