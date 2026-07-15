-- =====================================================================
-- Migration 0033: Advanced Promotions System
-- =====================================================================
-- Adds:
--   1. Flash sales (time-limited deep discounts)
--   2. Loyalty points system (earn & redeem)
--   3. Bundle deals (buy X get Y discount)
-- =====================================================================

-- =====================================================================
-- FLASH SALES
-- =====================================================================
CREATE TABLE IF NOT EXISTS flash_sales (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT          NOT NULL,
    description     TEXT,
    starts_at       TIMESTAMPTZ   NOT NULL,
    ends_at         TIMESTAMPTZ   NOT NULL,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    banner_image    TEXT,
    created_by      INTEGER       REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ends_at > starts_at),
    CHECK (name <> '')
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_active ON flash_sales(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_flash_sales_dates ON flash_sales(starts_at, ends_at);

-- Flash sale items (products in a flash sale)
CREATE TABLE IF NOT EXISTS flash_sale_items (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flash_sale_id   INTEGER       NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
    product_id      INTEGER       NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    flash_price     NUMERIC(12,2) NOT NULL CHECK (flash_price > 0),
    original_price  NUMERIC(12,2) NOT NULL CHECK (original_price > 0),
    max_quantity    INTEGER       CHECK (max_quantity IS NULL OR max_quantity > 0),
    sold_quantity   INTEGER       NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
    sort_order      INTEGER       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (flash_sale_id, product_id),
    CHECK (flash_price < original_price)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_items_sale ON flash_sale_items(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_items_product ON flash_sale_items(product_id);

-- =====================================================================
-- LOYALTY POINTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS loyalty_points (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INTEGER       NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_points    INTEGER       NOT NULL DEFAULT 0 CHECK (total_points >= 0),
    available_points INTEGER      NOT NULL DEFAULT 0 CHECK (available_points >= 0),
    lifetime_points INTEGER       NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
    tier            VARCHAR(20)   NOT NULL DEFAULT 'bronze'
        CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (available_points <= total_points)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tier);

-- Loyalty points transactions (earn/redeem history)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points          INTEGER       NOT NULL,
    type            VARCHAR(20)   NOT NULL
        CHECK (type IN ('earn', 'redeem', 'expire', 'adjust')),
    source          VARCHAR(40)   NOT NULL,
    reference_type  VARCHAR(40),
    reference_id    INTEGER,
    description     TEXT,
    balance_after   INTEGER       NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON loyalty_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_type ON loyalty_transactions(type);

-- Loyalty points configuration
CREATE TABLE IF NOT EXISTS loyalty_config (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key             VARCHAR(40)   NOT NULL UNIQUE,
    value           TEXT          NOT NULL,
    description     TEXT,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default loyalty configuration
INSERT INTO loyalty_config (key, value, description) VALUES
    ('points_per_currency', '1', 'Points earned per 1 YER spent'),
    ('redemption_rate', '100', 'Points needed for 1 YER discount'),
    ('min_redemption', '500', 'Minimum points for redemption'),
    ('tier_silver_threshold', '5000', 'Points needed for Silver tier'),
    ('tier_gold_threshold', '15000', 'Points needed for Gold tier'),
    ('tier_platinum_threshold', '50000', 'Points needed for Platinum tier'),
    ('tier_silver_bonus', '1.2', 'Silver tier points multiplier'),
    ('tier_gold_bonus', '1.5', 'Gold tier points multiplier'),
    ('tier_platinum_bonus', '2.0', 'Platinum tier points multiplier'),
    ('points_expiry_days', '365', 'Days until unused points expire')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- BUNDLE DEALS
-- =====================================================================
CREATE TABLE IF NOT EXISTS bundle_deals (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id        INTEGER       REFERENCES stores(id) ON DELETE CASCADE,
    name            TEXT          NOT NULL,
    description     TEXT,
    type            VARCHAR(20)   NOT NULL
        CHECK (type IN ('buy_x_get_y', 'fixed_price', 'percentage_off')),
    min_quantity    INTEGER       NOT NULL DEFAULT 2 CHECK (min_quantity >= 2),
    discount_value  NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    starts_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (name <> ''),
    CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_bundle_deals_store ON bundle_deals(store_id);
CREATE INDEX IF NOT EXISTS idx_bundle_deals_active ON bundle_deals(is_active, starts_at, expires_at);

-- Bundle deal items
CREATE TABLE IF NOT EXISTS bundle_deal_items (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bundle_deal_id  INTEGER       NOT NULL REFERENCES bundle_deals(id) ON DELETE CASCADE,
    product_id      INTEGER       NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity        INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
    is_required     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (bundle_deal_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_deal_items_bundle ON bundle_deal_items(bundle_deal_id);
CREATE INDEX IF NOT EXISTS idx_bundle_deal_items_product ON bundle_deal_items(product_id);

-- =====================================================================
-- FUNCTIONS FOR LOYALTY POINTS
-- =====================================================================

-- Function to calculate loyalty tier based on lifetime points
CREATE OR REPLACE FUNCTION calculate_loyalty_tier(lifetime_points INTEGER)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF lifetime_points >= 50000 THEN RETURN 'platinum';
    ELSIF lifetime_points >= 15000 THEN RETURN 'gold';
    ELSIF lifetime_points >= 5000 THEN RETURN 'silver';
    ELSE RETURN 'bronze';
    END IF;
END;
$$;

-- Function to add loyalty points
CREATE OR REPLACE FUNCTION add_loyalty_points(
    p_user_id INTEGER,
    p_points INTEGER,
    p_source VARCHAR(40),
    p_reference_type VARCHAR(40) DEFAULT NULL,
    p_reference_id INTEGER DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_balance INTEGER;
    v_new_total INTEGER;
    v_new_lifetime INTEGER;
    v_new_tier VARCHAR(20);
BEGIN
    -- Lock the user's loyalty record
    SELECT total_points, lifetime_points
    INTO v_balance, v_new_lifetime
    FROM loyalty_points
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create loyalty record if it doesn't exist
        INSERT INTO loyalty_points (user_id, total_points, available_points, lifetime_points, tier)
        VALUES (p_user_id, 0, 0, 0, 'bronze')
        RETURNING total_points, lifetime_points INTO v_balance, v_new_lifetime;
    END IF;

    -- Calculate new values
    v_new_total := v_balance + p_points;
    v_new_lifetime := v_new_lifetime + p_points;
    v_new_tier := calculate_loyalty_tier(v_new_lifetime);

    -- Update loyalty points
    UPDATE loyalty_points
    SET total_points = v_new_total,
        available_points = available_points + p_points,
        lifetime_points = v_new_lifetime,
        tier = v_new_tier,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Record transaction
    INSERT INTO loyalty_transactions (user_id, points, type, source, reference_type, reference_id, description, balance_after)
    VALUES (p_user_id, p_points, 'earn', p_source, p_reference_type, p_reference_id, p_description, v_new_total);

    RETURN v_new_total;
END;
$$;

-- Function to redeem loyalty points
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
    p_user_id INTEGER,
    p_points INTEGER,
    p_reference_type VARCHAR(40) DEFAULT NULL,
    p_reference_id INTEGER DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_available INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Lock and check available points
    SELECT available_points INTO v_available
    FROM loyalty_points
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_available < p_points THEN
        RETURN FALSE;
    END IF;

    -- Deduct points
    v_new_balance := v_available - p_points;

    UPDATE loyalty_points
    SET total_points = total_points - p_points,
        available_points = v_new_balance,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Record transaction
    INSERT INTO loyalty_transactions (user_id, points, type, source, reference_type, reference_id, description, balance_after)
    VALUES (p_user_id, p_points, 'redeem', 'order', p_reference_type, p_reference_id, p_description, v_new_balance);

    RETURN TRUE;
END;
$$;

-- Function to get loyalty points balance
CREATE OR REPLACE FUNCTION get_loyalty_balance(p_user_id INTEGER)
RETURNS TABLE(
    total_points INTEGER,
    available_points INTEGER,
    lifetime_points INTEGER,
    tier VARCHAR(20),
    tier_bonus NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lp.total_points,
        lp.available_points,
        lp.lifetime_points,
        lp.tier,
        CASE lp.tier
            WHEN 'platinum' THEN 2.0
            WHEN 'gold' THEN 1.5
            WHEN 'silver' THEN 1.2
            ELSE 1.0
        END AS tier_bonus
    FROM loyalty_points lp
    WHERE lp.user_id = p_user_id;
END;
$$;

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Trigger to update updated_at on flash_sales
DROP TRIGGER IF EXISTS trg_flash_sales_set_updated_at ON flash_sales;
CREATE TRIGGER trg_flash_sales_set_updated_at
    BEFORE UPDATE ON flash_sales
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Trigger to update updated_at on loyalty_points
DROP TRIGGER IF EXISTS trg_loyalty_points_set_updated_at ON loyalty_points;
CREATE TRIGGER trg_loyalty_points_set_updated_at
    BEFORE UPDATE ON loyalty_points
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Trigger to update updated_at on bundle_deals
DROP TRIGGER IF EXISTS trg_bundle_deals_set_updated_at ON bundle_deals;
CREATE TRIGGER trg_bundle_deals_set_updated_at
    BEFORE UPDATE ON bundle_deals
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =====================================================================
-- VIEWS
-- =====================================================================

-- View for active flash sales with item counts
CREATE OR REPLACE VIEW v_active_flash_sales AS
SELECT
    fs.id,
    fs.name,
    fs.description,
    fs.starts_at,
    fs.ends_at,
    fs.banner_image,
    COUNT(fsi.id) AS item_count,
    COALESCE(SUM(fsi.sold_quantity), 0) AS total_sold
FROM flash_sales fs
LEFT JOIN flash_sale_items fsi ON fsi.flash_sale_id = fs.id
WHERE fs.is_active = TRUE
  AND fs.starts_at <= NOW()
  AND fs.ends_at > NOW()
GROUP BY fs.id;

-- View for user loyalty summary
CREATE OR REPLACE VIEW v_user_loyalty_summary AS
SELECT
    lp.user_id,
    lp.total_points,
    lp.available_points,
    lp.lifetime_points,
    lp.tier,
    CASE lp.tier
        WHEN 'platinum' THEN 2.0
        WHEN 'gold' THEN 1.5
        WHEN 'silver' THEN 1.2
        ELSE 1.0
    END AS tier_bonus,
    u.full_name,
    u.email
FROM loyalty_points lp
JOIN users u ON u.id = lp.user_id;

-- =====================================================================
-- GRANTS
-- =====================================================================

-- Grant access to new tables for noufex_app
DO $$
DECLARE
    t text;
    new_tables text[] := ARRAY[
        'flash_sales',
        'flash_sale_items',
        'loyalty_points',
        'loyalty_transactions',
        'loyalty_config',
        'bundle_deals',
        'bundle_deal_items'
    ];
BEGIN
    FOREACH t IN ARRAY new_tables LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO noufex_app', t);
    END LOOP;
END;
$$;

-- Grant access to views
GRANT SELECT ON v_active_flash_sales TO noufex_app;
GRANT SELECT ON v_user_loyalty_summary TO noufex_app;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION add_loyalty_points(INTEGER, INTEGER, VARCHAR, VARCHAR, INTEGER, TEXT) TO noufex_app;
GRANT EXECUTE ON FUNCTION redeem_loyalty_points(INTEGER, INTEGER, VARCHAR, INTEGER, TEXT) TO noufex_app;
GRANT EXECUTE ON FUNCTION get_loyalty_balance(INTEGER) TO noufex_app;
GRANT EXECUTE ON FUNCTION calculate_loyalty_tier(INTEGER) TO noufex_app;

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('0033_advanced_promotions', 'Migration 0033: Flash sales, loyalty points, bundle deals')
ON CONFLICT (version) DO NOTHING;
