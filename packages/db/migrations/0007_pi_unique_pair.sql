-- =====================================================================
-- Migration 0007 — unique (product_id, image_url) on product_images
-- ----------------------------------------------------------------------------
-- P0-3: the image-pipeline script (`scripts/populate-product-images.cjs`)
-- is idempotent: re-running it must not duplicate rows. The only safe
-- ON CONFLICT target for an idempotent INSERT is a UNIQUE constraint
-- on (product_id, image_url), which the table currently lacks.
--
-- The existing data has no duplicates (the table was empty before
-- P0-3 shipped), so the constraint can be added without a backfill.
-- The constraint is added unconditionally — the script that applies
-- migrations is idempotent, so a re-apply is a no-op.
--
-- SECURITY (DB-CRITICAL-3, audit 2026-06-30): the original file
-- used a plain `ALTER TABLE … ADD CONSTRAINT`, which fails with
-- `42710: constraint already exists` on a second run. We now guard
-- the ADD with a `pg_constraint` existence check so the migration
-- is truly idempotent.
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'uq_product_images_product_url'
           AND conrelid = 'public.product_images'::regclass
    ) THEN
        ALTER TABLE product_images
            ADD CONSTRAINT uq_product_images_product_url
            UNIQUE (product_id, image_url);
    END IF;
END
$$;
