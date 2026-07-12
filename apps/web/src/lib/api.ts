/**
 * Nouf-ex Frontend API Client — Backward-compatibility shim
 *
 * As of R-22 (MIGRATION_EXECUTION_PLAN.md v2.8.2 §42), the 166-export
 * monolith that used to live here has been split into 16 domain
 * modules under `./api/` (products.ts, orders.ts, auth.ts, etc.).
 *
 * This file is now a thin re-export of `./api/index.ts` so any
 * existing import like `import { getProducts } from '@/lib/api'`
 * keeps working without code changes.
 *
 * New code SHOULD import from the specific domain module instead:
 *   import { getProducts } from '@/lib/api/products';
 * ... so the bundler can tree-shake unused domains from the
 * production build.
 */

export * from './api/index';