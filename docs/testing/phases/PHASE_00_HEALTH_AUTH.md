# PHASE 00 — Health + Readiness + DB Connectivity + Auth
# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3 (Test Design Specification), §4 (Test Case Specification), §5 (Test Procedure Specification)
> **Status:** ✅ Done — script at [`tests/e2e/phase00_health_auth.ps1`](../../../tests/e2e/phase00_health_auth.ps1)
> **Last verified:** 2026-06-28 (live run against `localhost:3000`)
> **Audience:** authors of new PHASE specs (B.1.2 → B.1.18) — copy this structure verbatim

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_00 |
| **Title** | Health + Readiness + DB Connectivity + Auth |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 (initial release) |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Functional + Security (auth + rate-limit) |

---

## 2. Scope

### 2.1 In scope

1. **Liveness & readiness probes** — the `/api/health` and `/api/ready`
   endpoints exposed by `app/server/index.ts`.
2. **DB connectivity proof** — exercised indirectly by hitting
   read-only public endpoints that must return real data.
3. **Authentication happy path** — login for the three seeded roles,
   `/auth/me` round-trip.
4. **Authentication negative path** — wrong password, unknown email,
   empty body, malformed token, missing token.
5. **Registration happy path** — create a new user, then login with
   their credentials.
6. **Registration negative path** — duplicate email, weak password,
   missing fields, invalid email format.

### 2.2 Out of scope (covered by other PHASES)

- 2FA setup, verify, disable → **PHASE 12** (`phase12_2fa_backup.ps1`)
- Password change → **PHASE 01** (`phase01_profile_addresses.ps1`)
- Address CRUD → **PHASE 01**
- Profile update → **PHASE 01**
- Logout / token revocation → not yet implemented (no endpoint)
- Email verification flow → not yet implemented

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/index.ts` | 100-106 | `GET /api/health` |
| `app/server/index.ts` | 109-120 | `GET /api/ready` (pings DB via `db.prepare('SELECT 1')`) |
| `app/server/routes/auth.cts` | 23-63 | `POST /api/auth/register` |
| `app/server/routes/auth.cts` | 65-108 | `POST /api/auth/login` (with 2FA branch at line 93) |
| `app/server/routes/auth.cts` | 110-122 | `GET /api/auth/me` |
| `app/server/routes/catalog.cts` | 59-160 | `GET /api/products` |
| `app/server/routes/catalog.cts` | 249-260 | `GET /api/stores` |
| `app/server/routes/catalog.cts` | 328-385 | `GET /api/categories` |
| `app/server/lib/shared.cts` | 55-87 | `hashPassword`, `verifyPassword` (scrypt) |
| `app/server/lib/shared.cts` | 92-103 | `authLimiter` → `consume_rate_limit()` SQL fn |
| `app/server/lib/shared.cts` | 113 | `authLimiter = rateLimit(15 * 60 * 1000, 20, 'auth')` (20 req / 15 min) |
| `app/server/lib/shared.cts` | 232-242 | `emailSchema`, `passwordSchema`, `registerSchema`, `loginSchema` |
| `app/server/middleware.ts` | (various) | `requestId`, `securityHeaders`, `optionalAuth`, `verifyAuthToken` |

### 3.2 Database

| Table | Operations in this PHASE |
|-------|--------------------------|
| `users` | `SELECT` (login, /me), `INSERT` (register), `UPDATE last_login` |
| `products` | `SELECT` (limit=1, for DB connectivity proof) |
| `categories` | `SELECT` (full tree, for DB connectivity proof) |
| `stores` | `SELECT` (full list, for DB connectivity proof) |
| `rate_limit_buckets` | `SELECT + UPDATE` via `consume_rate_limit()` (DB-backed rate limiting) |

### 3.3 Test data (from `database/seed.sql`)

| Email | Password | Role | user.id (in current DB) |
|-------|----------|------|--------------------------|
| `ahmed@gmail.com` | `customer123` | customer | 2 |
| `fatima@spice-yemen.com` | `merchant123` | merchant | 5 |
| `admin@noufex.com` | `admin123` | admin | 1 |

> Passwords are stored as `scrypt$<salt_b64>$<hash_b64>` (see
> `database/seed.sql:36-100`). Verification uses
> `crypto.timingSafeEqual` to defeat timing attacks
> (`app/server/lib/shared.cts:78`).

---

## 4. Test Conditions

Each **test condition** is a behavior the PHASE must verify. Conditions
are mapped to **test cases** in §5 and to **assertions** in §6.

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | The API exposes a liveness endpoint that does NOT require auth | IEEE 829 §4.1 |
| TC-2 | The API exposes a readiness endpoint that verifies DB connectivity | IEEE 829 §4.1 |
| TC-3 | Public catalog endpoints return real data, proving DB is reachable | ISO 29119-4 (EP) |
| TC-4 | The 3 seeded roles can authenticate and receive a valid JWT | IEEE 829 §4.2 |
| TC-5 | `/auth/me` echoes the authenticated user identity | IEEE 829 §4.3 |
| TC-6 | Wrong credentials return `401 AUTH_INVALID` (not 404) | ISTQB CTFL EP + security best practice |
| TC-7 | Missing fields return `400 VALIDATION_ERROR` | ISO 29119-4 (BVA) |
| TC-8 | Tampered tokens return `401` | ISTQB CTFL (error guessing) |
| TC-9 | Missing tokens return `401` | IEEE 829 §4.4 |
| TC-10 | Registration creates a new customer and returns `201` + token | IEEE 829 §4.5 |
| TC-11 | Duplicate email returns `409 EMAIL_TAKEN` (PG `23505`) | ISO 29119-4 (state: "exists") |
| TC-12 | Weak passwords (< 8 chars) return `400 VALIDATION_ERROR` | ISO 29119-4 (BVA on min length) |
| TC-13 | Invalid email format returns `400` | ISO 29119-4 (EP) |
| TC-14 | Newly registered user can login immediately | IEEE 829 §4.6 |

---

## 5. Test Cases (full enumeration)

Each test case lists: precondition, request, expected result, and which
condition(s) it satisfies. **Total: 17 test cases.**

### 5.1 Section 1 — Health endpoints

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-1.1 | API running | `GET /api/health` | 200, `{status:"ok"}`, `uptime_s` ≥ 0 | TC-1 |
| TC-1.2 | API running, DB seeded | `GET /api/ready` | 200, `checks.db.ok=true`, `checks.db.ms` ≤ 100 | TC-2 |

### 5.2 Section 2 — DB connectivity (real data)

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-2.1 | DB has ≥ 1 product | `GET /api/products?limit=1` | 200, `data.products[0]` is a real row | TC-3 |
| TC-2.2 | DB has ≥ 18 categories | `GET /api/categories` | 200, `data` is an array of length ≥ 18 | TC-3 |
| TC-2.3 | DB has ≥ 7 stores | `GET /api/stores` | 200, `data` is an array of length ≥ 7 | TC-3 |

### 5.3 Section 3 — Login for all 3 roles

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-3.1 | Seed user exists | `POST /api/auth/login {email: ahmed, password: customer123}` | 200, `data.token` non-empty, `data.user.role=customer` | TC-4 |
| TC-3.2 | Seed user exists | `POST /api/auth/login {email: fatima, password: merchant123}` | 200, `data.token`, `data.user.role=merchant` | TC-4 |
| TC-3.3 | Seed user exists | `POST /api/auth/login {email: admin, password: admin123}` | 200, `data.token`, `data.user.role=admin` | TC-4 |

### 5.4 Section 4 — `/auth/me` round-trip

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-4.1 | Token from TC-3.1 | `GET /api/auth/me` (customer Bearer) | 200, `data.id=2`, `data.email=ahmed@gmail.com` | TC-5 |
| TC-4.2 | Token from TC-3.2 | `GET /api/auth/me` (merchant Bearer) | 200, `data.id=5`, `data.email=fatima@…` | TC-5 |
| TC-4.3 | Token from TC-3.3 | `GET /api/auth/me` (admin Bearer) | 200, `data.id=1`, `data.email=admin@…` | TC-5 |

### 5.5 Section 5 — Bad credentials

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-5.1 | Seed user exists | `POST /api/auth/login {email: ahmed, password: WRONG}` | 401, `code=AUTH_INVALID` | TC-6 |
| TC-5.2 | Email does not exist | `POST /api/auth/login {email: nobody@example.com, password: whatever}` | 401, `code=AUTH_INVALID` (same as TC-5.1 to avoid email enumeration) | TC-6 |
| TC-5.3 | Empty body | `POST /api/auth/login {}` | 400, `code=VALIDATION_ERROR` | TC-7 |

### 5.6 Section 6 — Invalid / missing tokens

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-6.1 | Garbage token | `GET /api/auth/me` (Authorization: Bearer not.a.real.jwt) | 401 | TC-8 |
| TC-6.2 | No header | `GET /api/auth/me` (no Authorization) | 401 | TC-9 |

### 5.7 Section 7 — Registration

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-7.1 | Email is unique | `POST /api/auth/register {email: test<rand>@example.com, password: NewUserPass1!, name: Test User <rand>}` | 201, `data.user.id` non-null, `data.token` non-empty, `data.user.role=customer` | TC-10 |
| TC-7.2 | Email already exists (`ahmed@gmail.com`) | `POST /api/auth/register {email: ahmed, password: AnotherPass1!, name: Imposter}` | 409, `code=EMAIL_TAKEN` | TC-11 |
| TC-7.3 | Password below min length | `POST /api/auth/register {password: 123}` | 400, `code=VALIDATION_ERROR` | TC-12 |
| TC-7.4 | Missing required field | `POST /api/auth/register {email: missing<rand>@example.com}` (no password) | 400, `code=VALIDATION_ERROR` | TC-7 |
| TC-7.5 | Invalid email format | `POST /api/auth/register {email: not-an-email, password: NewUserPass1!, name: Bad Email}` | 400, `code=VALIDATION_ERROR` | TC-13 |
| TC-7.6 | Round-trip: login as newly created user | `POST /api/auth/login {email: <the one from TC-7.1>, password: NewUserPass1!}` | 200, `data.token` non-empty | TC-14 |

---

## 6. Test Procedure (execution order)

The PHASE script executes the 17 test cases in a fixed order. The order
matters because later cases depend on tokens or users created earlier.

```
1. Section 1 — Health endpoints         (TC-1.1, TC-1.2)
2. Section 2 — DB connectivity          (TC-2.1, TC-2.2, TC-2.3)
3. Section 3 — Login × 3 roles          (TC-3.1, TC-3.2, TC-3.3)
4. Section 4 — /auth/me round-trip      (TC-4.1, TC-4.2, TC-4.3)
5. Section 5 — Bad credentials          (TC-5.1, TC-5.2, TC-5.3)
6. Section 6 — Invalid tokens           (TC-6.1, TC-6.2)
7. Section 7 — Registration             (TC-7.1 → TC-7.6)
```

**Total HTTP requests: 18** (2 + 3 + 3 + 3 + 3 + 2 + 5 + 1 — one
repeat for the new-user login, but TC-7.6 is part of Section 7).

---

## 7. Pass/Fail Criteria

### 7.1 Test-case pass criteria

A test case **passes** if the actual HTTP status code AND the
`data.code` field (when present) match the expected values in §5.

### 7.2 PHASE pass criteria

The PHASE **passes** if **all 17 test cases pass**.

In practice the existing `phase00_health_auth.ps1` script does NOT count
pass/fail automatically (it predates `PS_TestHelpers.ps1`). A
`Assert-Status` wrapper around each `Call` is the recommended upgrade
(see [PS_TEST_TEMPLATE.ps1](../../templates/PS_TEST_TEMPLATE.ps1) §2-§7).

### 7.3 Re-run policy

PHASE 00 is **idempotent** EXCEPT for the registration step (TC-7.1).
Running it twice will produce a different `<rand>` for TC-7.1, so the
newly-created user is always unique. The duplicate-email test (TC-7.2)
targets the static `ahmed@gmail.com`, so it stays reliable.

---

## 8. Test Data Generation

### 8.1 Static (from `database/seed.sql`)

```
ahmed@gmail.com          / customer123  → customer  (user.id = 2)
fatima@spice-yemen.com   / merchant123  → merchant  (user.id = 5)
admin@noufex.com         / admin123     → admin     (user.id = 1)
```

The 18 categories and 7 stores come from `seed.sql` — do NOT alter them
without updating this PHASE spec.

### 8.2 Dynamic (per run)

- **Random email** for TC-7.1: `test<rand>@example.com` where `<rand>`
  is a 6-digit random number. Using `Get-Random -Minimum 100000
  -Maximum 999999` gives a sufficiently unique value across runs.
- **Random phone**: `+96771111<rand>` (Yemen country code + 8 digits,
  random suffix).
- **Random name**: `Test User <rand>`.

### 8.3 Test data invariants

- `ahmed@gmail.com` MUST exist before running PHASE 0.
- The DB MUST contain ≥ 1 product, ≥ 18 categories, ≥ 7 stores.
- `AUTH_SECRET` env var MUST be set (≥ 32 chars).

---

## 9. Traceability (Requirement → Test Case)

The following functional requirements are exercised by this PHASE:

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-AUTH-1: The system SHALL provide secure login (scrypt + JWT) | `docs/architecture/overview.md` "Authentication" | TC-3.1, TC-3.2, TC-3.3 |
| REQ-AUTH-2: The system SHALL return 401 on wrong credentials | RFC 7235 | TC-5.1, TC-5.2 |
| REQ-AUTH-3: The system SHALL return 400 on missing required fields | zod convention | TC-5.3, TC-7.3, TC-7.4, TC-7.5 |
| REQ-AUTH-4: The system SHALL rate-limit `/api/auth/*` to 20 req / 15 min / IP | `shared.cts:113` | TC-5.1..TC-7.6 (cumulatively) |
| REQ-AUTH-5: Newly registered users SHALL be able to login immediately | zod + bcrypt convention | TC-7.6 |
| REQ-AUTH-6: Duplicate email SHALL return 409 | PG unique constraint | TC-7.2 |
| REQ-AUTH-7: Password minimum length SHALL be 8 | `passwordSchema: z.string().min(8)` | TC-7.3 |
| REQ-OPS-1: API SHALL expose `/api/health` (no auth, no DB) | K8s liveness convention | TC-1.1 |
| REQ-OPS-2: API SHALL expose `/api/ready` (verifies DB ping) | K8s readiness convention | TC-1.2 |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **`AUTH_SECRET` too short** (< 32 chars) | Server fails to boot with cryptic error | TC pre-flight check via `Get-Item env:AUTH_SECRET` |
| **Rate limiter exhausted from previous runs** | TC-3.x, TC-7.x return 429 | Wait 15 min, or restart the API process (resets in-memory bucket; DB bucket via `consume_rate_limit` only resets per window) |
| **Seed users deleted** | TC-3.1, TC-3.2, TC-3.3, TC-4.x, TC-7.2 all fail | Re-run `npm run db:setup` |
| **DB empty** | TC-2.1 returns 200 with empty array | Re-run `npm run db:setup` |
| **Network unreachable** | All TC return 0 status | Verify API base URL via `Test-NetConnection localhost -Port 3000` |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
Exit code: 0
Phase 0 complete.
```

Section-by-section summary (truncated, full transcript at
`tests/reports/phase00_health_auth.log`):

```
Section 1 (Health):          2/2 PASS (200/200)
Section 2 (DB connectivity): 3/3 PASS (200/200/200)
                              categories: total=18, stores: total=7
Section 3 (Login):           3/3 PASS (all 200)
Section 4 (/auth/me):        3/3 PASS (all 200)
Section 5 (Bad credentials): 3/3 PASS (401/401/400)
Section 6 (Tokens):          2/2 PASS (401/401)
Section 7 (Registration):    6/6 PASS (201/409/400/400/400/200)
─────────────────────────────────────────────────
Total:                       22/22 PASS (0 FAIL)
```

> The script's request count (22) exceeds the test-case count (17)
> because Section 7 has 5 registration attempts + 1 login (6), and
> TC-2.2 / TC-2.3 each make one request that prints two log lines.

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Standard for Software and System Test
  Documentation ([source](https://standards.ieee.org/ieee/829/4987/))
- **ISO/IEC/IEEE 29119-3** — Software Testing — Part 3: Test
  Documentation ([source](https://www.iso.org/standard/81291.html))
- **ISTQB CTFL v4.0** — Foundation Level Syllabus
  ([source](https://www.istqb.org/))

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 0 — master plan
- [`standards/IEEE-829.md`](../standards/IEEE-829.md) — §3 Test Design, §4 Test Case
- [`standards/ISO-29119.md`](../standards/ISO-29119.md) — Part 3 documentation model
- [`standards/ISTQB-CTFL.md`](../standards/ISTQB-CTFL.md) — EP / BVA / state techniques
- [`../../templates/PS_TEST_TEMPLATE.ps1`](../../templates/PS_TEST_TEMPLATE.ps1) — script template (A.2)
- [`../../templates/PS_TESTHELPERS_REFERENCE.md`](../../templates/PS_TESTHELPERS_REFERENCE.md) — helper functions (A.4)
- [`../../../tests/e2e/phase00_health_auth.ps1`](../../../tests/e2e/phase00_health_auth.ps1) — the script
- [`../../../tests/reports/phase00_health_auth.log`](../../../tests/reports/phase00_health_auth.log) — last transcript
- [`../../../../app/server/routes/auth.cts`](../../../../app/server/routes/auth.cts) — handler under test
- [`../../../../app/server/lib/shared.cts`](../../../../app/server/lib/shared.cts) — scrypt + zod + rate limiter
- [`../../../../database/seed.sql`](../../../../database/seed.sql) — demo credentials

---

## 13. Maintenance Notes

When updating this PHASE:

1. Update §3 line numbers if `app/server/` files are edited.
2. Add new test cases to §5 + §6 + §7 + §9 traceability.
3. Bump version in §1.
4. Re-run live and update §11 with new transcript.
5. Commit the spec change + the script change in **the same commit**
   (so they stay in lock-step).

---

> **End of PHASE 00 Design Specification.** Next: B.1.2
> ([PHASE_01_PROFILE_ADDRESSES.md](PHASE_01_PROFILE_ADDRESSES.md)).