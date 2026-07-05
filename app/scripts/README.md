# `app/scripts/` — build-time tooling

> **Last verified:** 2026-07-05 (per MIGRATION_EXECUTION_PLAN.md v2.8.7 §47 R-14 execution)
> **Status:** 2 active `.cjs` scripts — both part of the P0-3 image pipeline
> **Closes:** GAP-9 ("`app/scripts/` has 2 .cjs files — undocumented") from §26.1
> **Why these scripts are not in `app/src/`:** they are build-time tooling that runs on the Node host (or in CI), not on the browser. Putting them under `src/` would (a) accidentally ship them to the Vite production bundle and (b) violate the convention that `src/` is for code that reaches the browser.
> **Why these scripts are not in the repo-root `scripts/`:** they reference `app/public/data/products.json` and `app/public/products/`. Co-locating them with `app/` keeps the tooling next to the data it operates on (a folder-of-folder pattern that scales better than a flat root-level list of scripts).

## Layout

```
app/scripts/
├── README.md                      ← this file
├── generate-product-images.cjs    ← P0-3 / file-based variant (uses JSON snapshots)
└── populate-product-images.cjs    ← P0-3 / DB-based variant (uses noufex_db)
```

## Workflow

```
[developer edits seed data]
            │
            ▼
   public/data/products.json   ← source of truth for JSON-snapshot variant
            │
            ▼
   node scripts/generate-product-images.cjs   ← Option A: file-based
            OR
   node scripts/populate-product-images.cjs   ← Option B: DB-based (preferred)
            │
            ▼
   app/public/products/p{id}-{slug}.jpg   ← per-product placeholder
   app/public/products/p{id}-{slug}.svg   ← per-product unique illustration
            │
            ▼
   noufex_db.products.main_image     ← wired to the per-product .jpg
   noufex_db.product_images           ← 2 rows per product (jpg + svg)
```

## Scripts

### `generate-product-images.cjs` — file-based variant

**Source of truth:** [`app/public/data/products.json`](../public/data/products.json) (a build-time snapshot)

**What it does:**

1. Reads every product from `products.json`
2. For each product with a missing or shared placeholder `main_image`, copies the category-level placeholder into a fresh `p{id}-{slug}.jpg`
3. Leaves hand-curated images untouched (idempotent)

**When to use:**

- CI builds without a live Postgres (e.g. static export)
- Local dev where the DB is not yet seeded
- Restoring the demo data after a `git clean -fdx` of `app/public/products/`

**Usage:**

```sh
# from repo root
node app/scripts/generate-product-images.cjs

# from app/
npm run images:populate       # wraps the DB-based variant below
```

**JSDoc types:** full TypeScript-style typedefs at the top of the file (`Category`, `Product`) so the IDE picks up parameters even though the file is `.cjs`.

### `populate-product-images.cjs` — DB-based variant (preferred)

**Source of truth:** the live `noufex_db` database

**What it does:**

1. Reads every `is_active = true` product from `products`
2. Copies the category placeholder into `app/public/products/p{id}-{slug}.jpg`
3. Generates a **unique** per-product SVG illustration (different background, name overlay, and icon per product — not just different filenames)
4. Updates `products.main_image` to the per-product JPG
5. Inserts 2 rows into `product_images` per product: `is_primary=true` for the JPG, `is_primary=false` for the SVG (gallery)

**When to use:**

- After `npm run db:setup` to wire the freshly-seeded demo products
- After any bulk product import that lacks images
- To regenerate unique SVG thumbnails if the category placeholder set has changed

**Usage:**

```sh
# from app/ (preferred — wrapped by npm script)
npm run images:populate

# from repo root
node app/scripts/populate-product-images.cjs
```

**Idempotency guarantees:**

- DB writes use `INSERT ... ON CONFLICT (product_id, image_url) DO NOTHING` — re-running never duplicates rows
- Disk writes overwrite existing files — safe to invoke on every CI build
- `main_image` is set unconditionally; last write wins

## Closes

- **GAP-9** (`app/scripts/` has 2 .cjs files) — **CLOSED** by this README (the 2 files are now documented; convention is now explicit)
- **NEW-8** (`app/scripts/` is a gitignored top-level `app/` child) — by design; the scripts are committed (not gitignored) but the build artifacts they produce (`app/public/products/p*.{jpg,svg}`) are gitignored via `app/.gitignore` lines covering `public/products/p*`

## Cross-references

- **Canonical plan:** [`MIGRATION_EXECUTION_PLAN.md`](../../docs/planning/MIGRATION_EXECUTION_PLAN.md) v2.8.7 §47 R-14
- **Database setup:** [`scripts/db/db-setup.cjs`](../../scripts/db/db-setup.cjs) — applies the 24 SQL migrations including the `products` + `product_images` tables that these scripts populate
- **Image data:** [`app/public/data/products.json`](../public/data/products.json) — build-time snapshot consumed by the file-based variant
- **Image output dir:** [`app/public/products/`](../public/products/) — receives the generated JPGs + SVGs (gitignored)
- **Placeholder assets:** [`app/public/category-*.jpg`](../public/) — shared per-category fallback images that get copied per-product
- **Test coverage:** [`app/server/tests/populate-product-images.test.ts`](../server/tests/populate-product-images.test.ts) — Vitest test that validates the file-creation logic against the current `products.json`
