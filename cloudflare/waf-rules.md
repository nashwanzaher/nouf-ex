# Cloudflare WAF Custom Rules

> Phase 4 — competitive-architecture-analysis. The Express API enforces
> its own rate limiting + CSRF + CSP, but the Cloudflare WAF is the
> outermost layer that blocks the largest volume of abuse before it
> reaches the origin.

## Pre-WAF: Bot Fight Mode

**Security → Bots → Bot Fight Mode: ON** (free plan).
**Security → Bots → Super Bot Fight Mode: ON** (paid plan) — categorizes
verified bots, likely bots, and definitely malicious bots separately.

## Custom Rules (priority high → low)

### 1. Block non-target countries (geo fencing)

Match: `ip.src.country` not in `{YE, SA, AE, OM, BH, KW, QA, EG, JO, IQ, SD}`
And `URI Path` starts with `/api/`

Action: Block

Rationale: Noufex is Yemen/Middle-East focused. Hard-blocking other
regions cuts a meaningful chunk of L7 DDoS attempts that originate
from compromised hosts in AS networks outside the target region.
Maintain a small allow-list for office IPs (override per IP).

### 2. Rate limit per IP for unauthenticated requests

Match: `not http.request.headers["cookie"][*]` contains `"noufex_auth"`
And `http.request.method` in `{"GET", "HEAD"}`
And `URI Path` starts with `/api/products` OR `/api/categories` OR `/api/search`

Rate limit: 60 requests per 10 seconds per IP
Action: Block for 60 seconds

Rationale: Public catalog endpoints are the highest-traffic surface.
60 req/10s is generous for normal browsing (humans rarely exceed 1
req/second) but kills scrapers immediately.

### 3. Block known-bad User-Agents

Match: `http.user_agent` matches `(?i)(?:scrapy|httpclient|python-requests|curl/7|wget|nikto|sqlmap|acunetix)`

Action: Block

Rationale: Cheap to maintain. Real browsers do NOT use these agents
on a marketplace storefront.

### 4. Block auth brute-force attempts

Match: `URI Path` equals `/api/auth/login`
Rate limit: 5 requests per 5 minutes per IP
Action: Managed Challenge (CAPTCHA)

Rationale: The API has its own per-IP rate limiter (15 hits/15 min via
`authLimiter`), but the WAF catches the obvious scripted bursts
faster and without burning API DB round-trips.

### 5. Block webhook spam

Match: `URI Path` starts with `/api/payments/webhook/`
And `http.request.headers["x-webhook-signature"][0]` does not exist

Action: Block

Rationale: Every legitimate payment provider signs its webhooks. Any
unsigned request to that endpoint is an attack or a misconfiguration.

### 6. Disable directory traversal

Match: `URI Path` matches `(?i)\.\./` or `URI Path` matches `(?i)%2e%2e`

Action: Block

Rationale: Cheap to filter at the edge; saves an audit-log entry on
every attempt.

## Rate Limit Rules

These are configured under Security → WAF → Rate Limit Rules and are
evaluated independently from Custom Rules.

| Endpoint prefix | Limit | Window | Key |
|---|---|---|---|
| `/api/auth/login` | 5 | 1 min | IP |
| `/api/auth/forgot-password` | 3 | 1 hour | IP |
| `/api/admin/*` | 600 | 5 min | IP (admin users get higher implicit quota via the JWT) |
| `/api/seller/*` | 300 | 5 min | IP |
| `/api/*` (rest) | 1000 | 1 min | IP |

## Security Headers (Transform Rules)

Apply on the response of all `/api/*` and `/*` paths:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

The `Content-Security-Policy` is generated per-request by the API
(nonce-based) so it is NOT set here — duplicating it would conflict
with the nonce.

## Logging

Security → Logs → Logpush to your SIEM (Datadog, Splunk, Elastic
Stack). At minimum ship:
- Blocked requests (full)
- Challenged requests (sampled 10%)
- All `/api/auth/*` (full, retention 90 days)