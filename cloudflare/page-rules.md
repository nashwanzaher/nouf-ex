# Cloudflare Cache Rules (Page Rules replacement)

> Phase 4 — competitive-architecture-analysis. The legacy Page Rules
> product is being phased out by Cloudflare in favour of the new
> **Cache Rules** (under Caching → Cache Rules) which supports more
> flexible matching and `Edge TTL`, `Browser TTL`, and `Cache
> Eligibility` overrides.

## Recommended rule list

Apply each rule in **first match wins** order. The Cloudflare dashboard
honours evaluation order, so put the most specific patterns first.

### 1. Catalog products (hot read path)
- **Match:** `URI Path` contains `/api/products/` AND `Method` equals `GET`
- **Cache eligibility:** Eligible
- **Edge TTL:** Respect existing headers (`Cache-Control: public, max-age=60`)
- **Browser TTL:** Respect existing headers
- **Cache key:** includes `cf-ipcountry` (for geo-aware sorting later)
- **Tiered Cache:** Off (single POP for Yemen/GCC users)

### 2. Catalog categories (rarely changes)
- **Match:** `URI Path` equals `/api/categories` AND `Method` equals `GET`
- **Edge TTL:** 1 hour
- **Browser TTL:** 5 minutes
- **Cache key:** Host only

### 3. Stats home (changes per order)
- **Match:** `URI Path` equals `/api/stats/home` AND `Method` equals `GET`
- **Edge TTL:** 30 seconds
- **Browser TTL:** 15 seconds

### 4. Shipping methods (TTL 5 min, server-controlled)
- **Match:** `URI Path` starts with `/api/shipping/` AND `Method` equals `GET`
- **Edge TTL:** 5 minutes
- **Browser TTL:** 1 minute

### 5. Public search autocomplete (Elasticsearch results)
- **Match:** `URI Path` equals `/api/search/suggest` AND `Method` equals `GET`
- **Edge TTL:** 1 minute
- **Browser TTL:** 30 seconds
- **Cache key:** `URI Query` includes `q=` (each prefix gets its own entry)

### 6. Authenticated / mutating routes — BYPASS
- **Match:** `URI Path` starts with `/api/auth/` OR `/api/admin/` OR `/api/orders/` OR `/api/cart/` OR `/api/wishlist/` OR `/api/messages/` OR `/api/notifications/` OR `/api/customer/` OR `/api/seller/` OR `/api/payments/` OR `/api/refunds/`
- **Cache eligibility:** Bypass cache
- **Origin Cache-Control:** Off

### 7. Health endpoints — BYPASS
- **Match:** `URI Path` equals `/api/health` OR `/api/ready`
- **Cache eligibility:** Bypass cache

### 8. Hashed assets — IMMUTABLE
- **Match:** `URI Path` starts with `/assets/` AND `File extension` in `{js, css, woff, woff2}`
- **Edge TTL:** 1 year
- **Browser TTL:** 1 year
- **Cache eligibility:** Eligible

## Origin-side cache invalidation

When the API writes to `products`, `categories`, etc. it calls into
`workers/purge.ts` (when `CLOUDFLARE_API_TOKEN` is configured) to
purge the matching Cloudflare cache tags. This means admin PATCHes
are visible at the edge within ~5 seconds.

```
PATCH /api/admin/products/:id
  → API invalidates Redis cache
  → API publishes `search.index` event (RabbitMQ)
  → API calls Cloudflare API: POST /zones/:zid/purge_cache { tags: ['product-42', 'catalog'] }
```

## Tiered Cache

Enable **Tiered Cache → Smart Tiered Caching** in the dashboard. For
Yemen/GCC users the request goes through the nearest Cloudflare POP
(Dubai, Muscat, Jeddah) and then to the origin in Frankfurt.

## Argo

Argo Smart Routing reduces TTFB by 25-30%. Free for the first month,
then billed per-GB. Worth enabling once traffic crosses 5M req/day.

## Health probes

Cloudflare sends its own load-balancer health checks to the origin.
Allow `cf-connecting-ip` ranges (Cloudflare publishes the list at
https://www.cloudflare.com/ips/) without rate limiting.