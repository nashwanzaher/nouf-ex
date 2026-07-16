# CSP nonce flow + Cloudflare Transform Rules precedence

> Tier 3.4 — competitive-architecture-analysis. Critical reference
> for anyone modifying `apps/api/src/middleware.ts:securityHeaders`
> or `cloudflare/terraform/main.tf:security_headers`.

## The flow (in order)

```
┌──────────────┐  ①   ┌─────────────────────────┐  ②   ┌────────────┐
│  Browser     │ ─────▶│   Cloudflare Edge        │ ─────▶│  Express   │
│              │       │  (pages-rules + WAF +   │       │  API       │
│              │       │   transform rules)       │       │            │
└──────┬───────┘       └─────────────────────────┘       └──────┬─────┘
       │                                                        │
       │  ⑤ nonce-aware scripts/styles run                       │
       │     inside the protection boundary                     │
       │                                                        │
       │  ④ nonce + sticky cookie echo back in static             │
       │    index.html                                           │
       │ ◀──────────────────────────────────────────────────────┘
```

### ① Incoming request

```
GET / HTTP/1.1
Host: app.noufex.com
Cookie: noufex_csrf=<token>; noufex_auth=<jwt>
Sec-Fetch-Dest: document
```

### ② Cloudflare edge processing

1. **WAF rules** evaluate first (TLS terminate + firewall). Block if
   the geo / UA / rate-limit check fails. If blocked, the request
   never reaches the origin and no nonce is needed.
2. **Cache rules** decide whether to serve a cached copy. HTML
   is explicitly NOT cached (`/api/*` is bypassed, the SPA's
   `index.html` is dynamic per CSP nonce).
3. **Transform rules** (cloudflare/terraform/main.tf) add
   **security headers**: HSTS, `X-Content-Type-Options`,
   `Referrer-Policy`, `Permissions-Policy`. These are added on the
   outbound response — and the origin can still set its own values.

### ③ Express layer

`apps/api/src/middleware.ts:securityHeaders`:

1. Generates a per-request CSP nonce:
   `crypto.randomBytes(16).toString('base64url')` (22 chars, RFC 4648
   §5 URL-safe alphabet).
2. Stores it on `res.locals.cspNonce`.
3. Sends the `Content-Security-Policy` header with the nonce in
   `script-src` and `style-src`. The `strict-dynamic` directive
   is included so once the initial bundle loads under the nonce,
   the browser trusts anything it pulls in.

The CSP **must NOT** be duplicated in the Cloudflare transform
rule — see "Precedence rules" below.

### ④ Static HTML injection

`apps/api/src/index.ts` (~line 488+) reads `index.html`, replaces:

- `<script>` → `<script nonce="…">`
- `<style>` → `<style nonce="…">`
- inserts `<meta name="csp-nonce" content="…">` inside `<head>`

The SPA reads the meta tag on hydrate and uses
`document.querySelector('meta[name="csp-nonce"]').content` when
attaching inline scripts/styles.

A non-HttpOnly cookie `noufex_csrf_h` echoes the CSRF secret so the
SPA can mirror the value into the `x-csrf-token` header without a
second round-trip.

### ⑤ Browser enforcement

The browser only executes inline scripts / styles that carry a
matching nonce (or pass `'strict-dynamic'` after the first nonce
load). External scripts from `'self'` are allowed; everything else
is blocked.

## Precedence rules (DON'T DO THIS)

The three places that touch `Content-Security-Policy`:

1. **Express middleware** (`apps/api/src/middleware.ts`)
2. **Cloudflare Transform Rules** (`cloudflare/terraform/main.tf`)
3. **`_headers` file** (if the SPA ever migrates to Cloudflare Pages)

### Rule #1: The Express CSP is authoritative

Cloudflare can `set` headers but cannot inject per-request nonces —
nonces must be generated at the origin because they are unique per
response. So the **Express CSP with the nonce takes precedence**
and Cloudflare must NOT add a competing `script-src` directive.

The Terraform transform rule includes a comment block instructing
operators to NOT add a `Content-Security-Policy` header at the edge.
The Hash header is computed from `default-src 'self' 'nonce-…'`
and `script-src 'self' 'nonce-…' 'strict-dynamic'` — values that
**must match the origin's nonce** or the browser will block every
script.

### Rule #2: Non-CSP headers can be layered

`X-Content-Type-Options`, `Referrer-Policy`, `HSTS`,
`Permissions-Policy` are static per-response, so Cloudflare can
`set` them at the edge to save the per-response header-flush work.
The origin should not also send them (different layer of authority,
different value chain). We pick the edge layer because it's
slightly cheaper.

`Strict-Transport-Security` MUST come from the edge so it's set
before any TLS termination can leak the response.

### Rule #3: `Cache-Control` on the edge supersedes the origin

The origin's `cacheControl(60, catalogRouter)` middleware sends
`Cache-Control: public, max-age=60, stale-while-revalidate=30`
on `/api/products*`. Cloudflare's page rule for `/api/products/*`
sets `Edge TTL = 60s` and `Browser TTL = 30s`. The CF values
win because they happen earlier in the response pipeline.

If you ever need to override CF's TTL temporarily (debugging
a stale-data incident), use the **CF API** not the origin
response header:

```bash
curl -X POST \
  https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -d '{"files":["https://app.noufex.com/products/42"]}'
```

### Rule #4: Never `Set-Cookie` at the edge

The `noufex_auth`, `noufex_csrf`, `noufex_session` cookies use
`HttpOnly` + `Secure` + `SameSite=Strict`. Setting them at the edge
would bypass the Express signing flow that mints CSRF secrets
tied to the session. Always let the origin set the cookie headers.

## Verification checklist

Before any change to `securityHeaders`, `index.ts` HTML
injection, or the Cloudflare transform rule, run through this:

- [ ] Open `/` in DevTools → Network → response headers. Confirm
      `content-security-policy` has a fresh nonce matching the
      value inside the served HTML.
- [ ] Confirm the SPA hydrates (no CSP violation console error).
- [ ] Reload twice — confirm the nonce changes between requests.
- [ ] `curl -I https://app.noufex.com/api/categories` — confirm
      the response includes the `Cache-Control: public, max-age=…`
      from the origin AND that the second request (within 60s)
      returns `cf-cache-status: HIT` from CF.
- [ ] `nslookup -type=TXT _cf-custom-hostname.api.noufex.com`
      if using Cloudflare for SaaS — confirm the CNAME
      validation succeeded.

## References

- W3C CSP Level 3 (CSP3) — https://www.w3.org/TR/CSP3/
- RFC 4648 (base64url) — https://www.rfc-editor.org/rfc/rfc4648
- OWASP CSP Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- Cloudflare Transform Rules — https://developers.cloudflare.com/rules/transform/
- MDN: 'strict-dynamic' — https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP/standard-src