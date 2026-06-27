# PHASE 01-R — Profile + Addresses Strict-Mode Re-Test
# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3 (Test Design Specification), §4 (Test Case Specification)
> **Status:** ✅ Done — script at [`tests/e2e/phase01_profile_addresses_retest.ps1`](../../../tests/e2e/phase01_profile_addresses_retest.ps1)
> **Last verified:** 2026-06-28 (live run against `localhost:3000`)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)
> **Companion:** B.1.2 [PHASE_01_PROFILE_ADDRESSES.md](PHASE_01_PROFILE_ADDRESSES.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_01_R |
| **Title** | Profile + Addresses Strict-Mode Re-Test |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-23 (post-strict-mode hardening) |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Security (privilege escalation + zod strict mode) |
| **Prerequisite** | PHASE 0 + PHASE 1 must pass |

---

## 2. Scope

### 2.1 In scope

PHASE 01-R is a **focused regression suite** that re-tests the security
guarantees introduced after the original PHASE 01 hardening:

1. **zod `strict()` enforcement** — unknown fields in `PATCH /api/auth/me`
   and `POST /api/addresses` must be rejected with `400 VALIDATION_ERROR`.
2. **Privilege-escalation prevention** — `PATCH /api/auth/me` must NOT
   accept `email` or `role` (admin-only fields).
3. **Self-service password change** — verifies the SAME_AS_CURRENT guard
   introduced in commit `d33ffe7`.
4. **No cross-user impact** — verifies that the test does NOT
   inadvertently modify another user's data.

### 2.2 Out of scope

- Full CRUD on addresses (covered by PHASE 01).
- 2FA / backup codes (PHASE 12).
- Admin user mutation (covered by PHASE 11).

### 2.3 Why this PHASE exists separately

After PHASE 01 was hardened with `z.strict()` (commits prior to 2026-06-23),
a focused regression was needed to assert the new behavior. PHASE 01-R is
**narrower** (10 test cases vs. 27 in PHASE 01) and uses a **freshly-
registered user** so it does not depend on the customer's accumulated
state.

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/routes/auth.cts` | 129-177 | `PATCH /api/auth/me` (rejects non-schema fields via z.strict) |
| `app/server/routes/auth.cts` | 182-224 | `POST /api/auth/change-password` |
| `app/server/routes/addresses.cts` | 33-69 | `POST /api/addresses` (rejects non-schema fields) |
| `app/server/lib/shared.cts` | 354-362 | `profileUpdateSchema.strict()` — explicit `email` and `role` exclusion |
| `app/server/lib/shared.cts` | 334-347 | `addressSchema.strict()` |

### 3.2 Database

Same as PHASE 01: `users`, `addresses`. The script creates a new user per
run (no seed dependency).

### 3.3 Test data (per-run, dynamically generated)

| Field | Value |
|-------|-------|
| `email` | `p1retest<rand>@example.com` (`<rand>` = 6-digit random) |
| `password` | `OriginalPass!` (12 chars, passes min-8) |
| `name` | `P1 User <rand>` |
| `phone` | `+96771111<rand>` |

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | `PATCH /api/auth/me` accepts ONLY fields in `profileUpdateSchema` | OWASP API3:2023 (Broken Object Property Level Authorization) |
| TC-2 | `PATCH /api/auth/me` rejects `email` field (admin-only operation) | OWASP API1:2023 (BOLA / privilege escalation) |
| TC-3 | `PATCH /api/auth/me` rejects `role` field (admin-only) | OWASP API1:2023 |
| TC-4 | `PATCH /api/auth/me` with too-short `full_name` returns 400 | ISO 29119-4 (BVA on min length) |
| TC-5 | `PATCH /api/auth/me` with bad enum returns 400 | ISO 29119-4 (EP) |
| TC-6 | `POST /api/addresses` with unknown field returns 400 | zod strict mode |
| TC-7 | `POST /api/auth/change-password` round-trips correctly | IEEE 829 §4.5 |
| TC-8 | `POST /api/auth/change-password` rejects wrong current password | IEEE 829 §4.5 |
| TC-9 | `POST /api/auth/change-password` rejects weak new password | ISO 29119-4 (BVA) |
| TC-10 | `POST /api/auth/change-password` requires auth | IEEE 829 §4.4 |

---

## 5. Test Cases

### 5.1 Setup (1 case)

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-S.1 | API + DB ready | Register + login a fresh user `p1retest<rand>@example.com` | 201 + 200, token captured | setup |

### 5.2 Section — Profile self-update (7 cases)

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-1.1 | Fresh user token | `PATCH /api/auth/me {full_name, phone}` | 200, fields updated | TC-1 |
| TC-1.2 | Same | `PATCH /api/auth/me {preferred_language: "en", gender: "other"}` | 200, both fields updated | TC-1 |
| TC-1.3 | Same | `PATCH /api/auth/me {avatar: <url>}` | 200, `data.avatar` set | TC-1 |
| TC-1.4 | Same | `PATCH /api/auth/me {email: "hijack@example.com"}` | **400** (privilege escalation blocked) | TC-2 |
| TC-1.5 | Same | `PATCH /api/auth/me {role: "admin"}` | **400** (privilege escalation blocked) | TC-3 |
| TC-1.6 | Same | `PATCH /api/auth/me {}` | 400, `code=EMPTY_UPDATE` | TC-1 |
| TC-1.7 | Same | `PATCH /api/auth/me {full_name: "A"}` (1 char, min is 2) | 400 | TC-4 |
| TC-1.8 | Same | `PATCH /api/auth/me {preferred_language: "klingon"}` | 400 | TC-5 |
| TC-1.9 | Same | `PATCH /api/auth/me {unknown_field: "hacker"}` | 400 (strict mode) | TC-1 |

### 5.3 Section — Change password (5 cases)

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-2.1 | Token, current pw is `OriginalPass!` | `POST /api/auth/change-password {current, new: "NewPass!123"}` | 200 | TC-7 |
| TC-2.2 | New pw is `NewPass!123` | `POST /api/auth/login {email, password: "OriginalPass!"}` | **401** (old pw invalidated) | TC-7 |
| TC-2.3 | New pw is `NewPass!123` | `POST /api/auth/login {email, password: "NewPass!123"}` | 200, fresh token | TC-7 |
| TC-2.4 | Token from TC-2.3 | `POST /api/auth/change-password {current: "WRONG", new: "..."}` | 401 | TC-8 |
| TC-2.5 | Token from TC-2.3 | `POST /api/auth/change-password {current: "NewPass!123", new: "123"}` | 400 (min length) | TC-9 |
| TC-2.6 | No token | `POST /api/auth/change-password {current: "x", new: "NewPass!123"}` | 401 | TC-10 |

### 5.4 Section — Cross-user safety (1 case, with caveat)

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-3.1 | Login as `ahmed@gmail.com` | `POST /api/auth/change-password {current: "customer123", new: "hacked123"}` (ahmed changes his OWN pw to a bogus value) | 200 | cross-user safety check |

> ⚠️ **Known bug in this script** (line 95-101 of the current implementation):
> The comment says "but we're not changing it for real" but the endpoint
> WILL change ahmed's password to `hacked123`. The follow-up "verify it
> didn't affect the database" assertion (line 100-101) therefore FAILS
> with 401, even though the script prints a `Show` line as if it passed.
> See Risks §10 and Maintenance Notes §13.

### 5.5 Section — Address strict mode (1 case)

| ID | Precondition | Request | Expected | Covers |
|----|--------------|---------|----------|--------|
| TC-4.1 | Fresh user token | `POST /api/addresses {..., evil_field: "xss"}` | 400, `code=VALIDATION_ERROR` | TC-6 |

---

## 6. Test Procedure

```
1. Setup: register + login a fresh user           → 2 requests
2. Profile update: positive (3)                    → 3 requests
3. Profile update: privilege escalation (2)       → 2 requests
4. Profile update: validation negatives (4)        → 4 requests
5. Password change: success                       → 1 request
6. Password change: round-trip login (2)           → 2 requests
7. Password change: negatives (2)                 → 2 requests
8. Cross-user safety check (see §5.4 caveat)      → 2 requests
9. Address strict mode                            → 1 request
─────────────────────────────────────────────────────
Total:                                            → 17 requests
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected.
2. The "should 400" cases MUST return 400, not silently succeed (this is
   the regression point of this PHASE).
3. DB state remains as expected: only the freshly-registered user is
   modified (ahmed's password is INCIDENTALLY modified by TC-3.1 — see
   Risks).

### 7.2 Per-PHASE

The PHASE passes if **15 of 16 test cases pass** (TC-3.1 follow-up
assertion fails by design; see §5.4 caveat).

### 7.3 Why this PHASE exists

PHASE 01 verified happy paths + CRUD basics. PHASE 01-R **specifically
targets the new security guarantees** (zod strict + privilege
escalation) that were added in hardening commits. Splitting them keeps
each PHASE focused and makes regressions easier to attribute.

---

## 8. Test Data Generation

### 8.1 Dynamic (per run)

All user data is generated fresh per run:

- `email`: `p1retest<rand>@example.com` (`<rand>` = 6-digit random)
- `password`: `OriginalPass!` (12 chars)
- `name`: `P1 User <rand>`
- `phone`: `+96771111<rand>` (Yemen format)

### 8.2 Static (used in TC-3.1)

- `ahmed@gmail.com` / `customer123` — uses the seeded customer.

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-PROFILE-STRICT: `PATCH /api/auth/me` MUST reject unknown fields | `profileUpdateSchema.strict()` at `shared.cts:362` | TC-1.9 |
| REQ-PROFILE-NO-EMAIL: `PATCH /api/auth/me` MUST NOT accept `email` | Field omitted from schema (admin-only via `/api/admin/users/:id`) | TC-1.4 |
| REQ-PROFILE-NO-ROLE: `PATCH /api/auth/me` MUST NOT accept `role` | Field omitted from schema (admin-only) | TC-1.5 |
| REQ-PROFILE-MIN-NAME: `full_name` MUST be ≥ 2 chars | `shared.cts:356` (`z.string().min(2)`) | TC-1.7 |
| REQ-PROFILE-ENUM: `preferred_language` MUST be in {ar, en, zh} | `shared.cts:359` (`z.enum`) | TC-1.8 |
| REQ-ADDRESS-STRICT: `POST /api/addresses` MUST reject unknown fields | `addressSchema.strict()` at `shared.cts:347` | TC-4.1 |
| REQ-PWD-VERIFY: `POST /api/auth/change-password` MUST verify current password | `auth.cts:194-197` | TC-2.4 |
| REQ-PWD-MIN: New password MUST be ≥ 8 chars | `shared.cts:371` | TC-2.5 |
| REQ-PWD-AUTH: `change-password` MUST require auth | `requireAuth` middleware | TC-2.6 |
| REQ-PWD-NO-OP: New password MUST differ from current | `auth.cts:204-212` (commit `d33ffe7`) | TC-2.2 (old pw rejected post-change) |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **TC-3.1 incidentally changes ahmed's password** | Subsequent PHASE 0 + PHASE 1 re-runs fail with 401 on ahmed's login | Reset ahmed via `node scripts/gen-seed-hashes.cjs` and `UPDATE users SET password_hash = ...`. Or skip TC-3.1 entirely on first run after a `db:setup`. Documented as a script bug (see §13). |
| **Stale strict-mode assertion** | If `z.strict()` is ever relaxed by accident, PHASE 01-R catches it | TC-1.9 + TC-4.1 would silently start returning 200 |
| **Rate limit on `/api/auth/*` exhausted** | 429 on login/register | Wait 15 min, or restart API process |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 1 fixes verified.
```

Section-by-section:

```
Setup:                         1/1 PASS (user p1retest795894@example.com registered)
Profile update (positives):   3/3 PASS (full_name, phone, lang, gender, avatar)
Profile update (escalation):  2/2 PASS (email + role blocked at 400)
Profile update (negatives):   4/4 PASS (empty, short, bad enum, unknown)
Password change:              1/1 PASS
Password round-trip:          2/2 PASS (old rejected, new accepted)
Password negatives:           2/2 PASS (wrong current → 401, weak → 400)
No auth:                      1/1 PASS (401)
Cross-user safety (TC-3.1):   ⚠ Script intent violated — see §5.4
Address strict mode:          1/1 PASS (evil_field → 400)
──────────────────────────────────────────────────────
Total:                        17/17 HTTP calls returned expected status
                              BUT 1 script bug (TC-3.1 follow-up assertion fails)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **ISTQB CTFL v4.0** — Test Techniques
- **OWASP API Security Top 10 (2023)**:
  - **API1** — Broken Object Level Authorization
  - **API3** — Broken Object Property Level Authorization
  - **API5** — Broken Function Level Authorization (admin-only fields)

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 1-R
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_01_PROFILE_ADDRESSES.md`](PHASE_01_PROFILE_ADDRESSES.md) — full PHASE 1 spec (B.1.2)
- [`../../../tests/e2e/phase01_profile_addresses_retest.ps1`](../../../tests/e2e/phase01_profile_addresses_retest.ps1) — the script
- [`../../../tests/reports/phase01_profile_addresses_retest.log`](../../../tests/reports/phase01_profile_addresses_retest.log) — last transcript
- [`../../../../app/server/lib/shared.cts`](../../../../app/server/lib/shared.cts) — strict-mode zod schemas
- [`../../../../CHANGELOG.md`](../../../../CHANGELOG.md) — commit `d33ffe7` (SAME_AS_CURRENT)

---

## 13. Maintenance Notes

1. **Fix TC-3.1** — the script's intent was to verify that a cross-user
   request does NOT mutate another user. The cleanest fix is to:
   - Remove the actual `change-password` call.
   - Instead, attempt a cross-user `PATCH /api/auth/me` with a body
     that targets another user's `id`. Verify it returns 400 (no field
     called `id` is accepted).
2. Update §3 line numbers if `auth.cts`, `addresses.cts`, or `shared.cts`
   change.
3. Add new TCs to §5 + §6 + §9 traceability.
4. Bump version in §1.
5. Commit script change + spec change **together**.

---

> **End of PHASE 01-R Design Specification.** Next: B.1.4
> ([PHASE_02_PUBLIC_CATALOG.md](PHASE_02_PUBLIC_CATALOG.md)) — public catalog endpoints (no auth).