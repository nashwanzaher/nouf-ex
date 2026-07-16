# API v1 → v2 Migration Runbook

> Tier 6.2 — the formal operator-facing document for retiring
> an API version. Generated as part of Tier 5.3 (API versioning).
> The current shipping version is `v1`; this runbook is the
> template that will be activated the day we deprecate v1.

## When does this runbook activate?

When a `VersionInfo` entry in
`apps/api/src/lib/api-version.ts` transitions to
`status: 'deprecated'`. Until then it lives in this directory as
documentation.

The transition happens with **a single PR**:

```diff
- { version: 1, status: 'current' },
+ { version: 1, status: 'deprecated', sunsetRfc: 'Sat, 01 Jan 2028 00:00:00 GMT', successorVersion: 2 },
+ { version: 2, status: 'current' },
```

The middleware then emits `Deprecation: true`, `Sunset: …`, and
`Link: </api/docs/migrations/v2>; rel="successor-version"` on
every v1 response (RFC 8594 §3).

## Timeline (90-day minimum per RFC 8594)

```
Day 0   ─ Mark v1 as `deprecated` + publish v2 as `current`
          (PR merge + CHANGELOG entry + status page post)

Day 0–90 ─ v1 + v2 both accepted (back-compat window)
          - `X-API-Version: v1` on v1 responses + `Deprecation: true`
          - `X-API-Version: v2` on v2 responses
          - Email / in-app banner to all SDK consumers
          - Cloudflare dashboard shows a "v1 usage last 30d" panel

Day 30  ─ Check internal SDK telemetry: if v1 share < 5 %,
          proceed to Day-60 milestone.

Day 60  ─ If v1 share > 5 %, **email all clients again** with
          the exact `Sunset` date and a link to the migration
          guide (this file).

Day 80  ─ Last-call email + in-app banner.

Day 90  ─ Set v1 to `status: 'sunset'`. The middleware stops
          accepting `Accept: application/vnd.noufex.v1+json` —
          it now returns `406 VERSION_NOT_ACCEPTABLE` with the
          list of supported versions in the body.
```

## Client-side changes

### Mobile (React Native)

```diff
- import { client } from '@noufex/api-client';
- const res = await client.GET('/api/products', { params: { query: { category: 'x' } } });
+ import { createApiClient } from '@noufex/api-client';
+ // The default client pins Accept: application/vnd.noufex.v1+json.
+ // After Day 90, drop the explicit pin so the SDK follows the
+ // current version automatically:
+ const client = createApiClient({ baseUrl: 'https://api.noufex.com' });
+ const res = await client.GET('/api/products', { params: { query: { category: 'x' } } });
```

### Web (React + Vite)

The web SPA already sends `application/json` (no vendor suffix)
in the `Accept` header, so it transparently follows the latest
version once the server's `VERSION_TABLE[0].status` flips to
`current` for v2. No code change required.

### Server-to-server (RabbitMQ workers, RabbitMQ consumers)

Workers call internal helpers (`db.prepare(...)`, `cacheGet(...)`)
directly, not the HTTP API. They are **not affected** by API
versioning. If a future task requires HTTP, use the SDK and pin
the version explicitly.

## What operators need to do

### T-90 (Day 0): Merge the deprecation PR

```bash
git checkout -b release/deprecate-v1
# 1. apps/api/src/lib/api-version.ts — change v1 status
# 2. CHANGELOG.md — add deprecation note
# 3. apps/api/openapi.generated.json + packages/api-client — regenerate
# 4. README.md — update "current version" badge
# 5. Open internal ticket: "Sunset v1 in 90 days"
gh pr create --base main --head release/deprecate-v1 --title "chore(api): deprecate v1"
```

### T-30 (Day 60): Check internal telemetry

```bash
# Per-client breakdown of v1 vs v2 share over the last 30 days:
curl -s http://prometheus.noufex.internal/api/v1/query \
  --data-urlencode 'query=sum by (client_name) (rate(noufex_http_requests_total{service="noufex-api",version="v1"}[30d]))'
```

Decision rule (Google SRE error-budget style):
- v1 share ≤ 5 % → continue to T-0
- v1 share > 5 % → delay sunset by one 30-day cycle

### T-0 (Day 90): Set v1 to `sunset`

```diff
- { version: 1, status: 'deprecated', ... },
+ { version: 1, status: 'sunset', ... },
```

The middleware returns `406` on every v1 request. Update the
status page, archive the migration guide, and disable the
`v1` tag in `package-api-client/`.

## Things that do NOT change

- URLs stay the same. `/api/products` keeps working forever
  (assuming v1 is still served). The version lives in the
  `Accept` header, not the URL.
- Rate-limit headers stay the same shape.
- OpenAPI document stays available at `/api/openapi.json`. We
  add a `x-sunset` extension on the v1 paths before they go
  to `sunset` so SDK generators can warn clients.
- Generated SDK keeps exporting the `paths` types from the
  generation step. The `client.GET(...)` call site never breaks
  between versions as long as the response shape is backwards
  compatible.

## Backwards-compatibility checklist (before the T-0 PR)

- [ ] v2 OpenAPI doc differs from v1 only in breaking fields.
- [ ] `git grep "application/vnd.noufex.v1"` returns no server
      code (only docs / middleware that emits the header).
- [ ] No background job / cron / RabbitMQ consumer depends on
      the v1 surface directly.
- [ ] SLO + alert budgets re-mapped to v2 (so on T-0 we don't
      start with v1 alerts firing indefinitely).

## Contact

- API council: `api@noufex.com`
- On-call SRE: PagerDuty service `noufex-api`
- Postmortem template: `docs/postmortems/api-deprecation.md`

## References

- RFC 8594 — Sunset and Deprecation headers
  https://www.rfc-editor.org/rfc/rfc8594.html
- RFC 6838 §4.2 — Vendor Tree + Personal Tree for media types
- Stripe API versioning: `https://stripe.com/docs/api/versioning`
- Google SRE Workbook — Ch. 27 "Reliable Product Launches
  over Time"