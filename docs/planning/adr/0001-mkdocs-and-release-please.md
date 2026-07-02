# ADR-0001 — Adopt MkDocs (Material) + release-please for docs automation

> **Status:** ✅ Accepted (2026-07-02)
> **Deciders:** Nouf-ex maintainers
> **Date:** 2026-07-02
> **Reviewers:** the Doc-Site Audit Pass (see MASTER_PLAN §12)

## Context and problem statement

The Nouf-ex documentation had grown organically to **19 active `.md`
files in `docs/`** plus **7 root-level `.md` files**. As of 2026-06-28
the docs were tracked only in plain Markdown with no rendered site, no
automated link-checking, and no automated CHANGELOG generation.

This led to three recurring problems documented in MASTER_PLAN §12
("Documentation Audit Pass — 2026-07-02"):

1. **Link rot** — when folders move (e.g. `docs/audit/` → `archive/audit/`),
   cross-doc links silently break and nobody notices until a contributor
   hits them months later.
2. **Stale status** — MASTER_PLAN §11.3 listed 6 entries as ⏳ TODO even
   though the corresponding files had been written; the manual update
   step was easy to forget.
3. **Discoverability** — contributors new to the project had to navigate
   GitHub raw-Markdown, which offers no search, no TOC, no "edit this
   page" button.

We needed a tool that:

- Renders our existing Diátaxis structure faithfully (tutorials / how-to /
  reference / explanation).
- Pins to versions we control — drift-free, reproducible.
- Plays well with GitHub Actions and GitHub Pages (no extra infra).
- Supports Arabic + Chinese text (Material handles RTL gracefully).
- Has a low-friction migration story from the existing `docs/`.
- Costs nothing at the project's scale (under 1k pages).

## Considered options

### Option A — Docusaurus

- **Pros:** React-based, MDX support, i18n built-in.
- **Cons:** Heavier (Node build pipeline), opinionated about file layout
  (`docs/` becomes `docs/<version>/`), i18n config is YAML-heavy and
  duplicates the doc tree per language.
- **Verdict:** Rejected — too much YAML duplication for 3 languages at
  our current size, and we'd inherit a React toolchain just to render
  docs.

### Option B — Sphinx (Read the Docs)

- **Pros:** Battle-tested, autodoc pulls in Python API references.
- **Cons:** Designed for Python projects; awkward for our React/Node
  stack; rST + MyST mix would mean contributors need two syntaxes.
- **Verdict:** Rejected — too domain-specific to Python, mismatch with
  the rest of the project's tooling.

### Option C — Antora

- **Pros:** Multi-repo docs playbook, strong content reuse.
- **Cons:** Heavy install (`node_modules` ~ 600 MB), steep learning
  curve for contributors, best when you have 5+ repo components.
- **Verdict:** Rejected — overkill for a single repo with one component.

### Option D — MkDocs + Material (chosen)

- **Pros:**
  - Pure static-site generator, builds in seconds.
  - One `mkdocs.yml` config — contributors learn it in minutes.
  - Material theme is widely adopted (Google, AWS, CERN docs).
  - Pinned to `mkdocs==1.6.1` and `mkdocs-material==9.5.49`
    (see `requirements-docs.txt`) — fully reproducible.
  - `mkdocs-include-markdown-plugin` lets us cross-reference snippets
    (handy for the test phase specs).
  - GitHub Pages deploy is one line (`mkdocs gh-deploy`).
  - Strong multilingual support (`lang: [en, ar, zh]`).
  - Strict mode catches nav / file drift at build time.
- **Cons:**
  - Plugin ecosystem is smaller than Docusaurus's.
  - No MDX — we can't embed React components in doc pages (acceptable,
    we're not doing that today).

## Decision

**We adopt MkDocs + Material for MkDocs.**

Specifically:

| Concern              | Choice                                                    |
|----------------------|-----------------------------------------------------------|
| Site generator       | `mkdocs==1.6.1`                                           |
| Theme                | `mkdocs-material==9.5.49`                                 |
| Minification         | `mkdocs-minify-plugin==0.8.0`                             |
| Last-updated dates   | `mkdocs-git-revision-date-localized-plugin==1.3.0`        |
| Cross-file includes  | `mkdocs-include-markdown-plugin==6.2.1`                   |
| Friendly redirects   | `mkdocs-redirects==1.2.1`                                 |
| Cross-doc link check | `markdown-link-check@3.12.2` (npm, run in CI)             |
| CHANGELOG automation | `release-please` via Google App (or self-hosted CLI)     |
| Deployment           | GitHub Pages via `.github/workflows/docs.yml`             |

## Consequences

### Positive

- **One YAML file** (`mkdocs.yml`) describes the entire navigation,
  including the Diátaxis split and 18 PHASE design specs.
- **`mkdocs build --strict`** now runs in CI on every PR — broken
  navigation fails the build, just like broken code.
- **`markdown-link-check`** catches every internal link in every `.md`
  file in under 3 min (split across two matrix jobs).
- **CHANGELOG automation** via release-please removes the manual
  `[Unreleased]` block — every merge to main gets a draft release PR
  with the right SemVer bump from Conventional Commits.
- **Discoverability** — the published site will have full-text search
  across EN/AR/ZH, light/dark toggle, edit-this-page button, and
  per-page "last updated" dates.

### Negative

- We now have **a Python toolchain** in addition to Node and Go for the
  MCP server. Mitigated by pinning `requirements-docs.txt` and using
  `pip install -r requirements-docs.txt` everywhere.
- Contributors may need to install Python 3.12+ locally to preview.
  The CI workflow doesn't depend on local install — anyone editing
  `docs/` without Python can still push and let CI catch issues.
- `release-please` requires the GitHub App to be installed (or a
  self-hosted CLI run). Until that's done, CHANGELOG entries are
  manual via the `[Unreleased]` block — same as before.

### Neutral

- We do **not** version the docs with `mike` yet — versioned docs add
  complexity (`pip install mike`, dual branches) that we don't need
  at v0.x. Tracked as a follow-up.
- We do **not** autogenerate API reference pages from TypeScript
  docstrings — `mkdocstrings` would require TypeScript-aware tooling
  (`mkdocstrings-tsc` is unmaintained). For now, the hand-written
  [`docs/architecture/api.md`](../architecture/api.md) is the source
  of truth and we keep it in sync via a CI lint (planned).

## Validation

- [x] `mkdocs build --strict` runs locally and passes.
- [x] `.github/workflows/docs.yml` builds on every push to `main`
      and deploys to GitHub Pages.
- [x] `.github/workflows/link-check.yml` runs on every PR and
      catches broken links.
- [x] `requirements-docs.txt` is committed and pins every plugin.
- [x] `release-please-config.json` is committed and pinned.
- [x] `docs/BUILD.md` walks contributors through the local setup.

## References

- MkDocs — <https://www.mkdocs.org/>
- Material for MkDocs — <https://squidfunk.github.io/mkdocs-material/>
- release-please — <https://github.com/googleapis/release-please>
- markdown-link-check — <https://github.com/tcort/markdown-link-check>
- Microsoft Docs pipeline guidance — <https://learn.microsoft.com/azure/devops/pipelines/>
- Diátaxis — <https://diataxis.fr/>
- Keep a Changelog — <https://keepachangelog.com/>
- Original audit pass — [`MASTER_PLAN.md`](../MASTER_PLAN.md) §12

---

## Revision history

| Date       | Author / source        | Change                                       |
|------------|------------------------|----------------------------------------------|
| 2026-07-02 | Doc-Audit Pass (Copilot) | Initial proposal + acceptance              |
