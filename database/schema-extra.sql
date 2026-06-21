-- ============================================
-- Extra tables (auto-extracted from SQLite seed)
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'YER',
        method TEXT NOT NULL DEFAULT 'cod' CHECK(method IN ('cod','card','wallet','bank_transfer')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed','refunded')),
        transaction_id TEXT,
        paid_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'percentage' CHECK(type IN ('percentage','fixed')),
        value REAL NOT NULL DEFAULT 0,
        min_order REAL DEFAULT 0,
        max_discount REAL,
        usage_limit INTEGER DEFAULT 1,
        usage_count INTEGER NOT NULL DEFAULT 0,
        starts_at TEXT,
        expires_at TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        sku TEXT,
        variant_name TEXT NOT NULL,
        price_adjustment REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount REAL NOT NULL DEFAULT 0,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','processed')),
        processed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS store_balance (
        id SERIAL PRIMARY KEY,
        store_id INTEGER NOT NULL UNIQUE REFERENCES stores(id),
        available_balance REAL NOT NULL DEFAULT 0,
        pending_balance REAL NOT NULL DEFAULT 0,
        total_earned REAL NOT NULL DEFAULT 0,
        total_withdrawn REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS store_followers (
        id SERIAL PRIMARY KEY,
        store_id INTEGER NOT NULL REFERENCES stores(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(store_id, user_id)
    );

CREATE TABLE IF NOT EXISTS inventory_log (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        store_id INTEGER NOT NULL REFERENCES stores(id),
        change_amount INTEGER NOT NULL,
        reason TEXT NOT NULL DEFAULT 'manual_adjustment',
        reference_type TEXT,
        reference_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS shipping_methods (
    id SERIAL PRIMARY KEY,
    name_ar         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    base_cost       REAL NOT NULL DEFAULT 0,
    per_kg_cost     REAL DEFAULT 0,
    estimated_days  INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    store_id        INTEGER NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('order','withdrawal','refund','fee','adjustment')),
    amount          REAL NOT NULL,
    balance_after   REAL NOT NULL,
    reference_type  TEXT,
    reference_id    INTEGER,
    description     TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  user_id      INTEGER,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    INTEGER,
  old_values   TEXT,
  new_values   TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usage (
    id SERIAL PRIMARY KEY,
    coupon_id       INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    order_id        INTEGER,
    discount_amount REAL NOT NULL,
    used_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, user_id, order_id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (order_id)  REFERENCES orders(id)
  );

-- ============================================
-- Indexes for performance (review_db.md §21)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payments_order        ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user         ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status       ON payments(status);
CREATE INDEX IF NOT EXISTS idx_coupons_code          ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active        ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon   ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user     ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_variants_product      ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_active       ON product_variants(is_active);
CREATE INDEX IF NOT EXISTS idx_refunds_order         ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user          ON refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status        ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_inventory_product     ON inventory_log(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store       ON inventory_log(store_id);
CREATE INDEX IF NOT EXISTS idx_followers_store       ON store_followers(store_id);
CREATE INDEX IF NOT EXISTS idx_followers_user        ON store_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_store    ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created  ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user            ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity          ON admin_audit_log(entity_type, entity_id);

-- ============================================
-- DB integrity fixes (review_db.md §1.2 - §1.7)
-- Apply via triggers so cached counts stay in sync
-- ============================================

-- products.review_count + rating derived from reviews
CREATE OR REPLACE FUNCTION refresh_product_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
    rating       = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)), 0)
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reviews_refresh_rating ON reviews;
CREATE TRIGGER trg_reviews_refresh_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_product_rating();

-- stores.products_count derived from products
CREATE OR REPLACE FUNCTION refresh_store_products_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE stores SET products_count = (
    SELECT COUNT(*) FROM products WHERE store_id = COALESCE(NEW.store_id, OLD.store_id) AND is_active = TRUE
  )
  WHERE id = COALESCE(NEW.store_id, OLD.store_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_refresh_store_count ON products;
CREATE TRIGGER trg_products_refresh_store_count
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION refresh_store_products_count();

-- orders.total derived from order_items (runs nightly + on-demand via a separate reconciliation script)
-- (kept as a documented routine rather than a trigger to avoid contention on every order insert)
