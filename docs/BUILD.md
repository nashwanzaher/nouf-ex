# Building the docs site

> **Last updated:** 2026-07-02.
> See also: [`mkdocs.yml`](../mkdocs.yml), [`.github/workflows/docs.yml`](../.github/workflows/docs.yml),
> [`docs/STRUCTURE.md`](STRUCTURE.md).

The docs site is built with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/),
which means you get:

- **Full-text search** across EN/AR/ZH pages.
- **Diátaxis-friendly navigation** — tabs across the top, expandable
  sections, breadcrumbs, prev/next.
- **Light/dark toggle** that respects the OS preference.
- **"Last updated" dates** per page (powered by `mkdocs-git-revision-date-localized-plugin`).
- **Edit-this-page pencil** — every page links back to the source on `main`.

## Local development

### One-time setup

```sh
# From the repo root
python -m venv .venv
. .venv/bin/activate          # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-docs.txt
```

### Serve with live reload

```sh
cd nouf-ex
mkdocs serve                  # http://127.0.0.1:8000
```

Edits to any `*.md` file under `docs/` trigger an instant reload.

### Build the static site

```sh
mkdocs build --strict         # writes ./site
```

The `--strict` flag promotes warnings to errors — broken navigation,
missing files, or invalid syntax will fail the build. CI does the same
in [`docs.yml` workflow](../.github/workflows/docs.yml).

### Deploy manually

```sh
mkdocs gh-deploy --force      # pushes to `gh-pages` branch
```

The CI workflow does this on every push to `main`. Use the manual
command only if you're publishing a one-off hotfix.

## Standards alignment

| Std                             | How it's reflected in the site                                        |
|---------------------------------|------------------------------------------------------------------------|
| **Diátaxis**                    | Tabs in nav: Tutorials / How-to / Reference / About                   |
| **IEEE 829-2008**               | Test design specs become discrete pages under "Reference > Test design specs" |
| **ISO/IEC/IEEE 29119**          | `testing/standards/ISO-29119.md` linked in nav, acronyms expanded     |
| **ISTQB CTFL v4.0**             | `testing/standards/ISTQB-CTFL.md` linked, term → definition via `<dfn>` |
| **Keep a Changelog**            | `CHANGELOG.md` linked under "About > Changelog"                        |
| **Microsoft Docs**              | admonitions, `<kbd>` keys, and consistent `## h2 / ### h3` heading hierarchy |
| **Conventional Commits**        | changelog automation via release-please (see `release-please-config.json`) |

## File map

| Path                                  | Purpose                                          |
|---------------------------------------|--------------------------------------------------|
| `mkdocs.yml`                          | Build + nav + Material theme config              |
| `requirements-docs.txt`               | Pinned Python deps for the build                 |
| `docs/assets/css/extra.css`           | Project-specific theme overrides                 |
| `docs/.markdown-link-check.json`      | CI link-check rules                              |
| `.github/workflows/docs.yml`          | Build + deploy site to GitHub Pages              |
| `.github/workflows/link-check.yml`    | Cross-doc link check on every PR                 |
| `release-please-config.json`          | CHANGELOG + SemVer automation                    |
| `app/package.json`                    | Exposes `npm run docs:*` shortcuts (mirrors `mkdocs`) |

## Common tasks

| I want to…                              | Run                                      |
|-----------------------------------------|-------------------------------------------|
| Preview the site locally                | `mkdocs serve`                           |
| Build it into `./site/`                 | `mkdocs build --strict`                  |
| Deploy to GitHub Pages (manual)         | `mkdocs gh-deploy --force`               |
| Add a new page under "Reference"        | Create the `.md` under `docs/`, add nav entry in `mkdocs.yml` |
| Add a new test design spec              | Drop under `docs/testing/phases/PHASE_<NN>_<topic>.md` (auto-picked by nav glob) |
