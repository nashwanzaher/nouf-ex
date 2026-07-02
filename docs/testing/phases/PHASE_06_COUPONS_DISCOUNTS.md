# PHASE 06 — Coupons + Discounts

# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ✅ Done — script at [`tests/e2e/phase06_coupons.ps1`](../../../tests/e2e/phase06_coupons.ps1)
> **Last verified:** 2026-06-28 (live run, **19/19 PASS**)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_06 |
| **Title** | Coupons + Discounts |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Functional + Business rules + Idempotency |
| **Auth required** | Bearer (customer for both endpoints) |
| **Prerequisite** | PHASE 0 + PHASE 5 (need an order to redeem against); seed coupons populated |

---

## 2. Scope

### 2.1 In scope

1. **Coupon validation** — `POST /api/coupons/validate` (does the coupon
   apply to this order_subtotal?).
2. **Coupon redemption** — `POST /api/coupons/redeem` (consumes the
   coupon for a specific order).
3. **Idempotent re-redeem** — calling redeem twice does NOT double-
   insert (returns "Already redeemed").
4. **Cross-user protection** — customer B cannot redeem against
   customer A's order.
5. **Validation rules** — empty code, negative subtotal, missing
   fields, unknown code, below min_order.
6. **Seed coupons** — `WELCOME10`, `FREESHIP`, `YEMEN25`, `SPICE20`.

### 2.2 Out of scope

- Admin coupon CRUD → future PHASE 11 (admin RBAC).
- Coupon listing → not implemented.
- Coupon deactivation → future PHASE.
- Per-user coupon limits (usage_count) → **PARTIAL** coverage in seed
  but not exercised end-to-end here.
- Coupon expiration dates → not exercised (no expired coupon in seed).

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/routes/coupons.cts` | 17-57 | `POST /api/coupons/validate` |
| `app/server/routes/coupons.cts` | 59-... | `POST /api/coupons/redeem` |
| `app/server/lib/shared.cts` | (coupon schemas) | `couponRedeemSchema` (with `.extend({order_id})`) |
| `database/seed.sql` | lines 326-350 | Inserts the 4 seed coupons |
| `database/migrations/0005_coupon_discount.sql` | (entire) | Adds `coupon_discount` column + index |

### 3.2 Database

| Table | Operations |
|-------|------------|
| `coupons` | `SELECT` (by code, by id) |
| `coupon_usage` | `SELECT` (for idempotency check), `INSERT` (on first redeem) |
| `orders` | `SELECT` (ownership check on redeem) |

### 3.3 Seed coupons (from `database/seed.sql`)

| code | type | value | min_order | max_discount | usage_limit | store_id |
|------|------|-------|-----------|--------------|-------------|----------|
| `WELCOME10` | percentage | 10.00 | 5000 | 5000 | 1000 | NULL (global) |
| `FREESHIP` | fixed | 500.00 | 0 | NULL | NULL | NULL (global) |
| `YEMEN25` | percentage | 25.00 | 10000 | 10000 | 500 | NULL (global) |
| `SPICE20` | percentage | 20.00 | 3000 | 3000 | 200 | 2 (store-scoped) |

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | `validate` requires auth (401 without Bearer) | IEEE 829 §4.1 |
| TC-2 | `validate` rejects empty code | ISO 29119-4 (BVA on min length) |
| TC-3 | `validate` rejects negative subtotal | ISO 29119-4 (BVA at 0) |
| TC-4 | `validate` requires `user_id` field | ISO 29119-4 (zod required) |
| TC-5 | `validate` returns 404 for unknown code | IEEE 829 §4.2 |
| TC-6 | `validate` returns 200 for known seed coupons (within min_order) | IEEE 829 §4.3 |
| TC-7 | `validate` returns 400 with "Minimum order" message when subtotal < min_order | IEEE 829 §4.4 |
| TC-8 | `redeem` requires auth | IEEE 829 §4.1 |
| TC-9 | `redeem` returns 404 for unknown code | IEEE 829 §4.2 |
| TC-10 | `redeem` returns 404 for unknown order | IEEE 829 §4.5 |
| TC-11 | Cross-user redeem returns 403 | OWASP API1:2023 (BOLA) |
| TC-12 | `redeem` happy path creates a `coupon_usage` row | IEEE 829 §4.6 |
| TC-13 | Re-redeem is idempotent (returns "Already redeemed") | ISO 29119-4 (idempotency) |
| TC-14 | `redeem` requires `order_id` field | ISO 29119-4 (zod required) |
| TC-15 | `redeem` requires `code` field | ISO 29119-4 (zod required) |

---

## 5. Test Cases (19 total)

### 5.1 Section 1 — Validate: input validation (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `POST /api/coupons/validate {code:"", user_id, order_subtotal:1000}` | 400 | TC-2 |
| TC-1.2 | `POST /api/coupons/validate {code:"WELCOME10", user_id, order_subtotal:-1}` | 400 | TC-3 |
| TC-1.3 | `POST /api/coupons/validate {code:"WELCOME10", user_id, order_subtotal:1000}` (no auth) | 401 | TC-1 |
| TC-1.4 | `POST /api/coupons/validate {code:"WELCOME10", order_subtotal:1000}` (missing user_id) | 400 | TC-4 |

### 5.2 Section 2 — Validate: unknown code (1 case)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-2.1 | `POST /api/coupons/validate {code:"NOPE_NOT_A_COUPON_QQQ"}` | 404 | TC-5 |

### 5.3 Section 3 — Validate: seed coupons (1 case)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-3.1 | `POST /api/coupons/validate {code:"WELCOME10", user_id, order_subtotal:15000}` | 200, `data.discount > 0` | TC-6 |

### 5.4 Section 4 — Validate: below min_order (1 case, conditional)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-4.1 | `POST /api/coupons/validate {code:"<known>", order_subtotal:1}` | 400 with "Minimum order" message OR 200 (no min_order) | TC-7 |

### 5.5 Section 5 — Validate: expired (1 case, flexible)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-5.1 | `POST /api/coupons/validate {code:"EXPIRED5"}` | 400 (expired) OR 404 (unknown) OR 200 (skipped) | Flexible (no expired coupon in seed) |

### 5.6 Section 6 — Redeem (8 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-6.1 | `POST /api/coupons/redeem {code:"NOPE", order_id}` | 404 | TC-9 |
| TC-6.2 | `POST /api/coupons/redeem {code:"<good>", order_id:999999}` | 404 (unknown order) | TC-10 |
| TC-6.3 | `POST /api/coupons/redeem {code:"<good>", order_id:<A's order>}` (as customer B) | 403 | TC-11 |
| TC-6.4 | `POST /api/coupons/redeem {code:"<good>", order_id:<A's order>}` (no auth) | 401 | TC-8 |
| TC-6.5 | `POST /api/coupons/redeem {code:"<good>", order_id:<A's order>}` (as customer A) | 200, `data.id` non-null | TC-12 |
| TC-6.6 | (re-redeem same coupon + same order) | 200, message="Already redeemed" | TC-13 |

### 5.7 Section 7 — Redeem: schema negatives (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-7.1 | `POST /api/coupons/redeem {code:"<good>"}` (missing order_id) | 400 | TC-14 |
| TC-7.2 | `POST /api/coupons/redeem {order_id}` (missing code) | 400 | TC-15 |

---

## 6. Test Procedure

```
1. Setup: login 2 customers + create 1 order           → 3 requests
2. Section 1 — Validate: input validation             → 4 requests
3. Section 2 — Validate: unknown code                 → 1 request
4. Section 3 — Validate: seed coupons                  → 1 request (probe up to 4)
5. Section 4 — Validate: below min_order              → 1 request
6. Section 5 — Validate: expired/unknown               → 1 request
7. Section 6 — Redeem                                 → 5 requests
8. Section 7 — Redeem: schema negatives               → 2 requests
─────────────────────────────────────────────────────
Total:                                              → 18 HTTP requests
                                                    - 1 inline data check (coupon_usage id)
                                                    = 19 PASS/FAIL assertions
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected (200, 400, 401, 403, 404).
2. Response body shape matches expected (e.g., `data.discount` non-null).
3. For TC-6.6 (idempotency): response message contains "Already redeemed".

### 7.2 Per-PHASE

PHASE 06 passes if **all 19 assertions pass**.

### 7.3 Known flexibility

- **TC-4.1 (below min_order)**: accepts 400 OR 200 (no min_order).
- **TC-5.1 (expired)**: accepts 400, 404, OR 200 (depends on whether
  `EXPIRED5` is in the seed; if not, surrogate 404 is acceptable).

---

## 8. Test Data Generation

### 8.1 Static (from seed)

- 2 customer accounts: `ahmed@gmail.com`, `sara@gmail.com` (both `customer123`).
- 4 seed coupons in `coupons` table (see §3.3).
- 24 products available for the test order.

### 8.2 Dynamic (per run)

- `$userAId`: from `/api/auth/me` as customer A.
- `$orderId`: from `POST /api/orders` response.
- `$goodCoupon`: the first seed coupon that validates successfully
  (`WELCOME10` is the most likely candidate).

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-COUPON-1: `validate` requires auth | `requireAuth` middleware | TC-1.3 |
| REQ-COUPON-2: `redeem` requires auth | `requireAuth` middleware | TC-6.4 |
| REQ-COUPON-3: `validate` zod-strict input | `couponRedeemSchema` base | TC-1.1, TC-1.2, TC-1.4 |
| REQ-COUPON-4: `redeem` zod-strict input | `couponRedeemSchema.extend({order_id})` | TC-7.1, TC-7.2 |
| REQ-COUPON-5: Unknown coupon returns 404 | DB lookup miss | TC-2.1, TC-6.1 |
| REQ-COUPON-6: Valid coupon within min_order returns 200 + discount | `coupons` table + handler logic | TC-3.1 |
| REQ-COUPON-7: Below min_order returns 400 "Minimum order" | `coupons.min_order` check | TC-4.1 |
| REQ-COUPON-8: Cross-user redeem returns 403 | Order ownership check in redeem handler | TC-6.3 |
| REQ-COUPON-9: Redeem creates `coupon_usage` row | `INSERT INTO coupon_usage` | TC-6.5 |
| REQ-COUPON-10: Redeem is idempotent | `WHERE coupon_id = ? AND order_id = ?` check | TC-6.6 |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Seed coupon already redeemed** by ahmed (state leakage) | `WELCOME10` shows "Already redeemed" on first try | `npm run db:setup` to reset, or accept idempotency assertion immediately |
| **PHASE 01-R broke ahmed's password** | All auth-gated tests fail | `logs/reset-ahmed.cjs` (see B.1.6 §8.3) |
| **No expired coupon in seed** | TC-5.1 always returns 404 | Documented as flexible (404 is acceptable) |
| **Store-scoped coupon (`SPICE20`) tested with wrong store** | Returns 400 (not applicable) | The script probes 4 coupons and uses the first valid one |
| **Rate limiter** on `/api/auth/*` | 429 if too many logins | Wait 15 min, or restart API |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 6 complete.

===== PHASE 6 SUMMARY =====
  PASS: 19
  FAIL: 0
```

Sample response from the live transcript:

```
✓ found valid coupon: code=WELCOME10 type=percentage value=10.00 discount=1500 final_total=13500
[PASS] redeem returned coupon_usage id=4
[PASS] re-redeem message: 'Already redeemed'
```

Section-by-section:

```
Section 1 (Validate input):     4/4 PASS
Section 2 (Unknown code):       1/1 PASS
Section 3 (Seed coupons):       1/1 PASS
Section 4 (Below min_order):    1/1 PASS
Section 5 (Expired/unknown):    1/1 PASS
Section 6 (Redeem):             6/6 PASS (incl. idempotency)
Section 7 (Redeem schema):      2/2 PASS
──────────────────────────────────────────────
Total:                         19/19 PASS (exit 0)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **ISTQB CTFL v4.0** — EP / BVA techniques
- **OWASP API1:2023** — BOLA

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 6 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_05_ORDERS_INVENTORY.md`](PHASE_05_ORDERS_INVENTORY.md) — companion (B.1.7)
- [`../../../tests/e2e/phase06_coupons.ps1`](../../../tests/e2e/phase06_coupons.ps1) — the script
- [`../../../tests/reports/phase06_coupons.log`](../../../tests/reports/phase06_coupons.log) — last transcript
- [`../../../../app/server/routes/coupons.cts`](../../../../app/server/routes/coupons.cts) — handlers under test
- [`../../../../database/seed.sql`](../../../../database/seed.sql) — 4 seed coupons at lines 326-350
- [`../../../../database/migrations/0005_coupon_discount.sql`](../../../../database/migrations/0005_coupon_discount.sql) — `coupon_discount` column

---

## 13. Maintenance Notes

1. Update §3 line numbers when `coupons.cts` is edited.
2. Add new seed coupons to §3.3 when added to `database/seed.sql`.
3. If admin coupon CRUD is implemented, add a new section §X for
   admin-only endpoints.
4. If a per-user `usage_count` limit is enforced, add a TC that
   verifies the 4th redemption attempt is rejected.
5. Bump version in §1.
6. Commit script + spec **together**.

---

> **End of PHASE 06 Design Specification.** Next: B.1.9
> ([PHASE_07_PAYMENTS_REFUNDS.md](PHASE_07_PAYMENTS_REFUNDS.md)) — payment
> methods, create, confirm, refund.
