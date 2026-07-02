# ISTQB CTFL — Foundation Level Test Techniques

> **Source:** [ISTQB Certified Tester Foundation Level Syllabus v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level)
> **Adopted by:** Nouf-ex testing program

ISTQB is the de-facto global certification body for software testers.
Its **Foundation Level** syllabus defines the core vocabulary and
techniques used across the industry. Nouf-ex aligns its testing program
with CTFL terminology and structure.

---

## 🧠 CTFL Test Types

| Test Type | What it verifies | Nouf-ex layer |
|-----------|------------------|---------------|
| **Functional** | "Does it do what it should?" | All routes in `tests/e2e/` |
| **Non-functional** | Performance, security, usability | (Out of E2E scope — see separate suites) |
| **Structural (white-box)** | Code paths, branches | `app/tests/`, Vitest unit tests |
| **Change-related** | Regression after a change | `phase17_full_regression.ps1` |

The CTFL distinguishes **levels** of testing:

| Level | Scope | Nouf-ex |
|-------|-------|---------|
| Component (unit) | Single function/class | `app/tests/` + `app/src/**/__tests__/` |
| Integration | Multiple components | `app/server/tests/api-server.test.ts` |
| System | Full system | `tests/e2e/phase*.ps1` ← **THIS folder** |
| Acceptance | User perspective | Manual UAT (out of automation scope) |

---

## 📐 CTFL Test Design Techniques

### 1. Specification-Based (Black-Box)

| Technique | Used for | Example |
|-----------|----------|---------|
| **Equivalence Partitioning** | Inputs grouped by behaviour | `email` field — valid format / invalid format / empty |
| **Boundary Value Analysis** | Edges of valid ranges | `quantity=0`, `quantity=1`, `quantity=100` |
| **Decision Table Testing** | Combinations of conditions | Login: (valid email × valid pw × 2FA enabled × TOTP code) |
| **State Transition Testing** | State machines | Order lifecycle: `pending → confirmed → processing → shipped → delivered` |
| **Use Case Testing** | Business workflows | Browse → Cart → Coupon → Order → Payment → Review |

### 2. Structure-Based (White-Box)

| Technique | Used for |
|-----------|----------|
| Statement coverage | Each line executed at least once |
| Branch coverage | Each decision branch taken both ways |
| Path coverage | Each independent path traversed |

> Implemented inside Vitest unit tests, not the E2E scripts.

### 3. Experience-Based

| Technique | Used for |
|-----------|----------|
| Error guessing | "What could the developer have missed?" |
| Exploratory testing | Sessions without pre-defined cases |
| Checklist-based | Pre-defined list of risk categories |

---

## 🎯 CTFL Test Process (in our MTP)

CTFL defines 5 main activities; we apply them per-PHASE:

| Activity | Output | Nouf-ex artifact |
|----------|--------|------------------|
| 1. Planning | Test plan | `PHASE_TEST_TASKS.md` |
| 2. Monitoring & Control | Status reports | `reports/*.log`, `Print-Summary` |
| 3. Analysis | Test conditions | `docs/testing/phases/PHASE_NN_*.md` |
| 4. Design | Test cases | `Assert-Status` calls in scripts |
| 5. Implementation | Test procedures | PowerShell orchestration |
| 6. Execution | Test logs | `tests/reports/phase*.log` |
| 7. Completion | Test summary | `Print-Summary` final block |

---

## 📊 CTFL Metrics Applied

| Metric | Formula | Used in |
|--------|---------|---------|
| **Test coverage** | (covered requirements) / (total requirements) | All PHASES |
| **Defect density** | defects / KLOC | Tracked in GitHub Issues |
| **Test effectiveness** | (defects found by tests) / (total defects) | Regression |
| **Pass rate** | PASS / (PASS + FAIL) | `Print-Summary` |

---

## 🌐 CTFL Vocabulary Mapping

| CTFL term | Nouf-ex term |
|-----------|--------------|
| Test Condition | A behavior to verify (e.g., "valid login") |
| Test Case | A specific scenario + inputs + expected output |
| Test Procedure | The script that runs the test case |
| Test Log | The captured stdout of execution |
| Test Suite | A collection of related test cases (`phase*.ps1`) |
| Test Plan | The master MTP document |
| Defect / Bug | A discrepancy logged in GitHub Issues |

---

## 🔗 References

- ISTQB CTFL Syllabus v4.0 (2023 release)
- ISTQB Glossary v4.0
- "Foundations of Software Testing" — ISTQB-aligned textbooks
- Black, R. — _Managing the Testing Process_ (3rd ed.)
