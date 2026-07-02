# Security — Nouf-ex

> **Standard:** [OWASP API Security Top 10 (2023)](https://owasp.org/API-security/editions/2023/en/0x11-t10/) · [NIST SP 800-53](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final) · [ISO/IEC 27001](https://www.iso.org/standard/27001)
> **Scope:** All routes in `app/server/routes/*.cts` + the Express app at `app/server/index.ts`.
> **Last reviewed:** 2026-06-28
> **Audience:** Engineers, security reviewers, auditors, ops.

---

## Table of Contents

1. [Threat model](#1-threat-model)
2. [OWASP API Security Top 10 (2023) coverage](#2-owasp-api-security-top-10-2023-coverage)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Role-Based Access Control (RBAC) matrix](#4-role-based-access-control-rbac-matrix)
5. [Defense layers](#5-defense-layers)
6. [Content Security Policy](#6-content-security-policy)
7. [Secrets management](#7-secrets-management)
8. [Rate limiting](#8-rate-limiting)
9. [Security headers](#9-security-headers)
10. [Audit logging](#10-audit-logging)
11. [Known limitations & accepted risks](#11-known-limitations--accepted-risks)
12. [Incident response](#12-incident-response)
13. [Review checklist](#13-review-checklist)
14. [References](#14-references)

---

## 1. Threat model

We use a simplified **STRIDE** model for the Nouf-ex REST API.

### 1.1 Assets (what we protect)

| Asset | Sensitivity | Storage | Encryption at rest |
|-------|-------------|---------|--------------------|
| User passwords | **Critical** | `users.password_hash` (scrypt) | Hash, not encrypt |
| Auth tokens (JWT) | **Critical** | In-memory + client `localStorage` | HMAC-SHA256 signed |
| Personal data (PII) — name, phone, email, address | High | `users`, `addresses` | DB-level (Postgres) |
| Payment data — orders, payments, refunds | High | `orders`, `payments`, `transactions` | DB-level |
| Inventory — stock, sold_count | Medium | `products`, `inventory_log` | DB-level |
| Reviews — `is_visible=false` content | Medium | `reviews` | DB-level |
| Audit log — admin actions | High | `admin_audit_log` | DB-level |
| Backup codes (TOTP) — hashed | High | `users.totp_backup_codes` | scrypt hash |
| Session secrets — `AUTH_SECRET`, DB passwords | **Critical** | Env vars | Docker secrets / k8s secrets |

### 1.2 Threat actors

| Actor | Motivation | Capability |
|-------|------------|------------|
| **Anonymous attacker** | DOS, scrape pricing, deface SPA | Internet, no credentials |
| **Authenticated low-privilege user** | Privilege escalation (BOLA/BFLA), data exfiltration | Valid customer token |
| **Authenticated merchant** | Tamper with competitor data, fake reviews | Valid merchant token |
| **Authenticated admin** | Misuse (insider threat), bulk data export | Valid admin token |
| **Network attacker** (MitM) | Token theft, response tampering | On-path position |
| **Supply chain** | Backdoor via npm / Docker | Build-time access |

### 1.3 Attack surface

- **Public** — `GET /api/*` (products, stores, reviews, categories, search, shipping methods, health/ready).
- **Authenticated** — every other `/api/*` endpoint.
- **Admin-only** — every `/api/admin/*` endpoint.
- **Cross-origin** — CORS allowlist (`ALLOWED_ORIGINS` env).
- **File uploads** — limited (product images via seed script only).

### 1.4 Out of scope

- **Physical security** — the cloud provider is responsible.
- **DDoS at the network edge** — handled by the CDN / load balancer.
- **Client-side security** (XSS in third-party scripts) — partially mitigated by strict CSP (§6).
- **Social engineering** — handled by 2FA + audit log.

---

## 2. OWASP API Security Top 10 (2023) coverage

| OWASP risk | Threat | Nouf-ex mitigation | Verified by |
|------------|--------|---------------------|-------------|
| **API1:2023** — Broken Object Level Authorization (BOLA) | User A reads/modifies user B's data | Ownership guards on every PATCH/DELETE: `WHERE id = ? AND user_id = req.user.id` (addresses, cart, wishlist, orders, payments, refunds, messages) | PHASE 04, 05, 07, 09 |
| **API2:2023** — Broken Authentication | Weak passwords, leaked tokens, brute force | scrypt password hashing (16-byte salt, 64-byte key), HMAC-SHA256 bearer tokens, 7-day TTL, optional 2FA with TOTP + backup codes, `AUTH_SECRET` ≥ 32 chars enforced at module load | PHASE 00, 12 |
| **API3:2023** — Broken Object Property Level Authorization (BOPLA) | User modifies admin fields (role, email_verified) | `z.strict()` on every writable schema — unknown fields rejected with 400; admin-only fields (`role`, `email_verified`, `status`) are NOT in the user schemas | PHASE 01-R |
| **API4:2023** — Unrestricted Resource Consumption | DOS via expensive queries, file uploads, large responses | DB-backed `consume_rate_limit()` on `/api/auth/*` (20 req / 15 min) + in-memory `healthRateLimit()` (30 req / 1s); pagination clamp `[1, 100]`; PWA cache + ETag headers; gzip via Express | PHASE 12 (rate-limit tested) |
| **API5:2023** — Broken Function Level Authorization (BFLA) | Customer calls admin endpoint | `requireRole('admin')` middleware on `/api/admin/*`; `requireAuth` on every non-public endpoint; admin self-protection (cannot ban/demote self) | PHASE 11 |
| **API6:2023** — Unrestricted Access to Sensitive Business Flows | Scraping, scalping | Rate limiting (§8); CAPTCHA on register (future); device fingerprinting (future) | N/A — rate limit provides partial coverage |
| **API7:2023** — Server Side Request Forgery (SSRF) | Server fetches attacker-controlled URL | No outbound HTTP from the API at this time (webhooks are stubs); when implemented, must use an allowlist of domains | N/A — partial |
| **API8:2023** — Security Misconfiguration | Permissive defaults, verbose errors | Strict helmet-equivalent headers (§9); `NODE_ENV=production` hides `err.message` from 500 responses; `dotenv` is loaded at startup only; `loadEnv()` validates schema | PHASE 14, 16 |
| **API9:2023** — Improper Inventory Management | Old versions, debug endpoints exposed | Single Express app, single `/api/*` namespace; no legacy versions; health endpoints rate-limited separately | N/A — partial |
| **API10:2023** — Unsafe Consumption of APIs | SSRF via Stripe/Paymob webhooks | Webhook endpoint validates path param + has no auth (by design — webhook is from a trusted source); TODO: signature verification before processing | N/A — partial (stub provider only) |

---

## 3. Authentication & Authorization

### 3.1 Authentication

Three mechanisms:

1. **Bearer token** — `<base64url(payload)>.<base64url(HMAC-SHA256)>`
   where payload = `{sub, role, exp}`. TTL = 7 days. Verified in
   `app/server/middleware.ts:verifyAuthToken()`.

   - **Forged tokens** are rejected because `timingSafeEqual` prevents
     timing attacks.
   - **Expired tokens** return 401 `AUTH_INVALID`.
   - **Tampered tokens** (signature mismatch) return 401.
   - **Missing tokens** on protected routes return 401 `AUTH_REQUIRED`.

2. **Password hashing** — scrypt with random 16-byte salt + 64-byte key
   (`app/server/lib/shared.cts:hashPassword`). Verified via
   `crypto.timingSafeEqual` to prevent timing attacks.

3. **2FA (optional)** — TOTP (HMAC-SHA1, RFC 6238, 30s window, ±1 step)
   - 10 scrypt-hashed backup codes (single-use). Setup via
   `POST /api/auth/2fa/setup`. Verified in PHASE 12.

### 3.2 Authorization

Three middleware levels:

| Middleware | Effect | Code reference |
|------------|--------|----------------|
| `optionalAuth` | Sets `req.user` if token valid, else continues | `middleware.ts:353` |
| `requireAuth` | 401 if no valid token | `middleware.ts:364` |
| `requireRole('admin')` | 403 if role not allowed | `middleware.ts:389` |

Mounting example:

```ts
// Public (no auth)
router.get('/products', async (req, res) => { ... });

// Optional auth (logs user if present, still public)
router.get('/search', optionalAuth, async (req, res) => { ... });

// Required auth (customer-scoped)
router.get('/cart/:userId', requireAuth, async (req, res) => { ... });

// Admin only
router.get('/admin/users', requireAuth, requireRole('admin'), async (req, res) => { ... });
```

### 3.3 Self-protection

The admin user (`admin@noufex.com`, id=1) **cannot ban or demote
themselves**. See `admin.cts:455-498` — `PATCH /api/admin/users/:id`
rejects `status='banned'` and `role !== 'admin'` on `req.user.id`.

### 3.4 Role matrix

Three roles. Promoted via DB seed (`admin`), application code
(`merchant`), or signup (`customer`):

| Role | Promotion path | Can be promoted by |
|------|---------------|---------------------|
| `customer` | Default (public signup) | (no one — self-service) |
| `merchant` | DB UPDATE — no public endpoint | DB admin |
| `admin` | DB UPDATE — no public endpoint | DB admin |

> **Known limitation:** there is no public "become a merchant" flow.
> See `MASTER_PLAN.md` §B.2.1.

---

## 4. Role-Based Access Control (RBAC) matrix

For every role × endpoint combination. **Y** = allowed, **N** = blocked,
**S** = self-only (owner-scoped).

### 4.1 Public endpoints (no auth)

| Endpoint | Method | customer | merchant | admin |
|----------|--------|----------|----------|-------|
| `/api/health` | GET | Y | Y | Y |
| `/api/ready` | GET | Y | Y | Y |
| `/api/products` | GET | Y | Y | Y |
| `/api/products/:id` | GET | Y | Y | Y |
| `/api/products/featured` | GET | Y | Y | Y |
| `/api/products/deals` | GET | Y | Y | Y |
| `/api/stores` | GET | Y | Y | Y |
| `/api/stores/:id` | GET | Y | Y | Y |
| `/api/categories` | GET | Y | Y | Y |
| `/api/categories/:slug` | GET | Y | Y | Y |
| `/api/search` | GET | Y | Y | Y |
| `/api/reviews` | GET | Y | Y | Y |
| `/api/shipping/methods` | GET | Y | Y | Y |
| `/api/auth/register` | POST | Y | Y | Y |
| `/api/auth/login` | POST | Y | Y | Y |

### 4.2 Customer endpoints (require customer token)

| Endpoint | Method | customer | merchant | admin |
|----------|--------|----------|----------|-------|
| `/api/auth/me` | GET | S | S | S |
| `PATCH /api/auth/me` | PATCH | S | S | S |
| `POST /api/auth/change-password` | POST | S | S | S |
| `POST /api/auth/2fa/setup` | POST | S | S | S |
| `POST /api/auth/2fa/verify` | POST | S | S | S |
| `/api/addresses` | GET/POST/PUT/DELETE | S | S | S |
| `/api/cart/:userId` | GET | S | S | Y (with `customerId` filter) |
| `POST /api/cart` | POST | Y | Y | Y |
| `/api/cart/count/:userId` | GET | S | N | Y (admin bypass) |
| `/api/wishlist/:userId` | GET | S | S | S |
| `POST /api/wishlist` | POST | Y | Y | Y |
| `/api/orders` | GET | S | S | Y (admin bypass with `?customerId=`) |
| `POST /api/orders` | POST | Y | Y | Y |
| `/api/reviews` | POST | Y | Y | Y |
| `/api/messages` | POST/GET | Y | Y | Y |
| `/api/refunds` | POST | S | S | S |
| `/api/coupons/validate` | POST | Y | Y | Y |
| `/api/coupons/redeem` | POST | S | S | S |
| `/api/notifications/:userId` | GET | S | S | S |
| `PUT /api/notifications/:id/read` | PUT | S | N | S |

### 4.3 Admin-only endpoints (require admin role)

| Endpoint | Method | customer | merchant | admin |
|----------|--------|----------|----------|-------|
| `/api/admin/users` | GET | N (403) | N (403) | Y |
| `PATCH /api/admin/users/:id` | PATCH | N (403) | N (403) | Y |
| `/api/admin/stores` | GET | N | N | Y |
| `PATCH /api/admin/stores/:id` | PATCH | N | N | Y |
| `/api/admin/products` | GET | N | N | Y |
| `PATCH /api/admin/products/:id` | PATCH | N | N | Y |
| `/api/admin/orders` | GET | N | N | Y |
| `PATCH /api/admin/orders/:id/status` | PATCH | N | N | Y |
| `/api/admin/disputes` | GET | N | N | Y |
| `PATCH /api/admin/disputes/:id` | PATCH | N | N | Y |
| `/api/admin/audit-log` | GET | N | N | Y |
| `/api/admin/stats` | GET | N | N | Y |
| `/api/payments/:id/confirm` | POST | N (403) | N (403) | Y |
| `/api/refunds/:id/resolve` | POST | N (403) | N (403) | Y |

### 4.4 Verified by tests

- PHASE 04 (cart + ownership) — TC-1.x, TC-5.x
- PHASE 05 (orders) — TC-5.1 (cross-user 403), TC-5.2 (admin bypass)
- PHASE 06 (coupons) — TC-5.5 (cross-user refund 403)
- PHASE 07 (payments) — TC-4.1, TC-6.4
- PHASE 09 (wishlist) — TC-2.2, TC-5.2
- PHASE 11 (admin RBAC) — 21 tests of the 7-endpoint × 3-role matrix
- PHASE 13 (messages) — TC-1.5 (cross-user 404)
- PHASE 15 (audit log) — TC-1.2/1.3 (RBAC enforced)

---

## 5. Defense layers

Nouf-ex uses **defense in depth**. If one layer fails, the next one
must catch the attack.

| Layer | Mechanism | Reference |
|-------|-----------|-----------|
| **Network** | HTTPS-only (HSTS), no plain HTTP in prod | `middleware.ts:67-69` |
| **Headers** | Strict helmet-equivalent (CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP, Referrer-Policy) | `middleware.ts:60-96` |
| **CORS** | Allowlist `ALLOWED_ORIGINS` (CSV); credentials supported only for those origins | `index.ts:83-91` |
| **AuthN** | Bearer token (HMAC-SHA256); scrypt passwords; optional 2FA | `middleware.ts:296-350` |
| **AuthZ** | `requireAuth` + `requireRole` middleware; per-route ownership guards | `middleware.ts:389-409` |
| **Validation** | zod `strict()` on every writable schema; unknown fields → 400 | `shared.cts:234-373` |
| **Rate limit** | DB-backed on `/api/auth/*`; in-memory on health probes | `shared.cts:113`, `middleware.ts:462-496` |
| **DB** | Least-privilege roles (`noufex_app`, `noufex_readonly`); `noufex_app` cannot write `admin_audit_log` (definer trigger) | `database/roles.sql` |
| **Triggers** | Inventory decrement + rating recompute + order state machine — atomic per row | `database/functions.sql` |
| **Audit** | Every admin mutation → `admin_audit_log` row | `shared.cts:writeAuditLog` |
| **Logging** | Single-line JSON to stdout (`log.info({...})`) — log-shipper friendly | `middleware.ts:107-117` |
| **Error response** | `isDev ? err.message : 'Internal error'` — no schema leak in prod | `middleware.ts:246-251` |
| **Request ID** | UUID per request, exposed in response header + every log line | `middleware.ts:26-32` |

---

## 6. Content Security Policy

The SPA at `/` is protected by a **strict-ish CSP** with per-request
nonce (16 bytes base64url). See `middleware.ts:77-94`.

```http
Content-Security-Policy:
  default-src 'self';
  style-src 'self' 'nonce-<random>' https://fonts.googleapis.com;
  script-src 'self' 'nonce-<random>' 'strict-dynamic';
  font-src 'self' data: https://fonts.gstatic.com;
  img-src 'self' data: blob: https:;
  connect-src 'self' ws: wss:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

### 6.1 Notes

- `'nonce-<random>'` is **per-request** — React/Vite inlines nonced
  `<script>` tags. The nonce is also exposed via a non-HttpOnly cookie
  - meta tag so the SPA can attach it to dynamic `<script>` and `<style>`
  elements it creates at runtime.
- `'strict-dynamic'` allows any script the initial nonced bundle pulls in
  (matches Vite's import-graph output).
- `connect-src 'self' ws: wss:` — allows Vite dev server (WS) in
  development; in production, only `'self'` is needed.
- **Override** via the `CSP_DIRECTIVES` env var when adding new
  endpoints (e.g., Stripe analytics).

### 6.2 What the CSP blocks

- **Inline `<script>`** without the nonce → blocked.
- **Cross-origin scripts** (e.g., malicious CDN) → blocked.
- **Clickjacking** (`<iframe>` embedding) → blocked (`frame-ancestors 'none'`).
- **Form submission to external site** → blocked (`form-action 'self'`).
- **`<base>` tag injection** → blocked (`base-uri 'self'`).

### 6.3 Tested by

- **PHASE 16 (Frontend SPA)** — TC-5.1 (CSP present), TC-5.2 (CSP has nonce).

---

## 7. Secrets management

### 7.1 What is a secret

| Secret | Where | Rotation cadence |
|--------|-------|-------------------|
| `AUTH_SECRET` (HMAC key) | `.env` / Docker / k8s | Every 90 days (TODO: rotation script) |
| `DATABASE_URL` / `DB_PASSWORD` | `.env` / Docker / k8s | Every 90 days |
| `ALLOWED_ORIGINS` | `.env` / Docker / k8s | As needed |
| `CHANGE_ME_APP` etc. (seed passwords) | `.env` only | NEVER (demo seed) |
| `STRIPE_SECRET_KEY`, `PAYMOB_*` | `.env` (when real) | Per provider docs |

### 7.2 How secrets are loaded

```ts
// app/server/middleware.ts:296 — AUTH_SECRET enforced at module load
function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET env var is required (≥32 random chars).');
  }
  return s;
}
```

The server **fails fast at module load** if `AUTH_SECRET` is missing or
weak. A predictable HMAC key would let an attacker forge any user's
token.

### 7.3 Generate a secret

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Output: 43-char base64url string. Use as the value of `AUTH_SECRET`.

### 7.4 Storage in production

- **Docker** — use `docker secrets` or environment variables injected
  via `docker-compose.yml`. **Never** commit `.env` to git (already
  gitignored).
- **Kubernetes** — use `Secret` resources mounted as env vars.
- **CI** — use GitHub Actions secrets (Settings → Secrets).

### 7.5 What is NOT a secret

- `ADMIN_USER` (`admin@noufex.com`) — public, intended for demo.
- `ADMIN_PASSWORD` (`admin123`) — DEMO ONLY. Rotate before production.
- `CUSTOMER_PASSWORD` (`customer123`) — DEMO ONLY.

### 7.6 Verified by

- **PHASE 00 (Health + Auth)** — TC-1.x (login flow requires valid creds).
- **Manual**: `AUTH_SECRET` length check on startup.

---

## 8. Rate limiting

### 8.1 Two limiters, two purposes

| Endpoint | Limiter | Limit | Source |
|----------|---------|-------|---------|
| `/api/health`, `/api/ready` | In-memory (`healthRateLimit`) | 30 req / 1s / IP | `middleware.ts:462-496` |
| `/api/auth/*` | DB-backed (`consume_rate_limit`) | 20 req / 15 min / IP | `shared.cts:113`, `index.ts:84-91` |

### 8.2 Why two?

- The health endpoints are probed by Kubernetes / Docker every 2-3s.
  Using the DB-backed limiter would make a Postgres outage also knock
  out the liveness probe — making the outage harder to diagnose.
- The in-memory limiter is zero-dep, per-process (resets on restart —
  acceptable for a probe-defence limiter, not for user-facing limits).

### 8.3 Response on overflow

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 1
{
  "success": false,
  "error": "Too many requests. Try again later.",
  "code": "RATE_LIMITED",
  "request_id": "<uuid>"
}
```

### 8.4 Tested by

- **PHASE 12 (2FA)** — rate-limit cascade documented (4 FAILs when run
  immediately after other auth-heavy PHASES).
- **PHASE 15 (Audit log)** — same root cause, 5 FAILs.
- **PHASE 16 (Frontend SPA)** — public endpoints do NOT hit the limiter.

### 8.5 Operational note

To clear the rate-limit bucket during testing:

```sql
DELETE FROM rate_limit_buckets WHERE bucket = 'auth';
```

Or use the script:

```sh
node tests/e2e/reset-rate-limit.cjs
```

---

## 9. Security headers

| Header | Value | Why |
|--------|-------|-----|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Anti-clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit Referer leakage |
| `Cross-Origin-Opener-Policy` | `same-origin` | Spectre mitigation |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Deny powerful APIs by default |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | Force HTTPS for 180 days (production only) |
| `Content-Security-Policy` | (see §6) | XSS + injection defense |
| `X-Request-Id` | `<uuid>` | Traceability |

All set by `securityHeaders` middleware at `middleware.ts:60-96`.

### 9.1 Tested by

- **PHASE 16** — TC-5.1 (CSP), TC-5.3 (HSTS + X-Frame-Options).

---

## 10. Audit logging

### 10.1 What is audited

Every admin mutation writes to `admin_audit_log`:

| Action | Trigger |
|--------|---------|
| `user.update` | `PATCH /api/admin/users/:id` |
| `store.update` | `PATCH /api/admin/stores/:id` |
| `order.status.update` | `PATCH /api/admin/orders/:id/status` |
| `product.update` | `PATCH /api/admin/products/:id` |
| `dispute.update` | `PATCH /api/admin/disputes/:id` |

### 10.2 Schema

```sql
CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  payload JSONB,                          -- before/after diff
  ip_address INET,
  user_agent TEXT,
  request_id UUID,                        -- matches the x-request-id header
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.3 Permissions

`admin_audit_log` is **inserted via SECURITY DEFINER trigger function**
(migration 0011). The `noufex_app` runtime role has **no INSERT
permission** on this table — only the trigger function can insert. This
prevents a compromised app from forging audit entries.

### 10.4 Retention

Not implemented. Old rows accumulate. **Roadmap item:** archive rows
older than 1 year to cold storage.

### 10.5 Verified by

- **PHASE 15 (Audit logs)** — TC-1.1 to TC-4.1 (RBAC + shape + delta).

---

## 11. Known limitations & accepted risks

| Limitation | Risk | Mitigation | Owner |
|------------|------|-----------|-------|
| **No webhook signature verification** (stub provider only) | Forged webhook events could mark payments as paid | When Stripe/Paymob go live, verify HMAC signature in `POST /api/payments/webhook/:method` | B.2.x |
| **No CSRF protection** | Cross-site request forgery via cookie auth | N/A — auth is bearer header, not cookie (except CSP nonce cookie which is non-HttpOnly but only used for inline `<script>` registration) | (acceptable) |
| **JWT cannot be revoked** | Stolen token valid until expiry | 7-day TTL limits blast radius. TODO: jti blacklist table | B.2.x |
| **No password reset flow** | User locked out if forgotten | Admin can reset via DB. TODO: email-based reset with token | roadmap P2 |
| **Demo seed passwords in `.env`** | Production deployment with demo creds | README + `.env.example` warn, but enforcement is operational | ops |
| **No email verification** on signup | Anyone can sign up with anyone's email | Email field is `citext` (case-insensitive) — duplicate emails blocked. No verification flow yet. | roadmap P1-7 |
| **No 2FA enforcement** | All users can opt out | 2FA is opt-in. Roadmap: mandatory for merchants and admins | roadmap |
| **Backup codes not rotation-tested** | User may run out | Tested manually. Auto-rotation = future | B.2.x |
| **Audit log can be truncated by admins** | Insider threat | `admin_audit_log` `INSERT` only via trigger; no `DELETE` permission for `noufex_app`. `noufex_owner` can DELETE — accepted risk | (acceptable) |
| **Merchant-only endpoints missing** | Merchants cannot self-manage | 12 documented SKIPs in PHASE 10; roadmap P1-17, P1-18 | roadmap |
| **PHASE 13 script contract drift** (inbox/conversation) | Script returns 2 false FAILs | Documented in PHASE 13 spec §7.3; route is correct, script needs updating | cleanup task |

---

## 12. Incident response

### 12.1 Severity levels

| Level | Definition | Response time | Example |
|-------|------------|---------------|---------|
| **P0** | Active exploitation, data leak | Immediate (within 1h) | Token signing key leaked |
| **P1** | Vulnerability confirmed, no active exploitation | Same business day | BOLA discovered but not yet exploited |
| **P2** | Theoretical vulnerability | Within sprint | Missing CSP directive |
| **P3** | Hygiene issue | Best-effort | Outdated dep with known CVE |

### 12.2 Response checklist

1. **Contain** — disable affected endpoint or rotate secrets.
2. **Investigate** — query `admin_audit_log` for the affected time
   window. Pull structured JSON logs from stdout.
3. **Notify** — if P0/P1, notify the security channel + legal/compliance.
4. **Remediate** — patch the code, write a regression test (a new TC
   in the relevant PHASE spec), deploy.
5. **Post-mortem** — write a dated entry in `docs/audit/` explaining
   root cause + remediation + lessons learned.

### 12.3 Key files to consult during an incident

- `admin_audit_log` (DB) — every admin action since the DB was created.
- `notifications` (DB) — user-facing events triggered by the system.
- Structured JSON logs to stdout (in production: piped to a log shipper
  like Loki / Elasticsearch).
- `tests/reports/phaseNN_*.log` — most recent E2E run per phase.

---

## 13. Review checklist

Use this before merging any change to `app/server/`.

### 13.1 New endpoint checklist

- [ ] Endpoint is mounted under `/api/` (or `/api/admin/` if admin-only).
- [ ] Schema is `z.strict()` if writable.
- [ ] `requireAuth` middleware applied if not public.
- [ ] `requireRole('admin')` applied if admin-only.
- [ ] Ownership guard on every PATCH/DELETE: `WHERE id = ? AND user_id = req.user.id`.
- [ ] Response uses `sendSuccess` / `sendError` (not raw `res.json`).
- [ ] No `console.log` of PII (email, phone, address, password hash).
- [ ] Added to the relevant PHASE design spec (B.1.x).

### 13.2 New dependency checklist

- [ ] Reviewed for known CVEs (`npm audit`).
- [ ] Pinned to an exact version in `package.json` (no `^` or `~`).
- [ ] Added to `.github/dependabot.yml` (future).
- [ ] License compatible with the project.

### 13.3 Pre-release security checklist

- [ ] `.env.example` has `AUTH_SECRET=CHANGE_ME` (placeholder, not the real secret).
- [ ] `.env` is in `.gitignore` (already true).
- [ ] `AUTH_SECRET` is at least 32 random chars (validated at module load).
- [ ] `NODE_ENV=production` is set in deployment (hides `err.message`).
- [ ] CORS `ALLOWED_ORIGINS` is restricted to known origins.
- [ ] All `/api/admin/*` tests pass in PHASE 11.
- [ ] Audit log captures every admin mutation (verify with PHASE 15).

---

## 14. References

### 14.1 External standards

- **OWASP API Security Top 10 (2023)** — https://owasp.org/API-security/editions/2023/en/0x11-t10/
- **OWASP Secure Headers Project** — https://owasp.org/www-project-secure-headers/
- **NIST SP 800-53 Rev. 5** — Security and Privacy Controls
- **NIST SP 800-63B** — Digital Identity Guidelines (Authenticator Lifecycle)
- **ISO/IEC 27001:2022** — Information Security Management
- **PCI-DSS v4.0** — Payment Card Industry Data Security Standard
- **RFC 6238** — TOTP
- **RFC 4226** — HOTP
- **RFC 2104** — HMAC (Keyed-Hashing for Message Authentication)

### 14.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §gap #3 — master source
- [`PHASE_00_HEALTH_AUTH.md`](../testing/phases/PHASE_00_HEALTH_AUTH.md) — auth + JWT
- [`PHASE_11_ADMIN_RBAC.md`](../testing/phases/PHASE_11_ADMIN_RBAC.md) — RBAC matrix
- [`PHASE_12_2FA_BACKUP.md`](../testing/phases/PHASE_12_2FA_BACKUP.md) — 2FA + TOTP
- [`PHASE_15_AUDIT_LOGS.md`](../testing/phases/PHASE_15_AUDIT_LOGS.md) — audit log
- [`overview.md`](overview.md) — architecture overview
- [`database.md`](database.md) — schema and roles
- [`../../app/server/middleware.ts`](../../../../app/server/middleware.ts) — security middleware
- [`../../app/server/lib/shared.cts`](../../../../app/server/lib/shared.cts) — zod schemas + scrypt
- [`../../database/roles.sql`](../../../../database/roles.sql) — least-privilege roles
- [`../../database/functions.sql`](../../../../database/functions.sql) — inventory + audit triggers
- [`../../database/migrations/0011_audit_log_security_definer.sql`](../../../../database/migrations/0011_audit_log_security_definer.sql) — SECURITY DEFINER fix
- [`CHANGELOG.md`](../../../../CHANGELOG.md) — historical security fixes

---

## Maintenance Notes

1. **Update §11 (Known limitations)** when any limitation is fixed.
2. **Update §4 (RBAC matrix)** when new endpoints are added (or
   existing endpoints change role).
3. **Update §10 (Audit logging)** when new admin actions are added.
4. **Add to §12 (Incident response)** when a real incident happens.
5. **Add to §13 (Review checklist)** as the team learns from PRs.
6. **Bump version** in §1 when significant changes are made.
7. Commit spec + code **together**.

---

> **End of security.md.** Next: B.2.2 — `deployment.md` (production
> checklist, nginx reverse proxy, SSL termination, blue-green).
