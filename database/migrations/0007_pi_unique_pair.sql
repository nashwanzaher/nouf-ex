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
-- =====================================================================
ALTER TABLE product_images
    ADD CONSTRAINT uq_product_images_product_url
    UNIQUE (product_id, image_url);
