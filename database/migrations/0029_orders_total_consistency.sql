-- =====================================================================
-- Migration 0029 — orders total consistency + deals constraint (audit 2026-07-09)
-- =====================================================================
-- Adds integrity constraints to prevent data drift in orders and products.
-- All changes are idempotent.
-- =====================================================================

-- ── 1. orders.total = subtotal + shipping_cost - discount_amount ────
-- Without this constraint, a bug in application code could set an
-- incorrect total, leading to payment discrepancies. The discount
-- column is the raw coupon value; discount_amount is the applied
-- amount. total = subtotal + shipping_cost - discount_amount.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_consistency'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_total_consistency CHECK (
                total = ROUND(subtotal + shipping_cost - discount_amount, 2)
            );
    END IF;
END $$;

-- ── 2. products.deal_discount + deal_ends_at must move together ─────
-- A deal without an end date is never-ending; an end date without a
-- discount is meaningless metadata. Enforce pairing.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_deal_pairing'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_deal_pairing CHECK (
                (deal_discount IS NULL AND deal_ends_at IS NULL) OR
                (deal_discount IS NOT NULL AND deal_ends_at IS NOT NULL)
            );
    END IF;
END $$;