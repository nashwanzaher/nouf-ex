# Nouf-ex — Project Structure

> **Last verified:** 2026-07-07 (after the deep cleanup pass)
> **Total source-tree size:** ≈ 30 MB (excluding `.git/`, `app/node_modules/`)
> **Source code files:** 654 files (across 9 top-level directories)

---

## Top-level layout

```
nouf-ex/                                  (≈ 30 MB / 654 files, excluding .git)
├── .editorconfig                          # cross-platform formatting
├── .nvmrc / .node-version                  # Node 20.18.0 LTS pin
├── .env.example / .env                    # 12-factor config template + dev secrets
├── .gitattributes                         # linguist overrides
├── .gitignore                             # build-artefact + IDE exclusions
├── .dockerignore                          # build-context minimisation
│
├── .github/                               (≈ 0.5 MB, 54 files)
│   ├── workflows/      ci / docs / link-check / deploy-{staging,prod}
│   ├── agents/         12 Copilot agent definitions
│   ├── skills/         25 Copilot skill definitions
│   ├── prompts/        1 reusable prompt
│   ├── ISSUE_TEMPLATE/ bug / feature request
│   ├── CODEOWNERS, copilot-instructions.md, dependabot.yml, …
│
├── .vscode/                               (≈ 0.04 MB, 5 files)
│   ├── extensions.json, launch.json, mcp.json, settings.json, tasks.json
│
├── .husky/                                (git pre-commit hook)
│
├── CHANGELOG.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md
├── README.md  LICENSE  Dockerfile  docker-compose.yml
│
├── app/                                   (≈ 27 MB, 385 files) — single npm package
│   ├── package.json (name = "@noufex/app", engines.node ≥ 20.18.0)
│   ├── src/      (React 19 + Vite 7 SPA)
│   ├── server/   (Express 5 + pg API)
│   ├── mocks/    (MSW handlers + JSON fixtures + vitest setup)
│   ├── scripts/  (build-time tooling: image pipeline)
│   ├── public/   (static assets — category/product images)
│   ├── *.config.js, tsconfig*.json, eslint.config.js, …
│
├── database/                              (≈ 0.2 MB, 33 files)
│   ├── schema.sql, schema-extra.sql, views.sql, triggers.sql, …
│   ├── migrations/    24 incremental SQL files (0001 → 0024)
│
├── docs/                                  (≈ 2.7 MB, 70 files) — Diátaxis
│   ├── architecture/ development/ operations/ planning/ testing/ tutorials/ workflows/
│   ├── assets/  (homepage-laptop.png, product-page-{ar,en}.png, css/)
│   ├── .markdownlint*  (moved here when config was relocated)
│   ├── README.md  STRUCTURE.md  BUILD.md
│
├── mcp-server/                            (≈ 0.1 MB, 13 files) — separate package
│   ├── package.json (name = "noufex-mcp", private, type: module)
│   ├── src/      6 .ts files (api / code / db / docs / project / index)
│   ├── scripts/  3 smoke tests
│
├── scripts/                               (≈ 0.06 MB, 29 files) — project-level helpers
│   ├── db/        5 .cjs / .ps1 (setup, seed, audit, drop, switch)
│   ├── devops/    7 .bat / .ps1 / .sh (autostart, build, docker, install)
│   ├── quality/   8 .ps1 / .cjs (lint, format, test, typecheck, verify)
│   ├── maintenance/  9 .cjs / .ps1 (scan-unused, rename-cts, e2e-step1, …)
│
├── tests/                                 (≈ 0.3 MB, 45 files) — E2E hub
│   ├── e2e/         18 phase*.ps1 + helpers + 16 smoke/*.ps1
│   ├── reports/     1 phase17 regression summary
│
├── mkdocs.yml                              # docs site config
├── requirements-docs.txt                   # mkdocs Python deps
├── release-please-config.json             # release-please automation
│
└── .git/                                  (≈ 6 MB, internal git objects)
```

---

## What was deleted in the 2026-07-07 cleanup

| Path | Size | What it was |
|------|------|-------------|
| `app/node_modules/`     | 272 MB | 32 520 npm-dependency files. Re-installed by `npm install` |
| `app/dist/`             |  27 MB | Vite production build. Re-built by `npm run build` |
| `app/coverage/`         |   3 MB | Vitest coverage HTML/JSON. Re-built by `npm run test:coverage` |
| `app/.vscode/tasks.json`| 0.6 KB | Duplicate of root `.vscode/tasks.json` |
| `app/.markdownlintignore`| 0.3 KB | Legacy from before the config moved to `docs/` |
| `app/logs/`             |  22 KB | Stale PowerShell output captures |
| `app/.env`              | 1.4 KB | Duplicate of root `.env` (gitignored) |
| `app/server/index.js`   | 256 KB | esbuild output (gitignored) |
| `app/server/index.cjs`  | 238 KB | esbuild output (gitignored) |
| `CLEAN_STATE.md`        | 2.9 KB | Personal note from the cleanup session (replaced by this file) |

**Total reclaimed:** ≈ 303 MB on disk, ≈ 2 800 fewer files in the working copy.

---

## What is intentionally NOT in the repo

These are gitignored but **may be on disk** (developer-local) — they
are part of the working environment, not the source tree:

- `app/node_modules/`
- `app/dist/`, `app/coverage/`, `app/logs/`
- `app/server/index.js`, `app/server/index.cjs`
- `mcp-server/dist/`, `mcp-server/node_modules/`
- `scripts/_*.out`, `scripts/_*.txt`
- `site/` (mkdocs HTML output)
- `.venv/`, `.vite/`, `.continue/`, `.playwright-mcp/`
- IDE / editor caches (`.vs/`, `.idea/`, etc.)

See `.gitignore` for the authoritative list.
