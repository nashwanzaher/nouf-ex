-- =====================================================================
-- Migration 0005 — coupon_discount_amount() PL/pgSQL function
-- ----------------------------------------------------------------------------
-- Centralizes the discount math that previously lived in TypeScript
-- (server/index.ts:computeCouponDiscount). The app now passes the
-- coupon's type/value/max_discount plus the order subtotal and gets
-- back a single rounded NUMERIC.
--
-- Behaviour matches the old TS implementation exactly:
--   * percentage: (subtotal * value) / 100
--   * fixed:      value
--   * capped at max_discount if provided
--   * clamped to [0, subtotal]
--   * rounded to 2 decimals
-- =====================================================================

CREATE OR REPLACE FUNCTION coupon_discount_amount(
    p_type         TEXT,
    p_value        NUMERIC,
    p_max_discount NUMERIC,
    p_subtotal     NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_raw    NUMERIC;
    v_capped NUMERIC;
BEGIN
    IF p_type = 'percentage' THEN
        v_raw := (p_subtotal * p_value) / 100;
    ELSE
        v_raw := p_value;
    END IF;

    IF p_max_discount IS NOT NULL THEN
        v_capped := LEAST(v_raw, p_max_discount);
    ELSE
        v_capped := v_raw;
    END IF;

    RETURN GREATEST(0, LEAST(p_subtotal, ROUND(v_capped, 2)));
END
$$;
