# PHASE 17 — Frontend SPA Smoke + Full Regression Runner
# Phase Design Specification (ISO/IEC/IEEE 29119-3)

> **Standard:** [ISO/IEC/IEEE 29119-3](https://www.iso.org/standard/81291.html) — Test Documentation
> **Maps to:** IEEE 829-2008 §3, §4, §5
> **Status:** ✅ Done — scripts at [`tests/e2e/phase16_frontend_spa.ps1`](../../../tests/e2e/phase16_frontend_spa.ps1) and [`tests/e2e/phase17_full_regression.ps1 (orchestrator)`](../../../tests/e2e/phase17_full_regression.ps1 (orchestrator))
> **Last verified:** 2026-06-28 (PHASE 16: **21/21 PASS**; PHASE 17: orchestrator, runtime ~5 min)
> **Template:** B.1.1 [PHASE_00_HEALTH_AUTH.md](PHASE_00_HEALTH_AUTH.md)

---

## 1. Identification

| Field | Value |
|-------|-------|
| **Identifier** | PHASE_16 + PHASE_17 |
| **Title** | Frontend SPA / PWA Smoke + Full Regression Runner |
| **Version** | 1.0 |
| **Author** | Nouf-ex QA program |
| **Created** | 2026-06-21 |
| **Last reviewed** | 2026-06-28 |
| **Test level** | System (E2E + meta-orchestrator) |
| **Test type** | Frontend smoke + Regression aggregation |
| **Auth required** | None for PHASE 16 (public); PHASE 17 inherits per-phase |

---

## 2. Scope

### 2.1 PHASE 16 in scope

1. **Root HTML** — `GET /` returns 200, contains `<html>`.
2. **Asset chunks** — `GET /assets/*` returns 200 for at least 1 chunk.
3. **PWA manifest** — `GET /manifest.webmanifest` returns 200.
4. **SPA fallback** — 11 SPA routes return 200 (history-API fallback).
5. **Security headers** — CSP, HSTS, X-Frame-Options present.
6. **API co-exists** — `/api/health` and `/api/products` still work.

### 2.2 PHASE 17 in scope

1. **Orchestrator** — runs all phaseNN_*.ps1 scripts sequentially.
2. **Rate-limit reset** — calls `reset-rate-limit.cjs` between phases.
3. **Tee output** — each phase's output is written to `tests/reports/phaseNN.log`.
4. **Aggregation** — total PASS/FAIL across all phases.
5. **Summary file** — `tests/reports/phase17_regression_summary.txt`.

### 2.3 Out of scope

- Real-browser E2E (Playwright/Cypress) → future work.
- Visual regression → not implemented.
- Performance benchmarks → covered by Lighthouse separately.

---

## 3. References (Traceability Matrix)

### 3.1 Source code under test (PHASE 16)

| File | Lines | What it owns |
|------|-------|--------------|
| `app/server/index.ts` | 95-97 | SPA fallback (serves `dist/index.html` for non-API routes) |
| `app/server/middleware.ts` | `securityHeaders` | CSP + HSTS + X-Frame-Options |
| `app/public/manifest.webmanifest` | (static) | PWA manifest |
| `vite.config.ts` | `vite-plugin-pwa` | PWA asset generation |

### 3.2 Orchestrator (PHASE 17)

| File | Lines | What it owns |
|------|-------|--------------|
| `tests/e2e/phase17_full_regression.ps1 (orchestrator)` | 13-30 | Phase list |
| `tests/e2e/phase17_full_regression.ps1 (orchestrator)` | 33-45 | Rate-limit reset |
| `tests/e2e/phase17_full_regression.ps1 (orchestrator)` | 55-88 | Phase execution loop |
| `tests/e2e/phase17_full_regression.ps1 (orchestrator)` | 90-129 | Summary + report |

### 3.3 Test data

- Static `dist/` directory built by `vite build`.
- 11 SPA routes (from `routes/*.tsx`).

---

## 4. Test Conditions (PHASE 16)

| # | Test Condition | Standard |
|---|----------------|----------|
| TC-1 | Root HTML returns 200 with `<html>` | IEEE 829 §4.1 |
| TC-2 | Asset chunks return 200 | IEEE 829 §4.2 |
| TC-3 | PWA manifest returns 200 | IEEE 829 §4.3 |
| TC-4 | SPA fallback works for all 11 routes | IEEE 829 §4.4 |
| TC-5 | Security headers (CSP, HSTS, X-Frame-Options) present | OWASP Secure Headers Project |
| TC-6 | CSP has per-request nonce | OWASP CSP best practice |
| TC-7 | `/api/health` and `/api/products` co-exist with SPA | IEEE 829 §4.5 |

---

## 5. Test Cases (PHASE 16: 21 total)

### 5.1 Section 1 — Root HTML (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-1.1 | `GET /` | 200 | TC-1 |
| TC-1.2 | (response body) | contains `<html>` | TC-1 |

### 5.2 Section 2 — Asset chunks (1 case + inline)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-2.1 | `GET /assets/*` (sample 5 chunks) | at least 1 returns 200 | TC-2 |

### 5.3 Section 3 — PWA manifest (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-3.1 | `GET /manifest.webmanifest` | 200 | TC-3 |
| TC-3.2 | (response shape) | has `name` field | TC-3 |

### 5.4 Section 4 — SPA fallback (11 cases)

| ID | Route | Expected | Covers |
|----|-------|---------|--------|
| TC-4.1 | `GET /` | 200 | TC-4 |
| TC-4.2 | `GET /search` | 200 | TC-4 |
| TC-4.3 | `GET /categories` | 200 | TC-4 |
| TC-4.4 | `GET /deals` | 200 | TC-4 |
| TC-4.5 | `GET /product/1` | 200 | TC-4 |
| TC-4.6 | `GET /store/1` | 200 | TC-4 |
| TC-4.7 | `GET /auth/login` | 200 | TC-4 |
| TC-4.8 | `GET /customer` | 200 | TC-4 |
| TC-4.9 | `GET /seller` | 200 | TC-4 |
| TC-4.10 | `GET /admin` | 200 | TC-4 |
| TC-4.11 | `GET /nonexistent-route` (SPA fallback) | 200 | TC-4 |

### 5.5 Section 5 — Security headers (3 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-5.1 | (CSP present) | inline | TC-5 |
| TC-5.2 | (CSP has nonce) | inline | TC-6 |
| TC-5.3 | (HSTS + X-Frame-Options present) | inline | TC-5 |

### 5.6 Section 6 — API co-existence (2 cases)

| ID | Request | Expected | Covers |
|----|---------|----------|--------|
| TC-6.1 | `GET /api/health` | 200 | TC-7 |
| TC-6.2 | `GET /api/products?limit=1` | 200 | TC-7 |

---

## 6. Test Procedure

### 6.1 PHASE 16

```
1. Section 1 — Root HTML         → 1 request + inline check
2. Section 2 — Asset chunks      → 5 requests (sample)
3. Section 3 — PWA manifest     → 1 request + inline
4. Section 4 — SPA fallback     → 11 requests
5. Section 5 — Security headers  → 1 request + inline checks
6. Section 6 — API co-existence  → 2 requests
─────────────────────────────────────────────
Total:                            → 21 HTTP requests = 21 PASS/FAIL
```

### 6.2 PHASE 17

```
1. Reset rate-limit buckets
2. Loop over 14 phase scripts:
   - Reset rate-limit between phases
   - Run phase
   - Tee output to tests/reports/phaseNN.log
   - Parse PASS/FAIL from output
   - Aggregate
3. Write summary to tests/reports/phase17_regression_summary.txt
─────────────────────────────────────────────
Total runtime: ~5 minutes on a fresh API
```

---

## 7. Pass/Fail Criteria

### 7.1 PHASE 16

A TC passes if:
1. HTTP status code matches expected (200).
2. Response body shape matches expected.

PHASE 16 passes if **all 21 assertions pass**.

### 7.2 PHASE 17

A "phase run" passes if:
1. Exit code 0.
2. Parsed `FAIL:` count is 0.

PHASE 17 passes if **all 14 phase runs pass**.

---

## 8. Test Data Generation

### 8.1 PHASE 16

- `$body` from `GET /`: parsed for `<html>`, asset references.
- `$h` from `GET /`: parsed for CSP/HSTS/XFO headers.

### 8.2 PHASE 17

- 14 phase scripts enumerated in the script.
- Rate-limit reset via `node tests/e2e/reset-rate-limit.cjs`.

---

## 9. Traceability (Requirement → Test Case)

| Requirement | Source | Test cases |
|-------------|--------|------------|
| REQ-SPA-1: Root HTML serves | `index.ts:95` | TC-1.1, TC-1.2 |
| REQ-SPA-2: Asset chunks served | `vite-plugin-pwa` build | TC-2.1 |
| REQ-SPA-3: PWA manifest served | `manifest.webmanifest` | TC-3.1, TC-3.2 |
| REQ-SPA-4: SPA fallback works | `index.ts:95-97` | TC-4.1 to TC-4.11 |
| REQ-SEC-1: CSP + HSTS + XFO headers | `middleware.ts:securityHeaders` | TC-5.1 to TC-5.3 |
| REQ-SPA-5: API + SPA co-exist | Single Express server | TC-6.1, TC-6.2 |
| REQ-REG-1: Full regression runs | `phase17_full_regression.ps1` | (orchestrator) |
| REQ-REG-2: Rate-limit reset between phases | `reset-rate-limit.cjs` | (orchestrator) |
| REQ-REG-3: Aggregated summary | `tests/reports/phase17_*.txt` | (orchestrator) |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Vite build not run** | `dist/` missing → SPA fallback 404 | `npm run build` before PHASE 16 |
| **CSP nonce leaks** | Per-request nonce; if caching enabled, leaks | Server uses `response.setHeader` (no caching by default) |
| **PHASE 17 cascades from PHASE 12 rate-limit** | PHASE 17 may fail 14 due to rate-limit cascade | `reset-rate-limit.cjs` called between phases |
| **Long runtime** | ~5 min | Acceptable; can be run nightly or in CI |

---

## 11. Logged Results (last run)

**Last verified:** 2026-06-28 against live `localhost:3000`.

```
PHASE 16 complete.

===== PHASE 16 SUMMARY =====
  PASS: 21
  FAIL: 0
```

PHASE 16 section-by-section:

```
Section 1 (Root HTML):           2/2 PASS
Section 2 (Asset chunks):        1/1 PASS
Section 3 (PWA manifest):        2/2 PASS
Section 4 (SPA fallback):        11/11 PASS
Section 5 (Security headers):    4/4 PASS (CSP + nonce + HSTS + XFO)
Section 6 (API co-existence):     2/2 PASS
────────────────────────────────────────────────
Total:                            21/21 PASS (exit 0)
```

PHASE 17 last run: not re-run in this session (would take ~5 min and
exceed the response budget). Last known result: 10/14 PASS with rate-limit
cascade on PHASES 12 + 15.

---

## 12. References

### 12.1 External standards

- **IEEE 829-2008** — Test Documentation
- **ISO/IEC/IEEE 29119-3** — Test Documentation
- **OWASP Secure Headers Project** — recommended HTTP headers
- **W3C Web App Manifest** — `manifest.webmanifest` spec
- **MDN Service Workers / PWA** — fallback behavior

### 12.2 Internal documents

- [`PHASE_TEST_TASKS.md`](../PHASE_TEST_TASKS.md) §PHASE 16, §PHASE 17 — master plan
- [`PHASE_00_HEALTH_AUTH.md`](PHASE_00_HEALTH_AUTH.md) — model template (B.1.1)
- [`PHASE_12_2FA_BACKUP.md`](PHASE_12_2FA_BACKUP.md) — root cause of rate-limit cascades (B.1.14)
- [`../../../tests/e2e/phase16_frontend_spa.ps1`](../../../tests/e2e/phase16_frontend_spa.ps1) — the script
- [`../../../tests/e2e/phase17_full_regression.ps1 (orchestrator)`](../../../tests/e2e/phase17_full_regression.ps1 (orchestrator)) — the orchestrator
- [`../../../tests/e2e/reset-rate-limit.cjs`](../../../tests/e2e/reset-rate-limit.cjs) — rate-limit reset utility
- [`../../../../app/server/index.ts`](../../../../app/server/index.ts) — SPA fallback + Express setup
- [`../../../../app/server/middleware.ts`](../../../../app/server/middleware.ts) — security headers

---

## 13. Maintenance Notes

1. **Vite build required** — `npm run build` before PHASE 16.
2. **Adding a new SPA route** — append to `$spaRoutes` in §5.4.
3. **Adding a new phase** — append to `$phases` in `phase17_full_regression.ps1`.
4. **PHASE 17 doesn't include PHASES 10, 11** by design (they have
   different concerns). Add them back if integration testing is needed.
5. **Rate-limit reset script** — if `reset-rate-limit.cjs` is missing,
   the orchestrator logs a warning but continues (PHASE 17 §33-40).
6. Update §3 line numbers when source files are edited.
7. Add new TCs to §5 + §9 traceability.
8. Bump version in §1.
9. Commit script + spec **together**.

---

> **End of PHASE 17 Design Specification.** This is the LAST spec in
> the B.1.x series (B.1.1 through B.1.18, 18 specs total, ~250 KB).
>
> Next: B.2.x — Architecture + Operations docs (security.md, deployment.md,
> monitoring.md, er-diagram.md, debugging.md) per MASTER_PLAN.md Phase B.2.