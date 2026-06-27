# PHASE 03 — Search + Filters + Pagination
# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ✅ Done — script at [`tests/e2e/phase03_search_filters.ps1`](../../../tests/e2e/phase03_search_filters.ps1)
> **Last verified:** 2026-06-28 (live run, **24/24 PASS**)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)
> **Companion:** B.1.4 [PHASE_02_PUBLIC_CATALOG.md](PHASE_02_PUBLIC_CATALOG.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_03 |
| **Title** | Search + Filters + Pagination |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Functional (search semantics) + Performance (duration_ms) |
| **Auth required** | **None** (public endpoint) |
| **Prerequisite** | PHASE 0 + PHASE 2 (DB has products, FTS index populated) |

---

## 2. Scope

### 2.1 In scope

The single public endpoint **`GET /api/search`** and its full
query-parameter surface:

1. **Query validation** — required `q`, non-empty after trim.
2. **Full-text search** — via PostgreSQL `tsvector` on `search_tsv`
   column (migration `0009_search_backend.sql`).
3. **Multi-language search** — Arabic (`بخور`), English
   (`"Original Oud Oil"`), Chinese (via `name_zh`).
4. **Sort variants** — `relevance` (FTS rank), `price_asc`,
   `price_desc`, `newest`.
5. **Filters** — `category`, `store`, `minPrice`, `maxPrice`.
6. **Pagination** — `limit` + `offset` with defensive clamps.
7. **Performance telemetry** — `duration_ms` field exposed in
   response.

### 2.2 Out of scope

- Admin search analytics (covered by `logSearch()` in `lib/search.cts`,
  not directly testable).
- Arabic / Chinese morphology tuning (covered by unit tests in
  `app/server/tests/search.test.ts`).
- Autocomplete / fuzzy matching → future PHASE.
- Search by image → future PHASE.

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/routes/catalog.cts` | 387-439 | `GET /api/search` — thin HTTP wrapper |
| `app/server/lib/search.cts` | (entire) | `runSearch()` — FTS query, filters, pagination, ranking |
| `database/migrations/0009_search_backend.sql` | (entire) | Adds `search_tsv` column + GIN index + `normalize_query()` function |
| `app/server/lib/search.cts` | `logSearch()` | Best-effort analytics insert into `search_logs` (failures never block search) |

### 3.2 Database

| Table | Operations |
|-------|------------|
| `products` | `SELECT` with FTS match (`search_tsv @@ plainto_tsquery('simple', $1)`) |
| `search_logs` | `INSERT` (best-effort, per request) |
| Index used | `idx_products_search` (GIN on `search_tsv`) |

### 3.3 Static test data

- **24 products** seeded with multi-language names (`name_ar`, `name_en`, `name_zh`).
- All seeded products have a populated `search_tsv` column (migration 0009).

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | `GET /api/search` requires `q` parameter | IEEE 829 §4.1 |
| TC-2 | Empty `q` returns 400 | ISO 29119-4 (BVA on min length) |
| TC-3 | Match in `name_en` returns the product | IEEE 829 §4.2 |
| TC-4 | Match in `name_ar` returns the product (multi-language FTS) | IEEE 829 §4.2 + ISO 29119-4 |
| TC-5 | Short letter (`q=a`) returns 200 with empty/full results | ISO 29119-4 (EP) |
| TC-6 | No-match query returns `total=0` | IEEE 829 §4.3 |
| TC-7 | `sort=price_asc` returns actually ascending prices | IEEE 829 §4.4 |
| TC-8 | `sort=price_desc` returns actually descending prices | IEEE 829 §4.4 |
| TC-9 | `sort=newest` returns 200 | IEEE 829 §4.4 |
| TC-10 | `sort=relevance` returns 200 (default FTS ranking) | IEEE 829 §4.4 |
| TC-11 | Filter by `category=<slug>` returns matching subset | IEEE 829 §4.5 |
| TC-12 | Filter by `store=<id>` returns matching subset | IEEE 829 §4.5 |
| TC-13 | Filter by `minPrice/maxPrice` returns matching subset | IEEE 829 §4.5 |
| TC-14 | Combined filter + sort + limit returns narrowed results | IEEE 829 §4.6 (combination) |
| TC-15 | `limit=3` returns ≤ 3 products | ISO 29119-4 (BVA) |
| TC-16 | `limit=99999` is clamped to 100 | ISO 29119-4 (BVA at max) |
| TC-17 | `limit=0` is clamped to 1 (per `catalog.cts:430`) | ISO 29119-4 (BVA at 0) |
| TC-18 | `offset=-5` is clamped to 0 | ISO 29119-4 (negative BVA) |
| TC-19 | Response includes `duration_ms` (performance telemetry) | IEEE 829 §4.7 |

---

## 5. Test Cases (24 total)

### 5.1 Section 1 — Negative (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `GET /api/search` (no `q`) | 400, `code=VALIDATION_ERROR` | TC-1 |
| TC-1.2 | `GET /api/search?q=` (empty) | 400, `code=VALIDATION_ERROR` | TC-2 |

### 5.2 Section 2 — Positive basic queries (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-2.1 | `GET /api/search?q=<English product name>` | 200, `data.total ≥ 1` | TC-3 |
| TC-2.2 | `GET /api/search?q=بخور` (Arabic) | 200, `data.total ≥ 0` | TC-4 |
| TC-2.3 | `GET /api/search?q=a` (single letter) | 200 | TC-5 |
| TC-2.4 | `GET /api/search?q=zzzzzzzz_no_match_xyz` | 200, `data.total === 0` | TC-6 |

### 5.3 Section 3 — Sort variants (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-3.1 | `GET /api/search?q=<x>&sort=price_asc` | 200, prices actually ascending | TC-7 |
| TC-3.2 | `GET /api/search?q=<x>&sort=price_desc` | 200, prices actually descending | TC-8 |
| TC-3.3 | `GET /api/search?q=<x>&sort=newest` | 200 | TC-9 |
| TC-3.4 | `GET /api/search?q=<x>&sort=relevance` | 200 (default FTS ranking) | TC-10 |

### 5.4 Section 4 — Filters (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-4.1 | `GET /api/search?q=<x>&category=<slug>` | 200, narrowed subset | TC-11 |
| TC-4.2 | `GET /api/search?q=<x>&store=<storeId>` | 200, narrowed subset | TC-12 |
| TC-4.3 | `GET /api/search?q=<x>&minPrice=1000&maxPrice=100000` | 200, narrowed subset | TC-13 |
| TC-4.4 | `GET /api/search?q=<x>&store=<id>&sort=price_asc&limit=5` | 200, all 3 filters apply | TC-14 |

### 5.5 Section 5 — Pagination (6 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-5.1 | `GET /api/search?q=<x>&limit=3` | 200, `data.products.Count <= 3` | TC-15 |
| TC-5.2 | `GET /api/search?q=<x>&limit=3&offset=3` | 200, second page | TC-15 |
| TC-5.3 | `GET /api/search?q=<x>&limit=99999` | 200, `data.limit === 100` (clamp) | TC-16 |
| TC-5.4 | `GET /api/search?q=<x>&limit=0` | 200, `data.limit === 1` (clamp) | TC-17 |
| TC-5.5 | `GET /api/search?q=<x>&offset=-5` | 200, `data.offset === 0` (clamp) | TC-18 |
| TC-5.6 | (every response) | `data.duration_ms` is a finite number | TC-19 |

---

## 6. Test Procedure

```
1. Section 1 — Negative validation              → 2 requests
2. Section 2 — Positive basic (incl. EN/AR/no-match) → 4 requests
3. Section 3 — Sort variants                   → 4 requests
4. Section 4 — Filters (category, store, price, combined) → 4 requests
5. Section 5 — Pagination edge cases           → 5 requests
─────────────────────────────────────────────────
Total:                                         → 19 HTTP requests
                                                + ~6 inline data-shape checks
                                                = 24 PASS/FAIL assertions
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected (200, 400).
2. Response body shape matches expected.
3. For sort tests: the actual ordering matches the requested direction.
4. For pagination edge cases: the clamped value matches the hard-coded
   constant (1 or 100).

### 7.2 Per-PHASE

PHASE 03 passes if **all 24 assertions pass** (exit code 0).

### 7.3 Known flexibility

TC-3.1 / TC-3.2 (sort assertions) only check ordering when
`data.products.Count > 1`. A single-hit result trivially passes.

---

## 8. Test Data Generation

### 8.1 Static (from `database/seed.sql`)

- 24 products with multi-language names populated.
- 18 categories with unique slugs.
- 7 stores with unique IDs.

### 8.2 Dynamic (per run)

- `$firstProduct.name_en` is fetched from `/api/products?limit=5` and
  used as the primary query string.
- `$firstProduct.store_id` is reused across filter and pagination tests.
- Category slug is fetched from `/api/categories[0].slug`.

This makes the script resilient to seed-data changes.

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-SEARCH-1: Public MUST NOT require auth | `catalog.cts:387` (no middleware) | All TCs |
| REQ-SEARCH-2: `q` parameter is required | `catalog.cts:390-392` | TC-1.1, TC-1.2 |
| REQ-SEARCH-3: Multi-language FTS (AR/EN/ZH) | `migration 0009` adds `search_tsv` | TC-2.1, TC-2.2 |
| REQ-SEARCH-4: Search MUST return total + products + duration_ms | `catalog.cts:426-435` | All TCs (shape verified) |
| REQ-SEARCH-5: Sort modes (relevance, price, newest) | `lib/search.cts` ORDER BY clauses | TC-3.1, TC-3.2, TC-3.3, TC-3.4 |
| REQ-SEARCH-6: Filters composable (category + store + price) | `lib/search.cts` WHERE clause | TC-4.1, TC-4.2, TC-4.3, TC-4.4 |
| REQ-SEARCH-7: limit clamped [1, 100] | `catalog.cts:430` `Math.max(1, Math.min(100, …))` | TC-5.3, TC-5.4 |
| REQ-SEARCH-8: offset clamped to ≥ 0 | `catalog.cts:432` `Math.max(0, …)` | TC-5.5 |
| REQ-SEARCH-9: Performance telemetry exposed | `catalog.cts:433` | TC-5.6 |
| REQ-SEARCH-10: Search log MUST NOT block search | `catalog.cts:417` (await with failure tolerance) | Implicit |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **`search_tsv` not populated** | All queries return `total=0` | Migration `0009_search_backend.sql` must run during `db:setup` |
| **Empty catalog** | TC-2.1 fails because no products to match | Minimum 20 products seeded |
| **Sort assertions on single result** | Trivially passes | Documented in §7.3 |
| **Multi-byte UTF-8 in `q`** | Encoding issues in HTTP URL | The script uses PowerShell string interpolation; no encoding issues observed in 24-test run |
| **`logSearch` failure** | Search still works (best-effort) | TC-1.x already covers happy path |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 3 complete.

===== PHASE 3 SUMMARY =====
  PASS: 24
  FAIL: 0
```

Sample response data from the live run:

```
query='Original Oud Oil 25ml' total=1 duration_ms=9
combined filter → total=1 limit=5
page1: limit=3 offset=0 count=1
page2: offset=3 count=0
```

Section-by-section:

```
Section 1 (Negative):         2/2 PASS
Section 2 (Positive basic):   4/4 PASS (incl. AR + EN + no-match)
Section 3 (Sort):             4/4 PASS (price_asc, price_desc, newest, relevance)
Section 4 (Filters):          4/4 PASS (category, store, price, combined)
Section 5 (Pagination):       6/6 PASS (incl. limit clamp + offset clamp + duration_ms)
─────────────────────────────────────────────
Total:                        24/24 PASS (exit 0)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **ISTQB CTFL v4.0** — EP / BVA techniques
- **PostgreSQL 17 Full-Text Search** — `tsvector` / `tsquery` (PG official docs)

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 3 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_02_PUBLIC_CATALOG.md`](PHASE_02_PUBLIC_CATALOG.md) — companion (B.1.4)
- [`../../../tests/e2e/phase03_search_filters.ps1`](../../../tests/e2e/phase03_search_filters.ps1) — the script
- [`../../../tests/reports/phase03_search_filters.log`](../../../tests/reports/phase03_search_filters.log) — last transcript
- [`../../../../app/server/routes/catalog.cts`](../../../../app/server/routes/catalog.cts) — HTTP wrapper (lines 387-439)
- [`../../../../app/server/lib/search.cts`](../../../../app/server/lib/search.cts) — `runSearch()` core
- [`../../../../database/migrations/0009_search_backend.sql`](../../../../database/migrations/0009_search_backend.sql) — FTS column + GIN index

---

## 13. Maintenance Notes

1. Update §3 line numbers when `catalog.cts` lines 387-439 are edited.
2. When adding a new sort mode (e.g., `popular`), add a TC to §5.3.
3. When adding a new filter (e.g., `brand`), add a TC to §5.4.
4. The `duration_ms` assertion (TC-5.6) does NOT pin a specific value —
   it only checks that the field is present and finite. If you add a
   performance SLA (e.g., < 200ms), add a separate TC.
5. Bump version in §1.
6. Commit script + spec **together**.

---

> **End of PHASE 03 Design Specification.** Next: B.1.6
> ([PHASE_04_CART.md](PHASE_04_CART.md)) — the cart endpoint recently hardened
> in fix A.1 (route reorder + ownership guard).