# Cloudflare Image Optimization

> Phase 4 — competitive-architecture-analysis. Product images are
> served from the Express static handler (`/uploads/...`). With
> Cloudflare Image Resizing we offload the work to the edge and
> serve modern formats (WebP, AVIF) at the right size for each
> client.

## Pricing

Cloudflare Image Resizing costs **$1 per 100,000 images delivered**.
For a marketplace with 50K product images and ~1M monthly pageviews
the monthly bill is roughly $5-15 — well within the free tier for
smaller deployments.

## Setup

1. **Speed → Optimization → Image Resizing: ON** (paid plan required).
2. **Caching → Cache Reserve: ON** (optional, $0.05/GB) — keeps
   resized variants cached for 30 days.

## URL transform

Cloudflare Image Resizing accepts query parameters on any proxied
image URL:

```
/cdn-cgi/image/width=600,quality=75,format=auto/uploads/products/yemeni-honey.jpg
```

The `format=auto` flag negotiates WebP/AVIF based on the client
`Accept` header.

## Recommended variants

We generate **four** variants per product image to cover the most
common layouts:

| Variant | Width | DPRs | Used by |
|---|---|---|---|
| `thumb` | 96 | 1x, 2x, 3x | search results, cart line items |
| `card` | 240 | 1x, 2x | category grids, deals carousel |
| `detail` | 600 | 1x, 2x | product detail page (hero) |
| `zoom` | 1200 | 1x | product detail lightbox / fullscreen |

Usage in JSX:

```tsx
const cdnImage = (src: string, variant: 'thumb' | 'card' | 'detail' | 'zoom') =>
  `/cdn-cgi/image/width=${WIDTHS[variant]},quality=75,format=auto${src}`;
```

## AVIF support

`format=auto` will serve AVIF when the client supports it (Chrome 85+,
Firefox 93+). AVIF is 30-50% smaller than WebP at equivalent quality.
Clients without AVIF support transparently get WebP, then JPEG.

## Cache key

The Cloudflare cache key includes the requested width + format, so
multiple variants of the same image are cached separately. Cache
TTL defaults to 30 days (`Cache-Control: max-age=2592000`).

## Fallback

If Cloudflare Image Resizing is disabled (free plan), the origin
serves the original `/uploads/products/...` URLs directly. The
frontend code is conditional on the `VITE_CLOUDFLARE_IMAGES` env var
— see `apps/web/src/lib/api/images.ts`.

## WEBP pre-encoding

Speed → Optimization → Polish (Lossy + Lossless) for free. Polish
re-encodes JPEGs on the fly without changing the URL. Combine with
Image Resizing for best results.