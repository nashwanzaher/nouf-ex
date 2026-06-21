# مراجعة شاملة لقاعدة بيانات تطبيق Nouf-ex
## Database Architecture Review

**تاريخ المراجعة:** 2025-06-21
**قاعدة البيانات:** noufex.db (SQLite)
**حجم الملف:** 244 KB
**عدد الجداول:** 16 (باستثناء sqlite_sequence)
**إجمالي الصفوف:** ~331 صفًا (بيانات تجريبية)
**إصدار المخطط:** v2.0

---

## ملخص تنفيذي

قاعدة بيانات Nouf-ex تحتوي على **16 جدولاً** أساسيًا لمنصة تجارة إلكترونية متعددة البائعين. المراجعة كشفت عن **7 مشاكل حرجة**، **21 فهرسًا مفقودًا**، **17 جدولًا مفقودًا**، و**عشرات الحقول المفقودة**. البيانات التجريبية تحتوي على تناقضات خطيرة بين الأعمدة المحسوبة والبيانات الفعلية. يتطلب الأمر إصلاحات فورية قبل الإطلاق الإنتاجي.

**درجة الخطورة الإجمالية: 🔴 عالية**

---

## 1. المشاكل الحرجة (Critical Issues)

### 🔴 1.1. Foreign Keys معطلة (خطير جداً)

**المشكلة:** `PRAGMA foreign_keys = 0` — المفاتيح الأجنبية غير مفعلة في SQLite.

**التأثير:** حتى مع تعريف FOREIGN KEY في المخطط، لن تمنع قاعدة البيانات:
- إدخال طلبات لمتاجر غير موجودة
- إدخال مراجعات لمنتجات محذوفة
- إدخال عناصر سلة لمستخدمين غير موجودين

**الإصلاح:**
```sql
-- تفعيل المفاتيح الأجنبية عند الاتصال
PRAGMA foreign_keys = ON;

-- أو في كود التطبيق بعد كل اتصال
sqlite3.connect('/mnt/agents/output/noufex.db')
conn.execute("PRAGMA foreign_keys = ON;")
```

---

### 🔴 1.2. عدم تطابق counts المحسوبة (خطير)

**المشكلة:** أعمدة العدّ المخزنة (`review_count`, `products_count`, `sold_count`) لا تتوافق مع البيانات الفعلية.

| الجدول | العمود | القيمة المخزنة | القيمة الفعلية | الفرق |
|--------|--------|---------------|---------------|-------|
| products | review_count (منتج 1) | 124 | 0 | -124 |
| products | review_count (منتج 2) | 89 | 2 | -87 |
| products | review_count (منتج 3) | 312 | 1 | -311 |
| stores | products_count (متجر 1) | 48 | 7 | -41 |
| stores | products_count (متجر 2) | 23 | 4 | -19 |
| stores | products_count (متجر 3) | 67 | 3 | -64 |

**ملاحظة:** ALL المتاجر (16/16) لديها `products_count` غير متطابق!

**الإصلاح:** إما:
1. إزالة الأعمدة المحسوبة والاعتماد على COUNT في الاستعلامات، أو
2. إنشاء triggers لتحديث الأعمدة المحسوبة تلقائيًا:

```sql
-- مثال: Trigger لتحديث products_count
CREATE TRIGGER update_store_products_count 
AFTER INSERT ON products
BEGIN
    UPDATE stores SET products_count = (
        SELECT COUNT(*) FROM products WHERE store_id = NEW.store_id
    ), updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.store_id;
END;

CREATE TRIGGER update_store_products_count_delete
AFTER DELETE ON products
BEGIN
    UPDATE stores SET products_count = (
        SELECT COUNT(*) FROM products WHERE store_id = OLD.store_id
    ), updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.store_id;
END;
```

---

### 🔴 1.3. عدم تطابق totals الطلبات (خطير جداً)

**المشكلة:** `orders.total` لا يتوافق مع `SUM(order_items.total_price)` في **30 طلبًا من أصل 30** (100%)!

**أمثلة:**
| Order ID | orders.total | SUM(items) | الفرق |
|----------|-------------|-----------|-------|
| 1 | 194,000 | 89,500 | +104,500 |
| 6 | 8,600 | 105,500 | -96,900 |
| 9 | 337,000 | 34,400 | +302,600 |

**الإصلاح:** إعادة حساب وتصحيح البيانات:
```sql
-- التحقق من التناقضات
SELECT o.id, o.total, SUM(oi.total_price) as calc_total
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id
HAVING ABS(o.total - SUM(oi.total_price)) > 1;

-- تصحيح (بعد مراجعة يدوية)
UPDATE orders SET total = (
    SELECT SUM(total_price) FROM order_items WHERE order_id = orders.id
);
```

---

### 🔴 1.4. جميع المنتجات بدون صور (100%)

**المشكلة:** 40/40 منتج (100%) لا يملكون صورًا في جدول `product_images` رغم وجود حقل `main_image` في جدول `products`.

**الإصلاح:** إما:
1. إدخال بيانات تجريبية للصور:
```sql
INSERT INTO product_images (product_id, image_url, sort_order)
SELECT id, main_image, 0 FROM products WHERE main_image IS NOT NULL;
```
2. أو إزالة `main_image` من `products` والاعتماد الكامل على `product_images`.

---

### 🔴 1.5. merchants بدون متجر

**المشكلة:** 2 merchants (user_id 9 و 10) ليس لديهما متجر مرتبط.

```
User 9: merchant4@noufex.com - بدون متجر
User 10: merchant5@noufex.com - بدون متجر
```

**الإصلاح:** إنشاء متاجر لهما أو تغيير دورهم.

---

### 🔴 1.6. التقييمات لا تتوافق مع المنتجات

**المشكلة:** حقل `products.rating` لا يتوافق مع متوسط تقييمات جدول `reviews`، و`review_count` مختلف بشكل كبير.

**الإصلاح:**
```sql
-- إعادة حساب التقييمات
UPDATE products 
SET rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE product_id = products.id), 0),
    review_count = COALESCE((SELECT COUNT(*) FROM reviews WHERE product_id = products.id), 0);
```

---

### 🔴 1.7. انعدام سلامة البيانات في order_items

**المشكلة:** لا يوجد قيد لمنع `quantity <= 0` أو `unit_price < 0` في `order_items`.

**الإصلاح:**
```sql
-- SQLite: إعادة إنشاء الجدول مع القيود (لا يمكن ADD CONSTRAINT مباشرة)
-- أو التحقق من التطبيق
ALTER TABLE order_items ADD COLUMN CHECK (quantity > 0);
ALTER TABLE order_items ADD COLUMN CHECK (unit_price >= 0);
```

---

## 2. الجداول المفقودة (17 جدول)

| # | الجدول المفقود | الأهمية | الوصف |
|---|---------------|---------|-------|
| 1 | **payments** | 🔴 عالية | سجل المدفوعات والمعاملات المالية |
| 2 | **coupons** | 🔴 عالية | قسائم الخصم الترويجية |
| 3 | **coupon_usage** | 🟡 متوسطة | استخدام القسائم من قبل المستخدمين |
| 4 | **product_variants** | 🔴 عالية | متغيرات المنتج (لون، مقاس، إلخ) |
| 5 | **inventory_log** | 🟡 متوسطة | سجل تغييرات المخزون |
| 6 | **store_followers** | 🟡 متوسطة | متابعي المتاجر |
| 7 | **shipping_methods** | 🔴 عالية | طرق وأسعار الشحن |
| 8 | **refunds** | 🔴 عالية | طلبات الاسترجاع والاسترداد |
| 9 | **shipping_tracking** | 🟡 متوسطة | تتبع حالة الشحن |
| 10 | **store_balance** | 🔴 عالية | رصيد المتجر والأرباح |
| 11 | **transactions** | 🔴 عالية | المعاملات المالية للمتاجر |
| 12 | **product_views** | 🟢 منخفضة | سجل مشاهدات المنتجات |
| 13 | **search_logs** | 🟢 منخفضة | سجل عمليات البحث |
| 14 | **banners** | 🟡 متوسطة | البنرات الإعلانية والترويجية |
| 15 | **promotions** | 🟡 متوسطة | العروض والحملات الترويجية |
| 16 | **activity_log** | 🟡 متوسطة | سجل النشاطات العامة |
| 17 | **admin_audit_log** | 🔴 عالية | سجل مراجعة actions الأدمن |

### سكريبت إنشاء الجداول المفقودة:

```sql
-- ============================================
-- الجداول المفقودة - Missing Tables
-- ============================================

-- 1. payments (سجل المدفوعات)
CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'YER',
    method          TEXT NOT NULL CHECK (method IN ('cod', 'card', 'wallet', 'bank_transfer', 'stripe', 'paymob')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    transaction_id  TEXT,
    gateway_response TEXT,
    paid_at         TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 2. coupons (قسائم الخصم)
CREATE TABLE IF NOT EXISTS coupons (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    type            TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
    value           REAL NOT NULL,
    min_order       REAL DEFAULT 0,
    max_discount    REAL,
    usage_limit     INTEGER,
    usage_count     INTEGER DEFAULT 0,
    valid_from      TIMESTAMP,
    valid_until     TIMESTAMP,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- 3. coupon_usage (استخدام القسائم)
CREATE TABLE IF NOT EXISTS coupon_usage (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id       INTEGER NOT NULL REFERENCES coupons(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    order_id        INTEGER REFERENCES orders(id),
    discount_amount REAL NOT NULL,
    used_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, user_id, order_id)
);

-- 4. product_variants (متغيرات المنتج)
CREATE TABLE IF NOT EXISTS product_variants (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku             TEXT,
    variant_name    TEXT NOT NULL,
    color           TEXT,
    size            TEXT,
    price_adjustment REAL DEFAULT 0,
    stock           INTEGER NOT NULL DEFAULT 0,
    image_url       TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- 5. inventory_log (سجل المخزون)
CREATE TABLE IF NOT EXISTS inventory_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    variant_id      INTEGER REFERENCES product_variants(id),
    store_id        INTEGER NOT NULL REFERENCES stores(id),
    change_amount   INTEGER NOT NULL,
    reason          TEXT NOT NULL,
    reference_type  TEXT,
    reference_id    INTEGER,
    notes           TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_log(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory_log(store_id);

-- 6. store_followers (متابعو المتجر)
CREATE TABLE IF NOT EXISTS store_followers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_followers_store ON store_followers(store_id);
CREATE INDEX IF NOT EXISTS idx_followers_user ON store_followers(user_id);

-- 7. shipping_methods (طرق الشحن)
CREATE TABLE IF NOT EXISTS shipping_methods (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    base_cost       REAL NOT NULL DEFAULT 0,
    per_kg_cost     REAL DEFAULT 0,
    estimated_days  INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. refunds (طلبات الاسترجاع)
CREATE TABLE IF NOT EXISTS refunds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id),
    order_item_id   INTEGER REFERENCES order_items(id),
    customer_id     INTEGER NOT NULL REFERENCES users(id),
    store_id        INTEGER NOT NULL REFERENCES stores(id),
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
    refund_amount   REAL NOT NULL,
    admin_notes     TEXT,
    resolved_by     INTEGER REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- 9. store_balance (رصيد المتجر)
CREATE TABLE IF NOT EXISTS store_balance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id        INTEGER NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    available       REAL NOT NULL DEFAULT 0,
    pending         REAL NOT NULL DEFAULT 0,
    withdrawn       REAL NOT NULL DEFAULT 0,
    total_earned    REAL NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. transactions (المعاملات المالية)
CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id        INTEGER NOT NULL REFERENCES stores(id),
    type            TEXT NOT NULL CHECK (type IN ('order', 'withdrawal', 'refund', 'fee', 'adjustment')),
    amount          REAL NOT NULL,
    balance_after   REAL NOT NULL,
    reference_type  TEXT,
    reference_id    INTEGER,
    description     TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_store ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- 11. admin_audit_log (سجل مراجعة الأدمن)
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id),
    action          TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       INTEGER,
    old_values      TEXT,
    new_values      TEXT,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at);

-- 12. product_views (مشاهدات المنتج)
CREATE TABLE IF NOT EXISTS product_views (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    user_id         INTEGER REFERENCES users(id),
    session_id      TEXT,
    ip_address      TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_views_product ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_views_created ON product_views(created_at);
```

---

## 3. الفهارس المفقودة (21 فهرس)

### الفهارس الحالية (26):
- `idx_cart_user`, `idx_disputes_order`, `idx_disputes_status`
- `idx_messages_receiver`, `idx_messages_sender`
- `idx_notifications_unread`, `idx_notifications_user`
- `idx_orders_customer`, `idx_orders_status`, `idx_orders_store`
- `idx_products_active`, `idx_products_category`, `idx_products_deal`, `idx_products_featured`, `idx_products_store`
- `idx_reviews_product`, `idx_reviews_store`
- `idx_stores_owner`, `idx_stores_trust`
- `idx_wishlist_user`
- فهارس UNIQUE تلقائية (6)

### الفهارس المفقودة الحرجة:

```sql
-- فهارس أساسية للعلاقات
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_store ON messages(store_id);
CREATE INDEX IF NOT EXISTS idx_messages_product ON messages(product_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE is_active = 1;

-- فهارس للأداء (الترتيب والتصفية)
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating);
CREATE INDEX IF NOT EXISTS idx_products_sold ON products(sold_count);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_stores_rating ON stores(rating);
CREATE INDEX IF NOT EXISTS idx_stores_created ON stores(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at);

-- فهارس مركبة (Composite Indexes) للبحث المتقدم
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);
```

---

## 4. الحقول المفقودة المهمة

### جدول users — 8 حقول مفقودة:
```sql
ALTER TABLE users ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE users ADD COLUMN birth_date DATE;
ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'ar';
ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Aden';
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP; -- soft delete
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN last_ip_address TEXT;
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
```

### جدول products — 10 حقول مفقودة:
```sql
ALTER TABLE products ADD COLUMN sku TEXT UNIQUE; -- Stock Keeping Unit
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'g'));
ALTER TABLE products ADD COLUMN is_digital BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN file_url TEXT; -- لمنتجات رقمية
ALTER TABLE products ADD COLUMN tax_rate REAL DEFAULT 0; -- نسبة الضريبة
ALTER TABLE products ADD COLUMN meta_title TEXT;
ALTER TABLE products ADD COLUMN meta_description TEXT;
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP; -- soft delete
```

### جدول orders — 8 حقول مفقودة:
```sql
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN shipping_company TEXT;
ALTER TABLE orders ADD COLUMN estimated_delivery DATE;
ALTER TABLE orders ADD COLUMN actual_delivery TIMESTAMP;
ALTER TABLE orders ADD COLUMN cancelled_reason TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP;
```

### جدول stores — 3 حقول مفقودة:
```sql
ALTER TABLE stores ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE stores ADD COLUMN commission_rate REAL DEFAULT 5.0; -- نسبة العمولة
ALTER TABLE stores ADD COLUMN bank_account_info TEXT;
```

### جدول reviews — 2 حقل مفقود:
```sql
ALTER TABLE reviews ADD COLUMN images TEXT; -- JSON array of image URLs
ALTER TABLE reviews ADD COLUMN is_visible BOOLEAN DEFAULT TRUE; -- للإشراف
```

---

## 5. مشاكل التطبيع (Normalization)

### 5.1. جدول addresses — مخالفة 1NF/3NF

**المشكلة:** يحتوي على أعمدة مكررة (governorate, city, district) يمكن استبدالها بجدول منفصل.

**الحل:** إنشاء جدول `locations`:
```sql
CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER REFERENCES locations(id),
    type        TEXT NOT NULL CHECK (type IN ('country', 'governorate', 'city', 'district')),
    name_ar     TEXT NOT NULL,
    name_en     TEXT,
    is_active   BOOLEAN DEFAULT TRUE
);

ALTER TABLE addresses ADD COLUMN location_id INTEGER REFERENCES locations(id);
-- ثم ترحيل البيانات وإزالة الأعمدة القديمة
```

### 5.2. orders.shipping_address — مخالفة 1NF

**المشكلة:** تخزين عنوان الشحن كـ JSONB يمنع البحث والفهرسة.

**الحل:** إضافة أعمدة منفصلة أو الربط بجدول addresses:
```sql
ALTER TABLE orders ADD COLUMN shipping_address_id INTEGER REFERENCES addresses(id);
```

### 5.3. products — أعمدة JSONB يمكن تفكيكها

- `colors` و `sizes`: يمكن الاحتفاظ بها كـ JSON للمرونة
- `specifications` و `features`: يمكن الاحتفاظ بها كـ JSON
- **التوصية:** لا حاجة لتفكيكها حاليًا

### 5.4. orders.timeline — مخالفة 1NF

**المشكلة:** تخزين سجل الأحداث كـ JSON يمنع البحث والفهرسة.

**الحل:** إنشاء جدول order_events:
```sql
CREATE TABLE IF NOT EXISTS order_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    note        TEXT,
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
```

---

## 6. مشاكل الأداء (Performance)

### 6.1. استعلامات تستخدم TEMP B-TREE (بطيئة)

| الاستعلام | المشكلة |
|-----------|---------|
| `ORDER BY sold_count DESC` | فحص كامل + فرز مؤقت |
| `ORDER BY rating DESC` | فحص كامل + فرز مؤقت |
| `ORDER BY created_at DESC` | فحص كامل + فرز مؤقت |

**الحل:** إنشاء الفهارس المذكورة في القسم 3.

### 6.2. استعلامات البحث

| الاستعلام | المشكلة |
|-----------|---------|
| `WHERE price BETWEEN x AND y` | فحص كامل |
| `WHERE name_ar LIKE '%term%'` | فحص كامل (لا يمكن فهرسة) |

**الحل:**
- إنشاء فهرس على السعر
- للبحث النصي: استخدام FTS5 في SQLite أو فهرس full-text

```sql
-- FTS5 للبحث النصي (متقدم)
CREATE VIRTUAL TABLE IF NOT EXISTS products_search USING fts5(
    name_ar, name_en, description_ar, description_en,
    content='products',
    content_rowid='id'
);

-- مزامنة FTS مع products
CREATE TRIGGER products_search_insert AFTER INSERT ON products BEGIN
    INSERT INTO products_search(rowid, name_ar, name_en, description_ar, description_en)
    VALUES (NEW.id, NEW.name_ar, NEW.name_en, NEW.description, NEW.description_en);
END;
```

### 6.3. الفهارس المركبة المقترحة

```sql
-- للبحث المتكرر: منتجات متجر + نشطة
CREATE INDEX idx_products_store_active ON products(store_id, is_active);

-- للبحث المتكرر: طلبات عميل + حالة
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- للبحث المتكرر: منتجات فئة + نشطة + سعر
CREATE INDEX idx_products_cat_active_price ON products(category_id, is_active, price);
```

---

## 7. مشاكل الأمان (Security)

### 7.1. Foreign Keys معطلة (راجع 1.1)

### 7.2. عدم وجود Soft Delete

**المشكلة:** لا يوجد `deleted_at` في أي جدول. الحذف فعلي ونهائي.

**الحل:** إضافة `deleted_at` لجميع الجداول الرئيسية.

### 7.3. عدم وجود Audit Log

**المشكلة:** لا يمكن تتبع تغييرات الأدمن.

**الحل:** إنشاء جدول `admin_audit_log` (راجع القسم 2).

### 7.4. تخزين الـ password_hash

**الملاحظة:** جيد — يُخزن hash فقط وليس كلمة المرور.

### 7.5. عدم وجود حد لمحاولات تسجيل الدخول

**الحل:** إضافة جدول `login_attempts`:
```sql
CREATE TABLE login_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    ip_address  TEXT,
    success     BOOLEAN,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, created_at);
```

---

## 8. مشاكل البيانات التجريبية (Seed Data)

### 8.1. التناقضات المكتشفة:

| المشكلة | الخطورة | العدد |
|---------|---------|-------|
| order.total ≠ sum(items) | 🔴 عالية | 30/30 طلب |
| products.review_count ≠ actual reviews | 🔴 عالية | 40/40 منتج |
| stores.products_count ≠ actual products | 🔴 عالية | 16/16 متجر |
| منتجات بدون صور | 🟡 متوسطة | 40/40 منتج |
| merchants بدون متجر | 🟡 متوسطة | 2/5 merchant |
| جدول product_images فارغ | 🟡 متوسطة | 0/0 صورة |
| جدول disputes فارغ | 🟢 منخفضة | 0 نزاع |

### 8.2. البيانات الصحيحة:

| الجدول | الصفوف | الحالة |
|--------|--------|--------|
| users | 10 | جيد |
| stores | 16 | جيد |
| categories | 18 | جيد |
| products | 40 | يحتاج صور |
| orders | 30 | يحتاج تصحيح totals |
| order_items | 67 | جيد |
| reviews | 50 | يحتاج توحيد counts |
| cart_items | 13 | جيد |
| wishlist | 23 | جيد |
| messages | 38 | جيد |
| notifications | 30 | جيد |
| addresses | 5 | جيد |
| subscriptions | 16 | جيد |

---

## 9. سكريبت الإصلاح الشامل

```sql
-- ============================================================
-- سكريبت إصلاح قاعدة بيانات Nouf-ex
-- ============================================================

-- 1. تفعيل Foreign Keys
PRAGMA foreign_keys = ON;

-- 2. إنشاء الفهارس المفقودة
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_store ON messages(store_id);
CREATE INDEX IF NOT EXISTS idx_messages_product ON messages(product_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating);
CREATE INDEX IF NOT EXISTS idx_products_sold ON products(sold_count);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_stores_rating ON stores(rating);
CREATE INDEX IF NOT EXISTS idx_stores_created ON stores(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);

-- 3. تصحيح review_count في products
UPDATE products SET 
    review_count = COALESCE((SELECT COUNT(*) FROM reviews WHERE product_id = products.id), 0),
    rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE product_id = products.id), 0);

-- 4. تصحيح products_count في stores
UPDATE stores SET 
    products_count = COALESCE((SELECT COUNT(*) FROM products WHERE store_id = stores.id), 0);

-- 5. إضافة الحقول المفقودة
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'ar';
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE products ADD COLUMN sku TEXT UNIQUE;
ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN tax_rate REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN is_digital BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE stores ADD COLUMN commission_rate REAL DEFAULT 5.0;
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN shipping_company TEXT;
ALTER TABLE reviews ADD COLUMN images TEXT;
ALTER TABLE reviews ADD COLUMN is_visible BOOLEAN DEFAULT TRUE;

-- 6. إنشاء الجداول المفقودة الأساسية
-- [راجع القسم 2 للسكريبت الكامل]

-- 7. إنشاء Triggers للحفاظ على الأعمدة المحسوبة
CREATE TRIGGER IF NOT EXISTS update_store_products_count_insert
AFTER INSERT ON products
BEGIN
    UPDATE stores SET products_count = (SELECT COUNT(*) FROM products WHERE store_id = NEW.store_id),
                      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.store_id;
END;

CREATE TRIGGER IF NOT EXISTS update_store_products_count_delete
AFTER DELETE ON products
BEGIN
    UPDATE stores SET products_count = (SELECT COUNT(*) FROM products WHERE store_id = OLD.store_id),
                      updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.store_id;
END;
```

---

## 10. ملخص التوصيات حسب الأولوية

### 🔴 أولوية فورية (Pre-Launch):

| # | الإجراء | الوقت المقدر |
|---|---------|-------------|
| 1 | تفعيل Foreign Keys في التطبيق | 30 دقيقة |
| 2 | تصحيح orders.total ليطابق order_items | 2 ساعة |
| 3 | تصحيح products.review_count و rating | 30 دقيقة |
| 4 | تصحيح stores.products_count | 30 دقيقة |
| 5 | إنشاء جدول payments | 2 ساعة |
| 6 | إنشاء الفهارس المفقودة | 1 ساعة |

### 🟡 أولوية قصيرة المدى (1-2 أسابيع):

| # | الإجراء | الوقت المقدر |
|---|---------|-------------|
| 7 | إنشاء جداول coupons, product_variants, refunds | 4 ساعات |
| 8 | إضافة الحقول المفقودة (deleted_at, sku, tracking) | 2 ساعة |
| 9 | إنشاء جدول admin_audit_log | 1 ساعة |
| 10 | إضافة بيانات تجريبية للصور | 2 ساعة |
| 11 | إنشاء جدول store_balance و transactions | 3 ساعات |

### 🟢 أولوية متوسطة المدى:

| # | الإجراء | الوقت المقدر |
|---|---------|-------------|
| 12 | تفكيك addresses إلى جدول locations | 4 ساعات |
| 13 | إنشاء جدول order_events بدل JSON | 2 ساعة |
| 14 | تنفيذ FTS5 للبحث النصي | 3 ساعات |
| 15 | إنشاء جداول التحليلات (views, search_logs) | 3 ساعات |

---

## 11. ملخص الإحصائيات

| البند | القيمة |
|-------|--------|
| إجمالي الجداول الحالية | 16 |
| إجمالي الجداول المطلوبة | 33 |
| الجداول المفقودة | 17 |
| إجمالي الفهارس الحالية | 26 |
| الفهارس المفقودة | 21 |
| المشاكل الحرجة | 7 |
| الحقول المفقودة | 31+ |
| التناقضات في البيانات | 5 أنواع |
| درجة الأمان | متوسطة |
| درجة الأداء | متوسطة |
| درجة التطبيع | مقبولة مع ملاحظات |

---

## 12. الخلاصة

قاعدة بيانات Nouf-ex تملك بنية أساسية متينة مع 16 جدولًا تغطي الوظائف الأساسية للتجارة الإلكترونية. ومع ذلك، هناك **7 مشاكل حرجة** يجب إصلاحها فورًا قبل الإطلاق:

1. **المفاتيح الأجنبية معطلة** — خطر على سلامة البيانات
2. **تناقص totals الطلبات** — 100% من الطلبات غير متطابقة
3. **review_count مزيف** — جميع القيم المخزنة غير صحيحة
4. **stores.products_count غير صحيح** — جميع المتاجر
5. **المنتجات بدون صور** — 100% من المنتجات
6. **merchants بدون متجر** — 40% من التجار
7. **17 جدولًا مفقودًا** — منها 5 حرجة (payments, coupons, refunds, ...)

**الجهد المطلوب للإصلاح:** 15-20 ساعة للإصلاحات الحرجة + 20-30 ساعة للجداول المفقودة.

---

*تم إعداد هذا التقرير بواسطة أداة مراجعة قواعد البيانات — Nouf-ex Database Review v1.0*
