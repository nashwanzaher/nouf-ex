# Production Deployment Process

> **Scope:** Companion document to [`.github/workflows/deploy-prod.yml`](../../.github/workflows/deploy-prod.yml). The YAML file is the runnable workflow; this file explains the **process**, **rollback procedure**, and **post-deploy checklist** in human-readable form.
>
> **D.5 in MASTER_PLAN.md** — manual approval workflow for production.
> **Standard:** [GitHub Actions — Using environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) · [GitHub — Deployment protection rules](https://docs.github.com/en/deployment/protecting-deployments/configuring-and-managing-deployments/configuring-deployment-protection-rules)

This document is the **canonical reference** for promoting builds
from staging to production. The process is **deliberately slower**
than staging — every production deploy must have a human
reviewer approve it.

---

## 1. Overview

```
Push to main
  │
  ▼  (auto)
ci.yml runs
  │ Lint + Typecheck + Test + Build (in parallel with PR)
  │ DB Integration + Server Boot (push to main only)
  │
  ▼  (auto, on push to main)
deploy-staging.yml
  │ Build artefacts → SCP to staging → restart → smoke
  │
  ▼  (auto, when version tag is pushed)
deploy-prod.yml (workflow_dispatch)
  │ Validate semver tag → run smoke against staging
  │ ▒▒▒ MANUAL APPROVAL ▒▒▒  (2 reviewers required)
  ▼  (auto, on approval)
Deploy to production → restart → smoke
```

---

## 2. How to trigger a production deploy

There are two methods. The version-tag method is the preferred one
because it is immutable and audit-friendly.

### 2.1 Method A — version tag (preferred)

```sh
# 1. Update version in CHANGELOG.md + package.json files.
# 2. Commit the version bump.
git add CHANGELOG.md app/package.json mcp-server/package.json
git commit -m "chore(release): v0.2.0"

# 3. Tag the commit. The tag MUST be a semver.
git tag -a v0.2.0 -m "v0.2.0 — see CHANGELOG.md"

# 4. Push the tag.
git push origin main --tags

# 5. The deploy-prod.yml workflow triggers. Open the run in
#    GitHub Actions, find the "production" environment's pending
#    approval, and click "Approve".
gh run list --workflow=deploy-prod.yml
gh run view <run-id> --web   # opens the approval page
```

### 2.2 Method B — manual dispatch (fallback)

```sh
# 1. Open GitHub → Actions → Deploy to Production.
# 2. Click "Run workflow", select the branch (main), and provide
#    a reason in the input field.
# 3. Same manual approval process as Method A.
```

---

## 3. Configuring the `production` environment

In **Settings → Environments → production → Configure**, set up:

| Setting | Value | Why |
|---------|-------|-----|
| **Required reviewers** | 2 specific users (or 1 user + 1 team) | Two-person rule for production. |
| **Wait timer** | 5 minutes | A 5-minute cool-off period before the deploy can start (after approval). Lets the approver cancel if they change their mind. |
| **Deployment branches** | `main` only (and `v*` tags) | Restrict production to verified branches. |
| **Environment secrets** | `PROD_SSH_KEY`, `PROD_HOST`, `PROD_USER`, `PROD_URL`, `AUTH_SECRET_PROD`, `DB_PASSWORD_PROD`, `DATABASE_URL_PROD` | Production-only secrets; never visible to PRs. |
| **Environment variables** | `NODE_ENV=production`, `API_PORT=3000`, `ALLOWED_ORIGINS` | Per-environment config. |

### 3.1 `gh` CLI to create the environment

```sh
# One-time setup
gh api repos/:owner/:repo/environments/production \
  --method PUT \
  --field wait_timer=5 \
  --field prevent_self_review=false \
  --field reviewers[]=alice \
  --field reviewers[]=bob \
  --field deployment_branch_policy[protected_branches]=true \
  --field deployment_branch_policy[custom_branch_policies]=true
```

---

## 5. Rollback

If a production deploy goes bad:

1. Open **Settings → Environments → production → Deployments**.
2. Find the most recent successful deploy, click **Revert** (or
   `gh api` `POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun`).
3. The production stack restarts with the previous build artefacts.

OR, for a manual rollback to a known-good version:

```sh
# 1. Re-tag the previous good commit.
git checkout v0.1.0
git tag -a v0.1.1 -m "Rollback to v0.1.0 baseline"
git push origin v0.1.1

# 2. The deploy-prod.yml workflow will trigger. Review + approve.
# 3. The stack gets the v0.1.0 artefacts again.
```

---

## 6. Post-deploy checklist

After a successful production deploy, within 30 minutes:

- [ ] Health endpoint returns 200 (`/api/health`).
- [ ] Readiness endpoint returns 200 with `checks.db.ok=true` (`/api/ready`).
- [ ] PHASE 0 E2E spec passes (22 assertions: login + bad creds + register).
- [ ] PHASE 16 spec passes (21 assertions: SPA + CSP + headers).
- [ ] nginx logs show no 5xx errors.
- [ ] API logs (stdout) show no `unhandled_error` events.
- [ ] Postgres connection pool is healthy (`SELECT count(*) FROM pg_stat_activity`).
- [ ] Docker container is `Up (healthy)`.
- [ ] `auth/login` rate-limiter is NOT exhausted.
- [ ] `admin/audit-log` has a fresh entry for the deployer's action.
- [ ] Write a dated entry in `docs/audit/deploy-<version>-<date>.md` describing
      the deploy, including reviewer names.

---

## References

- [.github/workflows/deploy-staging.yml](../../.github/workflows/deploy-staging.yml) — staging auto-deploy (D.4)
- [.github/workflows/deploy-prod.yml](../../.github/workflows/deploy-prod.yml) — this file's workflow YAML
- [.github/branch-protection.md](../../.github/branch-protection.md) — required status checks (D.3)
- [deployment.md](../../docs/development/operations/deployment.md) — production deploy guide
- [SECRETS.md](../../.github/SECRETS.md) — secrets management (D.2)
- [monitoring.md](../../docs/development/operations/monitoring.md) — observability + runbooks
- [rollback procedure](../../docs/development/operations/deployment.md#12-rollback-procedure)