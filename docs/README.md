# Documentation — Nouf-ex

> **Framework:** [Diátaxis](https://diataxis.fr/) — _tutorials · how-to · reference · explanation_
> **Standards:** [IEEE 829](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [ISTQB CTFL](https://www.istqb.org/)
> **Site:** built with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) — see [`BUILD.md`](BUILD.md) for the local preview workflow.
> **Last updated:** 2026-07-02 · maintained alongside the code · the master
> execution plan is the source of truth — see
> [`MASTER_PLAN.md`](MASTER_PLAN.md) for the canonical task table.
> Community docs (Code of Conduct, Security Policy) live at the repo root.

The documentation is split by intent to make navigation intuitive:

| Folder | Intent | Audience |
|--------|--------|----------|
| [`architecture/`](architecture/) | **Explanation** — How is the system designed? | New engineers, architects |
| [`development/`](development/) | **How-to** — How do I develop / build / deploy? | Active contributors |
| [`planning/`](planning/) | **Strategy** — Where is the project going? | Product, leadership |
| [`operations/`](operations/) | **How-to** — How do I run it in production? | Operators, SRE |
| [`testing/`](testing/) | **Reference** — Test program & standards | QA engineers |
| [`STRUCTURE.md`](STRUCTURE.md) | **Reference** — Repository map | Everyone |
| [`MASTER_PLAN.md`](MASTER_PLAN.md) | **Reference** — Execution roadmap (52/78 done) | Maintainers |

---

## 🚀 Start Here

| You want to … | Read |
|---------------|------|
| Get the project running | [`development/getting-started.md`](development/getting-started.md) |
| Learn by doing (tutorial, ~30 min) | [`tutorials/run-an-order-end-to-end.md`](tutorials/run-an-order-end-to-end.md) |
| Build the rendered docs site | [`BUILD.md`](BUILD.md) |
| Understand the system architecture | [`architecture/overview.md`](architecture/overview.md) |
| Look up an API endpoint | [`architecture/api.md`](architecture/api.md) |
| Set up or update the database | [`architecture/database.md`](architecture/database.md) |
| Contribute code | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Follow coding conventions | [`development/conventions.md`](development/conventions.md) |
| Run day-to-day dev workflow | [`development/workflow.md`](development/workflow.md) |
| Run tests | [`testing/README.md`](testing/README.md) |
| Build the Docker image | [`operations/docker.md`](operations/docker.md) |
| See the roadmap | [`planning/roadmap.md`](planning/roadmap.md) |
| Read competitive analysis | [`planning/competitive-analysis.md`](planning/competitive-analysis.md) |
| Browse the repository map | [`STRUCTURE.md`](STRUCTURE.md) |

---

## 🗂️ Folder Map

```
docs/
├── README.md                 ← (this file) — documentation index
├── STRUCTURE.md              ← repository map (every folder)
├── MASTER_PLAN.md            ← Master execution plan + completion log
│
├── architecture/             ← ⟦Explanation⟧
│   ├── overview.md           ← System diagram + layer responsibilities
│   ├── api.md                ← Endpoints reference (38 documented paths)
│   ├── database.md           ← Schema overview (30 tables, 13 fns, 10 triggers)
│   ├── security.md           ← Threat model, OWASP API Top-10, CSP, RBAC
│   └── er-diagram.md         ← 6 Mermaid ER diagrams for all 30 tables
│
├── development/              ← ⟦How-to⟧
│   ├── getting-started.md    ← 15-minute "running locally" walkthrough
│   ├── workflow.md           ← Daily commands cheat-sheet
│   ├── conventions.md        ← Style: TypeScript, naming, i18n, commit
│   ├── ci-cd.md              ← GitHub Actions strategy + stages + secrets
│   └── debugging.md          ← 14 failure modes + 7 reset utilities
│
├── operations/               ← ⟦How-to / Deployment⟧
│   ├── docker.md             ← `docker compose` dev + prod commands
│   ├── deployment.md         ← production checklist + nginx + SSL + rollback
│   ├── monitoring.md         ← JSON logs + metrics + 5 alert rules + runbooks
│   └── backup-restore.md     ← pg_dump + WAL archive + DR RPO/RTO targets
│
├── planning/                 ← ⟦Strategy⟧
│   ├── roadmap.md            ← P0/P1/P2/P3 backlog with target milestones
│   ├── competitive-analysis.md ← 19 axes × 6 competitors
│   └── risks.md              ← Risk register (severity × likelihood) + ADRs
│
└── testing/                  ← ⟦Reference⟧
    ├── README.md             ← Testing hub: layers, layout, how to add
    ├── overview.md           ← What we test + why (test pyramid)
    ├── conventions.md        ← Test taxonomy + style (AAA, naming, mocks)
    ├── PHASE_TEST_TASKS.md   ← Master Test Plan (18 PHASE design specs in §)
    ├── standards/
    │   ├── IEEE-829.md       ← Test Documentation mapping
    │   ├── ISO-29119.md      ← Software Testing mapping
    │   ├── ISTQB-CTFL.md     ← Test techniques mapping
    │   └── google-style.md   ← Quick reference: AAA, naming, mocks
    ├── phases/               ← One design spec per PHASE script (18 files)
    └── templates/            ← Reusable PS/JS templates + helpers reference
├── tutorials/                  ← ⟦Tutorials⟧ — Learning-oriented walkthroughs
│   └── run-an-order-end-to-end.md  ← IEEE 829-style hands-on exercise
├── workflows/                  ← ⟦External automation⟧ — N8N integration
│   ├── n8n-noufex-review-workflow.json
│   └── n8n-env-override.env.example
└── planning/adr/               ← ⟦Explanation⟧ — Architecture Decision Records
    ├── README.md
    └── 0001-mkdocs-and-release-please.md
```

---

## 📚 Standards We Follow

| Standard | Where it is mapped |
|----------|---------------------|
| **IEEE 829-2008** — Test Documentation | [`testing/standards/IEEE-829.md`](testing/standards/IEEE-829.md) |
| **ISO/IEC/IEEE 29119** — Software Testing | [`testing/standards/ISO-29119.md`](testing/standards/ISO-29119.md) |
| **ISTQB CTFL v4.0** — Test Techniques | [`testing/standards/ISTQB-CTFL.md`](testing/standards/ISTQB-CTFL.md) |
| **Google Style Guide** — TS/JS conventions | [`testing/standards/google-style.md`](testing/standards/google-style.md) |
| **OWASP API Security Top-10** | [`architecture/security.md`](architecture/security.md) |
| **Diátaxis** — Documentation framework | <https://diataxis.fr/> (folder layout above reflects it) |
| **Conventional Commits** — Commit messages | <https://www.conventionalcommits.org/> |
| **Semantic Versioning** — Version numbers | <https://semver.org/> |
| **Keep a Changelog** — CHANGELOG format | <https://keepachangelog.com/> |
| **12-Factor App** — Process & config | <https://12factor.net/> |

---

## 🗄️ History

Historical artifacts (audits, research, superseded plans, one-off fix scripts)
were previously kept in an `archive/` directory at the repo root.
**As of 2026-07-07, the archive was removed** because:

1. It was gitignored and explicitly *not* part of the project's SSOT.
2. Modern academic best practice treats git history as the canonical
   historical record — superseded content is preserved in commit logs.
3. The canonical, always-current documentation lives under `docs/` per the
   Diátaxis layout shown above.

If you need to recover an archived artifact, look at the project's git
history on GitHub before the cleanup commit. The relevant commits carry
detailed rationale in their messages and the
[`MIGRATION_EXECUTION_PLAN.md`](planning/MIGRATION_EXECUTION_PLAN.md)
changelog.

---

## 🤝 Contributing to these docs

- Add the new file under the correct **Diátaxis** folder (see top table).
- Update cross-references when introducing a new public concept:
  - **Endpoint** → [`architecture/api.md`](architecture/api.md)
  - **DB table / column** → [`architecture/database.md`](architecture/database.md)
    - migration under `database/migrations/`
  - **Env variable** → `.env.example` + the Configuration section of
    [`architecture/overview.md`](architecture/overview.md)
- One PR ↔ one logical change. Run `npm run format:check` and
  `npm run lint` from `app/` before pushing.

---

## 📊 Documentation health snapshot (2026-07-02)

| Metric                          | Value |
|---------------------------------|-------|
| Active docs in `docs/`          | 23 (after 2026-07-07 sweep — removed `archive/`, added `workflows/`) |
| Root-level docs                 | 7 (`README`, `CHANGELOG`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, `LICENSE`, `STRUCTURE`) |
| Archived docs                   | 0 (removed 2026-07-07 — see History section above) |
| Broken cross-links (last sweep) | 0 |
| Stale docs flagged              | 0 (after 2026-07-07 sweep) |
| Diátaxis folders covered        | 5 of 5 (tutorials, how-to, reference, explanation, about) |
| Docs site deploy                | GitHub Pages via `.github/workflows/docs.yml` |
| Link check                      | `.github/workflows/link-check.yml` on every PR |
| CHANGELOG automation            | `release-please` (Google App) |
