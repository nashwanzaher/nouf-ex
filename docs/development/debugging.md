# Debugging & Reset Utilities — Nouf-ex

> **Scope:** Local development and operational debugging for the Nouf-ex API + SPA.
> **Audience:** Developers, QA, SRE.
> **Last reviewed:** 2026-06-28

---

## Table of Contents

1. [Common failure modes (with fixes)](#1-common-failure-modes-with-fixes)
2. [Reset utilities](#2-reset-utilities)
3. [Debugging the auth flow](#3-debugging-the-auth-flow)
4. [Debugging the DB layer](#4-debugging-the-db-layer)
5. [Debugging the API server](#5-debugging-the-api-server)
6. [Debugging the SPA](#6-debugging-the-spa)
7. [Capturing a request trace](#7-capturing-a-request-trace)
8. [Reset scripts reference](#8-reset-scripts-reference)
9. [References](#9-references)

---

## 1. Common failure modes (with fixes)

### 1.1 "AUTH_SECRET env var is required" on startup

**Symptom:** server crashes immediately with `AUTH_SECRET env var is required (≥32 random chars)`.

**Cause:** `.env` is missing or the secret is too short.

**Fix:**

```sh
# Generate a strong secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
# → kZ8dQfR3vN1xY7pE2jW5mT4sL0aH6bC9dF8gJ3kM5nQ

# Append to .env
echo "AUTH_SECRET=kZ8dQfR3vN1xY7pE2jW5mT4sL0aH6bC9dF8gJ3kM5nQ" >> .env
```

See `app/server/middleware.ts:296-309`.

### 1.2 "DATABASE_URL is not set" on startup

**Symptom:** server crashes with `DATABASE_URL is not set. Copy .env.example to .env ...`.

**Cause:** `.env` is missing OR `DATABASE_URL` / `DB_*` vars are not set.

**Fix:**

```sh
# Use DB_HOST + DB_PORT + DB_NAME + DB_USER + DB_PASSWORD
# (or set DATABASE_URL directly)
cat .env | grep -E "^(DATABASE_URL|DB_)"
```

See `app/server/middleware.ts:644-654`.

### 1.3 Login returns 401 "Invalid email or password" for a seeded user

**Symptom:** logging in as `ahmed@gmail.com / customer123` returns 401.

**Cause:** ahmed's password has been mutated (e.g., by `phase01_profile_addresses_retest.ps1` TC-3.1, which **inadvertently** changes ahmed's password to `hacked123`).

**Fix:** reset the password using the one-shot utility:

```sh
cd app
cp ../logs/reset-ahmed.cjs ./    # only on first use; logs/ is gitignored
node reset-ahmed.cjs
# → "Reset: 1 row(s) updated: [ { id: 2, email: 'ahmed@gmail.com' } ]"
```

The script generates a fresh scrypt hash for `customer123` and updates
`users.password_hash`. The script source lives at `logs/reset-ahmed.cjs`
(also reproduced in §8.1).

### 1.4 PHASE 4 cart returns 401 cascading

**Symptom:** PHASE 4 spec returns 27 FAILs, all with status 401.

**Cause:** Same as 1.3 — ahmed's password has been mutated by an earlier
PHASE. The cascading 401s are because every cart endpoint requires auth.

**Fix:** same as 1.3 — reset ahmed's password, then re-run PHASE 4.

### 1.5 PHASE 12 2FA returns 429 "Too Many Requests"

**Symptom:** PHASE 12 spec returns 4+ FAILs, all with status 429.

**Cause:** the authLimiter (20 req / 15 min / IP) has been exhausted by a
recent PHASE 0, 1, or 1-R run.

**Fix:** clear the rate-limit buckets:

```sql
psql -h $DB_HOST -U noufex_owner -d noufex_db \
  -c "DELETE FROM rate_limit_buckets WHERE bucket = 'auth';"
```

Or use the script:

```sh
node tests/e2e/reset-rate-limit.cjs
```

### 1.6 PHASE 15 audit log returns 5 FAILs (rate-limit cascade from PHASE 12)

**Symptom:** same as 1.5 — authLimiter exhausted.

**Fix:** same as 1.5.

### 1.7 `npm run db:setup` fails with "password authentication failed"

**Symptom:** `db-setup.cjs` connects, then errors with `password authentication failed for user "postgres"`.

**Cause:** `.env` has the wrong `DB_PASSWORD` for the `postgres` superuser.

**Fix:**

```sh
# Verify postgres password
psql -h $DB_HOST -U postgres -c '\q'
# If this fails, fix DB_PASSWORD in .env
```

### 1.8 `db:setup` fails with "relation already exists"

**Symptom:** schema setup runs but errors mid-way with "relation X already exists".

**Cause:** partial state from a previous failed run.

**Fix:**

```sh
# Drop and recreate the DB
dropdb -h $DB_HOST -U postgres noufex_db
createdb -h $DB_HOST -U postgres noufex_db
npm run db:setup
```

### 1.9 PHASE 13 messages inbox returns empty

**Symptom:** `GET /api/messages/inbox` returns `{data: {items: [...]}}` but the script does `data` and sees an empty array.

**Cause:** **script bug, NOT a route bug**. The route returns nested
under `data.items`. The script does `data` directly.

**Fix:** not needed — the script just needs to be updated. The route is
correct. (See `phase13_notifications_messages.ps1` script comment at
the relevant TC.)

### 1.10 PHASE 13 conversation returns 400 "Invalid query: peer_id"

**Symptom:** `GET /api/messages/conversation?user_id=N` returns 400.

**Cause:** the route expects `?peer_id=N`, but the script passes
`?user_id=N`.

**Fix:** script bug. The route is correct (zod schema at
`messages.cts:237-313` requires `peer_id`).

### 1.11 PHASE 1 cart delete crosses users (404 not 403)

**Symptom:** customer B trying to delete customer A's cart_item id gets
404, not 403.

**Cause:** **by design**. The cart route scopes DELETE by
`WHERE id = ? AND user_id = ?` — non-owner rows simply don't match,
returning 404 (not found, no info leak about existence). This is more
secure than 403 (which would confirm the row exists).

**Status:** correct behavior, not a bug. See `PHASE_04_CART.md` §10.

### 1.12 "Port 3000 already in use"

**Symptom:** `npm run api` fails with `EADDRINUSE :::3000`.

**Cause:** another process is already listening on 3000.

**Fix:**

```powershell
# PowerShell — find the process
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Get-Process -Id <pid> | Select-Object ProcessName, Id

# Kill the process (Windows)
Stop-Process -Id <pid> -Force
```

```sh
# Linux/Mac
lsof -i :3000
kill -9 <pid>
```

### 1.13 CORS error in browser console

**Symptom:** browser shows: "Access to fetch at ... has been blocked by CORS policy".

**Cause:** the request's `Origin` header is not in `ALLOWED_ORIGINS`.

**Fix:** add the origin to `.env`:

```sh
# .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-staging.example.com
```

Restart the API.

### 1.14 CSP blocks an inline `<script>` I added

**Symptom:** browser shows: "Refused to execute inline script because it violates the following Content Security Policy directive".

**Cause:** the inline `<script>` doesn't have the per-request nonce
that's exposed by the security headers middleware.

**Fix:** add the nonce to the script tag:

```tsx
<script nonce={cspNonce}>{/* your code */}</script>
```

Where `cspNonce` is read from the `csp-nonce` cookie (non-HttpOnly) or
from the `<meta name="csp-nonce">` tag injected by the server.

See `app/server/middleware.ts:77-94`.

---

## 2. Reset utilities

### 2.1 The reset scripts inventory

| Script | Path | Purpose | Destructive? |
|--------|------|---------|--------------|
| `reset-ahmed.cjs` | `logs/reset-ahmed.cjs` | Reset ahmed's password to `customer123` | **Yes** (overwrites hash) |
| `reset-rate-limit.cjs` | `tests/e2e/reset-rate-limit.cjs` | Clear `rate_limit_buckets` table | **Yes** (drops entries) |
| `db-setup.cjs` | `scripts/db-setup.cjs` | Apply full schema + seed | **Yes** (drops + recreates) |
| `gen-seed-hashes.cjs` | `scripts/gen-seed-hashes.cjs` | Generate scrypt hashes for seed users | No (read-only output) |
| `verify-fresh.cjs` | `scripts/verify-fresh.cjs` | Verify DB is in fresh-seed state | No (read-only) |
| `drop-test-db.cjs` | `scripts/drop-test-db.cjs` | Drop the test DB | **Yes** (drops DB) |
| `switch-db.ps1` | `scripts/switch-db.ps1` | Switch between dev/staging DB | No (just edits `.env`) |

### 2.2 When to use which

| Symptom | Reset utility to use |
|---------|---------------------|
| PHASE 4-7 fail with 401 | `logs/reset-ahmed.cjs` |
| PHASE 12+ fail with 429 | `tests/e2e/reset-rate-limit.cjs` |
| Schema is in an unknown state | `scripts/db-setup.cjs` (after `drop-test-db.cjs`) |
| Need a new scrypt hash for seed | `scripts/gen-seed-hashes.cjs` |
| Need to verify the DB is fresh | `scripts/verify-fresh.cjs` |
| DB connection string is wrong | `scripts/switch-db.ps1` |

### 2.3 Safety checklist (before any reset)

- [ ] **Back up the DB** if it's not a dev DB.
- [ ] **Read the script source** before running (verify it does what you expect).
- [ ] **Run on dev first**, not production.
- [ ] **Document** the reset in `docs/audit/` if it's significant.

---

## 3. Debugging the auth flow

### 3.1 Decode a JWT manually

```js
// Decode a bearer token (no verification — for debugging only)
const token = 'eyJzdWIiOjIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTcyMjQ5OTU2MH0.abc123';
const [body, sig] = token.split('.');
const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
console.log(payload);
// { sub: 2, role: 'admin', exp: 1722499560 }
```

### 3.2 Trace a login failure

```sh
# 1. Get a request_id from a failed login (visible in browser dev tools)
# E.g. request_id = a1b2c3d4-1234-5678-9012-abcdef123456

# 2. Search logs
docker logs Nouf-ex 2>&1 | grep "a1b2c3d4-1234-5678-9012-abcdef123456"
# (or in your log shipper)
loki-cli query '{job="noufex"} |= "a1b2c3d4-1234-5678-9012-abcdef123456"'

# 3. Look for `http_error` with status 401 + code AUTH_INVALID
```

### 3.3 Common auth bugs

| Bug | Symptom | Cause | Fix |
|-----|---------|-------|-----|
| "Invalid or expired token" | 401 on every request | `AUTH_SECRET` rotated, old tokens invalid | Re-login |
| "Missing Authorization header" | 401, no body | Client didn't send header | Add `Authorization: Bearer <token>` |
| "Cannot read property 'exports' of undefined" | 500 on startup | CJS/ESM bridge failure in middleware import (see Dockerfile comments) | Rebuild with esbuild |
| "exp" claim is in the past | 401 | Client clock skew | Sync client clock |
| "AUTH_SECRET env var is required" | Server won't start | `.env` missing | Add to `.env` |

### 3.4 Test the password hashing directly

```sh
# In Node REPL
node -e "
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);
(async () => {
  const pw = 'customer123';
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64);
  console.log('scrypt\$' + salt.toString('base64') + '\$' + key.toString('base64'));
})();
"
```

---

## 4. Debugging the DB layer

### 4.1 Check current connection

```sql
-- Active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Long-running queries
SELECT pid, query, state, NOW() - query_start AS duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC
LIMIT 10;

-- Kill a long query
SELECT pg_cancel_backend(<pid>);
```

### 4.2 Check the rate-limit bucket

```sql
-- Total buckets
SELECT count(*) FROM rate_limit_buckets;

-- Buckets per IP
SELECT ip, count(*) FROM rate_limit_buckets GROUP BY ip ORDER BY count DESC LIMIT 10;

-- Clear a specific IP
DELETE FROM rate_limit_buckets WHERE ip = '1.2.3.4';

-- Clear all (DANGER: brief DOS vulnerability)
TRUNCATE rate_limit_buckets;
```

### 4.3 Check the audit log

```sql
-- Recent admin actions
SELECT id, user_id, action, entity_type, entity_id, request_id, created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 20;

-- Per-admin summary
SELECT user_id, count(*) AS actions
FROM admin_audit_log
GROUP BY user_id
ORDER BY actions DESC;
```

### 4.4 Check the used_jtis (revoked JWTs)

```sql
-- Active revocations
SELECT count(*) FROM used_jtis;

-- Revoke a specific token (TODO: support a `revoke` endpoint)
-- INSERT INTO used_jtis (jti, user_id, used_at) VALUES ('<jti>', <user_id>, NOW());
```

### 4.5 Check the inventory log

```sql
-- Recent stock changes
SELECT product_id, change_type, quantity_change, stock_after, reason, created_at
FROM inventory_log
ORDER BY created_at DESC
LIMIT 20;

-- Per-product history
SELECT change_type, quantity_change, stock_after, reason, created_at
FROM inventory_log
WHERE product_id = 1
ORDER BY created_at DESC;
```

### 4.6 Check the trigger functions

```sql
-- List trigger functions
SELECT n.nspname, p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind = 'f';

-- Show trigger definitions
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE NOT tgisinternal
ORDER BY tgname;
```

### 4.7 Recompute the trigger side-effects manually

If you suspect a trigger is broken (e.g., rating didn't update after a
review):

```sql
-- Force-update a product's rating
UPDATE products SET rating = (
  SELECT COALESCE(AVG(rating)::numeric(3, 2), 0)
  FROM reviews
  WHERE product_id = products.id AND is_visible = TRUE
), review_count = (
  SELECT count(*) FROM reviews WHERE product_id = products.id AND is_visible = TRUE
)
WHERE id = <product_id>;
```

If the manual update matches the trigger output, the trigger is fine
and the issue is somewhere else.

---

## 5. Debugging the API server

### 5.1 Increase log verbosity

```sh
# Set LOG_LEVEL=debug in .env
LOG_LEVEL=debug
```

Or per-request via env var when starting the server:

```sh
LOG_LEVEL=debug npm run api
```

`debug` emits more events (e.g., rate-limit decisions per request).
Be careful in production — `debug` is verbose.

### 5.2 Trace a single request

The `x-request-id` header correlates all logs for one request. To
trace:

```sh
# 1. Make a request
curl -v -H "X-Request-Id: my-trace-id" http://localhost:3000/api/products
# (server uses this if length ≤ 64, else generates a UUID)

# 2. Search logs
docker logs Nouf-ex 2>&1 | grep "my-trace-id"
# You'll see every event that touched this request.
```

### 5.3 Test a route manually with curl

```sh
# Public
curl -s http://localhost:3000/api/products?limit=2 | jq

# Authenticated
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ahmed@gmail.com","password":"customer123"}' | jq -r '.data.token')
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

### 5.4 Test the DB layer without the API

```js
// In app/, use the same wrapper the routes use
// node -e "
//   const { PgDb } = require('./server/db/pg-wrapper.cts');
//   (async () => {
//     const db = new PgDb(process.env.DATABASE_URL);
//     const rows = await db.prepare('SELECT id, email, role FROM users LIMIT 3').all();
//     console.log(rows);
//     process.exit(0);
//   })();
// "
```

### 5.5 Run a single test file with vitest

```sh
cd app
npx vitest run server/tests/cart-router.test.ts
```

Verbose mode:

```sh
cd app
npx vitest run --reporter=verbose server/tests/cart-router.test.ts
```

### 5.6 Test against a fresh database

```sh
# Drop and recreate
dropdb -h $DB_HOST -U postgres noufex_db
createdb -h $DB_HOST -U postgres noufex_db
npm run db:setup

# Re-run a single test
cd app && npx vitest run server/tests/cart-router.test.ts
```

### 5.7 Check the API is using the latest code

After editing a route file, restart the API:

```sh
# Local dev
Ctrl+C
npm run api

# Docker
docker compose restart noufex
```

The `tsx` runner does NOT hot-reload — you MUST restart.

---

## 6. Debugging the SPA

### 6.1 Open the browser dev tools

- **Console** — check for JS errors, CSP violations, network errors.
- **Network** — check for failed requests, large response times, CSP nonce issues.
- **Application** — check `localStorage` for `noufex_token`, CSP nonce cookie.
- **Sources** — set breakpoints in the React component.

### 6.2 Verify the API base URL

In the browser console:

```js
console.log(import.meta.env.VITE_API_BASE_URL);
// Should be: http://localhost:3000
// (or the production URL in prod)
```

If undefined, set the env var before `npm run build`:

```sh
VITE_API_BASE_URL=https://api.noufex.example.com npm run build
```

### 6.3 Check the CSP nonce

The server returns a per-request nonce. The SPA reads it from the
`csp-nonce` cookie or the `<meta name="csp-nonce">` tag.

In the browser console:

```js
// Read the cookie
document.cookie.split('; ').find(c => c.startsWith('csp-nonce='))
// → "csp-nonce=abcd1234..."

// Read the meta tag
document.querySelector('meta[name="csp-nonce"]')?.content
// → "abcd1234..."
```

If neither is present, the server didn't set them — check
`app/server/index.ts:95-97` (the static-file handler).

### 6.4 Test the SPA standalone

```sh
# Build the SPA
cd app
npm run build

# Serve the dist with a static server
npx serve dist -l 5173

# Open http://localhost:5173 — it should load without API calls
```

If the SPA loads but the API is unreachable, check the
`VITE_API_BASE_URL` env var (see §6.2).

### 6.5 Test the PWA install

1. Open the app in Chrome.
2. DevTools → Application → Manifest. Verify the manifest is valid.
3. DevTools → Application → Service Workers. Verify the SW is registered.
4. Click the install button in the URL bar (or "Add to Home Screen" on mobile).

### 6.6 Reset the SPA's local state

If the SPA is in a weird state (e.g., stuck on a stale page):

```js
// In the browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

This logs the user out and reloads.

---

## 7. Capturing a request trace

When reporting a bug, capture:

1. **Request URL and method** — the user knows what they clicked.
2. **`x-request-id`** — from the browser dev tools (response header).
3. **Server logs** — the corresponding lines from `docker logs Nouf-ex`.
4. **Browser console** — any JS errors or CSP violations.
5. **Network tab** — the full request/response (export as HAR if needed).

Example bug report:

```
## Login fails with 401
- URL: POST https://noufex.example.com/api/auth/login
- x-request-id: a1b2c3d4-1234-5678-9012-abcdef123456
- Server log:
    {"t":"...","level":"warn","msg":"http_error","request_id":"a1b2c3d4-...","status":401,"code":"AUTH_INVALID","path":"/api/auth/login"}
- Body sent: {"email":"ahmed@gmail.com","password":"customer123"}
- Browser console: (no errors)
- Network: status 401, body {"success":false,"error":"Invalid email or password","code":"AUTH_INVALID",...}
```

This is enough to diagnose almost any issue.

---

## 8. Reset scripts reference

### 8.1 `logs/reset-ahmed.cjs`

```js
// One-shot admin utility to reset ahmed's password back to customer123.
// Generated when B.1.6 cart test discovered that PHASE 01-R had
// permanently changed ahmed's password to 'hacked123' (a documented
// script bug in phase01_profile_addresses_retest.ps1 TC-3.1).
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const { Client } = require('pg');

(async () => {
  // 1. Generate a fresh scrypt hash for 'customer123'
  const scryptAsync = promisify(scrypt);
  const salt = randomBytes(16);
  const key = await scryptAsync('customer123', salt, 64);
  const hash = 'scrypt$' + salt.toString('base64') + '$' + key.toString('base64');
  console.log('Generated hash:', hash);

  // 2. Connect — try multiple connection strings
  const candidates = [
    'postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db',
    'postgresql://noufex_owner:CHANGE_ME_OWNER@localhost:5432/noufex_db',
    'postgresql://noufex_app:CHANGE_ME_APP@localhost:5432/noufex_db',
    process.env.DATABASE_URL,
  ].filter(Boolean);
  let client = null;
  let lastErr = null;
  for (const connStr of candidates) {
    try {
      const c = new Client({ connectionString: connStr });
      await c.connect();
      await c.query('SELECT 1');
      console.log('Connected via:', connStr.replace(/:[^:@/]+@/, ':***@'));
      client = c;
      break;
    } catch (e) {
      lastErr = e;
      try { await (client || { end: () => {} }).end(); } catch {}
      client = null;
    }
  }
  if (!client) throw lastErr || new Error('No connection succeeded');
  try {
    const res = await client.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id, email`,
      [hash, 'ahmed@gmail.com']
    );
    console.log('Reset:', res.rowCount, 'row(s) updated:', res.rows);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
```

### 8.2 `tests/e2e/reset-rate-limit.cjs`

```js
// Truncates the rate_limit_buckets table. Use between PHASE runs to
// avoid the 429 rate-limit cascade documented in B.1.14 §10.
const { Client } = require('pg');
const candidates = [
  'postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db',
  process.env.DATABASE_URL,
].filter(Boolean);
(async () => {
  let client = null;
  for (const cs of candidates) {
    try {
      client = new Client({ connectionString: cs });
      await client.connect();
      await client.query('SELECT 1');
      break;
    } catch (e) { client = null; }
  }
  if (!client) throw new Error('No DB connection');
  try {
    const before = await client.query('SELECT count(*) FROM rate_limit_buckets');
    await client.query('TRUNCATE rate_limit_buckets');
    console.log('rate_limit_buckets truncated:', before.rows[0].count, 'rows cleared');
  } finally {
    await client.end();
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
```

### 8.3 `scripts/db-setup.cjs`

Applies the 8-file SQL pipeline (see `database/README.md` §"Applying").
Use this for a full DB rebuild.

### 8.4 `scripts/gen-seed-hashes.cjs`

Generates scrypt hashes for the seed users. Use this when adding a new
seed user or rotating the seed password.

### 8.5 `scripts/verify-fresh.cjs`

Queries the DB to verify it's in a fresh-seed state (10 users, 24
products, etc.). Use this after `db:setup` to confirm success.

---

## 9. References

### 9.1 Internal documents

- [`getting-started.md`](getting-started.md) — local dev setup
- [`security.md`](../architecture/security.md) — auth + secrets
- [`monitoring.md`](monitoring.md) — logs + runbooks
- [`deployment.md`](deployment.md) — production ops
- [`er-diagram.md`](../architecture/er-diagram.md) — schema reference
- [`../../app/server/middleware.ts`](../../../../app/server/middleware.ts) — log + auth source
- [`../../app/server/lib/shared.cts`](../../../../app/server/lib/shared.cts) — scrypt + zod
- [`../../app/server/db/pg-wrapper.cts`](../../../../app/server/db/pg-wrapper.cts) — DB wrapper
- [`../../tests/e2e/reset-rate-limit.cjs`](../../../../tests/e2e/reset-rate-limit.cjs) — rate-limit reset
- [`../../database/README.md`](../../../../database/README.md) — DB conventions

### 9.2 External resources

- [PostgreSQL — System Information Functions](https://www.postgresql.org/docs/17/functions-info.html)
- [PostgreSQL — pg_stat_activity](https://www.postgresql.org/docs/17/monitoring-stats.html)
- [Express — Error handling](https://expressjs.com/en/guide/error-handling.html)
- [Chrome DevTools — Network](https://developer.chrome.com/docs/devtools/network/)
- [Mermaid — ER diagram syntax](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)
- [OpenSSL — verify JWT signature](https://www.npmjs.com/package/jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback)

---

## Maintenance Notes

1. **Add to §1** any new failure mode that takes > 5 min to diagnose.
2. **Add to §2** any new reset utility that you write.
3. **Update §3-§6** when the corresponding source code changes.
4. **Update §8** when reset scripts change.
5. Bump version in §1 when significant changes are made.
6. Commit spec + code **together**.

---

> **End of debugging.md.** Next: B.3.1 — `ci-cd.md`
> (GitHub Actions strategy + secrets + stages).