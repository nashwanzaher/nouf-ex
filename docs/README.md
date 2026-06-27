# Documentation — Nouf-ex

> **Framework:** [Diátaxis](https://diataxis.fr/) — *tutorials · how-to · reference · explanation*
> **Standards:** [IEEE 829](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [ISTQB CTFL](https://www.istqb.org/)

The documentation is split by intent to make navigation intuitive:

| Folder | Intent | Audience |
|--------|--------|----------|
| [`architecture/`](architecture/) | **Explanation** — How is the system designed? | New engineers, architects |
| [`development/`](development/) | **How-to** — How do I develop / build / deploy? | Active contributors |
| [`planning/`](planning/) | **Strategy** — Where is the project going? | Product, leadership |
| [`operations/`](operations/) | **How-to** — How do I run it in production? | Operators, SRE |
| [`testing/`](testing/) | **Reference** — Test program & standards | QA engineers |
| [`STRUCTURE.md`](STRUCTURE.md) | **Reference** — Repository map | Everyone |

---

## 🚀 Start Here

| You want to … | Read |
|---------------|------|
| Get the project running | [`development/getting-started.md`](development/getting-started.md) |
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
├── STRUCTURE.md              ← repository map
├── MASTER_PLAN.md            ← Master execution plan + consolidation plan
│
├── architecture/             ← ⟦Explanation⟧
│   ├── overview.md
│   ├── api.md
│   └── database.md
│
├── development/              ← ⟦How-to⟧
│   ├── getting-started.md
│   ├── workflow.md
│   ├── conventions.md
│
├── operations/               ← ⟦How-to / Deployment⟧
│   └── docker.md
│
├── planning/                 ← ⟦Strategy⟧
│   ├── roadmap.md
│   └── competitive-analysis.md
│
├── testing/                  ← ⟦Reference⟧
│   ├── README.md
│   ├── PHASE_TEST_TASKS.md
│   ├── conventions.md
│   ├── overview.md
│   ├── standards/
│   │   ├── IEEE-829.md
│   │   ├── ISO-29119.md
│   │   └── ISTQB-CTFL.md
│   ├── phases/              ← per-PHASE test design specs
│   └── templates/

archive/                     ← ⟦Historical⟧ (moved 2026-06-28)
├── audit/                    ← Past code audits (11 files)
└── research/                 ← Past research docs (11 files)
```

---

## 📚 Standards We Follow

- **IEEE 829-2008** — Software & System Test Documentation → [`testing/standards/IEEE-829.md`](testing/standards/IEEE-829.md)
- **ISO/IEC/IEEE 29119** — Software Testing → [`testing/standards/ISO-29119.md`](testing/standards/ISO-29119.md)
- **ISTQB CTFL v4.0** — Test techniques → [`testing/standards/ISTQB-CTFL.md`](testing/standards/ISTQB-CTFL.md)
- **Diátaxis** — Documentation framework → <https://diataxis.fr/>
- **Conventional Commits** — Commit messages
- **Semantic Versioning** — Version numbers
- **Keep a Changelog** — CHANGELOG format

---

## 🗄️ Archive

> Files preserved for historical reference (do not link from new content).

- [`audit/`](audit/) — Past code audits, extension audits, reviews.
- [`research/`](research/) — Original deep-research notes, plans, design study.
- [`assets/`](assets/) — Screenshots, product page mockups.
- [`workflows/`](workflows/) — Workflow diagrams.
