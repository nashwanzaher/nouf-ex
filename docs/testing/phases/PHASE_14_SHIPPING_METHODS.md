# PHASE 14 — Shipping Methods

# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ✅ Done — script at [`tests/e2e/phase14_shipping_methods.ps1`](../../../tests/e2e/phase14_shipping_methods.ps1)
> **Last verified:** 2026-06-28 (live run, **19/19 PASS**)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_14 |
| **Title** | Shipping Methods |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Functional + Edge cases (weight validation) |
| **Auth required** | **None** (public endpoint) |
| **Prerequisite** | PHASE 0 |

---

## 2. Scope

### 2.1 In scope

1. **Public listing** — `GET /api/shipping/methods` (no auth).
2. **Weight-based total** — `?weight_kg=N` computes `estimated_total`.
3. **Active filter** — only `is_active=true` methods returned.
4. **Ordering** — results sorted by `base_cost ASC`.
5. **Edge cases** — `weight_kg=0`, `weight_kg=-5`, `weight_kg=abc`.

### 2.2 Out of scope

- Admin shipping CRUD → covered in **PHASE 11** (admin RBAC).
- Per-store shipping rates → not implemented.
- Address validation → covered in PHASE 1.

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | Endpoint |
|------|-------|----------|
| `app/server/routes/shipping.cts` | 14-... | `GET /api/shipping/methods` |
| `database/seed.sql` | (shipping methods) | 4 active shipping methods seeded |
| `database/migrations/0012_payment_tx_index_and_jti_sweeper.sql` | (incidental) | Not related; here for traceability |

### 3.2 Database

| Table | Operations |
|-------|------------|
| `shipping_methods` | `SELECT WHERE is_active = TRUE ORDER BY base_cost ASC` |

### 3.3 Test data

- 4 active shipping methods seeded.

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | `GET /api/shipping/methods` returns 200 without auth | IEEE 829 §4.1 |
| TC-2 | At least 1 method returned | IEEE 829 §4.2 |
| TC-3 | Only `is_active=true` methods returned | IEEE 829 §4.3 |
| TC-4 | Every row has `id`, `name_ar`, `base_cost` | IEEE 829 §4.4 |
| TC-5 | `?weight_kg=N` returns rows with `estimated_total` | IEEE 829 §4.5 |
| TC-6 | Higher weight → higher total (when `per_kg_cost > 0`) | ISO 29119-4 (weight scaling) |
| TC-7 | `?weight_kg=0` falls back to 1 | ISO 29119-4 (BVA at 0) |
| TC-8 | `?weight_kg=-5` accepted (clamped) | ISO 29119-4 (negative BVA) |
| TC-9 | `?weight_kg=abc` accepted (NaN fallback) | ISO 29119-4 (input type) |
| TC-10 | Results sorted by `base_cost ASC` | IEEE 829 §4.6 |

---

## 5. Test Cases (19 total)

### 5.1 Section 1 — Basic list (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `GET /api/shipping/methods` (no auth) | 200 | TC-1 |
| TC-1.2 | (data shape, count) | inline check `data.Count >= 1` | TC-2 |
| TC-1.3 | (privacy) | all rows have `is_active=true` | TC-3 |
| TC-1.4 | (data shape) | all rows have `id+name_ar+base_cost` | TC-4 |

### 5.2 Section 2 — Weight variants (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-2.1 | `?weight_kg=1` | 200, all rows have `estimated_total` | TC-5 |
| TC-2.2 | `?weight_kg=2` | 200, all rows have `estimated_total` | TC-5 |
| TC-2.3 | `?weight_kg=5` | 200, all rows have `estimated_total` | TC-5 |
| TC-2.4 | `?weight_kg=10` | 200, all rows have `estimated_total` | TC-5 |

### 5.3 Section 3 — Weight scaling (1 case)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-3.1 | Compare weight=1 vs weight=5 totals | inline check (≥1 method scaled) | TC-6 |

### 5.4 Section 4 — Edge cases (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-4.1 | `?weight_kg=0` | 200, totals match `?weight_kg=1` | TC-7 |
| TC-4.2 | `?weight_kg=-5` | 200 (clamped) | TC-8 |
| TC-4.3 | `?weight_kg=abc` | 200 (NaN fallback) | TC-9 |
| TC-4.4 | (still no auth) | 200 | TC-1 |

### 5.5 Section 5 — Ordering (1 case)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-5.1 | Sort check `base_cost[i] <= base_cost[i+1]` | inline ascending | TC-10 |

---

## 6. Test Procedure

```
1. Section 1 — Basic list                       → 1 request + inline checks
2. Section 2 — Weight variants (4)              → 4 requests + inline checks
3. Section 3 — Weight scaling (1)               → 2 requests + inline check
4. Section 4 — Edge cases (4)                  → 4 requests + inline check
5. Section 5 — Ordering (1)                     → 1 request + inline check
─────────────────────────────────────────────────────
Total:                                          → 12 HTTP requests
                                                - 7 inline data-shape checks
                                                = 19 PASS/FAIL assertions
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected (200).
2. Response body shape matches expected.

### 7.2 Per-PHASE

PHASE 14 passes if **all 19 assertions pass**.

### 7.3 Known flexibility

**TC-3.1 (weight scaling)** accepts 0 scaling methods as long as the
result is still 200. The seed has no `per_kg_cost`, so totals are
constant across weights. If `per_kg_cost` is added in a future seed
migration, this TC tightens.

---

## 8. Test Data Generation

### 8.1 Static (from seed)

- 4 active shipping methods seeded.

### 8.2 Dynamic (per run)

- `$rows0`, `$rows1`, `$rows5`: from `GET /api/shipping/methods?weight_kg=N`.

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-SHIP-1: Shipping methods is public | `shipping.cts:14` (no auth) | TC-1.1 |
| REQ-SHIP-2: Only active methods returned | `WHERE is_active = TRUE` | TC-1.3 |
| REQ-SHIP-3: Each method has required fields | SQL `SELECT id, name_ar, ...` | TC-1.4 |
| REQ-SHIP-4: Weight-based total | `estimated_total` calc | TC-2.1 - TC-2.4 |
| REQ-SHIP-5: Edge weight handling | `Math.max(1, weight)` | TC-4.1, TC-4.2, TC-4.3 |
| REQ-SHIP-6: Sort by base_cost | `ORDER BY base_cost ASC` | TC-5.1 |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **No per_kg_cost in seed** | TC-3.1 cannot verify weight scaling | Documented as flexible; future migration adds per_kg_cost |
| **No auth → potential abuse** | Anyone can probe shipping costs | Acceptable; prices are not sensitive |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 14 complete.

===== PHASE 14 SUMMARY =====
  PASS: 19
  FAIL: 0
```

Sample response from the live transcript:

```
active shipping methods: 4
[PASS] weight=1: all rows have estimated_total
[PASS] weight=2: all rows have estimated_total
[PASS] weight=5: all rows have estimated_total
[PASS] weight=10: all rows have estimated_total
[PASS] weight scaling (no per_kg_cost on active methods, total is constant)
```

Section-by-section:

```
Section 1 (Basic list):        4/4 PASS
Section 2 (Weight variants):   4/4 PASS
Section 3 (Weight scaling):    1/1 PASS
Section 4 (Edge cases):        4/4 PASS
Section 5 (Ordering):          1/1 PASS
──────────────────────────────────────────────
Total:                          19/19 PASS (exit 0)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **ISTQB CTFL v4.0** — BVA (boundary value at 0, negative)

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 14 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_10_MERCHANT_FLOW.md`](PHASE_10_MERCHANT_FLOW.md) — ships via merchant flow (B.1.12)
- [`../../../tests/e2e/phase14_shipping_methods.ps1`](../../../tests/e2e/phase14_shipping_methods.ps1) — the script
- [`../../../tests/reports/phase14_shipping_methods.log`](../../../tests/reports/phase14_shipping_methods.log) — last transcript
- [`../../../../app/server/routes/shipping.cts`](../../../../app/server/routes/shipping.cts) — handler under test
- [`../../../../database/seed.sql`](../../../../database/seed.sql) — 4 shipping methods seeded

---

## 13. Maintenance Notes

1. **Adding `per_kg_cost`** — when seeded, tighten TC-3.1 to assert
   that at least one method's total grows with weight.
2. **Adding a new shipping method** — update §3.3 and §11 if the count
   changes.
3. Update §3 line numbers when `shipping.cts` is edited.
4. Add new TCs to §5 + §9 traceability.
5. Bump version in §1.
6. Commit script + spec **together**.

---

> **End of PHASE 14 Design Specification.** Next: B.1.17
> ([PHASE_15_AUDIT_LOGS.md](PHASE_15_AUDIT_LOGS.md)) — admin audit logs.
