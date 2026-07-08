# Nouf-ex Testing Conventions

> **Reference:** [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [ISTQB CTFL](https://www.istqb.org/) · [Google Testing Blog](https://testing.googleblog.com/)
> **Audience:** Everyone writing, running, or reviewing tests for the Nouf-ex platform.

---

## 📁 Directory Layout

```
tests/
├── README.md                       ← Testing hub
├── e2e/                            ← End-to-end PowerShell tests
│   ├── helpers/
│   │   └── PS_TestHelpers.ps1
│   ├── phaseNN_<topic>.ps1
│   └── phaseNN_<topic>_retest.ps1
├── reports/                        ← Auto-generated logs
└── fixtures/                       ← Static test data

app/
├── tests/                          ← Vitest integration tests
└── src/**/__tests__/              ← Vitest component tests
```

---

## 📝 Naming Rules

| Artifact | Convention | Example |
|----------|------------|---------|
| E2E phase script | `phase<NN>_<topic>.ps1` | `phase02_public_catalog.ps1` |
| Re-test of a phase | `phase<NN>_<topic>_retest.ps1` | `phase01_profile_addresses_retest.ps1` |
| E2E log | `<basename>.log` | `phase02_public_catalog.log` |
| Unit test | `<module>.test.ts(x)` | `useApi.test.ts` |
| Fixture | `<context>.json` | `products.json` |
| Helper module | `PS_TestHelpers.ps1` | (one file) |

---

## 🔤 Style Rules

1. **Each `phase*.ps1`** must include:
   - Header comment with phase number, topic, source spec
   - `. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"`
   - `Write-Host '===== N. Sub-topic ====='` between sections
   - `Print-Summary 'Phase N — Topic'` at the end

2. **Each test case** uses:
   - `Assert-Status $Label $Result $Expected` for HTTP status
   - `Assert-JsonField $Label $Result 'data.id' -NotNull` for body shape
   - One assertion per observable

3. **No raw `Invoke-WebRequest` outside helpers.** Use `Invoke-ApiRequest`
   to keep envelope handling consistent.

4. **No magic strings.** Token + IDs extracted via `Assert-JsonField`
   then passed into subsequent calls.

---

## 🧬 Test Taxonomy (per ISTQB Test Pyramid)

```
                  ╱  ╲
                 ╱ E2E╲          tests/e2e/
                ╱ tests╲         — full system
               ╱────────╲
              ╱  Integ  ╲       app/server/tests/
             ╱   tests   ╲      — supertest + mocked pg
            ╱──────────────╲
           ╱    Unit tests  ╲   app/mocks/, app/src/**/__tests__/
          ╱   (Vitest + RTL) ╲  — components, hooks, pure fns
         ╱────────────────────╲
```

| Level | Tooling | Mocking | Runtime | Where |
|-------|---------|---------|---------|-------|
| Unit | Vitest + Testing Library | Heavy (no DB) | < 1 ms/test | `app/mocks/` |
| Integration | Vitest + supertest | Partial (mocked `pg`) | < 50 ms/test | `app/server/tests/` |
| System (E2E) | PowerShell + Invoke-WebRequest | None (real DB) | ~5 s/test | `tests/e2e/` |

---

## 🛠️ Authoring Checklist

Before opening a PR with a new phase script:

- [ ] Banner includes: phase number, source spec, file count
- [ ] Each section grouped under `===== N. Topic =====`
- [ ] At least one positive + one negative assertion per endpoint
- [ ] No hard-coded URLs — uses `$script:ApiBaseUrl`
- [ ] No `console.log` left in (use `Write-Host` with `-ForegroundColor`)
- [ ] Log file generated via `Tee-Object` at run time
- [ ] Status of the phase updated in `PHASE_TEST_TASKS.md` ✅

---

## 🚦 CI Integration

- **Lint:** `pwsh -c "$tokens = Get-TestTokens"` smoke import
- **Unit + Integration:** `npm test` (Vitest)
- **E2E:** runs against a temporary container in CI's `server-boot` job
  (see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml))
- **Reports:** uploaded as workflow artifacts

---

## 🔒 Security Considerations

- Tests use **scenarios**, not real PII.
- The seeded users (`ahmed@gmail.com`, `fatima@…`, `admin@noufex.com`)
  exist solely for testing.
- Tokens captured by `Get-TestTokens` are **never persisted** outside
  the script's process lifetime.

---

## 📚 See Also

- [`PHASE_TEST_TASKS.md`](PHASE_TEST_TASKS.md) — Master Test Plan
- [`standards/IEEE-829.md`](standards/IEEE-829.md)
- [`standards/ISO-29119.md`](standards/ISO-29119.md)
- [`standards/ISTQB-CTFL.md`](standards/ISTQB-CTFL.md)
- [`../../tests/README.md`](../../tests/README.md)
- [`../../tests/e2e/README.md`](../../tests/e2e/README.md)
