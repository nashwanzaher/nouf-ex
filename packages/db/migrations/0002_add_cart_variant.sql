-- =====================================================================
-- Migration 0002 — cart_items.variant jsonb
-- ----------------------------------------------------------------------------
-- The server's POST /api/cart stores a JSON blob of the picked product
-- variant (color/size/etc.) as `variant`, but the original cart_items
-- table only had `variant_id` (the FK to product_variants for pre-defined
-- SKUs). These are two different things — a cart row can describe a
-- user-picked custom variant without referencing a product_variants row.
--
-- Adding the column to schema.sql means fresh builds get it automatically;
-- this migration brings older databases up to the same shape.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS was added in PG 9.6.
-- =====================================================================

ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS variant JSONB;
