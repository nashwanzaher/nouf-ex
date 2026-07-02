# IEEE 829-2008 — Standard for Software and System Test Documentation

> **Source:** [IEEE Std 829™-2008](https://standards.ieee.org/ieee/829/4987/) — _Standard for Software and System Test Documentation_
> **Adopted by:** Nouf-ex testing program (referenced in [`docs/testing/README.md`](../README.md))
> **Last reviewed:** 2026-06-27

IEEE 829 defines **eight document types** that together constitute a
complete, audit-ready test program. Nouf-ex maps each one to a concrete
artifact inside this repository.

---

## 📋 The 8 IEEE 829 Document Types

| # | Document | Purpose | Nouf-ex artifact |
|---|----------|---------|------------------|
| 1 | **Master Test Plan (MTP)** | Overall strategy, scope, resources, schedule | [`docs/testing/PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) |
| 2 | **Level Test Plan** | Plan for one test level (unit / integration / E2E) | [`docs/testing/conventions.md`](../conventions.md) |
| 3 | **Level Test Design** | Detailed test cases + identification | [`docs/testing/phases/`](../phases/) |
| 4 | **Level Test Case** | One specific test scenario | Each `tests/e2e/phase*.ps1` section |
| 5 | **Level Test Procedure** | Steps to execute a test case | PowerShell script flow inside each phase |
| 6 | **Level Test Log** | Chronological record of execution | [`tests/reports/phase*.log`](../../../tests/reports/) |
| 7 | **Level Anomaly Report** | Documented defects found | (GitHub Issues — see Contributing) |
| 8 | **Level Test Summary** | Pass/fail tally + evaluation | `Print-Summary` output at end of each phase |

---

## 🔍 How Nouf-ex Uses Each Document Type

### 1. Master Test Plan (MTP)

[`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) covers all 18 PHASES
with their objectives, files, endpoints, affected tables, test data,
positive/negative cases, execution order, and current status.

### 2. Level Test Plan

[`conventions.md`](../conventions.md) defines the test taxonomy
(unit / integration / E2E), naming rules, and placement policy.

### 3. Level Test Design

Each per-PHASE document in [`phases/`](../phases/) records the design
rationale: which endpoints, which tables, why this subset.

### 4. Level Test Case

A single assertion inside a phase script (e.g. `Assert-Status 'GET /api/products' $r 200`).

### 5. Level Test Procedure

The PowerShell statements that orchestrate a test case (Arrange → Act → Assert).

### 6. Level Test Log

[`tests/reports/phase*.log`](../../../tests/reports/) — auto-generated
via `Tee-Object` at execution time. Example: `phase02_public_catalog.log`.

### 7. Level Anomaly Report

Defects are tracked as **GitHub Issues** with the `bug` label.
The contributing guide ([`CONTRIBUTING.md`](../../../CONTRIBUTING.md))
defines the required fields.

### 8. Level Test Summary

The `Print-Summary` function at the end of each phase script prints
PASS / FAIL / Total counts plus a list of failures with expected vs.
actual status codes.

---

## 🧩 IEEE 829 §8 — Test Script Specification

The `phase*.ps1` scripts follow the **8-clause Test Script structure**
required by IEEE 829:

| Clause | Section | Where in our scripts |
|--------|---------|----------------------|
| 8.1 | Test script identifier | Banner comment at top |
| 8.2 | Purpose | `Write-Host '===== PHASE N — Topic ====='` |
| 8.3 | Pre-requisites | Top of script (e.g. token login) |
| 8.4 | Test script procedure | The numbered sections |
| 8.5 | Expected results | Hard-coded in `Assert-Status $expected` |
| 8.6 | Actual results | Stdout from `Assert-Status` |
| 8.7 | Test script evaluation criteria | `Print-Summary` PASS/FAIL totals |
| 8.8 | Cleanup | (Tests are non-destructive — no cleanup needed) |

---

## 🔁 Test Cycle (per IEEE 829 §6)

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ 1.Planning  │ →  │ 2.Execution  │ →  │ 3.Summarize │
└──────┬──────┘    └──────┬───────┘    └──────┬──────┘
       │                  │                   │
   MTP/PHASE_*       phase*.ps1            reports/*.log
```

---

## 📐 Conformance Checklist

- [x] MTP exists and is current
- [x] Per-phase test design documented
- [x] All test cases produce a verifiable pass/fail
- [x] Test logs persisted with timestamps
- [x] Test summaries produced automatically
- [x] Anomalies routed to a single defect tracker (GitHub Issues)
- [x] Test procedures idempotent (re-runnable)

---

## 🔗 References

- IEEE Std 829-2008 — _Standard for Software and System Test Documentation_
- IEEE Std 1012-2016 — _Standard for System, Software, and Hardware Verification and Validation_
- ISO/IEC/IEEE 29119 — _Software Testing_ (companion standard)
- Beizer, B. — _Software Testing Techniques_ (2nd ed.)
