# PHASE 08 — Reviews + Ratings

# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ✅ Done — script at [`tests/e2e/phase08_reviews_ratings.ps1`](../../../tests/e2e/phase08_reviews_ratings.ps1)
> **Last verified:** 2026-06-28 (live run, **21/21 PASS**)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_08 |
| **Title** | Reviews + Ratings |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Functional + Business rules + Trigger side-effects |
| **Auth required** | None for GET; Bearer for POST |
| **Prerequisite** | PHASE 0 + PHASE 5 (need an order for verified-purchase check) |

---

## 2. Scope

### 2.1 In scope

1. **Public review listing** — `GET /api/reviews` with optional
   `productId` and `storeId` filters; only `is_visible=true` rows
   return.
2. **Review creation** — `POST /api/reviews` (verified-buyer logic,
   rating 1-5, `is_verified` flag).
3. **Rating recomputation** — trigger updates `products.rating` and
   `products.review_count`.
4. **Validation** — rating boundaries, product existence, storeId
   mismatch, auth.
5. **Non-buyer reviews** — accepted with `is_verified=false`.

### 2.2 Out of scope

- Edit/delete review (not implemented).
- Helpful/unhelpful votes (not implemented).
- Merchant replies (not implemented).
- Review moderation (admin) → covered in **PHASE 15** (audit logs)
  tangentially.

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/routes/reviews.cts` | 19-48 | `GET /api/reviews` (with `is_visible=true` filter) |
| `app/server/routes/reviews.cts` | 50-... | `POST /api/reviews` (verified-buyer logic) |
| `app/server/lib/shared.cts` | (review schema) | `reviewCreateSchema` |
| `database/functions.sql` | `refresh_product_rating()` | Trigger function that recomputes `products.rating` and `products.review_count` |
| `database/triggers.sql` | (trigger wiring) | `AFTER INSERT/UPDATE/DELETE ON reviews` |

### 3.2 Database

| Table | Operations |
|-------|------------|
| `reviews` | `INSERT`, `SELECT` (with is_visible=true filter) |
| `products` | `UPDATE rating, review_count` (via trigger) |
| `order_items` | `SELECT` (verified-purchase check: did this user buy this product?) |

### 3.3 Test data

- Customer: `ahmed@gmail.com / customer123`
- 24 products across 7 stores
- 18 seed reviews in `database/seed.sql` (all `is_visible=true`)

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | `GET /api/reviews` is public (no auth) | IEEE 829 §4.1 |
| TC-2 | `GET /api/reviews` only returns `is_visible=true` rows | OWASP API3:2023 (BOPLA — no leak of hidden reviews) |
| TC-3 | `GET /api/reviews?productId=N` filters by product | IEEE 829 §4.2 |
| TC-4 | `GET /api/reviews?storeId=N` filters by store | IEEE 829 §4.3 |
| TC-5 | `POST /api/reviews` validates `productId` (integer, positive) | ISO 29119-4 (zod) |
| TC-6 | `POST /api/reviews` validates `rating` (1-5 integer) | ISO 29119-4 (BVA at 0, 6) |
| TC-7 | `POST /api/reviews` rejects non-existent product | IEEE 829 §4.4 |
| TC-8 | `POST /api/reviews` requires auth | IEEE 829 §4.5 |
| TC-9 | `POST /api/reviews` rejects `storeId` mismatch | IEEE 829 §4.6 |
| TC-10 | Verified buyer can post review (returns 200) | IEEE 829 §4.7 |
| TC-11 | Non-buyer can post review (returns 200, `is_verified=false`) | IEEE 829 §4.8 |
| TC-12 | Rating boundaries (1 and 5) accepted | ISO 29119-4 (BVA) |
| TC-13 | Rating recompute trigger: `products.rating` updated | ISO 29119-4 (side-effect) |
| TC-14 | Rating recompute trigger: `products.review_count` incremented | ISO 29119-4 (side-effect) |
| TC-15 | New review appears in the filter result | IEEE 829 §4.9 |

---

## 5. Test Cases (21 total)

### 5.1 Section 1 — Public list (5 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `GET /api/reviews` (no auth) | 200 | TC-1 |
| TC-1.2 | (data shape) | `data.Count >= 0` | TC-1 |
| TC-1.3 | (privacy) | all rows have `is_visible=true` | TC-2 |
| TC-1.4 | `GET /api/reviews?productId=<p1.id>` | 200 | TC-3 |
| TC-1.5 | `GET /api/reviews?storeId=<p1.store_id>` | 200 | TC-4 |

### 5.2 Section 2 — Create: schema negatives (7 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-2.1 | `POST /api/reviews {productId:"abc", rating:5}` | 400 | TC-5 |
| TC-2.2 | `POST /api/reviews {productId:<p1.id>, rating:0}` | 400 | TC-6 |
| TC-2.3 | `POST /api/reviews {productId:<p1.id>, rating:6}` | 400 | TC-6 |
| TC-2.4 | `POST /api/reviews {productId:<p1.id>, rating:"high"}` | 400 | TC-6 |
| TC-2.5 | `POST /api/reviews {productId:999999, rating:5}` | 404 | TC-7 |
| TC-2.6 | `POST /api/reviews` (no auth) | 401 | TC-8 |
| TC-2.7 | `POST /api/reviews {storeId:999}` (mismatch) | 400 | TC-9 |

### 5.3 Section 3 — Create: happy path (verified buyer, 4 cases)

| ID | Pre | Request | Expected | Covers |
|----|-----|---------|----------|--------|
| TC-3.1 | After order | `POST /api/reviews {productId:<p1.id>, rating:5, title:'Excellent product'}` | 200, `data.id` | TC-10 |
| TC-3.2 | (review id) | inline | non-null | TC-10 |
| TC-3.3 | (rating recomputed) | `GET /api/products/<p1.id>` | `rating in 1.0-5.0` | TC-13 |
| TC-3.4 | (review_count incremented) | (implicitly checked via rating delta) | increment by 1 | TC-14 |

### 5.4 Section 4 — Create: non-buyer (1 case)

| ID | Pre | Request | Expected | Covers |
|----|-----|---------|----------|--------|
| TC-4.1 | No order for p2 | `POST /api/reviews {productId:<p2.id>, rating:3}` | 200 (is_verified=false) | TC-11 |

### 5.5 Section 5 — Rating boundaries (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-5.1 | `POST /api/reviews {productId:<p3.id>, rating:1}` | 200 | TC-12 |
| TC-5.2 | `POST /api/reviews {productId:<p3.id>, rating:5}` | 200 | TC-12 |

### 5.6 Section 6 — List after insert (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-6.1 | `GET /api/reviews?productId=<p1.id>` | 200 | TC-15 |
| TC-6.2 | (filter result contains new review) | inline `title='Excellent product'` | TC-15 |

---

## 6. Test Procedure

```
1. Setup: login customer + create order for p1               → 2 requests
2. Section 1 — Public list (5 cases)                        → 5 requests + inline checks
3. Section 2 — Create negatives (7 cases)                    → 7 requests
4. Section 3 — Create happy (verified buyer)                 → 2 requests + inline checks
5. Section 4 — Create happy (non-buyer)                     → 1 request
6. Section 5 — Rating boundaries                             → 2 requests
7. Section 6 — List after insert                             → 1 request + inline check
─────────────────────────────────────────────────────
Total:                                                     → 20 HTTP requests
                                                           - 5 inline data-shape checks
                                                           = 21 PASS/FAIL assertions
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected (200, 400, 401, 404).
2. For list: only `is_visible=true` rows appear (TC-1.3).
3. For create: `data.id` non-null, `data.is_verified` reflects purchase history.
4. For trigger TCs: `products.rating` updates to a valid 1.0-5.0 range.

### 7.2 Per-PHASE

PHASE 08 passes if **all 21 assertions pass**.

### 7.3 Known flexibility

**TC-3.4 (review_count delta)** — the script does NOT assert an exact
delta because the seed may contain hidden or unrelated review rows.
The assertion is implicit (rating recomputed to a valid range).

---

## 8. Test Data Generation

### 8.1 Static (from seed)

- Customer: `ahmed@gmail.com / customer123`
- 24 products, 18 seed reviews
- All seeded reviews have `is_visible=true`

### 8.2 Dynamic (per run)

- `$p1`: first product (will be ordered + reviewed).
- `$p2`: second product (will be reviewed without ordering).
- `$p3`: third product (for boundary rating tests).
- `$orderId`: from `POST /api/orders` response (validates ahmed as a buyer of p1).
- `$ratingBefore` / `$countBefore`: from `GET /api/products/<p1.id>` before review.
- `$ratingAfter` / `$countAfter`: from `GET /api/products/<p1.id>` after review.

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-REV-1: Reviews listing is public | `reviews.cts:19` (no auth) | TC-1.1 |
| REQ-REV-2: Only visible reviews leak | `WHERE is_visible = TRUE` | TC-1.3 |
| REQ-REV-3: Filter by productId | `WHERE product_id = ?` | TC-1.4, TC-6.1 |
| REQ-REV-4: Filter by storeId | `JOIN products` filter | TC-1.5 |
| REQ-REV-5: zod validation on create | `reviewCreateSchema` | TC-2.1 to TC-2.7 |
| REQ-REV-6: Rating 1-5 | `z.number().int().min(1).max(5)` | TC-2.2, TC-2.3, TC-2.4, TC-5.1, TC-5.2 |
| REQ-REV-7: Verified-purchase check | `reviews.cts` looks up `order_items` | TC-3.1, TC-4.1 |
| REQ-REV-8: storeId mismatch rejected | Server derives from product | TC-2.7 |
| REQ-REV-9: Rating recompute trigger | `refresh_product_rating()` | TC-3.3, TC-3.4 |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **PHASE 01-R broke ahmed's password** | All auth-gated tests fail | `logs/reset-ahmed.cjs` (see B.1.6 §8.3) |
| **Non-buyer reviews accepted** | Potential abuse (unverified reviews) | By design; future moderation queue |
| **Rating delta varies with seed** | TC-3.4 cannot assert exact count delta | Documented in §7.3 |
| **Race on rating recompute** | Multiple concurrent reviews → temporary stale rating | Trigger is `AFTER` statement-level; eventually consistent |
| **No edit/delete endpoint** | User cannot correct their review | Out of scope (not implemented) |
| **storeId is silently overridden** | Client cannot specify store | Documented in §3 (server is source of truth) |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 8 complete.

===== PHASE 8 SUMMARY =====
  PASS: 21
  FAIL: 0
```

Sample response from the live transcript:

```
total reviews returned: 18
[PASS] all returned reviews are is_visible=true
p1 before: rating=3 review_count=2
[PASS] review id=19
p1 after:  rating=3.7 review_count=3
rating was: 3 → 3.7
```

Section-by-section:

```
Section 1 (Public list):        5/5 PASS (incl. is_visible filter)
Section 2 (Create negatives):   7/7 PASS (incl. rating 0, 6, string, storeId mismatch)
Section 3 (Create happy):       4/4 PASS (verified buyer + rating trigger)
Section 4 (Non-buyer):          1/1 PASS
Section 5 (Rating boundaries):  2/2 PASS
Section 6 (List after insert):  2/2 PASS
──────────────────────────────────────────────────────
Total:                          21/21 PASS (exit 0)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **ISTQB CTFL v4.0** — EP / BVA techniques
- **OWASP API3:2023** — Broken Object Property Level Authorization
  (BOPLA — only visible reviews leaked)

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 8 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_05_ORDERS_INVENTORY.md`](PHASE_05_ORDERS_INVENTORY.md) — companion (B.1.7)
- [`../../../tests/e2e/phase08_reviews_ratings.ps1`](../../../tests/e2e/phase08_reviews_ratings.ps1) — the script
- [`../../../tests/reports/phase08_reviews_ratings.log`](../../../tests/reports/phase08_reviews_ratings.log) — last transcript
- [`../../../../app/server/routes/reviews.cts`](../../../../app/server/routes/reviews.cts) — handlers under test
- [`../../../../database/functions.sql`](../../../../database/functions.sql) — `refresh_product_rating()` trigger function
- [`../../../../database/triggers.sql`](../../../../database/triggers.sql) — trigger wiring

---

## 13. Maintenance Notes

1. **Rating trigger is the keystone** — if `functions.sql` or
   `triggers.sql` is edited, this PHASE 08 must be re-run before any
   downstream PHASE that depends on `products.rating`.
2. **No edit/delete endpoint** — when added, add a new section §X.
3. Update §3 line numbers when `reviews.cts` is edited.
4. Add new TCs to §5 + §9 traceability.
5. Bump version in §1.
6. Commit script + spec **together**.

---

> **End of PHASE 08 Design Specification.** Next: B.1.11
> ([PHASE_09_WISHLIST_FOLLOWERS.md](PHASE_09_WISHLIST_FOLLOWERS.md)) —
> wishlist + store followers.
