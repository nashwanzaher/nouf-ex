-- =====================================================================
-- Migration 0030 — updated_at triggers for migration-added tables
-- =====================================================================
-- The triggers.sql dynamic loop creates trg_set_updated_at on all
-- tables that have an updated_at column AT THE TIME triggers.sql runs.
-- Migration 0021 added updated_at to product_images, order_items, and
-- rate_limit_buckets AFTER triggers.sql executed, so these tables are
-- missing the auto-update trigger. This migration fixes that.
--
-- Ref: docs/audit-2026-07-09.md §E-2
-- =====================================================================

-- product_images
DROP TRIGGER IF EXISTS trg_product_images_set_updated_at ON product_images;
CREATE TRIGGER trg_product_images_set_updated_at
    BEFORE UPDATE ON product_images
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- order_items
DROP TRIGGER IF EXISTS trg_order_items_set_updated_at ON order_items;
CREATE TRIGGER trg_order_items_set_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- rate_limit_buckets (created in migration 0004)
DROP TRIGGER IF EXISTS trg_rate_limit_buckets_set_updated_at ON rate_limit_buckets;
CREATE TRIGGER trg_rate_limit_buckets_set_updated_at
    BEFORE UPDATE ON rate_limit_buckets
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
