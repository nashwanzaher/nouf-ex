-- ============================================================
-- Nouf-ex Database Schema — Full E-commerce Marketplace
-- For Yemen & MENA (PostgreSQL/SQLite compatible)
-- ============================================================

-- Users table (Customers + Merchants + Admins)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    avatar          VARCHAR(500),
    role            VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Categories table (hierarchical)
CREATE TABLE IF NOT EXISTS categories (
    id              SERIAL PRIMARY KEY,
    name_ar         VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100) NOT NULL,
    name_zh         VARCHAR(100),
    slug            VARCHAR(100) NOT NULL UNIQUE,
    parent_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    icon            VARCHAR(100),
    image           VARCHAR(500),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Stores table (Merchant stores)
CREATE TABLE IF NOT EXISTS stores (
    id                  SERIAL PRIMARY KEY,
    owner_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name          VARCHAR(150) NOT NULL,
    store_name_en       VARCHAR(150),
    store_name_zh       VARCHAR(150),
    slug                VARCHAR(150) NOT NULL UNIQUE,
    description         TEXT,
    description_en      TEXT,
    description_zh      TEXT,
    logo                VARCHAR(500),
    banner              VARCHAR(500),
    location            VARCHAR(100),
    governorate         VARCHAR(50),
    category_ids        INTEGER[], -- array of category IDs
    trust_level         VARCHAR(20) DEFAULT 'verified' CHECK (trust_level IN ('verified', 'golden', 'diamond')),
    response_rate       INTEGER DEFAULT 0, -- percentage
    on_time_delivery    INTEGER DEFAULT 0, -- percentage
    rating              DECIMAL(2,1) DEFAULT 0.0, -- 0-5
    review_count        INTEGER DEFAULT 0,
    products_count      INTEGER DEFAULT 0,
    sales_count         INTEGER DEFAULT 0,
    followers_count     INTEGER DEFAULT 0,
    since_year          VARCHAR(4),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name_ar         VARCHAR(200) NOT NULL,
    name_en         VARCHAR(200) NOT NULL,
    name_zh         VARCHAR(200),
    description     TEXT,
    description_en  TEXT,
    description_zh  TEXT,
    price           DECIMAL(12,2) NOT NULL,
    original_price  DECIMAL(12,2),
    currency        VARCHAR(3) NOT NULL DEFAULT 'YER',
    moq             INTEGER DEFAULT 1, -- Minimum Order Quantity
    stock           INTEGER NOT NULL DEFAULT 0,
    sold_count      INTEGER DEFAULT 0,
    rating          DECIMAL(2,1) DEFAULT 0.0,
    review_count    INTEGER DEFAULT 0,
    features        JSONB,
    specifications  JSONB,
    badges          VARCHAR(50)[], -- 'bestseller', 'new', 'sale', 'limited'
    colors          VARCHAR(50)[],
    sizes           VARCHAR(50)[],
    main_image      VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    deal_discount   INTEGER, -- percentage
    deal_ends_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Product Images
CREATE TABLE IF NOT EXISTS product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES users(id),
    store_id        INTEGER NOT NULL REFERENCES stores(id),
    order_number    VARCHAR(50) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    payment_method  VARCHAR(20) NOT NULL DEFAULT 'cod' 
        CHECK (payment_method IN ('cod', 'card', 'wallet', 'bank_transfer')),
    payment_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    subtotal        DECIMAL(12,2) NOT NULL,
    shipping_cost   DECIMAL(12,2) DEFAULT 0,
    discount        DECIMAL(12,2) DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL,
    shipping_address JSONB,
    notes           TEXT,
    timeline        JSONB, -- order tracking events
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    unit_price  DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    variant     VARCHAR(100), -- color/size if applicable
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Cart Items
CREATE TABLE IF NOT EXISTS cart_items (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity    INTEGER NOT NULL DEFAULT 1,
    variant     VARCHAR(100),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id, variant)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    order_id    INTEGER REFERENCES orders(id),
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(200),
    comment     TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE, -- verified purchase
    helpful_count INTEGER DEFAULT 0,
    merchant_reply TEXT,
    reply_at    TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Wishlist
CREATE TABLE IF NOT EXISTS wishlist (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       VARCHAR(50), -- 'home', 'work', etc.
    full_name   VARCHAR(100),
    phone       VARCHAR(20),
    governorate VARCHAR(50),
    city        VARCHAR(50),
    district    VARCHAR(50),
    street      VARCHAR(200),
    building    VARCHAR(50),
    directions  TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(30) NOT NULL, -- 'order', 'message', 'review', 'promo', 'system'
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    data        JSONB, -- related IDs
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Disputes (Nouf-Resolve system)
CREATE TABLE IF NOT EXISTS disputes (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id),
    customer_id     INTEGER NOT NULL REFERENCES users(id),
    store_id        INTEGER NOT NULL REFERENCES stores(id),
    type            VARCHAR(30) NOT NULL 
        CHECK (type IN ('not_received', 'wrong_item', 'damaged', 'quality', 'refund_request', 'other')),
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'under_review', 'resolved_buyer', 'resolved_seller', 'split', 'closed')),
    priority        VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    subject         VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    evidence_urls   VARCHAR(500)[],
    resolution      TEXT,
    resolved_by     INTEGER REFERENCES users(id), -- admin
    refund_amount   DECIMAL(12,2),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Messages (Customer ↔ Merchant chat)
CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL PRIMARY KEY,
    sender_id   INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    store_id    INTEGER REFERENCES stores(id),
    product_id  INTEGER REFERENCES products(id),
    content     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id              SERIAL PRIMARY KEY,
    store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    plan            VARCHAR(20) NOT NULL 
        CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
    price_monthly   DECIMAL(10,2),
    price_yearly    DECIMAL(10,2),
    started_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_deal ON products(deal_discount) WHERE deal_discount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_store ON reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_trust ON stores(trust_level);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- Views
-- ============================================================

-- Products with store info
CREATE OR REPLACE VIEW v_products_full AS
SELECT 
    p.*,
    s.store_name, s.store_name_en, s.store_name_zh,
    s.slug AS store_slug, s.logo AS store_logo,
    s.trust_level, s.rating AS store_rating,
    c.name_ar AS category_name, c.name_en AS category_name_en
FROM products p
JOIN stores s ON p.store_id = s.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = TRUE;

-- Store stats view
CREATE OR REPLACE VIEW v_store_stats AS
SELECT 
    s.*,
    COUNT(DISTINCT p.id) AS total_products,
    COUNT(DISTINCT o.id) AS total_orders,
    COALESCE(SUM(o.total), 0) AS total_revenue,
    COUNT(DISTINCT r.id) AS total_reviews
FROM stores s
LEFT JOIN products p ON s.id = p.store_id AND p.is_active = TRUE
LEFT JOIN orders o ON s.id = o.store_id AND o.status IN ('delivered', 'shipped')
LEFT JOIN reviews r ON s.id = r.store_id
GROUP BY s.id;

-- ============================================================
-- Full-text search (PostgreSQL only)
-- ============================================================

-- For product search
CREATE INDEX IF NOT EXISTS idx_products_search 
ON products USING gin(to_tsvector('simple', COALESCE(name_ar,'') || ' ' || COALESCE(name_en,'')));
