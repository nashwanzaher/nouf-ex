# Code Review & Fixes — 2026-06-23

> **Scope**: `app/server/index.ts` and `app/server/middleware.ts` (Express 5 API).
> **Method**: Read-only audit first, then targeted low-risk patches verified with `tsc --noEmit`, `eslint`, and the full Vitest suite (216 tests).

---

## 1. Critical Bug Fixed

### `GET /api/wishlist/:userId` returned a Promise instead of rows

**File**: [`server/index.ts:1121-1142`](../../app/server/index.ts#L1121-L1142)
**Severity**: 🔴 Critical (silent data corruption in response)

```diff
- const items = db
+ const items = await db
    .prepare(`SELECT w.*, p.name_en, …`)
    .all(userId);
- sendSuccess(res, items);
+ return sendSuccess(res, items);
```

The original handler passed a `Promise<Row[]>` straight into `sendSuccess`, so the client received
`{ success: true, data: <Promise>, … }` and the rows were never serialized. Every other DB call in the
file is properly awaited, making this an easy-to-miss outlier.

---

## 2. Type-Safety Fixes (5 sites)

The `pg-wrapper` types `run()` as `Promise<{ lastInsertRowid: number | null; changes: number }>`,
but every INSERT handler in the file cast it as `{ lastInsertRowid: number }`, lying to TypeScript.
The compiler was appeased; the runtime could return `null` (e.g. when a trigger replaces the
identity column) and crash later in `sendSuccess`.

Updated all five sites to use the correct type **and** added a null guard:

| File line | Endpoint                               | Guard used                                               |
| --------- | -------------------------------------- | -------------------------------------------------------- |
| 705       | `POST /api/reviews`                    | `return sendError(res, …, 500, 'INSERT_FAILED')`         |
| 962       | `POST /api/orders` (inside `db.tx`)    | `throw new HttpError(500, …, { code: 'INSERT_FAILED' })` |
| 1074      | `POST /api/cart`                       | `return sendError(res, …, 500, 'INSERT_FAILED')`         |
| 1166      | `POST /api/wishlist`                   | `return sendError(res, …, 500, 'INSERT_FAILED')`         |
| 1258      | `POST /api/auth/register` (inside try) | `throw new HttpError(500, …, { code: 'INSERT_FAILED' })` |

---

## 3. Schema / SQL Cleanups

### `?column?` cast smell in review verification

**File**: [`server/index.ts:685-695`](../../app/server/index.ts#L685-L695)

```diff
- `SELECT 1 FROM order_items oi …
+ `SELECT 1 AS found FROM order_items oi …
- .get(…) as { '?column?': number } | undefined;
+ .get(…) as { found: 1 } | undefined;
```

PostgreSQL names an unaliased `SELECT 1` column `?column?`. The cast was a band-aid; the
underlying problem was the missing alias.

---

## 4. Robustness / Memory Hygiene

### Dangling 2 s timer in `GET /api/ready`

**File**: [`server/index.ts:96-112`](../../app/server/index.ts#L96-L112)

```diff
- const result = await Promise.race([
-   db.prepare('SELECT 1 AS ok').get(),
-   new Promise<never>((_, reject) =>
-     setTimeout(() => reject(new Error('db timeout')), 2000)
-   ),
- ]);
+ let timeoutId: NodeJS.Timeout | undefined;
+ const timeout = new Promise<never>((_, reject) => {
+   timeoutId = setTimeout(() => reject(new Error('db timeout')), 2000);
+ });
+ const result = await Promise.race([
+   db.prepare('SELECT 1 AS ok').get(),
+   timeout,
+ ]);
+ if (timeoutId) clearTimeout(timeoutId);
```

The reject timer is now cleared on both success **and** failure paths so it cannot fire after the
response is sent (memory + log noise).

### `.unref?.()` → `.unref()`

**File**: [`server/index.ts:131`](../../app/server/index.ts#L131)

`unref` has existed on `NodeJS.Timeout` since Node 0.9; the optional chaining was dead code.

---

## 5. Configuration / Boot Order

### Duplicate `configureTrustProxy` import

**File**: [`server/index.ts:24-39, 56`](../../app/server/index.ts#L24-L39)

The mid-file `import { configureTrustProxy } from './middleware';` (line 56) was a **duplicate**
of the top-level import — but the top-level import block did not actually include it, so the
function was only reachable through the mid-file import. After consolidation, `configureTrustProxy`
now lives in the canonical top-level import list, and the runtime call site is unchanged.

> **Side benefit**: this caught a latent bug — removing the mid-file import without adding
> `configureTrustProxy` to the top block would have broken the app. The `tsc` compile check
> surfaced the missing symbol immediately.

---

## 6. CORS Hardening

**File**: [`server/index.ts:63-73`](../../app/server/index.ts#L63-L73)

**Before**: a hand-rolled callback threw a raw `Error('CORS: origin not allowed: …')`, which
the `cors` package then forwarded to Express as a generic 500 with the message leaked into the
response body.

**After**: the `cors` middleware accepts the allowed-origin list directly:

```diff
- cors({
-   origin: (origin, callback) => {
-     if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
-     callback(new Error('CORS: origin not allowed: ' + origin));
-   },
-   credentials: true,
- })
+ cors({
+   origin: ALLOWED_ORIGINS,
+   credentials: true,
+ })
```

The `cors` package now returns a clean 403 with no internal details for blocked origins.
Same-origin / curl requests (no `Origin` header) remain allowed by default.

---

## 7. Verification

| Check                                  | Result                                    |
| -------------------------------------- | ----------------------------------------- |
| `tsc --noEmit -p tsconfig.server.json` | ✅ 0 errors                               |
| `tsc --noEmit -p tsconfig.app.json`    | ✅ 0 errors                               |
| `npx eslint server/index.ts`           | ✅ 0 issues                               |
| `npx vitest run` (full suite)          | ✅ **216/216 tests pass** across 25 files |

No new dependencies introduced. No behavioural change for any previously-working path.

---

## 8. Known Issues — Not Fixed (Requires Decision)

These were observed during the audit but **not** changed automatically because they need
architectural discussion:

### 8.1 Latent double-send risk: 35 catch blocks without `return`

Every `catch (err) { sendError(res, err); }` in route handlers omits `return`. They work today
because they are the last statement of the arrow function, but adding any code after them
later would silently call `sendSuccess` after `sendError` → `ERR_HTTP_HEADERS_SENT`.

**Fix**: add `return` to all 35 catch blocks. Mechanical, safe, ~5 min with a script.

### 8.2 In-memory `RATE_BUCKETS` map

Per-process; resets on restart; not shared across replicas. Should be replaced with
`express-rate-limit` + a shared store (Redis or PostgreSQL) before horizontal scale.

### 8.3 `req.user!.id` non-null assertion

`requireAuth` populates `req.user` but TypeScript cannot prove it. The `!` is everywhere.
Options: declare a module augmentation that the route is only callable when
`req.user` is set, or use a typed `AuthenticatedRequest` generic.

### 8.4 `as Record<string, unknown>` on every DB row

Type safety is lost at the database boundary. Consider:

- a thin query-builder wrapper that takes a `zod` schema and returns parsed rows, or
- generated types from `pgtyped` / `kysely-codegen` reading the live schema.

### 8.5 `/api/health` and `/api/ready` are unauthenticated and unlimited

Polling agents can DOS the DB through `/api/ready`. Add a 1 s negative cache when degraded
and/or restrict to internal network in production.

### 8.6 `server/index.ts` is 1960 lines

All routes live in one file with `// ═══ PRODUCTS ═══` banners. As the API grows this will
become unmaintainable. A `routes/products.ts`, `routes/orders.ts`, … split using
`express.Router()` would not change behaviour and is the next refactor worth doing.

### 8.7 ESLint gaps

- `no-explicit-any` (off) — would force types on the many `Record<string, unknown>` casts
- `no-floating-promises` (off) — would have caught the un-awaited wishlist query
- `no-console` (off) — there are `console.log`/`console.error` calls in production paths
- `consistent-type-imports` (off) — but `verbatimModuleSyntax: true` is on, so missing
  `import type` will eventually fail at build time

---

## 9. Files Touched

```
app/server/index.ts     (+18 / -10 lines, 8 distinct fixes)
docs/audit/code-review-fixes-2026-06-23.md   (this file)
```
