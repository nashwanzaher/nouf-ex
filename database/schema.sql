-- =====================================================================
-- Nouf-ex — Base Schema (noufex_db)
-- =====================================================================
-- Conventions
--   * Identity columns: GENERATED ALWAYS AS IDENTITY (PG 17 standard)
--   * Timestamps:      TIMESTAMPTZ everywhere
--   * Soft delete:     deleted_at TIMESTAMPTZ NULL on user-facing tables
--   * Tri-locale:      name_ar NOT NULL, name_en / name_zh nullable
--   * Money:           NUMERIC(12,2) — never REAL/FLOAT
--   * All tables:      updated_at maintained by trg_set_updated_at
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- Reference: app metadata table for soft-delete, lock_version, etc.
-- ---------------------------------------------------------------------

-- =====================================================================
-- USERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email                 CITEXT      NOT NULL UNIQUE,
    password_hash         TEXT        NOT NULL,
    full_name             TEXT        NOT NULL,
    phone                 VARCHAR(20),
    role                  VARCHAR(20) NOT NULL
        CHECK (role IN ('customer','merchant','admin')),
    status                VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','suspended','banned')),
    is_verified           BOOLEAN     NOT NULL DEFAULT FALSE,
    email_verified        BOOLEAN     NOT NULL DEFAULT FALSE,
    phone_verified        BOOLEAN     NOT NULL DEFAULT FALSE,
    avatar                TEXT,
    two_factor_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
    preferred_language    VARCHAR(5)  NOT NULL DEFAULT 'ar',
    gender                VARCHAR(10)
        CHECK (gender IS NULL OR gender IN ('male','female','other')),
    last_login            TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email          ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX        IF NOT EXISTS idx_users_role          ON users(role);
CREATE INDEX        IF NOT EXISTS idx_users_status        ON users(status) WHERE status <> 'active';
CREATE INDEX        IF NOT EXISTS idx_users_created_brin  ON users USING BRIN (created_at);

-- =====================================================================
-- CATEGORIES (self-referential tree)
-- =====================================================================
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id   INTEGER     REFERENCES categories(id) ON DELETE SET NULL,
    name_ar     TEXT        NOT NULL,
    name_en     TEXT,
    name_zh     TEXT,
    slug        VARCHAR(80) NOT NULL UNIQUE,
    icon        TEXT,
    image       TEXT,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (name_ar <> '')
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active, sort_order);

-- =====================================================================
-- STORES
-- =====================================================================
CREATE TABLE IF NOT EXISTS stores (
    id                INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id          INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_name        TEXT          NOT NULL,
    store_name_en     TEXT,
    store_name_zh     TEXT,
    slug              VARCHAR(80)   NOT NULL UNIQUE,
    description       TEXT,
    description_en    TEXT,
    description_zh    TEXT,
    logo              TEXT,
    banner            TEXT,
    location          TEXT,
    governorate       VARCHAR(60),
    trust_level       VARCHAR(20)   NOT NULL DEFAULT 'verified'
        CHECK (trust_level IN ('verified','golden','diamond')),
    response_rate     NUMERIC(5,2)  NOT NULL DEFAULT 95
        CHECK (response_rate BETWEEN 0 AND 100),
    on_time_delivery  NUMERIC(5,2)  NOT NULL DEFAULT 95
        CHECK (on_time_delivery BETWEEN 0 AND 100),
    commission_rate   NUMERIC(5,2)  NOT NULL DEFAULT 5
        CHECK (commission_rate BETWEEN 0 AND 100),
    rating            NUMERIC(2,1)  NOT NULL DEFAULT 0
        CHECK (rating BETWEEN 0 AND 5),
    review_count      INTEGER       NOT NULL DEFAULT 0,
    products_count    INTEGER       NOT NULL DEFAULT 0,
    sales_count       INTEGER       NOT NULL DEFAULT 0,
    followers_count   INTEGER       NOT NULL DEFAULT 0,
    since_year        VARCHAR(4)    DEFAULT '2024',
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    is_verified       BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stores_owner    ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_active   ON stores(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_stores_trust    ON stores(trust_level);
CREATE INDEX IF NOT EXISTS idx_stores_rating   ON stores(rating DESC);
CREATE INDEX IF NOT EXISTS idx_stores_created ON stores USING BRIN (created_at);

-- =====================================================================
-- PRODUCTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id        INTEGER         NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    category_id     INTEGER         REFERENCES categories(id) ON DELETE SET NULL,
    name_ar         TEXT            NOT NULL,
    name_en         TEXT,
    name_zh         TEXT,
    description     TEXT,
    description_en  TEXT,
    description_zh  TEXT,
    price           NUMERIC(12,2)   NOT NULL CHECK (price > 0),
    original_price  NUMERIC(12,2)   CHECK (original_price IS NULL OR original_price > 0),
    currency        VARCHAR(3)      NOT NULL DEFAULT 'YER',
    stock           INTEGER         NOT NULL DEFAULT 0 CHECK (stock >= 0),
    moq             INTEGER         NOT NULL DEFAULT 1 CHECK (moq >= 1),
    weight          INTEGER         CHECK (weight IS NULL OR weight > 0),
    tax_rate        NUMERIC(5,2)    NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
    is_digital      BOOLEAN         NOT NULL DEFAULT FALSE,
    main_image      TEXT,
    features        TEXT[],
    specifications  JSONB           NOT NULL DEFAULT '{}'::jsonb,
    badges          TEXT[],
    rating          NUMERIC(2,1)    NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    review_count    INTEGER         NOT NULL DEFAULT 0,
    sold_count      INTEGER         NOT NULL DEFAULT 0,
    view_count      INTEGER         NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN         NOT NULL DEFAULT FALSE,
    deal_discount   NUMERIC(5,2)    CHECK (deal_discount IS NULL OR deal_discount BETWEEN 1 AND 99),
    deal_ends_at    TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX        IF NOT EXISTS idx_products_store        ON products(store_id);
CREATE INDEX        IF NOT EXISTS idx_products_category     ON products(category_id);
CREATE INDEX        IF NOT EXISTS idx_products_active       ON products(is_active) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX        IF NOT EXISTS idx_products_featured     ON products(is_featured) WHERE is_featured = TRUE AND deleted_at IS NULL;
CREATE INDEX        IF NOT EXISTS idx_products_deal         ON products(deal_discount) WHERE deal_discount IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_products_store_active ON products(store_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX        IF NOT EXISTS idx_products_created      ON products(created_at DESC);
CREATE INDEX        IF NOT EXISTS idx_products_search       ON products
    USING GIN (to_tsvector('simple', coalesce(name_ar,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(name_zh,'')));

-- =====================================================================
-- PRODUCT_VARIANTS (size/color/SKU per product)
-- =====================================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id          INTEGER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  INTEGER        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku         VARCHAR(60)    UNIQUE,
    name_ar     TEXT           NOT NULL,
    name_en     TEXT,
    name_zh     TEXT,
    attributes  JSONB          NOT NULL DEFAULT '{}'::jsonb,   -- {color, size, ...}
    price_delta NUMERIC(12,2)  NOT NULL DEFAULT 0,               -- added to product.price
    stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
    sort_order  INTEGER        NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_active  ON product_variants(is_active) WHERE is_active = TRUE;

-- =====================================================================
-- PRODUCT_IMAGES
-- =====================================================================
CREATE TABLE IF NOT EXISTS product_images (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url   TEXT        NOT NULL,
    alt_text    TEXT,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(product_id, is_primary) WHERE is_primary = TRUE;

-- =====================================================================
-- ADDRESSES
-- =====================================================================
CREATE TABLE IF NOT EXISTS addresses (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       VARCHAR(40),
    full_name   TEXT        NOT NULL,
    phone       VARCHAR(20) NOT NULL,
    city        TEXT        NOT NULL,
    governorate TEXT,
    district    TEXT,
    street      TEXT        NOT NULL,
    building    TEXT,
    notes       TEXT,
    latitude    NUMERIC(9,6),
    longitude   NUMERIC(9,6),
    is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (full_name <> '' AND phone <> '' AND city <> '' AND street <> '')
);
CREATE INDEX IF NOT EXISTS idx_addresses_user    ON addresses(user_id);
-- Enforce at most one default address per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_one_default
    ON addresses(user_id) WHERE is_default = TRUE;

-- =====================================================================
-- ORDERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS orders (
    id                  INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number        VARCHAR(40)     NOT NULL UNIQUE,
    customer_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_id            INTEGER         NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
    payment_method      VARCHAR(20)     NOT NULL
        CHECK (payment_method IN ('cod','card','wallet','bank_transfer','stripe','paymob')),
    payment_status      VARCHAR(20)     NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending','paid','failed','refunded')),
    subtotal            NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    shipping_cost       NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    discount            NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (discount >= 0),
    coupon_code         VARCHAR(50),
    discount_amount     NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total               NUMERIC(12,2)   NOT NULL CHECK (total >= 0),
    currency            VARCHAR(3)      NOT NULL DEFAULT 'YER',
    shipping_address    JSONB           NOT NULL,
    billing_address     JSONB,
    notes               TEXT,
    tracking_number     VARCHAR(100),
    shipping_company    VARCHAR(100),
    estimated_delivery  TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    timeline            JSONB           NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_customer        ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store           ON orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status  ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_brin    ON orders USING BRIN (created_at);

-- =====================================================================
-- ORDER_ITEMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id     INTEGER        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   INTEGER        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id   INTEGER        REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT           NOT NULL,                  -- snapshot
    quantity     INTEGER        NOT NULL CHECK (quantity > 0),
    unit_price   NUMERIC(12,2)  NOT NULL CHECK (unit_price > 0),
    total_price  NUMERIC(12,2)  NOT NULL CHECK (total_price >= 0),
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- =====================================================================
-- CART_ITEMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS cart_items (
    id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER     REFERENCES product_variants(id) ON DELETE SET NULL,
    -- JSON blob of the picked product variant (color/size/custom fields).
    -- Server-side cart handlers INSERT this as a JSON string from the API
    -- body and the API client reads it back. Distinct from `variant_id`
    -- which is the FK to product_variants for pre-defined SKUs.
    variant    JSONB,
    quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, product_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_user    ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

-- =====================================================================
-- REVIEWS
-- =====================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id            INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id    INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id      INTEGER     NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
    customer_id   INTEGER     NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    order_id      INTEGER                  REFERENCES orders(id) ON DELETE SET NULL,
    rating        SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title         VARCHAR(120),
    comment       TEXT,
    images        TEXT[],
    is_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
    is_visible    BOOLEAN     NOT NULL DEFAULT TRUE,
    helpful_count INTEGER     NOT NULL DEFAULT 0,
    merchant_reply TEXT,
    merchant_replied_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (title IS NOT NULL OR comment IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_store   ON reviews(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_visible  ON reviews(is_visible) WHERE is_visible = TRUE;

-- =====================================================================
-- WISHLIST
-- =====================================================================
CREATE TABLE IF NOT EXISTS wishlist (
    id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user    ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist(product_id);

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(20) NOT NULL
        CHECK (type IN ('order','message','review','promo','system','dispute','refund')),
    title      TEXT        NOT NULL,
    body       TEXT,
    data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (title <> '')
);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_brin ON notifications USING BRIN (created_at);

-- =====================================================================
-- DISPUTES
-- =====================================================================
CREATE TABLE IF NOT EXISTS disputes (
    id             INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id       INTEGER     NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    customer_id    INTEGER     NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    store_id       INTEGER     NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    type           VARCHAR(30) NOT NULL
        CHECK (type IN ('not_received','damaged','wrong_item','quality_issue','refund_delay','other')),
    status         VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','investigating','resolved_buyer','resolved_seller','closed','rejected')),
    priority       VARCHAR(10) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low','normal','high','urgent')),
    subject        VARCHAR(200) NOT NULL,
    description    TEXT        NOT NULL,
    evidence       JSONB       NOT NULL DEFAULT '[]'::jsonb,
    resolution     TEXT,
    refund_amount  NUMERIC(12,2) CHECK (refund_amount IS NULL OR refund_amount >= 0),
    resolved_by    INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    resolved_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (subject <> '' AND description <> '')
);
CREATE INDEX IF NOT EXISTS idx_disputes_order    ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_store    ON disputes(store_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status   ON disputes(status) WHERE status NOT IN ('closed','rejected');
CREATE INDEX IF NOT EXISTS idx_disputes_priority ON disputes(priority, created_at) WHERE priority IN ('high','urgent');

-- =====================================================================
-- MESSAGES (customer ↔ merchant chat)
-- =====================================================================
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id    INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    receiver_id  INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    store_id     INTEGER                  REFERENCES stores(id)   ON DELETE SET NULL,
    product_id   INTEGER                  REFERENCES products(id) ON DELETE SET NULL,
    order_id     INTEGER                  REFERENCES orders(id)   ON DELETE SET NULL,
    body         TEXT        NOT NULL,
    attachments  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (body <> '' AND sender_id <> receiver_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver  ON messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_store     ON messages(store_id);
CREATE INDEX IF NOT EXISTS idx_messages_product   ON messages(product_id);

-- =====================================================================
-- SUBSCRIPTIONS (merchant plans)
-- =====================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id    INTEGER     NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    plan        VARCHAR(20) NOT NULL
        CHECK (plan IN ('free','starter','pro','enterprise')),
    status      VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','cancelled','expired','past_due')),
    started_at  TIMESTAMPTZ NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    currency    VARCHAR(3) NOT NULL DEFAULT 'YER',
    auto_renew  BOOLEAN NOT NULL DEFAULT FALSE,
    features    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (expires_at > started_at)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_store  ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE status IN ('active','past_due');
