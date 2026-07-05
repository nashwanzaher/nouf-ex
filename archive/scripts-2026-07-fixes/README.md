# Archive: scripts-2026-07-fixes

> **Archived:** 2026-07-04
> **Reason:** One-time fix scripts from the `2026-07-02` settings/markdown/scripts cleanup wave. Their work is complete — files cleaned, dedup applied, code fixed — and re-running them on the current tree would either be a no-op or cause regressions.

## What was moved here

These scripts were all written to repair issues from the early July 2026 settings.json / markdown / docs cleanup wave. They have been replaced by the canonical patterns now in `scripts/`:

### JSON / Settings.json cleanup
- `deduplicate-settings.ps1` → replaced by careful manual edits + `scripts/verify-fresh.cjs`
- `fix-duplicate-settings.py` → ditto
- `find-duplicate-settings.py` → ditto
- `check-settings.py` → ditto
- `validate-jsonc.py` → `python -c "import json"` ad-hoc
- `verify-settings.py` → ditto
- `analyze-settings-duplicates.ps1` → ditto
- `add-auto-switch-config.py` → merged into `.vscode/settings.json` directly

### Markdown cleanup
- `find-duplicate-headings.ps1` → replaced by canonical `markdownlint-cli2` rules
- `fix-duplicate-headings.ps1` → ditto
- `fix-all-markdown.py` → ditto
- `analyze-markdownlint.ps1` → ditto
- `fix-copilot-instructions.py` → manual edit done

### Brace / syntax repair
- `fix-orphan-braces.py` → one-time fix
- `fix-and-validate.py` → ditto
- `check-braces.py` → ditto
- `fix-all-issues.py` → ditto
- `fix-importspec.py` → ditto
- `deep-review.py` → ditto
- `safe-enhance.py` → ditto
- `full-restore.py` → ditto
- `run-check.js` → ditto
- `verify-all.js` → ditto
- `verify-no-dupes.py` → ditto
- `top-error-files.py` → ditto

### Build
- `build-api.bat` → replaced by `npm run api:build`

## When to restore from archive

**Don't.** Re-running any of these on the current tree would either:
1. Be a no-op (the issues they fix are already fixed), or
2. Cause regressions (some were intentionally aggressive — e.g. removing duplicate blocks wholesale).

If you discover a similar bug class in the future, port the **algorithm** from these scripts into a fresh, idempotent tool — don't just re-run them.

## Restoration

If you need the raw code for reference (e.g. to understand what was changed):

```powershell
# View history
git log --diff-filter=D --name-only --pretty=format: -- "scripts/*.py" "scripts/*.ps1" "scripts/*.bat"
```

The pre-archive versions are still in git history under their original paths.