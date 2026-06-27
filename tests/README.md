# Nouf-ex — Testing Hub

> **Standard reference:** [IEEE 829-2008 — Standard for Software and System Test Documentation](https://standards.ieee.org/ieee/829/4987/) ·
> [ISO/IEC/IEEE 29119 — Software Testing](https://www.iso.org/standard/81291.html) ·
> [ISTQB CTFL Syllabus](https://www.istqb.org/certifications/certified-tester-foundation-level) ·
> [Google Testing Blog](https://testing.googleblog.com/)

This directory contains **all test artifacts** for the Nouf-ex platform.
It mirrors the project's test taxonomy and is the entry point for
test execution, reporting, and standards conformance.

---

## 📁 Directory Layout

```
tests/
├── README.md                       ← (this file) — Testing hub
│
├── e2e/                            ← End-to-end PowerShell scripts
│   ├── README.md                   ← E2E usage guide
│   ├── helpers/
│   │   └── PS_TestHelpers.ps1     ← Shared HTTP/assert helpers (IEEE 829 §8)
│   ├── phase00_health_auth.ps1
│   ├── phase01_profile_addresses.ps1
│   ├── phase01_profile_addresses_retest.ps1
│   ├── phase02_public_catalog.ps1
│   ├── phase03_search_filters.ps1
│   ├── phase04_cart.ps1
│   ├── phase05_orders_inventory.ps1
│   ├── phase06_coupons.ps1
│   ├── phase07_payments_refunds.ps1
│   ├── phase08_reviews_ratings.ps1
│   ├── phase09_wishlist_followers.ps1
│   ├── phase10_merchant_flow.ps1
│   ├── phase11_admin_rbac.ps1
│   ├── phase12_2fa_backup.ps1
│   ├── phase13_notifications_messages.ps1
│   ├── phase14_shipping_methods.ps1
│   ├── phase15_audit_logs.ps1
│   ├── phase16_frontend_spa.ps1
│   └── phase17_full_regression.ps1
│
├── reports/                        ← Test execution logs (one .log per phase)
│   ├── phase02_public_catalog.log
│   ├── phase03_search_filters.log
│   └── ...
│
└── fixtures/                       ← Static test data (JSON fixtures, mocks)
    └── ...
```

> The `app/tests/` directory (not shown here) holds **Vitest unit and
> integration tests** colocated with the layer they cover, per the
> project's convention documented in [`docs/testing/conventions.md`](../docs/testing/conventions.md).

---

## 🎯 Test Taxonomy (per ISTQB / Google Test Pyramid)

```
                     ▲
                    ╱ ╲
                   ╱   ╲          E2E tests (this folder)
                  ╱ 17  ╲         — PowerShell, black-box
                 ╱ PHASES╲        — cover full user flows
                ╱─────────╲
               ╱           ╲      Integration tests (app/server/tests/)
              ╱  Vitest +   ╲     — supertest + mocked pg
             ╱   supertest   ╲
            ╱─────────────────╲
           ╱                   ╲  Unit tests (app/tests/, app/src/**/__tests__/)
          ╱  Vitest +          ╲ — components, hooks, pure functions
         ╱   Testing Library   ╲
        ╱───────────────────────╲
```

**Recommended ratios** (per Google Engineering Productivity Research):
- Unit : Integration : E2E ≈ **70 : 20 : 10**

This folder realises the **top 10 %** of that pyramid — the long,
expensive, user-facing flows that are too coarse for unit tests but
too realistic for integration mocks.

---

## 📚 Standards Conformance

| Concern | Standard | Document |
|---------|----------|----------|
| Test documentation | IEEE 829-2008 | [`docs/testing/standards/IEEE-829.md`](../docs/testing/standards/IEEE-829.md) |
| Test process | ISO/IEC/IEEE 29119-2 | [`docs/testing/standards/ISO-29119.md`](../docs/testing/standards/ISO-29119.md) |
| Test techniques | ISTQB CTFL | [`docs/testing/standards/ISTQB-CTFL.md`](../docs/testing/standards/ISTQB-CTFL.md) |
| Naming, conventions | Google Style Guide | [`docs/testing/conventions.md`](../docs/testing/conventions.md) |
| Master test plan | IEEE 829 §5 | [`PHASE_TEST_TASKS.md`](../docs/testing/PHASE_TEST_TASKS.md) |

---

## ▶️ How to Run

```powershell
# All PHASES in order (assumes API running on http://localhost:3000)
cd tests\e2e
foreach ($p in Get-ChildItem phase*.ps1 | Sort-Object Name) {
    powershell -ExecutionPolicy Bypass -File $p.FullName 2>&1 |
        Tee-Object -FilePath "..\reports\$($p.BaseName).log"
}

# Single PHASE
powershell -ExecutionPolicy Bypass -File .\phase02_public_catalog.ps1
```

> **Prerequisites** — the API server must be reachable on
> `http://localhost:3000` (override via `$env:NOUFEX_API_BASE`).

---

## 📊 Reporting

- Every `phase*.ps1` writes its stdout to `reports/<basename>.log`.
- Final summary (PASS/FAIL counts) is appended via `Print-Summary`.
- Aggregated regression reports belong in `reports/`.

---

## 🔗 Cross-References

- **Master test plan:** [`docs/testing/PHASE_TEST_TASKS.md`](../docs/testing/PHASE_TEST_TASKS.md)
- **Architecture:** [`docs/architecture/`](../docs/architecture/)
- **API contract:** [`docs/architecture/api.md`](../docs/architecture/api.md)
- **DB schema:** [`docs/architecture/database.md`](../docs/architecture/database.md)
