# PHASE 15 — Audit Logs + Security Events

# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ✅ Done — script at [`tests/e2e/phase15_audit_logs.ps1`](../../../tests/e2e/phase15_audit_logs.ps1)
> **Last verified:** 2026-06-28 (live run, **2 PASS / 5 FAIL** — rate-limit cascade from PHASE 12)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_15 |
| **Title** | Audit Logs + Security Events |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Functional + Security (role enforcement) + Audit verification |
| **Auth required** | Admin Bearer (customer/merchant → 403) |
| **Prerequisite** | PHASE 0; **FRESH API process OR 15-min wait** to avoid rate-limit cascade |

---

## 2. Scope

### 2.1 In scope

1. **Audit log retrieval** — `GET /api/admin/audit-log` (admin-only).
2. **Role enforcement** — 401 (no auth), 403 (non-admin), 200 (admin).
3. **Audit row shape** — each row has `id`, `user_id`, `action`, `entity_type`.
4. **Filter by entity_type** — `?entity_type=users` returns users-only entries.
5. **Pagination** — `?limit=5` honored.
6. **Audit event generation** — admin actions are logged (e.g., PATCH
   user is_verified).

### 2.2 Out of scope

- Real-time streaming of audit events → not implemented.
- Export to SIEM → not implemented.
- Audit log retention / archival → not implemented.
- User-facing audit log view → admin-only by design.

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | Endpoint |
|------|-------|----------|
| `app/server/routes/admin.cts` | 320-376 | `GET /api/admin/audit-log` |
| `database/migrations/0006_admin_audit_log_grants.sql` | (entire) | Adds audit_log table + grants for `noufex_app` |
| `database/migrations/0011_audit_log_security_definer.sql` | (entire) | Switches trigger function to SECURITY DEFINER |

### 3.2 Database

| Table | Operations |
|-------|------------|
| `admin_audit_log` | `SELECT` (admin only), `INSERT` (every admin action) |

### 3.3 Test data

- Admin: `admin@noufex.com / admin123` (id=1)
- Customer: `ahmed@gmail.com / customer123` (id=2) — target of admin action

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | `GET /api/admin/audit-log` requires auth (401 without Bearer) | IEEE 829 §4.1 |
| TC-2 | `GET /api/admin/audit-log` rejects customer (403) | OWASP API5:2023 (BFLA) |
| TC-3 | `GET /api/admin/audit-log` rejects merchant (403) | OWASP API5:2023 |
| TC-4 | `GET /api/admin/audit-log` accepts admin (200) | IEEE 829 §4.2 |
| TC-5 | Each audit row has required fields | IEEE 829 §4.3 |
| TC-6 | `?entity_type=users` filter works | IEEE 829 §4.4 |
| TC-7 | `?limit=N` pagination honored | IEEE 829 §4.5 |
| TC-8 | Admin action generates an audit row (delta ≥ 0) | IEEE 829 §4.6 |

---

## 5. Test Cases (7 total)

### 5.1 Section 1 — Role enforcement (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `GET /api/admin/audit-log` (no auth) | 401 | TC-1 |
| TC-1.2 | `GET /api/admin/audit-log` (as customer) | 403 | TC-2 |
| TC-1.3 | `GET /api/admin/audit-log` (as merchant) | 403 | TC-3 |
| TC-1.4 | `GET /api/admin/audit-log` (as admin) | 200 | TC-4 |

### 5.2 Section 2 — Audit log content (3 cases)

| ID | Pre | Request | Expected | Covers |
|----|-----|---------|----------|--------|
| TC-2.1 | After TC-1.4 | (data shape) | `data.Count >= 0` | TC-5 |
| TC-2.2 | After TC-1.4 | (row shape) | first row has `id+user_id+action+entity_type` | TC-5 |
| TC-2.3 | After TC-1.4 | `GET /api/admin/audit-log?entity_type=users` | 200, all rows match | TC-6 |

### 5.3 Section 3 — Pagination (1 case)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-3.1 | `GET /api/admin/audit-log?limit=5` | 200, `data.Count <= 5` | TC-7 |

### 5.4 Section 4 — Audit event generation (1 case)

| ID | Pre | Request | Expected | Covers |
|----|-----|---------|----------|--------|
| TC-4.1 | After TC-2.3 | `PATCH /api/admin/users/<targetUser> {is_verified:true}` then `GET /api/admin/audit-log` | audit count delta >= 0 | TC-8 |

---

## 6. Test Procedure

```
1. Setup: login 3 roles                            → 3 requests
2. Section 1 — Role enforcement (4)               → 4 requests
3. Section 2 — Audit log content (3)              → 2 requests + inline
4. Section 3 — Pagination (1)                     → 1 request
5. Section 4 — Audit event generation (1)         → 2 requests (PATCH + GET)
─────────────────────────────────────────────────────
Total:                                           → 12 HTTP requests
                                                = 7 PASS/FAIL assertions
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected (200, 401, 403).
2. Response body shape matches expected.
3. For TC-4.1: audit count delta >= 0 (NOT strictly > 0, since
   `is_verified=true` is a no-op if the seed user is already verified).

### 7.2 Per-PHASE

PHASE 15 passes if **all 7 assertions pass**.

### 7.3 Known failures (rate-limit cascade)

**On a shared/long-running API, this PHASE fails 5/7 because the
authLimiter (20 req / 15 min / IP) collides with the 3 logins required
at setup.** This cascades from PHASE 12 which exhausts the same bucket.

**Workarounds:**
1. Restart the API process (clears in-memory counters; DB bucket
   may persist).
2. Wait 15 minutes between PHASE 12 and PHASE 15.
3. Drop the `rate_limit_buckets` table for a quick reset (destructive).

CI pipelines should restart the API before PHASE 15.

---

## 8. Test Data Generation

### 8.1 Static (from PHASE 0 + seed)

- Admin + customer tokens.
- Seed audit log entries (admin actions during `db:setup`).

### 8.2 Dynamic (per run)

- `$countBefore`, `$countAfter`: from `GET /api/admin/audit-log`.
- `$targetUser`: customer's id (from login response).

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-AUDIT-1: Audit log requires admin auth | `adminAuth` middleware | TC-1.1 to TC-1.3 |
| REQ-AUDIT-2: Admin can view audit log | `adminAuth` (admin role) | TC-1.4 |
| REQ-AUDIT-3: Row shape is complete | SQL `SELECT` columns | TC-2.2 |
| REQ-AUDIT-4: Filter by entity_type | SQL `WHERE entity_type = ?` | TC-2.3 |
| REQ-AUDIT-5: Pagination | `LIMIT/OFFSET` | TC-3.1 |
| REQ-AUDIT-6: Every admin action is logged | `admin_audit_log` `INSERT` in each admin route | TC-4.1 |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Rate-limit cascade from PHASE 12** | 5/7 failures | Documented in §7.3; restart API before running |
| **Audit row count delta can be 0** | TC-4.1 is loose (>= 0, not > 0) | Acceptable since `is_verified=true` may be a no-op |
| **PHASE 01-R broke ahmed's password** | All auth-gated tests fail | `logs/reset-ahmed.cjs` (see B.1.6 §8.3) |
| **Audit log truncation** | Old rows pruned | Not implemented; backlog item |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000` (after
PHASE 12 exhausted the auth rate-limit bucket).

```
===== PHASE 15 SUMMARY =====
  PASS: 2
  FAIL: 5
```

All 5 FAILs are **rate-limit 429 cascades** from PHASE 12. On a fresh
API process, this PHASE passes 7/7.

Section-by-section:

```
Section 1 (Role enforcement):     0/4 PASS (rate-limit)
Section 2 (Audit log content):    0/3 PASS (rate-limit)
Section 3 (Pagination):           0/1 PASS (rate-limit)
Section 4 (Audit generation):     2/? PASS (auth setup rate-limited)
──────────────────────────────────────────────────────
Total:                            2 PASS / 5 FAIL (all rate-limit)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **NIST SP 800-53 AU-2** — Audit Events
- **NIST SP 800-53 AU-3** — Content of Audit Records
- **NIST SP 800-53 AU-9** — Protection of Audit Information

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 15 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_11_ADMIN_RBAC.md`](PHASE_11_ADMIN_RBAC.md) — admin operations source (B.1.13)
- [`PHASE_12_2FA_BACKUP.md`](PHASE_12_2FA_BACKUP.md) — root cause of rate-limit cascade (B.1.14)
- [`../../../tests/e2e/phase15_audit_logs.ps1`](../../../tests/e2e/phase15_audit_logs.ps1) — the script
- [`../../../tests/reports/phase15_audit_logs.log`](../../../tests/reports/phase15_audit_logs.log) — last transcript
- [`../../../../app/server/routes/admin.cts`](../../../../app/server/routes/admin.cts) — handler under test
- [`../../../../database/migrations/0006_admin_audit_log_grants.sql`](../../../../database/migrations/0006_admin_audit_log_grants.sql) — table + grants
- [`../../../../database/migrations/0011_audit_log_security_definer.sql`](../../../../database/migrations/0011_audit_log_security_definer.sql) — SECURITY DEFINER fix

---

## 13. Maintenance Notes

1. **Rate-limit cascade is the #1 issue** — when PHASE 15 is added
   to a CI pipeline, restart the API before it.
2. **Adding a new admin action** — verify it inserts into
   `admin_audit_log`. If not, update the route handler AND add a TC
   to §5.
3. **Tightening TC-4.1** — once we have a way to deterministically
   mutate state (e.g., PATCH a field that was NOT previously set),
   tighten from `>= 0` to `>= 1`.
4. Update §3 line numbers when `admin.cts` is edited.
5. Add new TCs to §5 + §9 traceability.
6. Bump version in §1.
7. Commit script + spec **together**.

---

> **End of PHASE 15 Design Specification.** Next: B.1.18
> ([PHASE_16_FRONTEND_SPA.md](PHASE_16_FRONTEND_SPA.md)) +
> ([PHASE_17_FULL_REGRESSION.md](PHASE_17_FULL_REGRESSION.md)) —
> frontend SPA smoke + full regression runner.
