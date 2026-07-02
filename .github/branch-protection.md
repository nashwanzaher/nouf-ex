# Branch Protection Rules — `main`

> **D.3 in MASTER_PLAN.md** — required status checks for `main`.
> **Last reviewed:** 2026-06-28
> **Standard:** [GitHub — About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

This document is the **canonical reference** for configuring
branch protection on `main`. The settings below can be applied
via the GitHub UI (Settings → Branches → main → Edit) or via the
`gh` CLI (see the snippet at the bottom).

---

## 1. Required status checks

The following checks **must pass** before a PR can be merged into `main`.
The check names are the `name:` field in `.github/workflows/ci.yml` —
they are stable identifiers that the GitHub UI displays as
`ci / <name>`.

### 1.1 Always required (on every PR + push)

| # | Status check | Why required |
|---|--------------|--------------|
| 1 | `ci / Lint` | Catches ESLint errors, `no-unused-vars`, `no-console`, etc. |
| 2 | `ci / Typecheck` | Catches type errors across the API and mcp-server. |
| 3 | `ci / Test` | All 700+ unit tests pass (no DB required; pg is mocked). |
| 4 | `ci / Build` | Vite SPA + esbuild API + mcp-server bundle produce artefacts. |

### 1.2 Required for direct-to-main pushes only

| # | Status check | Why required |
|---|--------------|--------------|
| 5 | `ci / DB Integration` | Schema applies cleanly against `postgres:17`; `noufex_app` role can SELECT. |
| 6 | `ci / Server Boot Smoke` | Real API boots end-to-end and `/api/health`, `/api/ready`, `/api/stats/home` return 200. |

These last two are skipped on PRs (only run on `push` to main or when
the branch name contains `db`, `server`, or `ci`). They run on every
direct-to-main push, so they protect the protected branch.

### 1.3 Optional (recommended for the future)

| # | Status check | Why |
|---|--------------|-----|
| 7 | `ci / Coverage` | The vitest coverage upload — track diffs in coverage.json. |

---

## 2. Apply via `gh` CLI

```sh
# Set up branch protection on main
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=ci / Lint \
  --field required_status_checks[contexts][]=ci / Typecheck \
  --field required_status_checks[contexts][]=ci / Test \
  --field required_status_checks[contexts][]=ci / Build \
  --field required_status_checks[contexts][]=ci / DB Integration \
  --field required_status_checks[contexts][]=ci / Server Boot Smoke \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field required_pull_request_reviews[dismiss_stale_reviews]=true \
  --field enforce_admins=true \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

## 3. Apply via the GitHub UI

1. Navigate to **Settings → Branches**.
2. Click **Add rule** (or edit the existing `main` rule).
3. Branch name pattern: `main`.
4. Enable these options:

   - [x] Require a pull request before merging
     - [x] Require approvals: **1**
     - [x] Dismiss stale pull request approvals when new commits are pushed
     - [x] Require linear history (no merge commits)
   - [x] Require status checks to pass before merging
     - [x] Require branches to be up to date before merging
     - Search and add these required checks (use the search box):
       - `ci / Lint`
       - `ci / Typecheck`
       - `ci / Test`
       - `ci / Build`
       - `ci / DB Integration`
       - `ci / Server Boot Smoke`
   - [x] Do not allow forcing the specific class of pushes
   - [x] Do not allow deletions
5. Click **Create** (or **Save changes**).

## 4. Recommended (but not required)

- [x] Require conversation resolution before merging
- [x] Require signed commits (if signed-off is enforced)
- [x] Require linear history (already enabled above)
- [x] Include administrators (enforce_admins — already enabled above)

## 5. Verifying

```sh
# Confirm the rules are in place
gh api repos/:owner/:repo/branches/main/protection | jq

# Try to push a commit directly to main (should fail)
git push origin main
# → "remote: error: GH006: Protected branch update failed for refs/heads/main."

# Or open a PR that has failing tests
gh pr create --base main --head test/fail --title "test"
# → the PR will show red checks for Lint / Typecheck / Test
```

---

## References

- [.github/workflows/ci.yml](../../workflows/ci.yml) — the pipeline that produces the status names
- [ci-cd.md](../../development/ci-cd.md) §5 — the canonical status check table
- [SECRETS.md](../../SECRETS.md) — secrets management (D.2)
- [dependabot.yml](../../dependabot.yml) — automated dependency updates (D.2)
