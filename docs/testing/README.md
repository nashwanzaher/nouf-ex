# Nouf-ex — Testing Documentation

> **Entry point** for everything testing-related.
> Conforms to [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [ISTQB CTFL](https://www.istqb.org/).

This directory is the **single source of truth** for the Nouf-ex test
program. It is organised per ISO 29119-3's recommended documentation
structure.

---

## 📁 Contents

```
docs/testing/
├── README.md                  ← (this file) — testing hub
│
├── PHASE_TEST_TASKS.md        ← Master Test Plan (MTP) — IEEE 829 §5
│
├── conventions.md             ← Test taxonomy + naming + style rules
│
├── standards/                 ← International standards we follow
│   ├── IEEE-829.md           ← Software & System Test Documentation
│   ├── ISO-29119.md          ← Software Testing (5 parts)
│   └── ISTQB-CTFL.md         ← Foundation Level techniques
│
├── phases/                    ← Per-PHASE Test Design Specifications
│   ├── PHASE_00_HEALTH_AUTH.md
│   ├── PHASE_01_PROFILE_ADDRESSES.md
│   └── ... (one per phase)
│
└── templates/                 ← Reusable test templates
    └── PS_TEST_HELPER.ps1    ← (mirrored at tests/e2e/helpers/)
```

---

## 🧭 How to Navigate

| You want to … | Read |
|---------------|------|
| Run all tests | [`../../tests/README.md`](../../tests/README.md) |
| Run a single phase | [`../../tests/e2e/README.md`](../../tests/e2e/README.md) |
| Understand the master plan | [`PHASE_TEST_TASKS.md`](PHASE_TEST_TASKS.md) |
| Author a new phase | [`conventions.md`](conventions.md) |
| Map our process to a standard | [`standards/`](standards/) |
| See design rationale for a phase | [`phases/`](phases/) |
| Find a test template | [`templates/`](templates/) |

---

## 🔁 Process (per ISO 29119-2)

```
Master Test Plan          ─── PHASE_TEST_TASKS.md
        │
        ▼
Test Design Specification ─── phases/PHASE_NN_*.md
        │
        ▼
Test Procedure / Script   ─── tests/e2e/phaseNN_*.ps1
        │
        ▼
Test Execution Log         ─── tests/reports/phaseNN_*.log
        │
        ▼
Test Summary Report        ─── Print-Summary output
```

---

## 📐 Conformance Statement

Nouf-ex testing program claims **conformance** to:

- **IEEE 829-2008** — All 8 document types are produced
- **ISO/IEC/IEEE 29119-2** — The dynamic test process is followed per phase
- **ISTQB CTFL v4.0** — Vocabulary and test design techniques are applied

See [`standards/`](standards/) for the detailed mapping.

---

## 📊 Current State (as of 2026-06-27)

| PHASE | Topic | Status | Script |
|-------|-------|--------|--------|
| 00 | Health + Auth | ✅ Done | `tests/e2e/phase00_health_auth.ps1` |
| 01 | Profile + Addresses | ✅ Done | `tests/e2e/phase01_profile_addresses.ps1` |
| 01-R | Profile re-test | ✅ Done | `tests/e2e/phase01_profile_addresses_retest.ps1` |
| 02 | Public Catalog | ✅ Done | `tests/e2e/phase02_public_catalog.ps1` |
| 03 | Search + Filters | ✅ Done | `tests/e2e/phase03_search_filters.ps1` |
| 04 | Cart | ⏳ Pending | `tests/e2e/phase04_cart.ps1` |
| 05 | Orders + Inventory | ⏳ Pending | `tests/e2e/phase05_orders_inventory.ps1` |
| 06 | Coupons | ⏳ Pending | `tests/e2e/phase06_coupons.ps1` |
| 07 | Payments + Refunds | ⏳ Pending | `tests/e2e/phase07_payments_refunds.ps1` |
| 08 | Reviews + Ratings | ⏳ Pending | `tests/e2e/phase08_reviews_ratings.ps1` |
| 09 | Wishlist + Followers | ⏳ Pending | `tests/e2e/phase09_wishlist_followers.ps1` |
| 10 | Merchant Flow | ⏳ Pending | `tests/e2e/phase10_merchant_flow.ps1` |
| 11 | Admin + RBAC | ⏳ Pending | `tests/e2e/phase11_admin_rbac.ps1` |
| 12 | 2FA + Backup | ⏳ Pending | `tests/e2e/phase12_2fa_backup.ps1` |
| 13 | Notifications + Messages | ⏳ Pending | `tests/e2e/phase13_notifications_messages.ps1` |
| 14 | Shipping Methods | ⏳ Pending | `tests/e2e/phase14_shipping_methods.ps1` |
| 15 | Audit Logs | ⏳ Pending | `tests/e2e/phase15_audit_logs.ps1` |
| 16 | Frontend SPA | ⏳ Pending | `tests/e2e/phase16_frontend_spa.ps1` |
| 17 | Full Regression | ⏳ Pending | `tests/e2e/phase17_full_regression.ps1` |

> **18 PHASES** total · **5 Done** (00, 01, 01-R, 02, 03) · **13 Pending**
