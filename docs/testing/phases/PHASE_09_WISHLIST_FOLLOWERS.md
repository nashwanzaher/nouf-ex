# PHASE 09 — Wishlist + Store Followers
# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ✅ Done — script at [`tests/e2e/phase09_wishlist_followers.ps1`](../../../tests/e2e/phase09_wishlist_followers.ps1)
> **Last verified:** 2026-06-28 (live run, **24/24 PASS**)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_09 |
| **Title** | Wishlist + Store Followers |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E black-box) |
| **Test type** | Functional + Security (path-id ignored, cross-user) |
| **Auth required** | Bearer for all endpoints |
| **Prerequisite** | PHASE 0 + ahmed password restored |

---

## 2. Scope

### 2.1 In scope

1. **Wishlist CRUD** — `GET /api/wishlist/:userId`, `POST /api/wishlist`,
   `DELETE /api/wishlist/:id`.
2. **Path-id behavior** — the URL `:userId` is **ignored**, route
   always uses `req.user.id` (owner-only by design).
3. **Store follower check** — `GET /api/store-followers/check?store_id&user_id`.
4. **Cross-user safety** — wishlist DELETE returns 404 to non-owner.
5. **Admin bypass** — admin can check follow state for any user.

### 2.2 Out of scope

- Wishlist move-to-cart → not implemented.
- Follower notification / feed → not implemented.
- Unfollow endpoint → not implemented.
- Wishlist share / privacy → not implemented.

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/routes/wishlist.cts` | 14-31 | `GET /:userId` (ignores URL param) |
| `app/server/routes/wishlist.cts` | 33-61 | `POST /` (with FK violation handling) |
| `app/server/routes/wishlist.cts` | 63-83 | `DELETE /:id` (ownership via WHERE user_id) |
| `app/server/routes/store-followers.cts` | 21-... | `GET /check?store_id&user_id` |

### 3.2 Database

| Table | Operations |
|-------|------------|
| `wishlist` | `SELECT` (owner-scoped), `INSERT` (FK to products), `DELETE WHERE id AND user_id` |
| `store_followers` | `SELECT` (by store_id + user_id) |

### 3.3 Test data

- 2 customers: ahmed (id=2), sara (id=3)
- Admin (id=1)
- 24 products across 7 stores

---

## 4. Test Conditions

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | All wishlist endpoints require auth (401 without Bearer) | IEEE 829 §4.1 |
| TC-2 | `GET /api/wishlist/:userId` returns owner's wishlist (path param ignored) | IEEE 829 §4.2 + A.1 contract |
| TC-3 | `POST /api/wishlist` validates body (productId required, integer) | ISO 29119-4 (zod) |
| TC-4 | `POST /api/wishlist` rejects non-existent product (FK 400/409) | IEEE 829 §4.3 |
| TC-5 | `POST /api/wishlist` happy path creates a row | IEEE 829 §4.4 |
| TC-6 | `POST /api/wishlist` re-add returns 200 (no UNIQUE constraint yet) | IEEE 829 §4.5 |
| TC-7 | `GET /api/wishlist` reflects the new row | IEEE 829 §4.6 |
| TC-8 | `DELETE /api/wishlist/:id` rejects non-integer id | ISO 29119-4 (BVA) |
| TC-9 | `DELETE /api/wishlist/:id` cross-user returns 404 (no leak) | OWASP API1:2023 (BOLA) |
| TC-10 | `DELETE /api/wishlist/:id` (owner) returns 200 | IEEE 829 §4.7 |
| TC-11 | `DELETE /api/wishlist/:id` re-delete returns 404 (idempotent) | ISO 29119-4 (idempotency) |
| TC-12 | `GET /api/store-followers/check` requires auth | IEEE 829 §4.8 |
| TC-13 | `GET /api/store-followers/check` returns `following=true/false` for owner | IEEE 829 §4.9 |
| TC-14 | Admin can check follow state for any user | Role-based bypass |
| TC-15 | Non-admin cross-user check returns 403 | OWASP API1:2023 |
| TC-16 | `GET /api/store-followers/check` missing params returns 400 | ISO 29119-4 (zod) |

---

## 5. Test Cases (24 total)

### 5.1 Section 1 — Auth negatives (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `GET /api/wishlist/<id>` (no auth) | 401 | TC-1 |
| TC-1.2 | `POST /api/wishlist` (no auth) | 401 | TC-1 |
| TC-1.3 | `DELETE /api/wishlist/1` (no auth) | 401 | TC-1 |
| TC-1.4 | `GET /api/store-followers/check?...` (no auth) | 401 | TC-12 |

### 5.2 Section 2 — Wishlist list (3 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-2.1 | `GET /api/wishlist/<B>` (as B) | 200, B's list | TC-2 |
| TC-2.2 | `GET /api/wishlist/<B>` (as A) | 200, A's own list (path ignored) | TC-2 |
| TC-2.3 | `GET /api/wishlist/<A>` (as A) | 200, A's list | TC-2 |

### 5.3 Section 3 — Wishlist add (5 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-3.1 | `POST /api/wishlist {}` (empty body) | 400 | TC-3 |
| TC-3.2 | `POST /api/wishlist {productId:"abc"}` | 400 | TC-3 |
| TC-3.3 | `POST /api/wishlist {productId:999999}` (non-existent) | 400 OR 409 (FK violation) | TC-4 |
| TC-3.4 | `POST /api/wishlist {productId:<p.id>}` (happy) | 200 | TC-5 |
| TC-3.5 | `POST /api/wishlist {productId:<p.id>}` (re-add) | 200 | TC-6 |

### 5.4 Section 4 — List after add (1 case, 1 inline)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-4.1 | `GET /api/wishlist/<A>` (after add) | 200, `data.Count >= 1` | TC-7 |

### 5.5 Section 5 — Wishlist delete (4 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-5.1 | `DELETE /api/wishlist/abc` | 400 | TC-8 |
| TC-5.2 | `DELETE /api/wishlist/<realId>` (as B) | 404 (no leak) | TC-9 |
| TC-5.3 | `DELETE /api/wishlist/<realId>` (as A, owner) | 200 | TC-10 |
| TC-5.4 | `DELETE /api/wishlist/<realId>` (as A, again) | 404 | TC-11 |

### 5.6 Section 6 — Store follower check (6 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-6.1 | `GET /api/store-followers/check?store_id=N&user_id=A` (as A) | 200, `data.following` present | TC-13 |
| TC-6.2 | (data shape) | `following=true` OR `false` | TC-13 |
| TC-6.3 | `GET ... ?store_id=N&user_id=B` (as admin) | 200 | TC-14 |
| TC-6.4 | `GET ... ?store_id=N&user_id=A` (as B, non-admin) | 403 | TC-15 |
| TC-6.5 | `GET /api/store-followers/check` (no params) | 400 | TC-16 |
| TC-6.6 | `GET /api/store-followers/check?store_id=N` (missing user_id) | 400 | TC-16 |

---

## 6. Test Procedure

```
1. Setup: login 3 roles + fetch 1 product        → 4 requests
2. Section 1 — Auth negatives                    → 4 requests
3. Section 2 — Wishlist list                     → 3 requests + inline checks
4. Section 3 — Wishlist add                      → 5 requests
5. Section 4 — List after add                    → 1 request + inline
6. Section 5 — Wishlist delete                   → 4 requests
7. Section 6 — Follower check                    → 6 requests + inline
─────────────────────────────────────────────────────
Total:                                          → 27 HTTP requests
                                                + ~3 inline data-shape checks
                                                = 24 PASS/FAIL assertions
```

---

## 7. Pass/Fail Criteria

### 7.1 Per-test-case

A TC passes if:
1. HTTP status code matches expected (200, 400, 401, 403, 404, 409).
2. Response body shape matches expected.

### 7.2 Per-PHASE

PHASE 09 passes if **all 24 assertions pass**.

### 7.3 Known flexibility

- **TC-3.5 (re-add same product)** — accepts 200 (current behavior, no
  UNIQUE constraint). If a UNIQUE constraint is added, this tightens.
- **TC-3.3 (non-existent product)** — accepts 400 OR 409 (FK 23503
  violation mapping).
- **TC-2.2 (cross-user wishlist list)** — accepts 200 (the path id is
  ignored, so user A asking for B's wishlist gets A's own). Documented
  in script comment as actual contract (not 403).
- **TC-5.2 (cross-user DELETE)** — accepts 404 (handler scopes by
  `user_id`; non-owner sees 404) — this is the security-safe behavior.

---

## 8. Test Data Generation

### 8.1 Static (from PHASE 0 + seed)

- 2 customers + 1 admin.
- 24 products.

### 8.2 Dynamic (per run)

- `$p`: first product (used for wishlist add).
- `$storeId`: `$p.store_id` (used for follower check).
- `$userCustId`, `$userCustBId`: from `/api/auth/login`.
- `$wishlistId`: from `GET /api/wishlist/<A>.data[0].id` (delete target).

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-WISH-1: All wishlist endpoints require auth | `requireAuth` | TC-1.1, TC-1.2, TC-1.3 |
| REQ-WISH-2: Wishlist list is owner-scoped (path id ignored) | `wishlist.cts:14-31` | TC-2.1, TC-2.2, TC-2.3 |
| REQ-WISH-3: Wishlist add validates productId | `reviewSchema` | TC-3.1, TC-3.2 |
| REQ-WISH-4: Wishlist add FK-checked (product exists) | `wishlist.cts:33-61` | TC-3.3 |
| REQ-WISH-5: Wishlist delete is owner-scoped (404 on cross-user) | `WHERE id = ? AND user_id = ?` | TC-5.2 |
| REQ-WISH-6: Wishlist delete is idempotent | `RETURNING id` | TC-5.4 |
| REQ-FOLLOW-1: Follower check requires auth | `requireAuth` | TC-1.4 |
| REQ-FOLLOW-2: Follower check returns `following` field | Response shape | TC-6.1, TC-6.2 |
| REQ-FOLLOW-3: Admin can check any user's follow state | Role bypass | TC-6.3 |
| REQ-FOLLOW-4: Non-admin cross-user check returns 403 | `req.user.role === 'admin'` | TC-6.4 |
| REQ-FOLLOW-5: Missing params returns 400 | zod validation | TC-6.5, TC-6.6 |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **PHASE 01-R broke ahmed's password** | All auth-gated tests fail | `logs/reset-ahmed.cjs` (see B.1.6 §8.3) |
| **No UNIQUE constraint on wishlist** | Same product can be added multiple times | Documented in §7.3; future migration to add UNIQUE (user_id, product_id) |
| **Path id ignored** — security through obscurity? | User A cannot query B's wishlist even if they guess the id | Documented as contract; not a leak, but not strictly enforced |
| **FK violation mapping** | Server returns 409 instead of 400 | Documented; both acceptable |
| **State leakage across runs** | Wishlist may grow unbounded | Acceptable; tests don't depend on a clean state |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 9 complete.

===== PHASE 9 SUMMARY =====
  PASS: 24
  FAIL: 0
```

Sample response from the live transcript:

```
wishlist rows for A: 3
[PASS] POST /api/wishlist (non-existent product) → 409 (FK violation)
deleting wishlist_id=3
[PASS] following=True
```

Section-by-section:

```
Section 1 (Auth):                4/4 PASS
Section 2 (List):                3/3 PASS (incl. path-id-ignored contract)
Section 3 (Add):                 5/5 PASS (incl. FK violation)
Section 4 (List after add):      1/1 PASS (+ inline count check)
Section 5 (Delete):              4/4 PASS (incl. cross-user 404 + idempotent)
Section 6 (Follower check):      6/6 PASS (incl. admin bypass + 403 cross-user)
──────────────────────────────────────────────────────
Total:                            24/24 PASS (exit 0)
```

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **ISTQB CTFL v4.0** — EP / BVA / idempotency
- **OWASP API1:2023** — BOLA (cross-user wishlist blocked via 404)

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 9 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_06_COUPONS_DISCOUNTS.md`](PHASE_06_COUPONS_DISCOUNTS.md) — companion (B.1.8)
- [`../../../tests/e2e/phase09_wishlist_followers.ps1`](../../../tests/e2e/phase09_wishlist_followers.ps1) — the script
- [`../../../tests/reports/phase09_wishlist_followers.log`](../../../tests/reports/phase09_wishlist_followers.log) — last transcript
- [`../../../../app/server/routes/wishlist.cts`](../../../../app/server/routes/wishlist.cts) — handlers under test
- [`../../../../app/server/routes/store-followers.cts`](../../../../app/server/routes/store-followers.cts) — handlers under test

---

## 13. Maintenance Notes

1. **Path-id-ignored contract** — the script documents this as actual
   behavior. If the route is fixed to honor the URL `:userId` (with
   proper ownership checks), tighten TC-2.2 to assert 403.
2. **UNIQUE constraint on wishlist** — when added, tighten TC-3.5 to
   assert `idempotent=true` (similar to payments).
3. Update §3 line numbers when `wishlist.cts` / `store-followers.cts`
   are edited.
4. Add new TCs to §5 + §9 traceability.
5. Bump version in §1.
6. Commit script + spec **together**.

---

> **End of PHASE 09 Design Specification.** Next: B.1.12
> ([PHASE_10_MERCHANT_FLOW.md](PHASE_10_MERCHANT_FLOW.md)) — seller
> endpoints: products, orders, analytics.