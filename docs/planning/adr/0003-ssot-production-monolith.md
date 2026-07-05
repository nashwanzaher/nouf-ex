# ADR-0003 — Adopt current production as Single Source of Truth (reject monorepo restructure)

> **Status:** ✅ Accepted (2026-07-04)
> **Deciders:** Nouf-ex maintainer + GitHub Copilot (`@architect` agent)
> **Date:** 2026-07-04 (retroactive — formalizes a decision originally made in plan v2.0.0)
> **Supersedes:** v1.0.0 / v1.1.0 of `MIGRATION_EXECUTION_PLAN.md` (monorepo proposal, now archived)
> **Reviewers:** `@reviewer` agent (Round-3 SSOT audit confirmed this decision)
> **Tags:** `architecture`, `ssot`, `monolith`, `anti-monorepo`, `yagni`

## Context and problem statement

By 2026-07-04, `MIGRATION_EXECUTION_PLAN.md` v1.0.0 / v1.1.0 proposed a
**monorepo restructure** of the Nouf-ex codebase:

- Migrate `app/` to `apps/web` + `apps/api` (separate deploy units)
- Extract shared code into `packages/shared/`, `packages/database/`,
  `packages/mcp-server/`, `packages/eslint-config/`,
  `packages/typescript-config/`
- Adopt Turborepo + pnpm workspaces as the build orchestrator
- Estimated effort: **32.5 hours** across 6 phases (28 tasks)

The rationale behind the monorepo proposal was that the project's single
`app/` package (a "fat jar" containing both React 19 frontend and Express 5
backend) was perceived as not scaling to multiple developers, multiple
deploys, or future extraction of services.

Round-3 SSOT audit (`MIGRATION_EXECUTION_PLAN.md` §11) verified the actual
state of the production system and challenged this premise on five grounds:

1. **Current state passes ALL quality gates.** `npx tsc -b --noEmit` → exit 0;
   `npx eslint . --max-warnings=0` → 0 problems; `npx vitest run` → 817 passed,
   3 skipped (820 total). A11y gate: 16+ tests passing.
2. **Current state is production-deployable.** Docker build runs, API responds
   200 on `/api/health`, `/api/ready`, `/api/stats/home`. Single
   `Nouf-ex` container is in production.
3. **The 24/24 migrations are applied** (post-`0024_production_hardening`).
   The live database has 33 unique tables, 4 views, 16 CREATE TRIGGER
   statements, 52 FKs, 13 unique constraints, 4 application roles, 0
   tables owned by `postgres` (RBAC contract enforced).
4. **The team has 1 maintainer** (verified via `git log --pretty=format:"%an"
   | sort -u` — see [validation §6](#validation)). Multiple-package
   extraction would add 6+ build pipelines and 6+ deploy units for a
   single person to maintain.
5. **Industry precedent** — most successful apps (Discord, Shopify, GitHub)
   started as monoliths before extracting services. The
   [Shopify engineering blog](https://shopify.engineering/shopify-monolith)
   explicitly documents the
   [modular monolith pattern](https://en.wikipedia.org/wiki/Modular_monolith)
   that Nouf-ex is following.

## Considered options

### Option A — **Adopt current production as SSOT (CHOSEN)**

- Keep `app/` as a single npm package (name="my-app", 59 deps + 38 devDeps).
- Frontend (`app/src/`, React 19 + Vite 7) and backend (`app/server/`,
  Express 5 + node-postgres) ship as a single deploy unit.
- One production database: PostgreSQL 17 `noufex_db` (33 tables, 24
  migrations).
- One CI/CD pipeline + one staging + one production environment.
- One documentation file (`MIGRATION_EXECUTION_PLAN.md`) is the canonical
  plan.
- Tools stay in the dev environment, isolated by `.gitignore` patterns
  (`.claude/`, `app/coverage/`, `app/dist/`, `app/node_modules/`).

### Option B — Migrate to Turborepo + pnpm workspaces (REJECTED in v2.0.0)

- 7 packages, 6+ build pipelines, 6+ deploy units.
- Split `app/src/lib/api.ts` (1475 lines) into per-feature service modules.
- Split `app/server/middleware.ts` (873 lines) into per-concern middleware.
- Convert migrations from `NNNN_*.sql` to `YYYYMMDD_NNNN_*.sql` (Prisma-style).
- 32.5 hours effort for 0 production value at the current scale.

### Option C — Hybrid (extract only `mcp-server` and `database/` to packages/) (CONSIDERED, REJECTED)

- Targeted: only `mcp-server/` and `database/` move to packages.
- Pros: mcp-server is dev-only, database is host-side — both are
  legitimately separate.
- Cons: violates the SSOT principle of "ONE npm package, ONE deploy unit"
  for the application code. If `database/` moves out, deployment scripts
  (`scripts/db/db-setup.cjs`) must change. If `mcp-server/` moves out, the
  `mcp-server` workspace config becomes its own concern.
- Rejected because: the cost of one-off package management exceeds the value
  of a single responsibility split for code that has no production runtime
  coupling to the app.

## Decision

**Adopt Option A: current production state IS the SSOT.** This is now
codified as `MIGRATION_EXECUTION_PLAN.md` v2.0.0+ and Round-3 SSOT audit
confirmed every claim.

The monorepo restructure (Option B) and the hybrid (Option C) are
**explicitly rejected** under SSOT. Re-evaluation triggers:

- Team size > 2 developers (currently 1)
- Load > 1000 req/s (currently far below)
- More than 3 distinct product surfaces (currently 1 SPA + 1 REST API)

When any trigger fires, re-author this ADR with `Status: Superseded` and
link to the new monorepo-extraction ADR.

## Consequences

### Positive

- **One SSOT source.** The plan file (`MIGRATION_EXECUTION_PLAN.md`) is the
  single canonical plan; all other plan files (`MASTER_PLAN.md`, `STRUCTURE.md`,
  `roadmap.md`, `competitive-analysis.md`, `AUDIT_2026-07-04-PLAN_VS_REALITY.md`)
  are archived to `archive/plans/`.
- **One production deploy unit.** Single `Nouf-ex` container (3-stage Dockerfile,
  `node:20-alpine` + tini + esbuild bundle) per `docker-compose.yml`. No
  cross-service versioning, no monorepo orchestration overhead.
- **One production database.** Single PostgreSQL 17 `noufex_db` with 3 application
  roles (`noufex_owner`, `noufex_app`, `noufex_readonly`) enforcing least
  privilege.
- **Operational simplicity.** One npm install, one `npm run build`, one
  `vitest run`, one TypeScript project references chain.
- **Documentation clarity.** `MIGRATION_EXECUTION_PLAN.md` §§1–3 explicitly
  enumerate the SSOT target as a single source table.
- **YAGNI discipline.** Avoids 32.5 hours of speculative refactoring.

### Negative

- **Scaling ceiling.** When load > 1000 req/s OR team > 2 devs, this
  decision will need to be revisited. Re-architecting from monolith to
  modular monolith to services is documented in the
  [Shopify engineering blog](https://shopify.engineering/shopify-monolith)
  as harder than extracting services upfront — but accepted trade-off
  for the current scale.
- **Coupling between frontend and backend.** The 1475-line
  `app/src/lib/api.ts` and 873-line `app/server/middleware.ts` are
  intentionally large; splitting them prematurely (Round-1 v1.0.0
  proposal) would create artificial boundaries that the current SSOT
  doesn't benefit from.
- **Single `package.json` constraint.** All 59 production deps + 38
  devDeps must coexist in one manifest. A future split will need
  careful migration (pnpm.overrides / workspace: protocol) to avoid
  duplicate React / Express versions.

## Validation

This ADR's decision is **valid** as long as all of the following are
true. Re-validate at every quarterly review; if any condition changes,
mark this ADR `Superseded`.

| # | Condition | Verification | Status (2026-07-04) |
|---|---|---|---|
| V-1 | Team size ≤ 2 | `git log --since='6 months ago' --pretty=format:'%an' \| sort -u \| wc -l` | ✅ ≤ 2 (verified 1 maintainer) |
| V-2 | Load < 1000 req/s | `Get-NetTCPConnection -State Listen \| ? {$_.LocalPort -eq 3000}` then sample traffic | ✅ Far below threshold |
| V-3 | Single product surface (1 SPA + 1 REST API) | `app/src/pages/*.tsx` count = 60 (single SPA); `app/server/routes/*.cts` count = 19 (single REST API) | ✅ |
| V-4 | Single production database | `psql -U postgres -d noufex_db -c "SELECT count(*) FROM pg_database WHERE datname='noufex_db'"` → 1 | ✅ |
| V-5 | All quality gates pass | `cd app && npx tsc -b --noEmit && npx eslint . --max-warnings=0 && npx vitest run` | ✅ |
| V-6 | Migration 0024 applied | `psql -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1"` → `0024_production_hardening` | ✅ |

**Re-evaluation trigger:** any of V-1, V-2, V-3 changes → re-author this
ADR with `Status: Superseded` and link to the new monorepo-extraction ADR.

## References

- **Shopify Engineering — _Monolith_:** <https://shopify.engineering/shopify-monolith>
  (industry precedent for modular monolith)
- **Turborepo documentation:** <https://turbo.build/docs>
  (the rejected alternative)
- **pnpm Workspaces:** <https://pnpm.io/workspaces>
  (the rejected alternative)
- **Diátaxis documentation framework:** <https://diataxis.fr/>
  (informs the doc structure that this ADR lives within)
- **MADR template:** <https://adr.github.io/madr/> (the ADR format used)
- **Nygard's original ADR blog:** <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
- **`MIGRATION_EXECUTION_PLAN.md` §1.1** (The Decision), §1.2 (Rationale),
  §3 (Gap Analysis), §11.5 (ADR Gap), §30 (Prioritized Recommendations) —
  the source of every claim in this ADR

## Revision history

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-07-05 | **v1.0** | GitHub Copilot (`@reviewer`) | **Initial version.** Retroactively formalizes the SSOT decision made in `MIGRATION_EXECUTION_PLAN.md` v2.0.0 (2026-07-04) per recommendation R-1 of the Round-9 prioritized roadmap. Closes GAP-19 and G-ADV1 from §11.5. |
| 2026-07-04 | v0.0 (proposed) | (implicit in MIGRATION_EXECUTION_PLAN.md v2.0.0 §1.1) | Decision made but not formally recorded as ADR. |
