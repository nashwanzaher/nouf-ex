---
name: noufex-project
description: Deep knowledge of the Nouf-ex project - context, architecture, standards, and patterns
trigger:
  - "noufex"
  - "this project"
  - "our codebase"
  - "our architecture"
  - "project context"
phases:
  - load_context
  - identify_domain
  - apply_knowledge
  - verify_alignment
inputs:
  - task
outputs:
  - context_aware_solution
verification:
  - Aligned with project standards
  - Uses correct tech stack
  - Follows project conventions
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md](../../../docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md) (v1.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Nouf-ex Project Skill

## Purpose

Apply **deep project knowledge** about Nouf-ex including architecture, tech stack, standards, patterns, and current state.

## When to Use

- Working on any Nouf-ex task
- Need project context
- Need to follow project conventions
- Need to understand current state

## Project Knowledge Base

### Tech Stack (Verified 2026-07-02)

```yaml
Frontend:
  Framework: React 19.2.0
  Build Tool: Vite 7.3.5
  Language: TypeScript 5.x (strict mode)
  UI Library: shadcn/ui + Tailwind CSS (latest)
  Router: React Router
  State: useState, useReducer, Context (no Redux)
  Form: React Hook Form
  Validation: Zod
  Date: date-fns
  Icons: lucide-react

Backend:
  Runtime: Node.js 20.18.1 (Note: Vite warns requires 20.19+)
  Framework: Express 5.2.1
  Language: TypeScript 5.x
  Validation: Zod
  Auth: JWT (jsonwebtoken) + scrypt password hashing
  Rate Limiting: express-rate-limit (custom buckets per endpoint)
  Logging: pino
  Process Manager: tsx (dev), esbuild ESM (prod)

Database:
  Engine: PostgreSQL 17 (external, not in container)
  Driver: pg 8.22.0 (with custom PgDb wrapper)
  Schema Tool: Custom SQL files (not ORM)
  Migrations: Sequential numbered files in `database/migrations/`
  Connection: Single `noufex_app` user (least privilege)

Testing:
  Framework: Vitest 4.1.9
  E2E: Playwright (planned)
  Coverage: 732 tests passing, 3 skipped (55 test files)

Build:
  Server: esbuild (ESM bundle)
  Frontend: Vite
  PWA: vite-plugin-pwa (21.18 MiB precache)

Infrastructure:
  Container: 3-stage Dockerfile (deps → build → runtime)
  Orchestration: docker-compose.yml
  CI/CD: GitHub Actions (5 jobs)
  Database: External PostgreSQL (not containerized)
```

### Project Structure (Verified)

```yaml
nouf-ex/
├── app/                          # Single npm package
│   ├── src/                      # React 19 frontend
│   │   ├── pages/                # 23 route pages
│   │   ├── components/           # UI components
│   │   ├── hooks/                # Custom hooks
│   │   ├── lib/                  # Utilities
│   │   ├── core/                 # Business logic
│   │   ├── context/              # React contexts
│   │   └── App.tsx               # Router
│   ├── server/                   # Express API
│   │   ├── index.ts              # Source
│   │   ├── index.js              # Built (esbuild)
│   │   ├── middleware.ts         # Express middleware
│   │   ├── lib/                  # Server libraries
│   │   └── routes/               # 19 route files
│   ├── tests/                    # Test code
│   ├── public/                   # Static assets
│   └── dist/                     # Built files

├── database/                     # PostgreSQL
│   ├── schema.sql                # 17 tables
│   ├── schema-extra.sql          # 10 tables
│   ├── functions.sql             # 7 functions
│   ├── views.sql                 # 4 views
│   ├── triggers.sql              # 10 triggers
│   ├── roles.sql                 # 3 app roles
│   ├── seed.sql                  # Demo data
│   └── migrations/               # 13 migrations

├── docs/                         # Active documentation
│   ├── architecture/             # System design
│   ├── development/              # Dev guides
│   ├── operations/               # Ops guides
│   ├── planning/                 # Roadmap, risks, competitive analysis
│   ├── testing/                  # Test docs
│   ├── tutorials/                # How-tos
│   ├── workflows/                # Process docs (was: n8n — removed 2026-07-11)
│   ├── architecture/             # Architecture docs
│   ├── audits/                   # Periodic conformance audits
│   └── planning/REMEDIATION_ROADMAP_2026-Q3.md   # Active P0–P3 backlog

├── scripts/                      # Build/utility scripts
├── docker/                       # Docker support
├── tests/                        # Cross-cutting tests
├── mcp-server/                   # MCP server package
├── .github/                      # GitHub config
│   ├── agents/                   # 12 agent files
│   ├── skills/                   # 21 skill files
│   ├── workflows/                # CI/CD
│   └── copilot-instructions.md   # Agent instructions

└── .vscode/                      # VS Code config
```

### Standards Applied

```yaml
Documentation Standards:
  - IEEE 829-2008 (Software Test Documentation)
  - ISO/IEC/IEEE 29119 (Software Testing)
  - ISTQB CTFL (Testing)
  - Google Style Guide
  - Microsoft Docs (.NET Architecture Guides)
  - Diátaxis (Documentation framework: tutorial/how-to/reference/explanation)
  - Keep a Changelog

Code Standards:
  - TypeScript strict mode (0 errors)
  - ESLint (0 issues)
  - Prettier formatting
  - JSDoc for public APIs
  - Conventional commits

Testing Standards:
  - ISTQB CTFL methodology
  - AAA pattern (Arrange, Act, Assert)
  - 80%+ coverage target
  - Test isolation

Security Standards:
  - OWASP Top 10 awareness
  - JWT + scrypt
  - RBAC
  - Rate limiting
  - CORS allow-list
```

### Database Schema (30 tables, verified 2026-07-02)

```yaml
Application Tables (27):
  - users (customers, sellers, admins)
  - stores (seller shops)
  - products (catalog items)
  - categories (product categorization)
  - product_images (multi-image support)
  - orders (customer orders)
  - order_items (line items)
  - payments (payment records)
  - reviews (product reviews)
  - coupons (discount codes)
  - addresses (shipping addresses)
  - sessions (JWT tracking)
  - audit_log (change tracking)
  - ... (15 more)

System Tables (3):
  - schema_migrations (migration tracking)
  - rate_limit_buckets (rate limiter state)
  - search_logs (search history)
  - used_jtis (revoked tokens)

Roles (3):
  - noufex_owner (schema owner)
  - noufex_app (runtime user, least privilege)
  - noufex_readonly (read-only reporting)

Functions (13):
  - update_updated_at() trigger function
  - Order/payment calculation functions
  - Search functions
  - Aggregation functions

Views (4):
  - mv_product_stats (materialized)
  - v_order_summary
  - v_user_activity
  - v_payment_status
```

### API Patterns (91 endpoints)

```yaml
API Conventions:
  Base: /api
  Auth: JWT in Authorization header
  Response Format: { success: bool, data?: T, error?: { code, message, details? } }
  Versioning: URL path (planned)
  Documentation: Inline JSDoc + OpenAPI planned

Endpoint Patterns:
  - GET /api/{resource} - List with pagination
  - GET /api/{resource}/:id - Get one
  - POST /api/{resource} - Create
  - PATCH /api/{resource}/:id - Update
  - DELETE /api/{resource}/:id - Delete
  - POST /api/{resource}/:id/{action} - Custom action

Authentication Endpoints:
  - POST /api/auth/register
  - POST /api/auth/login
  - POST /api/auth/logout
  - POST /api/auth/refresh
  - POST /api/auth/2fa/* (8 endpoints with separate rate limits)

Status Codes:
  - 200: OK
  - 201: Created
  - 204: No Content (DELETE)
  - 400: Validation Error
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not Found
  - 409: Conflict
  - 429: Rate Limit
  - 500: Server Error
```

### Frontend Patterns

```yaml
React 19 Patterns:
  - Functional components only
  - Custom hooks for reusable logic
  - useSyncExternalStore for external state
  - useReducer for complex state
  - Suspense + lazy for code splitting
  - memo for expensive components

Routing:
  - 23 routes in App.tsx
  - ProtectedRoute component for auth
  - Role-based access (admin/seller/customer)
  - NotFound for unknown routes

State Management:
  - useDataHook (custom hook pattern)
  - stable fetcherRef pattern
  - Side effects outside reducers
  - Context for global state

Forms:
  - React Hook Form
  - Zod validation
  - Error messages

Accessibility:
  - WCAG 2.1 AA target
  - Semantic HTML
  - ARIA labels
  - Keyboard navigation
  - Focus management

i18n:
  - AR: 970 keys (primary)
  - EN: 828 keys
  - ZH: 895 keys
  - RTL support for Arabic
```

### Current Project State (2026-07-02)

```yaml
Build Status:
  TypeScript: 0 errors ✅
  ESLint: 0 issues ✅
  Tests: 732 passing / 3 skipped ✅
  Build: OK ✅
  Server boot smoke: passing ✅

Code Coverage:
  Current: High (specific % per file)
  Target: 80%+ all metrics

Deployment:
  Container: docker-compose.yml
  External Postgres: noufex_db
  API endpoint: http://localhost:3000

Git Status:
  Branch: main
  Last commit: d85f4a9 (Phase K docs)
  Ahead of origin: 2 commits (d85f4a9, 4eeda90)
  Local branches: opencode/silent-engine (Phase K K.1 partial)

Features:
  ✅ Authentication (register, login, JWT, 2FA, password hashing)
  ✅ Products (CRUD, images, categories)
  ✅ Cart (with store_id resolution)
  ✅ Orders (with payments integration)
  ✅ Reviews
  ✅ Coupons
  ✅ Admin (with some orphaned pages)
  ✅ Seller dashboard
  ✅ Customer dashboard
  ⏳ Search (basic only)
  ⏳ Notifications (basic only)
  ⏳ Analytics (basic only)

Known Issues:
  - 8 YER hardcoding locations (4 Checkout + 2 SellerDashboard + 2 CustomerDashboard)
  - 5 orphaned admin pages (UsersManagement, StoresManagement, etc.)
  - 14 missing features (P1: 4, P2: 6, P3: 4)
  - 30 tasks pending (Phase E, F, G, J)
```

### Standards References

```yaml
Internal:
  - docs/STRUCTURE.md (canonical map)
  - docs/planning/REMEDIATION_ROADMAP_2026-Q3.md (active P0–P3 backlog)
  - docs/planning/risks.md (risk register)
  - docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md (latest conformance audit)
  - .github/copilot-instructions.md (agent instructions)
  - .github/STANDARDS.md (engineering standards)
  - .github/agents/*.md (12 expert agents)
  - .github/skills/*.md (21 skills)

External:
  - IEEE 829-2008: https://standards.ieee.org/ieee/829/4987/
  - ISO/IEC/IEEE 29119: https://www.iso.org/standard/81291.html
  - ISTQB: https://www.istqb.org/
  - Google Style Guide: https://google.github.io/styleguide/
  - Diátaxis: https://diataxis.fr/
  - Keep a Changelog: https://keepachangelog.com/
  - PostgreSQL Docs: https://www.postgresql.org/docs/
  - React Docs: https://react.dev/
  - Express Docs: https://expressjs.com/
  - OWASP: https://owasp.org/
  - WCAG: https://www.w3.org/WAI/WCAG21/quickref/
```

## Project Context Loader

When starting any task, use this framework:

```yaml
Step 1: Understand Context
  - What is being asked?
  - Which area does it affect? (frontend/backend/database/devops/etc.)
  - What's the current state of that area?
  - Are there related docs in /docs?

Step 2: Apply Standards
  - What standards apply? (IEEE, ISO, Google, etc.)
  - What are the project conventions?
  - What's the testing requirement?
  - What's the documentation requirement?

Step 3: Use Tech Stack
  - Are we using the right tools?
  - Are there established patterns?
  - What do similar components look like?

Step 4: Implement
  - Follow established patterns
  - Use TypeScript strict mode
  - Add tests
  - Update documentation

Step 5: Verify
  - Run typecheck, lint, tests
  - Verify against acceptance criteria
  - Update CHANGELOG
  - Commit
```

## Common Tasks in Nouf-ex

### Add a New API Endpoint

```yaml
Files to Create/Modify:
  - apps/api/src/routes/{resource}.ts (endpoint)
  - app/mocks/{resource}.test.ts (tests)
  - database/migrations/{N+1}__{description}.sql (if DB change)

Pattern:
  1. Validate input with Zod
  2. Authenticate if needed
  3. Authorize if needed
  4. Business logic
  5. Database operation (parameterized)
  6. Return standardized response

Example:
  router.get('/api/products', authenticate, async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const products = await db.query(...);
      res.json({ success: true, data: products.rows });
    } catch (error) {
      next(error);
    }
  });
```

### Add a New React Page

```yaml
Files to Create/Modify:
  - apps/web/src/pages/{role}/{PageName}.tsx (page component)
  - apps/web/src/App.tsx (add route)
  - app/mocks/{PageName}.test.tsx (tests)
  - README.md updates (if needed)

Pattern:
  1. Functional component with TypeScript
  2. Use existing hooks
  3. Handle loading and error states
  4. Add i18n keys (AR, EN, ZH)
  5. Add tests

Example:
  export const ProductPage: React.FC = () => {
    const { data, isLoading, error } = useProducts();
    if (isLoading) return <Loading />;
    if (error) return <Error error={error} />;
    return <ProductList products={data} />;
  };
```

### Add a Database Table

```yaml
Files to Create:
  - database/migrations/{N+1}__{description}.sql
  - app/mocks/db/{table}.test.ts (if needed)

Pattern:
  1. UUID primary key
  2. TIMESTAMPTZ for timestamps
  3. NOT NULL where required
  4. CHECK constraints for validation
  5. Indexes for common queries
  6. Triggers for updated_at
  7. Migration recorded in schema_migrations

Example:
  CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_new_table_created_at ON new_table(created_at DESC);
  CREATE TRIGGER new_table_updated_at BEFORE UPDATE ON new_table
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Domain Knowledge

### E-commerce Domain

```yaml
Core Entities:
  - Customer (browses, buys)
  - Seller (sells)
  - Admin (manages)
  - Product (listed by sellers)
  - Order (created by customers)
  - Payment (for orders)
  - Category (groups products)
  - Store (seller shop)
  - Review (customer feedback)
  - Coupon (discounts)

Key Flows:
  Registration:
    User → Register → Email Verify → Login → Browse

  Purchase:
    Browse → Product → Add to Cart → Checkout → Address → Payment → Order Confirmation → Fulfillment → Review

  Selling:
    Register as Seller → Create Store → List Products → Manage Inventory → Receive Orders → Fulfill → Get Paid

Business Rules:
  - One user can be both customer and seller
  - Orders go to specific stores (multi-vendor)
  - Payments may be split across sellers
  - Reviews require verified purchase
  - Coupons have usage limits
```

### Technical Patterns

```yaml
Backend Patterns:
  - Source of truth: server (client is display)
  - Idempotency for state changes
  - Transactions for multi-step operations
  - Audit logging for sensitive operations
  - Rate limiting per endpoint

Frontend Patterns:
  - Server-first (trust server data)
  - Optimistic UI for better UX
  - Suspense for loading states
  - Error boundaries for failures

Database Patterns:
  - UUID over serial IDs (distributed-safe)
  - TIMESTAMPTZ over TIMESTAMP
  - Soft delete (deleted_at) where appropriate
  - Audit fields (created_at, updated_at)
  - Triggers for derived data

Security Patterns:
  - JWT short-lived (15 min)
  - Refresh tokens (httpOnly cookies)
  - Rate limiting on auth endpoints
  - CORS allow-list
  - Input validation at boundaries
```

## Output Template

```markdown

## Nouf-ex Solution

### Context Understanding

[What I understood about the task]

### Standards Applied

- IEEE: [...]
- ISO: [...]
- Project Conventions: [...]

### Approach

[Step-by-step approach]

### Files

- [List of files to create/modify]

### Code

[Code with patterns from existing codebase]

### Tests

[Test approach]

### Documentation

[Docs to update]
```

## Verification Checklist

- [ ] Context understood
- [ ] Standards identified
- [ ] Tech stack correct
- [ ] Patterns consistent with codebase
- [ ] Tests included
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] All verification passed

## Anti-Patterns to Avoid

```yaml
Don't:
  - Use wrong tech stack (e.g., MongoDB instead of PostgreSQL)
  - Skip TypeScript types
  - Use 'any' type
  - Skip input validation
  - Hardcode values
  - Mix concerns
  - Bypass authentication
  - Skip error handling
  - Forget i18n
  - Ignore accessibility
```
