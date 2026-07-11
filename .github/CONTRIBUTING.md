# Contributing to Nouf-ex

> **Full guide:** [docs/README.md §2 — How-to guides](docs/README.md#2-how-to-guides-task-oriented) ·
> **Security issues:** [.github/SECURITY.md](.github/SECURITY.md) (do NOT open a public issue)

Thanks for helping build Nouf-ex. This is a short overview; the comprehensive developer guide lives in [docs/README.md](docs/README.md). Issue templates: [bug report](.github/ISSUE_TEMPLATE/bug_report.md) · [feature request](.github/ISSUE_TEMPLATE/feature_request.md).

## Code of Conduct

Everyone who participates is expected to follow the [Contributor Covenant v3.0](.github/CODE_OF_CONDUCT.md). Be welcoming, be respectful, assume good faith.

## Workflow

1. **Pick an item** off the [active backlog](docs/README.md#52-roadmap) — search for `G-N` IDs in the [remediation roadmap](docs/README.md#52-roadmap). If nothing fits, [open an issue](https://github.com/nashwanzaher/nouf-ex/issues/new/choose).
2. **Branch from `main`:**
   - `feat/<scope>` — new feature
   - `fix/<scope>` — bug fix
   - `chore/<scope>` — tooling, docs, housekeeping
   - `docs/<scope>` — documentation only
3. **Commit using [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):**
   ```
   feat(cart): add server-side cart sync on login
   fix(auth): bump scrypt params to N=131072
   docs: update SECURITY.md to reflect HttpOnly cookie model
   ```
4. **Open a Pull Request** using the [template](.github/PULL_REQUEST_TEMPLATE.md).

## Local setup

```sh
git clone https://github.com/nashwanzaher/nouf-ex
cd nouf-ex
cp .env.example .env             # fill in DATABASE_URL, AUTH_SECRET (≥32 chars)
cd app && npm install
npm run db:setup                 # idempotent: applies database/*.sql
npm run api                      # Express on :3000
npm run dev                      # Vite on :5173 (separate terminal)
```

Full instructions: [docs/README.md §1.1 — Getting started](docs/README.md#11-getting-started).

## Coding conventions

- **TypeScript strict mode** — no `any`. Use `unknown` and narrow.
- **2-space indent, LF line endings** (enforced by Prettier + `.gitattributes`).
- **No `// eslint-disable`** — fix the warning.
- **No `console.log` in production code** — use the structured logger or write nothing.
- **React components:** `PascalCase.tsx`. **Hooks:** `useKebab.ts`. **DB tables:** `snake_case` plural. **Env vars:** `UPPER_SNAKE_CASE`.
- **i18n keys:** `dot.path.lower_snake` (ar / en / zh).
- **One default export per file** unless co-located variants are the public API.

## Before pushing

Run from `app/`:

```sh
npm run lint           # ESLint — must be 0 errors, 0 warnings
npm run typecheck      # tsc -b --noEmit
npm run test:unit      # Vitest (pg mocked)
npm run build          # tsc + vite build
```

For server-side changes that touch `app/server/`, also:

```sh
npm run db:setup       # applies migrations
# then start the API (npm run api) and exercise the changed endpoint with curl
```

## Pull Request checklist

See [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) for the full checklist. TL;DR:

- [ ] Linked to a `G-N` from the roadmap (or a GitHub issue)
- [ ] `npm run lint && npm run typecheck && npm run test:unit && npm run build` all green
- [ ] New code paths covered by tests
- [ ] CHANGELOG.md updated under `[Unreleased]` if user-visible
- [ ] No secrets, no `.env`, no `console.log`

## Adding documentation

Update [docs/README.md](docs/README.md). One section per concern; use the existing anchor links. If your change introduces a new public concept:

- **Endpoint** → add a row to [docs/README.md §3.1 — API reference](docs/README.md#31-api-reference)
- **DB table / column** → add a migration under `database/migrations/` and reference it in [docs/README.md §3.2 — Database](docs/README.md#32-database)
- **Significant decision** → append a new `## ADR-NNNN` section to [docs/README.md §4](docs/README.md#4-explanation-understanding-oriented)

## Reporting security issues

**Do NOT open a public issue.** See [.github/SECURITY.md](.github/SECURITY.md) for the coordinated-disclosure process.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
