# ADR-0012: TypeScript SDK auto-generated from OpenAPI

## Status

Accepted

## Date

2026-07-16

## Context

We had two hand-written API client wrappers:
- `apps/web/src/features/*/api/*.ts` — React Query hooks for the
  web app
- `apps/mobile/src/features/products/api/products.ts` — fetch
  wrapper for the mobile app

Both hand-coded the response shapes and drifted from the actual
API contract at least three times in the past 60 days. A
mutated response shape (e.g. `data.data.products` instead of
`data.products`) would silently fail in production because the
TypeScript types still allowed it.

Industry references: Stripe's open-source SDK generator, AWS
SDK for JavaScript v3 (codegen-driven), GitHub's `openapi-typescript`.

## Decision

Adopt the **official `openapi-typescript`** tool as the source
of truth for the SDK:

1. `apps/api/src/lib/openapi.ts` produces the canonical OpenAPI
   3.1 document from the same Zod schemas that validate
   requests. Single source of truth.
2. `scripts/openapi/generate-json.ts` runs the generator and
   emits `apps/api/openapi.generated.json` + the matching
   file in `packages/api-client/openapi.generated.json`. Both
   are committed to git (deterministic output).
3. `packages/api-client/` is a new workspace that wraps
   `openapi-fetch` with Noufex-specific defaults:
   - Stripe-style `Accept: application/vnd.noufex.v1+json`
   - `x-request-id` stamped on every request
   - Bearer-token auth helper
4. The web and mobile apps will switch from their hand-written
   clients to `@noufex/api-client` in Tier 7 (separate ADR).

## Consequences

### Positive

- Drift is impossible — the SDK cannot compile against an
  OpenAPI spec that doesn't match the runtime contract.
- New endpoints appear in the SDK on the next `npm run
  openapi:generate` — no manual client updates.
- Single typed surface for web, mobile, and any future
  consumer (server-to-server, CLI tools).

### Negative

- Build-time dependency on `openapi-typescript`. Mitigated:
  the tool is officially maintained and the runtime only
  depends on `openapi-fetch`, which is much smaller.

### Neutral

- The existing hand-written clients can stay in place until
  Tier 7 migrates them. The new SDK is the recommended path
  for all new code.