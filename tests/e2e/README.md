# E2E Test Suite — Nouf-ex

> **Standard reference:** [IEEE 829-2008 §8 — Test Script](https://standards.ieee.org/ieee/829/4987/) ·
> [ISTQB CTFL §5 — Test Types](https://www.istqb.org/)

End-to-end black-box tests for the Nouf-ex REST API.
Each script exercises a complete feature area against the **live** API
(the one running on `http://localhost:3000` by default).

---

## 🗂️ File Naming Convention (per Google Style Guide)

```
phase<NN>_<short_topic>.ps1
└─┬─┘  └────┬─────────┘ └─┬─┘
  │        │             └─ extension
  │        └─ snake_case topic (verb-friendly)
  └─ 2-digit zero-padded index

Examples:
  phase00_health_auth.ps1
  phase02_public_catalog.ps1
  phase11_admin_rbac.ps1
```

A `-retest` suffix marks a regression re-run (e.g.
`phase01_profile_addresses_retest.ps1`).

---

## 🔧 Anatomy of a Phase Script

Every script follows the **same structure** (IEEE 829 §8 Test Script):

```powershell
# 1. Banner — header + identification (IEEE 829 §8.1)
Write-Host '===== PHASE N — Topic ====='

# 2. Setup — login tokens, fixtures
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"
$tokens = Get-TestTokens

# 3. Test sections — group by concern
Write-Host '===== 1. Sub-topic A ====='
$r = Invoke-ApiRequest GET '/api/foo' @{} $null
Assert-Status 'GET /api/foo' $r 200

Write-Host '===== 2. Sub-topic B ====='
$r = Invoke-ApiRequest POST '/api/bar' @{...} @{...}
Assert-Status 'POST /api/bar (negative)' $r 400

# 4. Cleanup — none required (tests are read-mostly or DB-backed)

# 5. Summary — print PASS/FAIL counts
Print-Summary 'Phase N — Topic'
```

---

## 📦 Helpers

`helpers/PS_TestHelpers.ps1` exposes:

| Function | Purpose | IEEE 829 mapping |
|----------|---------|------------------|
| `Invoke-ApiRequest` | HTTP wrapper with status + JSON envelope | Test Script Procedure (8.2) |
| `Show-ApiResult` | One-line compact result printer | Test Log (8.5) |
| `Assert-Status` | Pass/Fail assertion against expected HTTP code | Test Script Evaluation (8.4) |
| `Assert-JsonField` | Drill into JSON envelope (data.id, success, …) | Test Script Evaluation (8.4) |
| `Get-TestTokens` | Login the 3 seeded roles → hashtable | Test Setup (8.3) |
| `Get-AuthHeader` | Build `Authorization` header | Test Setup (8.3) |
| `Print-Summary` | Final PASS/FAIL tally | Test Summary (8.6) |
| `Reset-Counters` | Reset between sub-suites | Test Script Procedure (8.2) |

---

## 🚀 Running

```powershell
# Single phase
cd tests\e2e
powershell -ExecutionPolicy Bypass -File .\phase02_public_catalog.ps1

# All phases in sequence
foreach ($p in Get-ChildItem phase*.ps1 | Sort-Object Name) {
    Write-Host "Running $($p.Name)..." -ForegroundColor Cyan
    & powershell -ExecutionPolicy Bypass -File $p.FullName 2>&1 |
        Tee-Object -FilePath "..\reports\$($p.BaseName).log"
    Write-Host ""
}

# Against a non-default base URL
$env:NOUFEX_API_BASE = 'http://10.0.0.5:3000'
powershell -File .\phase02_public_catalog.ps1
```

---

## ⚠️ Pre-conditions

| What | Why | Source of truth |
|------|-----|-----------------|
| API server reachable | The script targets the live endpoint | `docker compose up -d` or `npm run api` |
| DB seeded | Login users exist | `npm run db:setup` |
| `AUTH_SECRET` set | Tokens verify HMAC signature | `.env` ≥ 32 chars |
| Rate limits not exhausted | Avoid 429 from earlier runs | Wait 15 min after a burst |

---

## 📊 Test Reports

Each run writes a `reports/<basename>.log` capturing the full transcript.
Use these to:
- Compare against the **IEEE 829 Test Log** specification
- Audit pass/fail counts over time
- Investigate regressions after a code change

---

## ➕ Adding a New Phase

1. Read [`docs/testing/PHASE_TEST_TASKS.md`](../../docs/testing/PHASE_TEST_TASKS.md) for the spec.
2. Copy `phase02_public_catalog.ps1` as a scaffold.
3. Update the banner, sections, and `Print-Summary` argument.
4. Run locally; commit the script **and** its log.
5. Update the master plan with ✅ status.
