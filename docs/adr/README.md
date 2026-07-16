# Architecture Decision Records (ADRs)

This directory contains the ADRs that have shaped Noufex.
Each ADR captures **one decision** in the format recommended by
the [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
blog (Michael Nygard). The format is lightweight on purpose:
keep ADRs short, dated, and immutable once accepted.

## Index

| #   | Title | Status | Date |
|-----|-------|--------|------|
| 0001 | Use PostgreSQL 17 as the system of record | Accepted | 2026-07-04 |
| 0002 | Cache-aside with Redis + PG fallback (fail-OPEN) | Accepted | 2026-07-05 |
| 0003 | RabbitMQ for async messaging with DLQs | Accepted | 2026-07-06 |
| 0004 | Elasticsearch for search with PG FTS fallback | Accepted | 2026-07-08 |
| 0005 | Cloudflare as the edge CDN + WAF provider | Accepted | 2026-07-10 |
| 0006 | React Native (Expo) for mobile, sharing types via monorepo | Accepted | 2026-07-11 |
| 0007 | OpenAPI 3.1 as the contract-of-truth | Accepted | 2026-07-13 |
| 0008 | OpenTelemetry (W3C Trace Context) for distributed tracing | Accepted | 2026-07-14 |
| 0009 | IETF RateLimit-* headers (draft-ietf-httpapi-ratelimit-headers) | Accepted | 2026-07-15 |
| 0010 | Stripe-style API versioning (RFC 6838 + RFC 8594) | Accepted | 2026-07-16 |
| 0011 | Tier 1.4 — workers in a separate container | Accepted | 2026-07-16 |
| 0012 | TypeScript SDK auto-generated from OpenAPI | Accepted | 2026-07-16 |

## How to write a new ADR

1. Copy `template.md` to `NNNN-short-title.md` (increment from
   the current max).
2. Fill in:
   - **Status**: Proposed / Accepted / Deprecated / Superseded
   - **Context**: the forces at play (technical, organisational)
   - **Decision**: the choice you made
   - **Consequences**: trade-offs, both positive and negative
3. Reference the relevant RFCs / specs (with links).
4. Open a PR. Reviewers include the API council + the on-call SRE.
5. Once accepted, **do not edit the file**. Mark superseded
   decisions with `Superseded by ADR-NNNN`.

## Why this exists

The Noufex codebase is large and evolves quickly. New
contributors regularly ask "why do we use Redis here?" or "why
is the API version in the Accept header?". The ADRs give the
answer in a single short document and let us re-evaluate the
decision later without having to reconstruct the original
reasoning.

The decisions captured here are the ones that took the most
research and were the most debated — not every preference or
local pattern warrants an ADR.