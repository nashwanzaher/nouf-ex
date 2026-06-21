-- =====================================================================
-- Nouf-ex — Extra Schema: payments, coupons, refunds, balances, audit
-- =====================================================================
-- Loaded after schema.sql.
-- All tables are owned by noufex_owner; grants to noufex_app are in
-- roles.sql.
-- =====================================================================

-- =====================================================================
-- PAYMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        INTEGER       NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    user_id         INTEGER       NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    method          VARCHAR(20)   NOT NULL
        CHECK (method IN ('cod','card','wallet','bank_transfer','stripe','paymob')),
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','completed','failed','refunded','cancelled')),
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency        VARCHAR(3)    NOT NULL DEFAULT 'YER',
    provider        VARCHAR(40),                       -- 'stripe', 'paymob', 'manual'
    provider_txn_id VARCHAR(120),
    provider_meta   JSONB         NOT NULL DEFAULT '{}'::jsonb,
    failure_reason  TEXT,
    paid_at         TIMESTAMPTZ,
    refunded_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user   ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- =====================================================================
-- COUPONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS coupons (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(40)   NOT NULL UNIQUE,
    type            VARCHAR(20)   NOT NULL CHECK (type IN ('percentage','fixed')),
    value           NUMERIC(8,2)  NOT NULL CHECK (value > 0),
    min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
    max_discount    NUMERIC(12,2) CHECK (max_discount IS NULL OR max_discount >= 0),
    usage_limit     INTEGER       CHECK (usage_limit IS NULL OR usage_limit > 0),
    usage_count     INTEGER       NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    per_user_limit  INTEGER       NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
    store_id        INTEGER       REFERENCES stores(id) ON DELETE CASCADE,    -- NULL = site-wide
    starts_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    description     TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (type <> 'percentage' OR value <= 100),
    CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_coupons_code   ON coupons(code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_store  ON coupons(store_id);

-- =====================================================================
-- COUPON_USAGE (one row per redemption)
-- =====================================================================
CREATE TABLE IF NOT EXISTS coupon_usage (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    coupon_id       INTEGER       NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id         INTEGER       NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    order_id        INTEGER       NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    discount_amount NUMERIC(12,2) NOT NULL CHECK (discount_amount >= 0),
    used_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (coupon_id, user_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user   ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order  ON coupon_usage(order_id);

-- =====================================================================
-- REFUNDS
-- =====================================================================
CREATE TABLE IF NOT EXISTS refunds (
    id             INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id       INTEGER       NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    payment_id     INTEGER       REFERENCES payments(id) ON DELETE SET NULL,
    user_id        INTEGER       NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason         TEXT          NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested','approved','rejected','processed')),
    admin_notes    TEXT,
    resolved_by    INTEGER       REFERENCES users(id) ON DELETE SET NULL,
    resolved_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (reason <> '')
);
CREATE INDEX IF NOT EXISTS idx_refunds_order  ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user   ON refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- =====================================================================
-- STORE_BALANCE (one row per store — wallet)
-- =====================================================================
CREATE TABLE IF NOT EXISTS store_balance (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id        INTEGER       NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    available       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available >= 0),
    pending         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending >= 0),
    currency        VARCHAR(3)    NOT NULL DEFAULT 'YER',
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- STORE_FOLLOWERS (customers following stores)
-- =====================================================================
CREATE TABLE IF NOT EXISTS store_followers (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id    INTEGER     NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id     INTEGER     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    notify_new_products  BOOLEAN NOT NULL DEFAULT TRUE,
    notify_offers        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (store_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_followers_store ON store_followers(store_id);
CREATE INDEX IF NOT EXISTS idx_followers_user  ON store_followers(user_id);

-- =====================================================================
-- INVENTORY_LOG (append-only stock movements)
-- =====================================================================
CREATE TABLE IF NOT EXISTS inventory_log (
    id             INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id     INTEGER       NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    store_id       INTEGER       NOT NULL REFERENCES stores(id)   ON DELETE RESTRICT,
    change_amount  INTEGER       NOT NULL CHECK (change_amount <> 0),
    reason         VARCHAR(40)   NOT NULL
        CHECK (reason IN ('order_placed','order_cancelled','manual_adjust','restock','return')),
    reference_type VARCHAR(40),
    reference_id   INTEGER,
    notes          TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_product   ON inventory_log(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_store     ON inventory_log(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_created_brin ON inventory_log USING BRIN (created_at);

-- =====================================================================
-- SHIPPING_METHODS (global catalog — referenced by /api/shipping/methods)
-- =====================================================================
CREATE TABLE IF NOT EXISTS shipping_methods (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_ar         TEXT          NOT NULL,
    name_en         TEXT,
    name_zh         TEXT,
    base_cost       NUMERIC(12,2) NOT NULL CHECK (base_cost >= 0),
    per_kg_cost     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (per_kg_cost >= 0),
    estimated_days  INTEGER       NOT NULL CHECK (estimated_days > 0),
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order      INTEGER       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shipping_active ON shipping_methods(is_active, sort_order);

-- =====================================================================
-- TRANSACTIONS (store wallet ledger — append-only)
-- =====================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id        INTEGER       NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    type            VARCHAR(20)   NOT NULL
        CHECK (type IN ('order','withdrawal','refund','fee','adjustment')),
    amount          NUMERIC(12,2) NOT NULL,
    balance_after   NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'YER',
    reference_type  VARCHAR(40),
    reference_id    INTEGER,
    description     TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_store    ON transactions(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_brin ON transactions USING BRIN (created_at);

-- =====================================================================
-- ADMIN_AUDIT_LOG (write-only — admins + automated)
-- =====================================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER       REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(40)   NOT NULL,
    entity_type VARCHAR(40)   NOT NULL,
    entity_id   VARCHAR(60),
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON admin_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_brin ON admin_audit_log USING BRIN (created_at);
