# PHASE 10 — Merchant / Seller Flow
# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ⚠️ Partial — script at [`tests/e2e/phase10_merchant_flow.ps1`](../../../tests/e2e/phase10_merchant_flow.ps1)
> **Last verified:** 2026-06-28 (live run, **8 PASS / 0 FAIL / 12 SKIP**)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_10 |
| **Title** | Merchant / Seller Flow |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) + Gap analysis |
| **Test type** | Functional + Gap inventory |
| **Auth required** | Mixed (public read + merchant Bearer) |
| **Prerequisite** | PHASE 0; merchant seed user `fatima@spice-yemen.com / merchant123` |

---

## 2. Scope

### 2.1 In scope (what works)

1. **Public read endpoints** merchants rely on (products, stores, reviews,
   categories, shipping methods).
2. **Order visibility** — `GET /api/orders` for the merchant's own orders.
3. **Merchant as buyer** — the merchant can still buy from other stores.

### 2.2 Gap inventory (what does NOT work)

**12 documented missing endpoints** — see §5.3. These are tracked as
roadmap items in `MASTER_PLAN.md` (Phase C — Functional P1) and
`roadmap.md` (P1-17 + P1-18).

### 2.3 Out of scope

- Admin product/storestuff (covered in PHASE 11).
- Seller dashboard UI (covered in `src/pages/seller/`, no E2E coverage
  here).

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/routes/catalog.cts` | (public) | Products, stores, reviews, categories, search — all public |
| `app/server/routes/orders.cts` | (filtered by user_id) | Order visibility per role |
| `app/server/routes/shipping.cts` | (public) | `GET /api/shipping/methods` |
| `app/server/routes/seller/*` | **DOES NOT EXIST** | All 12 missing endpoints |

### 3.2 Database

| Table | Operations |
|-------|------------|
| `products` | (read-only via public endpoints) |
| `stores` | (read-only via public endpoints) |
| `orders` | `SELECT WHERE user_id = req.user.id` (merchant sees own orders only) |
| `seller_*` | **DO NOT EXIST** |

### 3.3 Test data

- Merchant: `fatima@spice-yemen.com / merchant123` (id=5, store=1)
- 24 products across 7 stores

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | Public read endpoints return 200 | IEEE 829 §4.1 |
| TC-2 | Merchant can read own orders | IEEE 829 §4.2 |
| TC-3 | Merchant can place orders at other stores | IEEE 829 §4.3 |
| TC-4 | Missing seller endpoints return 404 (documented gap) | IEEE 829 §4.4 (gap inventory) |

---

## 5. Test Cases (8 PASS + 12 SKIP = 20 total)

### 5.1 Section 1 — Public read endpoints (6 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `GET /api/products` | 200 | TC-1 |
| TC-1.2 | `GET /api/products?store=1` | 200 | TC-1 |
| TC-1.3 | `GET /api/stores/1` | 200 | TC-1 |
| TC-1.4 | `GET /api/stores/1/reviews` | 200 | TC-1 |
| TC-1.5 | `GET /api/categories` | 200 | TC-1 |
| TC-1.6 | `GET /api/shipping/methods?weight_kg=1` | 200 | TC-1 |

### 5.2 Section 2 — Merchant-authenticated (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-2.1 | `GET /api/orders` (as merchant fatima) | 200 | TC-2 |
| TC-2.2 | `POST /api/orders` (as merchant fatima, buying from another store) | 200 | TC-3 |

### 5.3 Section 3 — Missing merchant endpoints (12 SKIP — gap inventory)

| ID | Endpoint | Status | Roadmap ref |
|----|----------|--------|-------------|
| SKIP-3.1 | `POST /api/seller/products` (create product) | NOT IMPLEMENTED | roadmap P1-17 |
| SKIP-3.2 | `PATCH /api/seller/products/:id` (edit product) | NOT IMPLEMENTED | roadmap P1-17 |
| SKIP-3.3 | `DELETE /api/seller/products/:id` (delete product) | NOT IMPLEMENTED | roadmap P1-17 |
| SKIP-3.4 | `POST /api/seller/stores` (create store) | NOT IMPLEMENTED | roadmap P1-18 |
| SKIP-3.5 | `PATCH /api/seller/stores/:id` (edit store) | NOT IMPLEMENTED | roadmap P1-18 |
| SKIP-3.6 | `GET /api/seller/orders` (orders for my store) | NOT IMPLEMENTED | roadmap P1-17 |
| SKIP-3.7 | `POST /api/seller/orders/:id/status` (update status) | NOT IMPLEMENTED | roadmap P1-17 |
| SKIP-3.8 | `GET /api/seller/analytics` | NOT IMPLEMENTED | roadmap P1-18 |
| SKIP-3.9 | `GET /api/seller/inventory` | NOT IMPLEMENTED | roadmap P1-18 |
| SKIP-3.10 | `GET /api/seller/payouts` | NOT IMPLEMENTED | roadmap P1-18 |
| SKIP-3.11 | `POST /api/seller/products/:id/images` | NOT IMPLEMENTED | roadmap P1-17 |
| SKIP-3.12 | `GET /api/seller/dashboard` | NOT IMPLEMENTED | roadmap P1-18 |

### 5.4 Section 4 — Workaround via admin (informational, no assertion)

Merchants must be **promoted to admin role** to manage products/stores.
This is documented in `roadmap.md` and `MASTER_PLAN.md` Phase C.

---

## 6. Test Procedure

```
1. Section 1 — Public read (6 endpoints)              → 6 requests
2. Section 2 — Merchant-authenticated                 → 2 requests
3. Section 3 — Missing endpoints (gap inventory)       → 0 requests (informational)
4. Section 4 — Workaround documentation                → 0 requests (informational)
─────────────────────────────────────────────────────
Total:                                              → 8 HTTP requests
                                                    + 12 SKIP (documented gaps)
                                                    = 20 total assertions
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected (200).
2. Response body shape matches expected.

### 7.2 Per-PHASE

PHASE 10 passes if **all 8 PASS assertions pass and 0 FAIL**.
The 12 SKIPs are documented gaps — they are NOT failures, they are
features waiting to be implemented.

### 7.3 Gap inventory contract

When any of the 12 SKIP endpoints is implemented, the script must be
updated to:
1. Remove the SKIP entry.
2. Add proper TCs (auth, ownership, validation).
3. Move the entry from "gap inventory" to "covered scope".

---

## 8. Test Data Generation

### 8.1 Static (from PHASE 0 + seed)

- Merchant: `fatima@spice-yemen.com / merchant123` (id=5, store=1).
- 24 products across 7 stores.

### 8.2 Dynamic (per run)

- `$p`: first product (used for the regression "merchant as buyer" test).

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-SELLER-1: Public read endpoints work | catalog.cts, shipping.cts | TC-1.1 to TC-1.6 |
| REQ-SELLER-2: Merchant can see own orders | orders.cts (`WHERE user_id = req.user.id`) | TC-2.1 |
| REQ-SELLER-3: Merchant can buy from others | orders.cts (no store-scoping) | TC-2.2 |
| REQ-SELLER-CMS-1..12: Merchant self-service endpoints | **NOT IMPLEMENTED** | SKIP-3.1 to SKIP-3.12 |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **12 endpoints missing** | Merchants cannot self-manage | Documented in roadmap P1-17 + P1-18; promote-to-admin workaround |
| **Promote-to-admin security risk** | A merchant becomes a full admin | Role promotion must be auditable (PHASE 15 covers audit logs) |
| **Public shipping methods** | Leaks pricing info | Acceptable; documented as public by design |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 10 complete.

===== PHASE 10 SUMMARY =====
  PASS: 8
  FAIL: 0
  SKIP: 12 (documented missing endpoints)
```

Section-by-section:

```
Section 1 (Public read):        6/6 PASS
Section 2 (Merchant auth):      2/2 PASS (incl. "merchant as buyer" regression)
Section 3 (Gap inventory):     12 SKIP (NOT FAIL — these are roadmap items)
─────────────────────────────────────────────────────
Total:                          8 PASS, 0 FAIL, 12 SKIP (exit 0)
```

Notable findings from the live transcript:

```
[PASS] merchant GET /api/orders → 200
[PASS] merchant can place order at another store → 200
[SKIP] non-existent: POST /api/seller/products (create product) (known gap)
[SKIP] non-existent: POST /api/seller/orders/:id/status (update order status)
... (10 more SKIPs)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation (incl. gap inventory)

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 10 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_11_ADMIN_RBAC.md`](PHASE_11_ADMIN_RBAC.md) — companion (B.1.13)
- [`../../../tests/e2e/phase10_merchant_flow.ps1`](../../../tests/e2e/phase10_merchant_flow.ps1) — the script
- [`../../../tests/reports/phase10_merchant_flow.log`](../../../tests/reports/phase10_merchant_flow.log) — last transcript
- [`../../../../docs/planning/roadmap.md`](../../../../docs/planning/roadmap.md) — P1-17, P1-18 backlog items
- [`../../../../docs/MASTER_PLAN.md`](../../../../docs/MASTER_PLAN.md) — Phase C functional items

---

## 13. Maintenance Notes

1. **When a SKIP-3.x endpoint is implemented**, remove it from this
   spec and replace with proper TCs.
2. **When the workaround (promote to admin) is deprecated**, update
   §5.4.
3. **When `src/pages/seller/` adds E2E coverage**, link it from §12.
4. Update §3 line numbers when `catalog.cts` is edited.
5. Bump version in §1.
6. Commit script + spec **together**.

---

> **End of PHASE 10 Design Specification.** This PHASE is intentionally
> a partial-coverage spec — it documents what works (8 PASS) and what
> does NOT (12 SKIP) so future implementers can convert SKIPs to
> TCs.
>
> Next: B.1.13 ([PHASE_11_ADMIN_RBAC.md](PHASE_11_ADMIN_RBAC.md)) —
> admin role-based access control.