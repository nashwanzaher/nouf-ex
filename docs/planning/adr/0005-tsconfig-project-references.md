# ADR-0005 — Use TypeScript Project References (rejects `tsconfig.base.json` pattern)

> **Status:** ✅ Accepted (2026-07-05)
> **Deciders:** Nouf-ex maintainer + GitHub Copilot (`@architect` + `@reviewer` agents)
> **Date:** 2026-07-05 (retroactive — formalizes a structural decision made in original 4-tsconfigs setup)
> **Supersedes:** v2.0.0 plan proposal to add `tsconfig.base.json` (REJECTED in Round-7 GAP-1 reclassification)
> **Reviewers:** `@reviewer` agent (Round-7 SSOT audit confirmed this decision as NEW-9)
> **Tags:** `typescript`, `build-config`, `project-references`, `monorepo-in-package`, `ssot`

## Context and problem statement

The Nouf-ex project has 4 TypeScript configuration files in `app/`:

| File | Purpose | Reference |
|---|---|---|
| `app/tsconfig.json` | Root, uses **Project References** pattern | <https://www.typescriptlang.org/docs/handbook/project-references.html> |
| `app/tsconfig.app.json` | Frontend (React 19 + Vite 7) config | — |
| `app/tsconfig.node.json` | Config files (vite.config.ts, vitest.config.ts) | — |
| `app/tsconfig.server.json` | Backend (Express 5) config | — |

In Round-6 §15, GAP-1 was identified: "`tsconfig.base.json` is missing". The
recommendation was to add a `tsconfig.base.json` that the 4 project configs
would `extends` from, sharing common compiler options (target, module,
strict, etc.).

In Round-7 verification (NEW-9 in §25), this was re-examined and the
recommendation was **reclassified** from 🟡 Medium to 🟢 Low because:

1. The `app/tsconfig.json` already uses the **idiomatic alternative** to
   `extends` — the **Project References** pattern with the `references`
   field. This is documented as the modern TypeScript best practice for
   multi-config projects in the official TypeScript handbook.
2. Adding a `tsconfig.base.json` + `extends` chain would create a parallel
   pattern that duplicates the same purpose.
3. The `extends` pattern was the original TypeScript recommendation pre-3.0
   for sharing compiler options; Project References superseded it for
   multi-config projects.
4. The 4 configs have different `target`, `lib`, `module`, `types`, and
   `moduleResolution` settings — they are NOT meant to be merged.

## Considered options

### Option A — **Keep current Project References pattern (CHOSEN)**

- `app/tsconfig.json` uses:
  ```json
  {
    "files": [],
    "references": [
      { "path": "./tsconfig.app.json" },
      { "path": "./tsconfig.node.json" },
      { "path": "./tsconfig.server.json" }
    ]
  }
  ```
- Each project config (`*.app.json`, `*.node.json`, `*.server.json`) is
  self-contained with its own target, lib, types, etc.
- `npx tsc -b --noEmit` correctly resolves all 3 projects in build order.
- Matches the
  [official TypeScript Project References pattern](https://www.typescriptlang.org/docs/handbook/project-references.html#what-is-a-project-reference)
  for multi-config monorepo-in-package projects.

### Option B — Add `tsconfig.base.json` + `extends` (REJECTED)

- Add `tsconfig.base.json` with shared options (target: ES2022, strict: true, etc.).
- Each of the 4 configs does `"extends": "./tsconfig.base.json"`.
- This is the pre-3.0 idiomatic pattern. Still supported but superseded by
  Project References for multi-config projects.
- **Cons:** duplicates the purpose of `references`; adds one more file
  to maintain; creates two parallel configuration inheritance patterns in
  the same project.

### Option C — Single `tsconfig.json` (REJECTED)

- Collapse all 4 configs into one.
- **Cons:** Would force a single `target`, `lib`, `types` setting for the
  whole project — incompatible with the current architecture where the
  frontend uses DOM types, the backend uses Node types, and the config
  files use neither.

## Decision

**Adopt Option A: keep the current TypeScript Project References pattern
documented in [`app/tsconfig.json`](../../app/tsconfig.json). Do NOT add
`tsconfig.base.json` (Option B rejected) or collapse into a single config
(Option C rejected).**

The decision formalizes the existing structural choice. **No code or
config files are modified** by this ADR.

## Consequences

### Positive

- **Idiomatic TypeScript pattern.** The `references` field is the
  modern recommendation for multi-config projects, fully supported by
  the TypeScript compiler (`tsc -b`) since v3.0.
- **Build orchestration works correctly.** `npx tsc -b --noEmit` correctly
  resolves all 3 referenced projects and reports errors per project
  (verified: exit 0 in Round-3 §11.3).
- **Clear project boundaries.** Each `*.{app,node,server}.json` has
  explicit boundaries — no accidental option bleed between frontend, config,
  and backend.
- **Performance.** `tsc --build` (the `-b` flag) uses incremental
  compilation per project; only changed projects are re-compiled.
- **No new file to maintain.** The pattern is already in place.

### Negative

- **Settings can be duplicated** (e.g., `target` may appear in 2 configs).
  This is minor and intentional: each project's settings are explicit
  and self-documenting.
- **Less idiomatic for some teams** that are more familiar with the
  `extends` pattern. The `references` pattern is more common in monorepos
  and less so in single-package projects — but Nouf-ex is effectively
  monorepo-in-package (frontend + backend + config files in one `app/`).
- **No single source of "what's the project's TS target"** — must look at
  each `*.{app,node,server}.json` separately. Mitigated by
  [`app/tsconfig.json`](../../app/tsconfig.json) being a single 1-page file
  that lists all references.

## Validation

This ADR's decision is **valid** as long as the project structure matches
the description above. Re-validate at every quarterly review.

| # | Condition | Verification | Status (2026-07-05) |
|---|---|---|---|
| V-1 | `app/tsconfig.json` uses `references` field | `Get-Content 'app\tsconfig.json' \| Select-String -Pattern 'references'` → 1 match | ✅ |
| V-2 | 3 referenced project configs exist | `Test-Path 'app\tsconfig.app.json','app\tsconfig.node.json','app\tsconfig.server.json'` → all True | ✅ |
| V-3 | `npx tsc -b --noEmit` passes (exit 0) | `cd app && npx tsc -b --noEmit` → exit 0 | ✅ (verified Round-3 §11.3) |
| V-4 | Build orchestration works | `cd app && npm run build` → OK | ✅ (verified Round-7 §22.3) |
| V-5 | Vitest respects each project's settings | `cd app && npx vitest run` → 817 passed | ✅ (verified Round-7 §22.3) |
| V-6 | No `tsconfig.base.json` exists | `Test-Path 'app\tsconfig.base.json'` → False | ✅ |

**Re-evaluation trigger:** any of the 4 tsconfigs is deleted, or a new
config is added (e.g., for E2E tests). Re-validate then.

## References

- **TypeScript Project References — official docs:**
  <https://www.typescriptlang.org/docs/handbook/project-references.html>
- **TypeScript `tsc -b` (project build mode):**
  <https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript-project-references>
- **MIGRATION_EXECUTION_PLAN.md §15** (GAP-1 original), §25 (NEW-9
  reclassification), §26.1 (final status)
- **MADR template:** <https://adr.github.io/madr/>
- **Nygard's ADR blog:** <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
- **TypeScript Wiki — `tsconfig.json`:**
  <https://www.typescriptlang.org/docs/handbook/tsconfig-json.html>

## Revision history

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-07-05 | **v1.0** | GitHub Copilot (`@reviewer`) | **Initial version.** Retroactively formalizes the Project References pattern decision (originally made when the 4 tsconfigs were created). Closes GAP-22 from §25.6. Reclassifies GAP-1 from 🟡 Medium to 🟢 Low (since the pattern is idiomatic). |
