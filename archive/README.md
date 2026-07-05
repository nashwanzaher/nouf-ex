# Archive Index

> **Last updated:** 2026-07-05 (per MIGRATION_EXECUTION_PLAN.md v2.7.6 §36 R-8 execution).
> **Source-of-truth:** MIGRATION_EXECUTION_PLAN.md v2.7.5 §26.1 + §26.2 (Round-7 SSOT audit verified counts).
> **Total files in archive:** 60 files across 6 sub-folders.
> **Convention:** the entire `archive/` folder is gitignored (per `archive/` patterns). Nothing in this directory is tracked in git.

This file exists per MIGRATION_EXECUTION_PLAN.md v2.7.5 §30.4 Sprint 1 (R-8) to give future contributors a navigable index of the historical artifacts.

> **Important:** the `archive/` folder is **NOT part of the project's SSOT (Single Source of Truth)**. It exists for historical reference only. The SSOT for Nouf-ex is `MIGRATION_EXECUTION_PLAN.md` and the files under `app/`, `database/`, `mcp-server/`, `scripts/`, `docs/`, and `mcp-server/`. Anything in `archive/` is informational and may be removed without notice.

## Sub-folder index

| # | Sub-folder | Files | Last touched | Purpose |
|---|---|---:|---|---|
| 1 | [`audit/`](audit/) | 12 (11 .md + 1 deprecated .json) | 2026-06-24 | Historical code/docs review reports from pre-production phase (2026-06-21 → 2026-07-02) |
| 2 | [`audits-final-2026-07-04/`](audits-final-2026-07-04/) | 4 (.md) | 2026-07-04 | Final audit reports (technical, real, production-hardening, audit) from Round-2 audit session |
| 3 | [`plans/`](plans/) | 5 (.md) | 2026-07-04 | Superseded plan files: MASTER_PLAN.md, STRUCTURE.md, roadmap.md, competitive-analysis.md, AUDIT_2026-07-04-PLAN_VS_REALITY.md |
| 4 | [`research/`](research/) | 11 (.md) | 2026-06-28 | Alibaba/Taobao competitive research (8 wide-* files) + 3 design studies (plan, plan-fixes, design-study-alibaba) |
| 5 | [`scripts-2026-07-fixes/`](scripts-2026-07-fixes/) | 27 (.py, .ps1, .bat, .js) | 2026-07-04 | One-time fix scripts (markdownlint, settings dedup, code analysis) — all archived after use |
| 6 | [`testing/`](testing/) | 1 (.md) | 2026-06-28 | Historical test artifacts (PHASE_01_PROFILE_ADDRESSES_RETEST.md) |

**Total:** 60 files.

## Sub-folder details

### 1. `audit/` (12 files)

Historical pre-production reviews. **All resolved** (replaced by [`docs/audits-final-2026-07-04/`](../docs/audits-final-2026-07-04/) in earlier rounds, which itself was archived to [`audits-final-2026-07-04/`](audits-final-2026-07-04/) — see #2 below).

| File | Date | Purpose |
|---|---|---|
| `code-audit-2026-06-21.md` | 2026-06-21 | First code review pass |
| `code-review-fixes-2026-06-23.md` | 2026-06-23 | Code review fixes summary |
| `doc-audit-2026-07-02.md` | 2026-07-02 | Documentation audit |
| `extensions.md` | 2026-06-22 | VSCode extensions review |
| `ops-verification-2026-06-24.md` | 2026-06-24 | Operations verification v1 |
| `ops-verification-2026-06-24-v2.md` | 2026-06-24 | Operations verification v2 (corrected) |
| `review-code.md` | 2026-06-25 | Code review |
| `review-database.md` | 2026-06-25 | Database review |
| `review-features.md` | 2026-06-25 | Features review |
| `review-market.md` | 2026-06-25 | Market analysis review |
| `review-ux.md` | 2026-06-25 | UX review |
| `verify-from-scratch-2026-06-23.md` | 2026-06-23 | End-to-end verification |
| `.markdownlint.json.deprecated` | 2026-06-25 | Deprecated config (gitignored) |

### 2. `audits-final-2026-07-04/` (4 files)

Final audit reports from the Round-2 session (2026-07-04). These were originally at `docs/audits/` (the "live" audit location) but were moved to archive per R2.1 of MIGRATION_EXECUTION_PLAN.md v2.6.0.

| File | Size | Purpose |
|---|---|---|
| `AUDIT_REPORT_2026-07-04.md` | 26,602 b | Comprehensive code audit |
| `PRODUCTION_HARDENING_REPORT.md` | 16,018 b | Production hardening verification |
| `REAL_AUDIT_2026-07-04.md` | 27,051 b | Real source-code audit |
| `TECHNICAL_REPORT.md` | 38,772 b | Technical analysis |

### 3. `plans/` (5 files)

Superseded plan files. **All decisions in these files have been consolidated into** [`MIGRATION_EXECUTION_PLAN.md`](../docs/planning/MIGRATION_EXECUTION_PLAN.md) **v2.7.5+** as the single canonical plan.

| File | Size | Superseded by |
|---|---|---|
| `AUDIT_2026-07-04-PLAN_VS_REALITY.md` | 18,073 b | MIGRATION_EXECUTION_PLAN.md §30 (Prioritized Recommendations) |
| `MASTER_PLAN.md` | 174,288 b | MIGRATION_EXECUTION_PLAN.md v2.0.0+ (SSOT decision per ADR-0003) |
| `STRUCTURE.md` | 23,441 b | To be re-authored per R-10 (Round-9 roadmap) |
| `competitive-analysis.md` | 39,997 b | MIGRATION_EXECUTION_PLAN.md §1.2 (Verified Tech Stack) |
| `roadmap.md` | 24,409 b | MIGRATION_EXECUTION_PLAN.md §30.4 (Implementation Roadmap) |

### 4. `research/` (11 files)

Competitive research and design studies. **All pre-production research** (2026-06-28) — referenced by the active product strategy in MIGRATION_EXECUTION_PLAN.md §1.

| File | Date | Topic |
|---|---|---|
| `wide-01-alibaba-b2b.md` | 2026-06-28 | Alibaba B2B platform research |
| `wide-02-taobao.md` | 2026-06-28 | Taobao marketplace research |
| `wide-03-market.md` | 2026-06-28 | Yemen/MENA market analysis |
| `wide-04-features.md` | 2026-06-28 | Feature gap analysis |
| `wide-05-pricing.md` | 2026-06-28 | Pricing strategy |
| `wide-06-trust.md` | 2026-06-28 | Trust & safety mechanisms |
| `wide-07-tech.md` | 2026-06-28 | Tech stack comparison |
| `wide-08-roadmap.md` | 2026-06-28 | Product roadmap |
| `plan.md` | 2026-06-28 | Original product plan (iter 1) |
| `plan-fixes.md` | 2026-06-28 | Plan fixes (iter 2) |
| `design-study-alibaba.md` | 2026-06-28 | Deep dive: Alibaba architecture |

### 5. `scripts-2026-07-fixes/` (27 files)

**One-time fix scripts** that were executed during the July 2026 audit and restructuring session. **All have been applied**; do not re-run. They are kept for reference (and potential undo).

| Type | Count | Examples |
|---|---:|---|
| `.py` (Python) | ~10 | `fix-orphan-braces.py`, `fix-importspec.py`, `fix-duplicate-settings.py`, `fix-copilot-instructions.py`, `fix-and-validate.py`, `fix-all-markdown.py`, `fix-all-issues.py`, `find-duplicate-settings.py`, `verify-settings.py`, `verify-no-dupes.py`, `verify-all.js`, `add-auto-switch-config.py`, `top-error-files.py`, `safe-enhance.py`, `deep-review.py`, `run-check.js`, `full-restore.py` |
| `.ps1` (PowerShell) | 5 | `fix-duplicate-headings.ps1`, `find-duplicate-headings.ps1`, `analyze-settings-duplicates.ps1`, `analyze-markdownlint.ps1`, `deduplicate-settings.ps1` |
| `.bat` (Windows batch) | 1 | `build-api.bat` |
| `.js` (JavaScript) | ~4 | `validate-jsonc.js`, `run-check.js`, `verify-all.js`, `full-restore.py` (note: .py file with .js name) |
| `README.md` | 1 | Original README for the fix-scripts sub-folder |

> **Note:** the exact .py/.js/.ps1/.bat split can be verified via `Get-ChildItem -File | Group-Object Extension`. Total = 27.

### 6. `testing/` (1 file)

Historical test artifacts from pre-production testing. **All are pre-`vitest`; superseded by active test suite** in `app/server/tests/`, `app/src/__tests__/`, `app/tests/`, `app/src/components/__tests__/`, `app/src/pages/__tests__/`, `app/src/lib/__tests__/`, `app/src/hooks/__tests__/`, `app/src/context/__tests__/`.

| File | Date | Purpose |
|---|---|---|
| `PHASE_01_PROFILE_ADDRESSES_RETEST.md` | 2026-06-28 | Phase 01 retest results (pre-`vitest` docs) |

## How to navigate this folder

1. **Looking for audit reports?** → `audits-final-2026-07-04/` (the 4 most recent) or `audit/` (the 12 older).
2. **Looking for superseded plans?** → `plans/` (5 files, all consolidated into the active MIGRATION_EXECUTION_PLAN.md).
3. **Looking for competitive research?** → `research/` (11 files).
4. **Looking for fix-scripts?** → `scripts-2026-07-fixes/` (27 files, all already applied).
5. **Looking for old test artifacts?** → `testing/` (1 file).

## How to add to this index

When adding a new file to `archive/`:

1. Place the file in the appropriate sub-folder (or create a new sub-folder if none fits).
2. Update the relevant section in **both** this README **and** in
   [`MIGRATION_EXECUTION_PLAN.md`](../docs/planning/MIGRATION_EXECUTION_PLAN.md) §13.5 or §26.1
   (whichever is current).
3. Increment the file count in the sub-folder table above.

## References

- **MIGRATION_EXECUTION_PLAN.md v2.7.5** (the SSOT plan) — [`docs/planning/MIGRATION_EXECUTION_PLAN.md`](../docs/planning/MIGRATION_EXECUTION_PLAN.md)
- **Diátaxis documentation framework** — <https://diataxis.fr/> (this README follows the
  Reference quadrant: factual reference for an existing artifact)
- **Keep a Changelog 1.1.0** — <https://keepachangelog.com/> (semantic conventions)
- **R-8 in §30.4 Sprint 1** — author of this README (per MIGRATION_EXECUTION_PLAN.md)

## Revision history

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-07-05 | **v1.0** | GitHub Copilot (`@reviewer`) | **Initial version.** Created per MIGRATION_EXECUTION_PLAN.md v2.7.5 R-8 (Sprint 1). Closes GAP-17 (R-8.1: archive structure canonicalization). Provides navigable index of all 60 archived files across 6 sub-folders. |
