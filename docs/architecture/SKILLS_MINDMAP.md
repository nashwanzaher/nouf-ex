# Nouf-ex End-to-End Developer Skills Mind Map

> **Version:** 1.0.0 (2026-07-03)
> **Status:** **MANDATORY** for all agents operating on Nouf-ex
> **Authority:** This document is the canonical reference for all skills required to develop, test, deploy, and maintain the Nouf-ex platform end-to-end.
> **Compliance:** Every Copilot agent, custom agent, and skill defined in `.github/agents/` and `.github/skills/` MUST follow this mind map. Non-compliance is a build-blocking violation.
> **Academic Standards Referenced:**
> - **ISO/IEC/IEEE 12207:2017** — Systems and software engineering — Software life cycle processes
> - **ISO/IEC 25010:2011** — Systems and software engineering — Quality models
> - **IEEE 830-1998** — Recommended practice for Software Requirements Specifications
> - **IEEE 829-2008** — Standard for Software and System Test Documentation
> - **ISO/IEC/IEEE 29119** — Software testing standards
> - **OWASP API Security Top 10 (2023)** — Web application security
> - **WCAG 2.1 Level AA** — Web Content Accessibility Guidelines
> - **SEMAT** — Software Engineering Method and Theory (essence kernel)
> - **CMMI v2.0** — Capability Maturity Model Integration (process areas referenced for skill levels)
> - **SWEBOK v4** — Guide to the Software Engineering Body of Knowledge
> - **Keep a Changelog 1.1.0** — https://keepachangelog.com
> - **Conventional Commits 1.0.0** — https://www.conventionalcommits.org
> - **Semantic Versioning 2.0.0** — https://semver.org
> - **Diátaxis Framework** — https://diataxis.fr

---

## 🧭 Mastery Index

> Every developer working on Nouf-ex — whether human or AI agent — must demonstrate proficiency in the following 9 skill domains, evaluated against the Junior / Mid / Senior scale defined in [§11](#11-skill-levels).

| # | Domain | Branch | Criticality |
|---|--------|--------|-------------|
| 1 | Frontend Engineering | 🎨 | **Critical** |
| 2 | Backend Engineering | ⚙️ | **Critical** |
| 3 | Database Engineering | 🗄️ | **Critical** |
| 4 | Security Engineering | 🛡️ | **Critical** |
| 5 | Quality Engineering (Testing) | 🧪 | **Critical** |
| 6 | DevOps & Site Reliability | 🔧 | **High** |
| 7 | Documentation & Knowledge | 📚 | **High** |
| 8 | AI-Agent Operations | 🤖 | **High** |
| 9 | Project & Release Engineering | 📊 | **High** |

> **Mandatory rule:** No commit may touch the codebase unless the change can be mapped to one of the 9 domains below. If your change does not fit, document it under §10 (Cross-Cutting Concerns).

---

## 🌳 1. Frontend Engineering (React 19 + Vite 7 + TypeScript)

### 1.1 React Core (foundational)

- **1.1.1** React 19 Hooks: `useState`, `useReducer`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useImperativeHandle`
- **1.1.2** Concurrent Features: `React.lazy()`, `<Suspense>`, `useTransition`, `useDeferredValue`
- **1.1.3** Custom Hooks: factory pattern (see `app/src/hooks/useApi.ts`), `useDataHook` composability
- **1.1.4** Error Boundaries: class components with `componentDidCatch`, fallback UIs
- **1.1.5** Portal API: modals, dropdowns, tooltips
- **1.1.6** Strict Mode: double-invocation awareness, side-effect discipline

### 1.2 Component Architecture

- **1.2.1** Composition over inheritance (HOCs, render props, compound components)
- **1.2.2** Headless component pattern (shadcn/ui primitives)
- **1.2.3** Container/presentational split (smart/dumb components)
- **1.2.4** Render-props pattern for cross-cutting concerns

### 1.3 shadcn/ui + Radix (58 primitives)

- **1.3.1** cva (Class Variance Authority) for variant-driven styling
- **1.3.2** Slot composition (`asChild` prop pattern)
- **1.3.3** Data-attribute selectors (`data-slot="card"`, `data-state`)
- **1.3.4** Controlled vs uncontrolled component selection
- **1.3.5** Forwarded refs and `displayName` discipline

### 1.4 Vite 7 Build System

- **1.4.1** Manual chunk strategy: `react`, `recharts`, `animation`, `radix-ui`, `lucide`
- **1.4.2** PWA via `vite-plugin-pwa` (Workbox runtime caching)
- **1.4.3** esbuild minification with `target: 'es2022'`
- **1.4.4** Tree-shaking: `sideEffects: false` discipline
- **1.4.5** Asset fingerprinting for long-term caching
- **1.4.6** Source maps: `hidden-source-map` for prod, inline for dev

### 1.5 Internationalization (AR/EN/ZH, RTL)

- **1.5.1** i18next with `LanguageDetector` (localStorage → navigator)
- **1.5.2** RTL: `dir` attribute on `<html>`, logical CSS properties (`ms-*` / `me-*` / `ps-*` / `pe-*`)
- **1.5.3** Arabic-Indic digits (٠-٩) and locale-aware number formatting
- **1.5.4** Cairo font (Arabic), Amiri (Arabic serif), Inter (Latin)
- **1.5.5** Pluralization rules per locale (Arabic has 6 forms)

### 1.6 Accessibility (WCAG 2.1 Level AA — MANDATORY)

- **1.6.1** Perceivable: text alternatives, color contrast (4.5:1), text resizable to 200%
- **1.6.2** Operable: keyboard accessible, focus visible, focus order logical
- **1.6.3** Understandable: language declared, input assistance, error identification
- **1.6.4** Robust: compatible with assistive technologies (NVDA, JAWS, VoiceOver)
- **1.6.5** ARIA patterns: `role="list"` / `role="listitem"`, `aria-current`, `aria-label`, `aria-hidden`
- **1.6.6** axe-core rules to know by heart: `color-contrast`, `aria-prohibited-attr`, `button-name`, `landmark-one-main`

### 1.7 Performance & Rendering

- **1.7.1** Code splitting by route (admin bundle = `~390KB` vs public = `~80KB`)
- **1.7.2** Image optimization (WebP, AVIF, `loading="lazy"`)
- **1.7.3** Virtual scrolling for long lists (`react-window`, `react-virtual`)
- **1.7.4** `useMemo` discipline: only memoize when measurement proves a re-render problem
- **1.7.5** `useCallback` for stable function identities passed to memoized children

> **Files to master:** `app/src/App.tsx`, `app/vite.config.ts`, `app/src/context/{App,Cart}Context.tsx`, `app/src/i18n/index.ts`, `app/src/__tests__/a11y/*.a11y.test.tsx`

---

## 🌳 2. Backend Engineering (Express 5 + Node 20 + TypeScript)

### 2.1 Express 5 Architecture

- **2.1.1** Router composition: per-feature router mounted under `/api/{resource}`
- **2.1.2** Middleware chain: `requestId` → `securityHeaders` (CSP nonce) → `cors` → `json` (1MB cap) → `optionalAuth` → `requestLogger`
- **2.1.3** Error middleware: 4-arg signature (`err, req, res, next`), `HttpError` class
- **2.1.4** Async error propagation: Express 5 auto-catches rejected promises

### 2.2 Authentication & Authorization

- **2.2.1** Password hashing: scrypt (16-byte salt, 64-byte derived key), `timingSafeEqual`
- **2.2.2** Password policy: 10-128 chars, 3-of-4 character classes, top-100 denylist, no repeats/sequences
- **2.2.3** Token: HMAC-SHA256 signed JWT, payload `{sub, role, ver, exp}`, 7-day TTL
- **2.2.4** Token revocation: `token_version` column bumped on password change → invalidates ALL outstanding tokens
- **2.2.5** Used-JTI replay prevention: `used_jtis` table with cleanup sweep
- **2.2.6** 2FA: TOTP (RFC 6238, HMAC-SHA1, 30s window, ±1 step tolerance)
- **2.2.7** 2FA backup codes: 10 codes, scrypt-hashed, single-use
- **2.2.8** `partial_token` for 2FA bootstrap (short-lived, single-purpose)
- **2.2.9** Authorization: `requireRole(...allowed)`, ownership guards (`req.user.id === :userId`)
- **2.2.10** Self-protection: admin cannot ban/demote self

### 2.3 Payment Gateway Integration

- **2.3.1** Provider registry pattern (`selectProvider(method)`)
- **2.3.2** Stripe: Checkout Sessions, `sk_` live key prefix, HMAC-SHA256 webhook signature
- **2.3.3** Paymob: two-step auth (token + order), HMAC webhook verification
- **2.3.4** Stub provider for development (no real gateway)
- **2.3.5** Webhook raw-body preservation (JSON parsers would break HMAC)
- **2.3.6** Idempotency: `provider_txn_id` lookup before UPDATE
- **2.3.7** Atomic state transitions: `trg_orders_state_machine` in PL/pgSQL

### 2.4 Database Access Layer

- **2.4.1** `pg` (node-postgres) Pool: `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`
- **2.4.2** Custom `PgDb` wrapper mimicking `better-sqlite3` API (`.prepare(sql).all/get/run/tx()`)
- **2.4.3** SQL injection prevention: `pgify()` state machine that handles:
  - `'...'` (single-quoted strings, with `''` escape)
  - `$$ ... $$` (PostgreSQL dollar-quoted strings)
  - `$tag$ ... $tag$` (tagged dollar-quoted)
  - `E'...'` (escape strings)
  - `--` line comments, `/* */` block comments
- **2.4.4** Transaction management: `db.tx(async (txDb) => {...})` BEGIN/COMMIT/ROLLBACK
- **2.4.5** Connection pool: graceful release in error paths, `process.on('SIGTERM')` shutdown

### 2.5 Security Headers & CSP

- **2.5.1** CSP with per-request nonce (16 bytes, base64url): `style-src 'nonce-...' 'strict-dynamic'`
- **2.5.2** HSTS: `max-age=31536000; includeSubDomains; preload` (production only)
- **2.5.3** `X-Content-Type-Options: nosniff`
- **2.5.4** `X-Frame-Options: DENY`
- **2.5.5** `Referrer-Policy: strict-origin-when-cross-origin`
- **2.5.6** `Cross-Origin-Opener-Policy: same-origin`
- **2.5.7** `Permissions-Policy` deny list: ~30 sensitive browser APIs
- **2.5.8** CORS: allowlist via `ALLOWED_ORIGINS` env, NOT wildcard

### 2.6 Rate Limiting & Abuse Prevention

- **2.6.1** DB-backed sliding window (`consume_rate_limit()` PL/pgSQL)
- **2.6.2** In-memory fallback for `/api/health` (no DB dependency)
- **2.6.3** Per-IP, per-endpoint buckets
- **2.6.4** Background sweeper (60s `setInterval`, `.unref()` so it doesn't block exit)
- **2.6.5** Webhook-specific rate limits to prevent abuse of unauthenticated endpoints

### 2.7 Audit Logging

- **2.7.1** `write_audit_log()` SECURITY DEFINER function (app role has EXECUTE only)
- **2.7.2** Retry with exponential backoff (100ms, 200ms, 400ms)
- **2.7.3** Dead-letter queue: `logs/audit-dlq-YYYY-MM-DD.jsonl`
- **2.7.4** Audit never blocks user action (fail open)

> **Files to master:** `app/server/middleware.ts`, `app/server/lib/shared.cts`, `app/server/lib/payments/{stripe,paymob,stub,registry}.cts`, `app/server/db/pg-wrapper.cts`, all 19 `app/server/routes/*.cts`

---

## 🌳 3. Database Engineering (PostgreSQL 17)

### 3.1 Schema Design (foundational)

- **3.1.1** `GENERATED ALWAYS AS IDENTITY` (PG 17 standard, replaces `SERIAL`)
- **3.1.2** `TIMESTAMPTZ` everywhere (NEVER `TIMESTAMP`)
- **3.1.3** `NUMERIC(12,2)` for money (NEVER `REAL`/`FLOAT`)
- **3.1.4** `CITEXT NOT NULL UNIQUE` for case-insensitive email
- **3.1.5** Soft delete pattern: `deleted_at TIMESTAMPTZ NULL` + partial indexes
- **3.1.6** Trilingual schema: `name_ar / name_en / name_zh`, `description_ar / description_en / description_zh`
- **3.1.7** `CHECK` constraints on every enum-style column
- **3.1.8** `updated_at` trigger on every base table (auto-maintained)

### 3.2 Indexes (advanced)

- **3.2.1** B-tree for equality + range (`(user_id, created_at DESC)`)
- **3.2.2** BRIN for time-series tables with monotonic inserts (`users.created_at`, `audit_log.created_at`)
- **3.2.3** Hash for equality-only (rare in OLTP)
- **3.2.4** GIN for `tsvector` full-text search
- **3.2.5** Partial indexes with WHERE clause: `WHERE deleted_at IS NULL`, `WHERE is_active = TRUE`
- **3.2.6** Covering indexes: include non-key columns in INCLUDE for index-only scans
- **3.2.7** `idx_messages_thread ON (LEAST(sender_id, receiver_id), GREATEST(...), created_at DESC)` for chat

### 3.3 Stored Functions (PL/pgSQL)

- **3.3.1** `trg_set_updated_at()` — universal BEFORE UPDATE updated_at setter
- **3.3.2** `trg_orders_state_machine` — enforces pending→confirmed→processing→shipped→delivered
- **3.3.3** `trg_order_items_decrement_stock` — `SELECT ... FOR UPDATE` + decrement + `inventory_log` insert (SECURITY DEFINER)
- **3.3.4** `trg_reviews_refresh_rating` — recomputes `products.rating` and `review_count`
- **3.3.5** `consume_rate_limit()` — sliding-window rate-limit primitive
- **3.3.6** `write_audit_log()` — SECURITY DEFINER, app role has EXECUTE only
- **3.3.7** Search-path security: `SET search_path = ''` in SECURITY DEFINER functions

### 3.4 Triggers (advanced)

- **3.4.1** BEFORE vs AFTER timing choice
- **3.4.2** ROW-level vs STATEMENT-level (ROW for per-row, STATEMENT for aggregate)
- **3.4.3** When INSERT vs UPDATE vs DELETE triggers are needed
- **3.4.4** Trigger recursion prevention (e.g., `trg_reviews_refresh_rating` updates `products`, which has its own triggers)
- **3.4.5** `WHEN (OLD.* IS DISTINCT FROM NEW.*)` for efficient conditional triggers

### 3.5 Views (intermediate)

- **3.5.1** `security_invoker = true` (NOT definer — respects caller's privileges)
- **3.5.2** Materialized views vs simple views (when to use each)
- **3.5.3** View stability: never depend on row order without ORDER BY
- **3.5.4** Schema binding: `WITH LOCAL CHECK OPTION` (default in PG 9.4+) for updatable views

### 3.6 Migrations (intermediate)

- **3.6.1** Idempotent: every DDL wrapped in `IF NOT EXISTS` or `DO $$ BEGIN ... END $$`
- **3.6.2** Transactional: each file wrapped in `BEGIN; ... COMMIT;`
- **3.6.3** Sequential numbering: `0001` through `0018` (and growing)
- **3.6.4** Reversibility: include down patterns or document why irreversible
- **3.6.5** Never edit a committed migration; create a new one that mutates state

### 3.7 Roles & Least Privilege (advanced)

- **3.7.1** Explicit GRANTs (NEVER `GRANT ALL`)
- **3.7.2** Separate roles for DDL, runtime, and read-only
- **3.7.3** `ALTER DEFAULT PRIVILEGES` for future tables
- **3.7.4** `noufex_owner` (DDL), `noufex_app` (runtime CRUD with allowlist), `noufex_readonly` (BI)
- **3.7.5** `SECURITY DEFINER` for sensitive functions; app role has EXECUTE only

### 3.8 Performance (advanced)

- **3.8.1** `EXPLAIN ANALYZE` interpretation
- **3.8.2** Window functions: `COUNT(*) OVER ()` for paginated totals in one round-trip
- **3.8.3** `LATERAL` joins for correlated subqueries
- **3.8.4** `EXISTS` vs `IN` vs `JOIN` query plan choice
- **3.8.5** CTEs (`WITH`) for query readability without forcing materialization

> **Files to master:** `database/schema.sql`, `database/schema-extra.sql`, `database/migrations/*.sql`, `database/functions.sql`, `database/triggers.sql`, `database/views.sql`, `database/roles.sql`

---

## 🌳 4. Security Engineering (OWASP API Security Top 10 2023)

### 4.1 OWASP API1:2023 — Broken Object Level Authorization (BOLA)

- **4.1.1** Every resource-fetching route checks `req.user.id === :resourceOwnerId OR req.user.role === 'admin'`
- **4.1.2** Pattern: `if (req.user!.role !== 'admin' && resource.user_id !== req.user!.id) return sendError(res, 'Forbidden', 403);`

### 4.2 OWASP API2:2023 — Broken Authentication

- **4.2.1** Never accept passwords in plain text over the wire (TLS termination at edge)
- **4.2.2** Generic error messages on login: "Invalid credentials" (not "user not found" vs "wrong password")
- **4.2.3** Rate-limit login attempts (5/min per IP + per account)
- **4.2.4** 2FA enrollment rate-limit (10/hour)

### 4.3 OWASP API3:2023 — Broken Object Property Level Authorization (BOPLA)

- **4.3.1** Explicit column lists in `SELECT` (NEVER `SELECT *` in production handlers)
- **4.3.2** Zod schemas with `.strict()` mode to reject unknown fields
- **4.3.3** Separate "user can update" vs "admin can update" schemas

### 4.4 OWASP API4:2023 — Unrestricted Resource Consumption

- **4.4.1** Rate limiting per IP, per user, per endpoint
- **4.4.2** JSON body size limit (1MB)
- **4.4.3** Pagination limits (`Math.max(1, Math.min(100, ...))`)
- **4.4.4** Webhook rate limit (prevent abuse of unauthenticated endpoint)
- **4.4.5** Pagination via `COUNT(*) OVER ()` (one round-trip, not two)

### 4.5 OWASP API5:2023 — Broken Function Level Authorization

- **4.5.1** `requireRole(...allowed)` middleware
- **4.5.2** Self-protection: admin cannot ban self, cannot demote self
- **4.5.3** Per-action role checks (not just per-resource)

### 4.6 OWASP API6:2023 — Unrestricted Access to Sensitive Business Flows

- **4.6.1** Coupon redemption rate limits
- **4.6.2** Order creation per-user rate limit
- **4.6.3** Bulk-export rate limits
- **4.6.4** Password reset flow throttling

### 4.7 OWASP API7:2023 — Server Side Request Forgery (SSRF)

- **4.7.1** Webhook URLs are provider-controlled (not user-supplied)
- **4.7.2** No image upload + URL fetch combination (out of scope for v1)

### 4.8 OWASP API8:2023 — Security Misconfiguration

- **4.8.1** CSP with nonce, no `unsafe-inline` in production
- **4.8.2** CORS allowlist (NEVER `*`)
- **4.8.3** HSTS enabled in production
- **4.8.4** Generic error messages to clients (PG error translation via `PG_TRANSLATION` table)
- **4.8.5** Security headers complete: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy

### 4.9 OWASP API9:2023 — Improper Inventory Management

- **4.9.1** Single OpenAPI spec (PLANNED — gap)
- **4.9.2** Versioned API (`/api/v1/...` is the GOAL, current is `/api/...`)
- **4.9.3** Deprecation policy with `Sunset` and `Deprecation` headers
- **4.9.4** API documentation in `docs/architecture/api.md`

### 4.10 OWASP API10:2023 — Unsafe Consumption of APIs

- **4.10.1** Webhook signature verification (HMAC) — DONE
- **4.10.2** Webhook raw body preservation
- **4.10.3** Provider response sanitization (no raw gateway JSON returned to client)

### 4.11 Cryptography (foundational)

- **4.11.1** scrypt for password hashing
- **4.11.2** HMAC-SHA256 for token signing
- **4.11.3** `timingSafeEqual` for ALL secret comparisons
- **4.11.4** 16-byte minimum random IV/salt
- **4.11.5** `crypto.randomBytes(32)` for AUTH_SECRET generation (32+ chars)
- **4.11.6** No `Math.random()` for any security-sensitive value

> **Files to master:** `app/server/middleware.ts` (securityHeaders, requireAuth, requireRole), `app/server/lib/shared.cts` (hashPassword, signAuthToken, writeAuditLog), `app/server/lib/payments/{stripe,paymob}.cts` (webhook signature verification)

---

## 🌳 5. Quality Engineering (Testing)

### 5.1 Test Pyramid (foundational)

- **5.1.1** Unit tests: pure functions, isolated (Vitest, no DB)
- **5.1.2** Integration tests: route handlers, real Express, real auth, mocked pg
- **5.1.3** E2E tests: PowerShell scripts in `tests/e2e/`, real DB, real server
- **5.1.4** A11y tests: `vitest-axe` + `axe-core` for WCAG 2.1 AA compliance

### 5.2 Vitest Configuration

- **5.2.1** Two projects: `server` (Node env) and `dom` (happy-dom)
- **5.2.2** `globals: false` — explicit imports for clarity
- **5.2.3** Per-file setup via `setupFiles`
- **5.2.4** Coverage via `@vitest/coverage-v8`
- **5.2.5** `test:ui` for interactive debugging

### 5.3 Test Patterns

- **5.3.1** `signTestToken` helper for real Bearer token signing
- **5.3.2** `installFetchSpy` / `uninstallFetchSpy` for MSW-style fetch mocking
- **5.3.3** Global `pg` mock (zero DB dependency for unit tests)
- **5.3.4** `buildApp()` factory for each route test file
- **5.3.5** Property-based testing (planned) for pgify state machine

### 5.4 Accessibility Testing (MANDATORY)

- **5.4.1** `vitest-axe` is a required CI check (added in P2-09)
- **5.4.2** Every new component needs an a11y test in `app/src/__tests__/a11y/`
- **5.4.3** Test: zero `axe()` violations + ARIA well-formedness + keyboard navigation
- **5.4.4** Manual checklist for screen reader testing (NVDA, VoiceOver)

### 5.5 Coverage Targets (intermediate)

- **5.5.1** Current: 16.91% lines, 16.61% branches, 31.21% functions
- **5.5.2** Target: 80% lines, 70% branches, 90% functions for new code
- **5.5.3** Server `index.cjs` (0% covered) needs to be addressed via route-level integration tests
- **5.5.4** Excludes: `app/src/components/ui/*` (shadcn primitives, vendor code)

> **Files to master:** `app/vitest.config.ts`, `app/tests/setup.ts`, all files in `app/server/tests/`, all files in `app/src/**/__tests__/`, `tests/e2e/phase*.ps1`

---

## 🌳 6. DevOps & Site Reliability

### 6.1 Docker (intermediate)

- **6.1.1** Multi-stage builds: `deps` → `build` → `runtime` (production only has `runtime`)
- **6.1.2** `tini` as PID 1 for proper signal handling (SIGTERM → graceful shutdown)
- **6.1.3** Non-root user (`node`, uid=1000)
- **6.1.4** Layer caching optimization (package.json change = full reinstall; src change = rebuild only)
- **6.1.5** `HEALTHCHECK` directive (interval=30s, timeout=10s, retries=3)
- **6.1.6** `.dockerignore` to exclude `.git`, `node_modules`, `coverage`, etc.

### 6.2 CI/CD (intermediate)

- **6.2.1** GitHub Actions: 6 workflows (ci, link-check, docs, deploy-staging, deploy-prod, a11y)
- **6.2.2** Required status checks: lint, typecheck, test, build, a11y
- **6.2.3** `actions/setup-node@v4` with `cache: npm`, `cache-dependency-path: app/package-lock.json`
- **6.2.4** Working directory: `app/` for all npm steps
- **6.2.5** `concurrency` to cancel superseded runs

### 6.3 Build Tools (intermediate)

- **6.3.1** TypeScript project references: `tsconfig.app.json` + `tsconfig.server.json` + `tsconfig.node.json`
- **6.3.2** esbuild for server bundle: `--packages=external --format=esm` (CJS→ESM bridge)
- **6.3.3** Vite for client bundle: code splitting, tree-shaking, asset hashing
- **6.3.4** Husky pre-commit hook: `lint-staged` runs ESLint + Prettier on staged files

### 6.4 Observability (planned)

- **6.4.1** Structured logging: JSON to stdout (one line per request)
- **6.4.2** `request_id` propagation: header in, header out, in every log line
- **6.4.3** Health endpoints: `/api/health` (liveness), `/api/ready` (readiness with DB check)
- **6.4.4** Metrics: Prometheus-compatible (PLANNED)
- **6.4.5** Error tracking: Sentry-compatible (PLANNED)

### 6.5 Release Engineering

- **6.5.1** release-please: conventional commit parsing → auto version bump → auto CHANGELOG
- **6.5.2** SemVer: MAJOR (breaking), MINOR (feature), PATCH (fix)
- **6.5.3** `release-please-config.json` configuration
- **6.5.4** `Keep a Changelog` format in `CHANGELOG.md`

> **Files to master:** `Dockerfile`, `docker-compose.yml`, `.github/workflows/*.yml`, `.dockerignore`, `.github/branch-protection.md`, `release-please-config.json`, `package.json` (root and app)

---

## 🌳 7. Documentation & Knowledge Engineering

### 7.1 Diátaxis Framework (intermediate)

- **7.1.1** `tutorials/` — Learning-oriented, step-by-step paths ("First 10 minutes", "Run an order end-to-end")
- **7.1.2** `how-to/` — Task-oriented, problem-solving ("How to deploy", "How to add an a11y test")
- **7.1.3** `reference/` — Information-oriented, technical specs (architecture, security, ER diagram, a11y standard)
- **7.1.4** `explanation/` — Understanding-oriented, design decisions, ADRs

### 7.2 Documentation Standards

- **7.2.1** Keep a Changelog 1.1.0 format in `CHANGELOG.md`
- **7.2.2** Conventional Commits for commit messages
- **7.2.3** Code comments: WHY not WHAT (the code already shows what)
- **7.2.4** JSDoc/TSDoc for public APIs

### 7.3 ADRs (Architecture Decision Records)

- **7.3.1** `docs/planning/adr/0001-mkdocs-and-release-please.md`
- **7.3.2** `docs/planning/adr/0002-vitest-axe-a11y.md`
- **7.3.3** Future: `0003-...md` for each significant decision

### 7.4 Reference Documents

- **7.4.1** `docs/STRUCTURE.md` — canonical repo map
- **7.4.2** `docs/MASTER_PLAN.md` — single source of truth for project status
- **7.4.3** `docs/architecture/overview.md` — system architecture
- **7.4.4** `docs/architecture/security.md` — OWASP API Security mapping
- **7.4.5** `docs/testing/standards/a11y.md` — WCAG 2.1 AA testing standard

> **Files to master:** `docs/STRUCTURE.md`, `docs/MASTER_PLAN.md`, `docs/architecture/*.md`, `docs/testing/standards/*.md`, `docs/planning/adr/*.md`

---

## 🌳 8. AI-Agent Operations (12 custom agents + 20+ skills)

### 8.1 Agent Inventory (`.github/agents/*.agent.md`)

| Agent | Specialty | When to invoke |
|-------|-----------|----------------|
| `@architect` | System design, SOLID, pattern selection | Major refactors, new subsystems |
| `@backend` | Express, Node, PostgreSQL | API endpoints, auth, middleware |
| `@database` | PG 17, schema, indexes, PL/pgSQL | Migrations, query optimization |
| `@debug` | Error analysis, stack traces | Test failures, runtime errors |
| `@devops` | Docker, CI/CD, release | Build failures, deployment |
| `@doc` | Diátaxis, MkDocs, ADRs | Doc updates, new features |
| `@frontend` | React 19, Vite, Tailwind, a11y | UI components, pages |
| `@performance` | Bundle, N+1, indexing | Slow pages, large queries |
| `@refactor` | God objects, duplication, coupling | Code review, refactoring |
| `@reviewer` | Best practices, security, testing | Pre-merge review |
| `@security` | OWASP, auth, cryptography | Security audit, vuln fix |
| `@tester` | Coverage, quality, E2E | Test gap analysis |

### 8.2 Skill Inventory (`.github/skills/*.skill.md`)

- **8.2.1** `analyze`, `plan`, `implement` — workflow skills
- **8.2.2** `refactor`, `fix`, `verify` — code quality skills
- **8.2.3** `document`, `test`, `review` — verification skills
- **8.2.4** `noufex-project` — project-specific context
- **8.2.5** `standards-aware` — enforce global standards (ISO, IEEE, OWASP, WCAG)
- **8.2.6** `feasibility-study` — ROI analysis before major work
- **8.2.7** `scaffold`, `cleanup`, `organize` — project lifecycle

### 8.3 MCP Server (intermediate)

- **8.3.1** `mcp-server/` — TypeScript implementation of Model Context Protocol
- **8.3.2** Exposes PG queries as MCP tools (read-only by default)
- **8.3.3** `pg` + `zod` + `@modelcontextprotocol/sdk` dependencies

### 8.4 Copilot Workspace Configuration

- **8.4.1** `.vscode/settings.json` — MiniMax API config, agent preferences
- **8.4.2** `.vscode/tasks.json` — 28+ tasks (test, build, lint, format)
- **8.4.3** `.vscode/launch.json` — debug configurations
- **8.4.4** `.vscode/extensions.json` — recommended + unwanted extensions

> **Files to master:** All 12 `app/.github/agents/*.agent.md` files, all 20+ `app/.github/skills/*.skill.md` files, `app/mcp-server/`

---

## 🌳 9. Project & Release Engineering

### 9.1 Git Workflow (foundational)

- **9.1.1** Conventional Commits 1.0.0:
  - `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `ci:`, `build:`, `style:`
  - Scoping: `feat(admin): add K.8 by-governorate endpoint`
- **9.1.2** Imperative mood in subject ("add", not "added")
- **9.1.3** Body explains WHY, not WHAT
- **9.1.4** Reference issues: `Refs: #123`
- **9.1.5** Co-author attribution: `Co-Authored-By: Name <email>`

### 9.2 Branching Strategy (intermediate)

- **9.2.1** `main` — production-ready, protected by branch protection
- **9.2.2** `feat/*` — feature branches, squash-merged
- **9.2.3** `fix/*` — bugfix branches, squash-merged
- **9.2.4** `release-please--*` — auto-created release PRs
- **9.2.5** `opencode/*` — agent workspace branches (excluded from main)

### 9.3 Code Review (intermediate)

- **9.3.1** All PRs require 1+ approval (CODEOWNERS)
- **9.3.2** Required CI checks must pass
- **9.3.3** No direct pushes to `main`
- **9.3.4** Review checklist (see `docs/development/workflow.md`)

### 9.4 SemVer & Release (intermediate)

- **9.4.1** SemVer 2.0.0: `MAJOR.MINOR.PATCH`
- **9.4.2** Pre-1.0 (current): 0.MINOR.PATCH, no stability guarantees
- **9.4.3** release-please automation: conventional commits → version bump → CHANGELOG → PR
- **9.4.4** Tag format: `v1.2.3` (with `v` prefix)

> **Files to master:** `CHANGELOG.md`, `release-please-config.json`, `.github/CODEOWNERS`, `.github/branch-protection.md`, `docs/development/workflow.md`

---

## 🌳 10. Cross-Cutting Concerns

### 10.1 Security Hardening (Critical, Ongoing)

- **10.1.1** Rotate compromised credentials (DB password + AUTH_SECRET) — `git filter-repo` to scrub history
- **10.1.2** Enable webhook rate limits (per IP per provider)
- **10.1.3** Add CSP `report-uri` for ongoing monitoring
- **10.1.4** Migrate from `localStorage` JWT to `httpOnly` cookie + CSRF token
- **10.1.5** Enable PostgreSQL row-level security (RLS) for multi-tenant isolation

### 10.2 Performance Optimization (High Priority)

- **10.2.1** Lazy-load recharts (admin routes only)
- **10.2.2** Split `gsap` and `framer-motion` into separate chunks
- **10.2.3** Add composite indexes for hot queries (per `docs/architecture/database.md` review)
- **10.2.4** Enable Redis cache layer (rate limiting + token_version cache)
- **10.2.5** Implement cursor-based pagination for large tables

### 10.3 Architecture Refactoring (Medium Priority)

- **10.3.1** Split `lib/shared.cts` (god object, 36KB, 7 responsibilities)
- **10.3.2** Add service layer between routes and `pg` (19 routes currently bypass)
- **10.3.3** Fix circular import risk between `middleware.ts` and `lib/shared.cts`
- **10.3.4** Document service boundaries in `docs/architecture/overview.md`

### 10.4 Test Coverage Expansion (Medium Priority)

- **10.4.1** Add tests for `logout`, `change-password` (currently untested)
- **10.4.2** Add 2FA happy path tests (currently only rate limit + validation)
- **10.4.3** Add payment idempotency tests (`provider_txn_id` webhook replay)
- **10.4.4** Add stock decrement tests (`trg_order_items_decrement_stock`)
- **10.4.5** Add tests for the 17 untested frontend pages (33% → 80%+)
- **10.4.6** Add tests for `messages.cts` (only route with zero tests)

### 10.5 Documentation Improvements (Low Priority)

- **10.5.1** Generate OpenAPI spec from route handlers (eliminate drift)
- **10.5.2** Update ER diagram in `docs/architecture/er-diagram.md`
- **10.5.3** Document all `env vars` in `docs/operations/`
- **10.5.4** Add onboarding runbook in `docs/development/getting-started.md`

---

## 📊 11. Skill Levels

> **Adapted from CMMI v2.0 Process Areas and SWEBOK v4 Knowledge Areas**

| Level | Title | Years Experience | Capabilities |
|-------|-------|------------------|-------------|
| **J** | **Junior** | 0-2 years | Implements assigned tasks under supervision; follows style guide; writes tests for own code; asks questions; uses existing patterns |
| **M** | **Mid** | 2-5 years | Designs new features; writes integration tests; reviews PRs; documents in Diátaxis; refactors small modules; mentors juniors |
| **S** | **Senior** | 5+ years | Architects subsystems; designs the testing strategy; writes ADRs; identifies and fixes systemic issues; leads the security audit; proposes standards |

### 11.1 Skill Level Matrix (by Domain)

| Domain | Junior | Mid | Senior |
|--------|--------|-----|--------|
| 1. Frontend | React hooks, JSX | Code splitting, Suspense | Performance, a11y |
| 2. Backend | Routes, middleware | Auth, webhooks | Architecture, scaling |
| 3. Database | SELECT, INSERT | Indexes, joins | Stored procs, optimization |
| 4. Security | HTTPS, passwords | OWASP, CSP | Threat modeling, pen testing |
| 5. Testing | Unit tests | Integration, mocks | Coverage strategy, E2E |
| 6. DevOps | Git, npm | Docker, CI/CD | K8s, observability |
| 7. Documentation | README | Diátaxis | ADRs, standards |
| 8. AI Agents | Basic Copilot | Custom agents | Skill design, workflows |
| 9. Project Mgmt | Git basics | Conventional Commits | Release engineering |

### 11.2 Promotion Criteria

| From | To | Criteria |
|------|----|----|
| J → M | Independently ships 1 feature end-to-end (frontend + backend + tests + docs) | Reviewed by S; passes review with no critical comments |
| M → S | Designs + ships 1 subsystem (e.g., payment integration, a11y layer, observability) | Writes 1 ADR; identifies + fixes ≥3 systemic issues; leads 1 release cycle |

---

## 📚 12. Resource Library

### 12.1 Official References (cited in code)

- [React 19 Documentation](https://react.dev) — Component model, hooks, concurrent features
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) — Strict mode, generics, conditional types
- [Vite Guide](https://vitejs.dev/guide/) — Build, plugins, code splitting
- [Express 5 Guide](https://expressjs.com/en/5x/api.html) — Routing, middleware, error handling
- [PostgreSQL 17 Documentation](https://www.postgresql.org/docs/17/) — SQL, functions, triggers
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/) — BOLA, BFLA, BOPLA
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/) — Perceivable, Operable, Understandable, Robust
- [Diátaxis Documentation Framework](https://diataxis.fr/) — Tutorials, How-to, Reference, Explanation
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) — Commit message standard
- [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) — CHANGELOG.md format
- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) — Version numbering
- [GitHub Copilot Documentation](https://docs.github.com/copilot) — Custom agents, skills
- [Model Context Protocol](https://modelcontextprotocol.io) — MCP server specification

### 12.2 Academic Standards Cited in This Document

- **ISO/IEC/IEEE 12207:2017** — Systems and software engineering — Software life cycle processes
- **ISO/IEC 25010:2011** — Systems and software engineering — Quality models
- **IEEE 830-1998** — Recommended practice for Software Requirements Specifications
- **IEEE 829-2008** — Standard for Software and System Test Documentation
- **ISO/IEC/IEEE 29119** — Software testing standards (parts 1-5)
- **IEEE 1028-2008** — Standard for Software Reviews and Inspections
- **SWEBOK v4** — Guide to the Software Engineering Body of Knowledge
- **CMMI v2.0** — Capability Maturity Model Integration (process areas referenced for skill levels)
- **ISO/IEC 27001** — Information security management (referenced for audit log requirements)

---

## ✅ 13. Compliance Verification

### 13.1 Self-Audit Checklist (run before any PR)

- [ ] TypeScript: `npm run typecheck` — 0 errors
- [ ] ESLint: `npm run lint` — 0 errors
- [ ] Vitest: `npm test` — 798+ / 798+ passing
- [ ] Vitest a11y: `npm run test:a11y` — 16+ / 16+ passing
- [ ] Vite build: `npm run build` — 0 errors
- [ ] esbuild server: `npm run api:build` — 0 errors
- [ ] Markdown lint: `npx markdownlint-cli2 "**/*.md"` — 0 errors
- [ ] Conventional Commits: commit message format valid
- [ ] Documentation: any new feature has Diátaxis-compliant docs

### 13.2 Pre-Release Checklist

- [ ] All `P0-` through `P2-` items from `docs/MASTER_PLAN.md` completed
- [ ] Test coverage: lines ≥ 80%, functions ≥ 90%
- [ ] Security audit: `docs/architecture/security.md` reviewed
- [ ] No hardcoded secrets in source (grep for `NpEx_`, `C2i7v`, `AUTH_SECRET=`)
- [ ] CHANGELOG.md updated via release-please PR
- [ ] Version tag follows SemVer

---

## 🔄 14. Maintenance of This Mind Map

| Action | Frequency | Owner |
|--------|-----------|-------|
| Review against current codebase | Quarterly | @architect + @reviewer |
| Add new skill (e.g., new framework) | When adopted | Tech lead |
| Add new ADRs | Per significant decision | Decision author |
| Update skill levels matrix | After promotions | Tech lead |
| Update resource library | When new standards are referenced | Tech lead |
| Bump version of this mind map | Per semver release | Release manager |

### 14.1 Versioning

This mind map follows **Semantic Versioning 2.0.0**:
- **MAJOR** (e.g., 2.0.0): incompatible structure (e.g., domain consolidation)
- **MINOR** (e.g., 1.1.0): new skill added, or domain expansion
- **PATCH** (e.g., 1.0.1): typo fix, link update, example correction

Current version: **1.0.0** (2026-07-03) — initial mandatory release

### 14.2 Change Control

Any change to this mind map:
1. MUST be proposed via PR with rationale
2. MUST be reviewed by @architect and one Senior
3. MUST be referenced in the corresponding CHANGELOG entry
4. MUST propagate to the agent instructions (`.github/copilot-instructions.md`)

---

## 🙏 Acknowledgments

This mind map is synthesized from:
- The actual Nouf-ex codebase (as of 2026-07-03)
- 4 recent commits (98939bc, a0739f9, 6f6fb7b, 8cb511e)
- 6 deep audit reports (security, performance, tester, refactor, database, doc)
- 12 custom agents in `.github/agents/`
- 20+ skills in `.github/skills/`

> **Adopted standards:** ISO/IEC/IEEE 12207:2017, ISO/IEC 25010:2011, IEEE 830-1998, IEEE 829-2008, ISO/IEC/IEEE 29119, OWASP API Security Top 10 2023, WCAG 2.1 Level AA, Diátaxis, Keep a Changelog 1.1.0, Conventional Commits 1.0.0, Semantic Versioning 2.0.0.

> **Mandatory authority:** This mind map is incorporated by reference into `.github/copilot-instructions.md` and becomes a build-blocking reference for all AI agents operating on Nouf-ex.

---

**End of Mind Map — Nouf-ex Developer Skills, End-to-End (v1.0.0)**
