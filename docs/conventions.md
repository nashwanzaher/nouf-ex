# Project Conventions

## Code style

- **TypeScript strict mode** is on. Avoid `any` — use `unknown` and narrow.
- **2-space indent, LF line endings.** Enforced by Prettier + `.gitattributes`.
- **No `// eslint-disable` comments.** Fix the warning instead.
- **No `console.log` in production code** — use the future structured
  logger (P2-4 in the roadmap) or write nothing.
- **One default export per file** unless co-located variants/hooks are
  the documented public API (`src/components/ui/**`, `src/context/**`).

### Naming

| What               | Convention                                          | Example                          |
| ------------------ | --------------------------------------------------- | -------------------------------- |
| React components   | `PascalCase.tsx`                                    | `Navbar.tsx`                     |
| Hooks              | `useKebab.ts`                                       | `use-mobile.ts`                  |
| Pure utilities     | `camelCase.ts`                                      | `utils.ts`                       |
| Constants          | `UPPER_SNAKE_CASE`                                  | `DEFAULT_PAGE_SIZE`              |
| DB tables          | `snake_case` (plural)                               | `order_items`                    |
| DB columns         | `snake_case`                                        | `created_at`                     |
| API endpoints      | kebab-case for collections, IDs in path             | `/api/order-items`               |
| Env vars           | `UPPER_SNAKE_CASE`                                  | `DATABASE_URL`                   |
| i18n keys          | `dot.path.lower_snake`                              | `home.hero.search_placeholder`   |
| File paths in URLs | kebab-case                                          | `/product/123-some-slug`         |

## React patterns

- **Co-locate** small components next to their consumer. Promote to
  `src/components/` only when reused.
- **Use the `cn()` helper** from `src/lib/utils.ts` for conditional
  classes. Avoid string concatenation.
- **State initializers**: when state derives from `localStorage`, use the
  lazy initializer form (`useState(() => readFromStorage())`) instead of
  `useEffect`.
- **Side effects outside reducers.** Reducers must be pure. Kick off
  fetches from the component, then dispatch the result.
- **Refs for non-render data**: timers, abort controllers, embla apis,
  intersection observers. State is for things you render.

## i18n

- **Arabic is the default and the source of truth.** Add a key to
  `ar.json` first, then mirror to `en.json` and `zh.json`.
- Use the `t('key')` helper from `react-i18next`. Avoid
  `i18n.language === 'ar' ? 'A' : 'B'` ternaries.
- For dynamic plurals: `t('key', { count })`.
- For RTL-aware layout: rely on the `dir` attribute on `<html>` (set by
  `AppContext`). Don't hardcode `left`/`right` in CSS — use `start`/`end`.

## Database

- **SQL files only**, no migration framework. See
  [`database.md`](database.md).
- **Use the PgDb wrapper** (`app/server/db/pg-wrapper.cjs`) — do not import `pg`
  directly from route handlers.
- **Wrap multi-write endpoints in `db.tx(...)`** so they commit together.
- **Money in `NUMERIC(12,2)`**, never `FLOAT`/`DOUBLE`.
- **Always set `created_at`/`updated_at`** via `DEFAULT CURRENT_TIMESTAMP`.

## API

- **Validate with `zod`** before any DB write.
- **Never `console.log` PII** (email, phone, password hashes, full
  addresses) — use the structured logger or scrub before printing.
- **Errors** return `{ error: string, details?: zodIssues }` with the
  right HTTP code. Do not leak stack traces in `NODE_ENV=production`.

## Git workflow

- **Branches:**
  - `main` — always deployable.
  - `feat/<scope>` — new feature.
  - `fix/<scope>` — bug fix.
  - `chore/<scope>` — tooling / docs / housekeeping.
  - `audit/<date>` — periodic cleanup passes (matches
    `docs/audit/code-audit-YYYY-MM-DD.md`).
- **Commit messages:** imperative mood, ≤ 72 chars on the subject line.
  Body explains *why*. Reference roadmap IDs when applicable:
  `P0-1: cart→order pipeline E2E`
- **PRs** are squash-merged. One concern per PR.

## Security

- **No secrets in the repo.** `.env` is git-ignored; only `.env.example`
  ships.
- **Password hashing:** `scrypt` with a 16-byte random salt. Never store
  plaintext, never roll your own.
- **CORS allow-list** lives in `ALLOWED_ORIGINS` env var. Empty string
  means "localhost only".
- **Rate limiting** is in-memory by default. Document before scaling out
  (see roadmap P2-3 / P2-4).

## Documentation

- **Update docs in the same PR as the code.** If you change an endpoint,
  update [`api.md`](api.md). If you change the schema, update
  [`database.md`](database.md).
- **Long-form research** lives under `docs/research/`. **Audits and
  reviews** live under `docs/audit/`. Never overwrite — append a dated
  file.
