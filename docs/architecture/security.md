# Nouf-ex — Security Model

> **Audience:** security reviewers, backend devs.
> **Last updated:** 2026-07-12
> **Standards:** OWASP API Top 10 (2023), OWASP ASVS 4.0.3, NIST SP 800-218 SSDF v1.1, ISO/IEC 25010.

---

## 1. Threat model

| Asset | Threat | Mitigation |
|---|---|---|
| Auth token | XSS-leak of Bearer token | HttpOnly cookie (no JS access) |
| Session | CSRF on mutations | Double-submit cookie + SameSite=Strict |
| Password | Brute-force / leak | scrypt + 10-char min + complexity rules |
| TOTP secret | DB dump → 2FA bypass | Encryption-at-rest (planned), bcrypt-style storage |
| User email | Enumeration | Generic 200 on `/auth/forgot-password` |
| Order timeline | Tampering | Append-only JSONB, triggers write to it |
| Payment webhook | Replay | Idempotency via `webhook_events` UNIQUE |
| Admin token | Privilege escalation | Per-user `token_version` + cache TTL 30s |
| Settings secrets | DB dump → SMTP/Stripe creds | `lib/settings-redact.ts` (8 patterns masked in audit) |
| Audit chain | Undetectable tampering | Write-only via SECURITY DEFINER functions |

---

## 2. Authentication

### 2.1 Password hashing

- **Algorithm**: scrypt with random 16-byte salt, 64-byte derived key (256-bit)
- **Storage format**: `scrypt$<base64-salt>$<base64-key>`
- **Verification**: `crypto.timingSafeEqual` (constant-time)
- **Policy** (`lib/validation.ts:evaluatePasswordStrength`):
  - Length: 10-128 chars (NIST 800-63B minimum)
  - At least 3 of: lowercase, uppercase, digit, symbol
  - Reject: 4+ identical chars, 4+ sequential chars, 55 common passwords, email-local-part matches

### 2.2 Authentication token (HMAC-signed JWT)

- **Format**: `base64url({sub,role,ver,exp}).base64url(hmac)`
- **TTL**: 7 days
- **Algorithm**: HMAC-SHA256
- **Secret**: `AUTH_SECRET` env var (≥32 chars, fails fast at module-load if missing)
- **Revocation**: bumping `users.token_version` invalidates ALL outstanding tokens for that user in a single UPDATE

### 2.3 Cookie attributes

```ts
res.cookie('noufex_token', token, {
  httpOnly: true,                              // not accessible from JS (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'strict',                         // CSRF protection
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

### 2.4 2FA (optional, recommended for admins)

- **Algorithm**: TOTP per RFC 6238 (HMAC-SHA1, 6 digits, 30s step)
- **Tolerance**: ±1 step (±30s)
- **Backup codes**: 10 single-use codes, scrypt-hashed (`users.totp_backup_codes TEXT[]`)
- **Setup endpoint**: `POST /api/auth/2fa/setup` → returns `secret`, `otpauth_url`, `backup_codes`
- **Enable**: requires verifying first TOTP code
- **Verify**: uses short-lived (5min) `partial_token` (single-use via `used_jtis` table)

---

## 3. CSRF protection

Implemented in `lib/csrf.ts` (double-submit cookie pattern):

1. **On any safe-method request (GET, HEAD, OPTIONS)**: set two cookies
   - `noufex_csrf` (non-HttpOnly, JS-readable)
   - `noufex_csrf_h` (HttpOnly, server-only)
   Both contain the same random 32-byte token.
2. **On any mutation (POST/PATCH/DELETE)**: compare all three:
   - `noufex_csrf` cookie
   - `noufex_csrf_h` cookie
   - `x-csrf-token` request header
3. **Mismatch** → 403 + `CSRF_INVALID`

**Exempt routes** (no session yet or health probe):
- `/api/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/refresh`, `/csrf`
- `/api/health`, `/api/ready`

**CORS headers** in `index.ts`:
```ts
allowedHeaders: ['Content-Type', 'x-csrf-token']
```

---

## 4. Rate limiting

DB-backed via `consume_rate_limit()` PL/pgSQL function (shared across replicas):

| Bucket | Default | Endpoint |
|---|---|---|
| `auth` | 20/15min/IP | login, register, etc. |
| `webhook` | 120/min/IP | payment provider webhooks |
| `2fa_verify` | 5/min/IP | TOTP brute-force |
| `2fa_setup` | 10/hour/IP | enrollment abuse |
| `2fa_enable` | 10/min/IP | enrollment brute-force |
| `2fa_disable` | 5/min/IP | password brute-force |
| `2fa_backup_codes` | 5/min/IP | rotation abuse |

Health probe: **in-memory** (30/s/IP, resets on process restart).

On 429: `Retry-After: <seconds>` header.

---

## 5. Security headers

Set globally via `securityHeaders` middleware:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` (prod only) | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | Per-request nonce, `script-src 'self' 'nonce-XYZ' 'strict-dynamic'` |
| `Permissions-Policy` | 32 capability denylist (camera, microphone, geolocation, payment, USB, etc.) |
| `frame-ancestors` | `'none'` (anti-clickjacking) |

CSP allows trusted image hosts via `CSP_IMG_HOSTS` env var.

---

## 6. Audit log

Every admin mutation writes to `admin_audit_log`:

| Column | Purpose |
|---|---|
| `user_id` | Who made the change |
| `action` | e.g. `update_user`, `force_status`, `set_setting` |
| `entity_type` | e.g. `user`, `order`, `setting` |
| `entity_id` | The affected PK |
| `old_values` | JSONB snapshot before |
| `new_values` | JSONB snapshot after |
| `ip_address` | INET (from req.ip) |
| `user_agent` | string |
| `created_at` | TIMESTAMPTZ |

**Redaction**: 17 sensitive keys are masked before insert:
`password, password_hash, passwd, pwd, token, auth_token, access_token, refresh_token, api_key, apikey, secret, client_secret, private_key, cvv, cvc, ssn, authorization`

**Settings redaction** (lib/settings-redact.ts): when the SETTING KEY matches `_password|_secret|_token|_api_key|_apikey|_private_key`, the value becomes `[REDACTED]` in audit rows.

**Dead-letter queue**: if DB write fails after 3 retries, entry lands in `logs/audit-dlq-YYYY-MM-DD.jsonl` (still redacted).

**Retention**: `audit-scheduler.ts` runs `cleanup_audit_logs()` daily at 03:00 UTC (2y admin / 90d search).

---

## 7. Payment security

### 7.1 Webhook idempotency

`webhook_events` table with UNIQUE(provider, event_id, transaction_id, event_type):

```sql
INSERT INTO webhook_events (provider, event_id, transaction_id, event_type, payload)
VALUES ($1, $2, $3, $4, $5::jsonb)
ON CONFLICT (provider, event_id, transaction_id, event_type) DO NOTHING
RETURNING id;
```

Atomic dedup — concurrent duplicates update at most once.

### 7.2 HMAC verification

`rawBody` is captured at JSON parse time (`verify` callback) so payment webhooks can verify HMAC over the EXACT bytes the provider signed.

### 7.3 Provider registry

`lib/payments/registry.ts`:
- Real providers (Stripe, Paymob) — only active when env keys present
- Stub — for dev/MVP
- Offline (cod, card, wallet, bank_transfer) — no network provider, handled by route

---

## 8. Database security

### 8.1 Roles

| Role | Use | Permissions |
|---|---|---|
| `postgres` | Setup only | superuser (never used at runtime) |
| `noufex_owner` | Migrations | DDL + GRANT management |
| `noufex_app` | Runtime | least-privilege RW on 26 tables, RO on 4 |
| `noufex_readonly` | BI/reporting | SELECT only |

### 8.2 Row-Level Security

- **`app_settings`** (migration 0023): `noufex_app` SELECT, `noufex_owner` UPDATE. Writes go through `admin_set_app_setting()` SECURITY DEFINER function.
- **`webhook_events`** (migration 0020): RLS on processing_state transitions.

### 8.3 Secrets at rest

- `AUTH_SECRET`, `DB_PASSWORD` — in `.env` (gitignored) or platform secrets manager
- TOTP secrets — `users.totp_secret TEXT` (encryption-at-rest pending, see risk register)
- Payment provider API keys — env vars only, never persisted

### 8.4 SQL injection protection

- **pg `?` → `$N` rewriting** (`pg-wrapper.ts:pgify`): state-machine-based parser
- **buildUpdateSet** (`lib/sql-helpers.ts`): regex `/^[a-z][a-z0-9_]*$/` validates column names
- **All SQL via parameterized queries** — no string concatenation of user input

---

## 9. Vulnerability disclosure

See [`.github/SECURITY.md`](../../.github/SECURITY.md) for the disclosure policy.

---

## 10. Compliance checklist

- [x] **OWASP API Top 10 (2023)** — covered
- [x] **WCAG 2.1 Level AA** — frontend tests via axe-core
- [ ] **SOC 2** — not yet relevant (pre-revenue)
- [ ] **GDPR** — not yet relevant (Yemen market)
- [ ] **PCI-DSS** — compliant by delegation (Stripe/Paymob)

---

## See also

- [API reference](api.md)
- [Database reference](database.md)
- [Secrets management](../../.github/SECRETS.md)
- [Security disclosure](../../.github/SECURITY.md)
- [Risk register](../planning/risks.md)
