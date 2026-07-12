# Nouf-ex — ER Diagram (Mermaid)

> **Audience:** database designers, onboarding devs.
> **Last updated:** 2026-07-12
> **Source:** [`packages/db/schema.sql`](../../packages/db/schema.sql) + 30 migrations.

## Core entities

```mermaid
erDiagram
    users ||--o{ addresses : "has many"
    users ||--o{ orders : "places"
    users ||--o{ cart_items : "has cart"
    users ||--o{ wishlist : "saves"
    users ||--o{ reviews : "writes"
    users ||--o{ notifications : "receives"
    users ||--o{ messages : "sends/receives"
    users ||--o{ store_followers : "follows stores"
    users ||--o{ subscriptions : "subscribes (merchant)"
    users ||--o{ payments : "owns"
    users ||--o{ refunds : "requests"

    stores ||--o{ products : "sells"
    stores ||--o{ orders : "fulfills"
    stores ||--o{ store_balance : "has wallet"
    stores ||--o{ store_followers : "has followers"
    stores ||--o{ transactions : "ledger entries"
    stores ||--o{ subscriptions : "plan"

    categories ||--o{ categories : "parent (self-ref)"
    categories ||--o{ products : "categorizes"

    products ||--o{ product_variants : "has SKUs"
    products ||--o{ product_images : "has gallery"
    products ||--o{ order_items : "ordered as"
    products ||--o{ cart_items : "in carts"
    products ||--o{ wishlist : "saved as"
    products ||--o{ reviews : "reviewed"
    products ||--o{ inventory_log : "stock movements"

    orders ||--o{ order_items : "contains"
    orders ||--|| payments : "paid by"
    orders ||--o{ refunds : "may refund"
    orders ||--o{ disputes : "may dispute"

    payments ||--o{ transactions : "creates ledger entry"

    reviews }o--|| products : "rates"
    reviews }o--|| stores : "rates store"

    disputes }o--|| orders : "concerns"
```

## Detailed relationships

### Users & Auth

```mermaid
erDiagram
    users {
        INTEGER id PK
        CITEXT email UK
        TEXT password_hash
        TEXT full_name
        VARCHAR phone
        VARCHAR role "customer|merchant|admin"
        VARCHAR status "active|suspended|banned"
        BOOLEAN two_factor_enabled
        TEXT totp_secret
        TEXT_ARRAY totp_backup_codes
        INTEGER token_version "for revocation"
        VARCHAR preferred_language "ar|en|zh"
        TIMESTAMPTZ last_login
        TIMESTAMPTZ deleted_at
    }

    addresses {
        INTEGER id PK
        INTEGER user_id FK
        VARCHAR label
        TEXT full_name
        VARCHAR phone
        VARCHAR governorate
        TEXT city
        TEXT street
        BOOLEAN is_default
    }

    subscriptions {
        INTEGER id PK
        INTEGER store_id FK
        VARCHAR plan "free|starter|pro|enterprise"
        VARCHAR status
        TIMESTAMPTZ started_at
        TIMESTAMPTZ expires_at
        NUMERIC amount
    }
```

### Stores & Products

```mermaid
erDiagram
    stores {
        INTEGER id PK
        INTEGER owner_id FK
        TEXT store_name
        VARCHAR slug UK
        VARCHAR trust_level "verified|golden|diamond"
        NUMERIC rating
        INTEGER products_count
        INTEGER sales_count
        INTEGER followers_count
        BOOLEAN is_active
        BOOLEAN is_verified
    }

    categories {
        INTEGER id PK
        INTEGER parent_id FK "self-ref"
        TEXT name_ar
        VARCHAR slug UK
        BOOLEAN is_active
    }

    products {
        INTEGER id PK
        INTEGER store_id FK
        INTEGER category_id FK
        TEXT name_ar
        NUMERIC price
        INTEGER stock
        INTEGER moq
        NUMERIC rating
        INTEGER review_count
        INTEGER sold_count
        NUMERIC deal_discount
        TSVECTOR search_tsv "GENERATED"
    }

    product_variants {
        INTEGER id PK
        INTEGER product_id FK
        VARCHAR sku UK
        JSONB attributes "size, color"
        NUMERIC price_delta
        INTEGER stock
    }

    product_images {
        INTEGER id PK
        INTEGER product_id FK
        TEXT image_url
        BOOLEAN is_primary
        INTEGER sort_order
    }
```

### Orders & Payments

```mermaid
erDiagram
    orders {
        INTEGER id PK
        VARCHAR order_number UK
        INTEGER customer_id FK
        INTEGER store_id FK
        VARCHAR status "pending|confirmed|processing|shipped|delivered|cancelled|refunded"
        VARCHAR payment_method
        VARCHAR payment_status
        NUMERIC subtotal
        NUMERIC shipping_cost
        NUMERIC discount
        NUMERIC total
        JSONB shipping_address
        JSONB timeline "audit trail"
        TIMESTAMPTZ delivered_at
    }

    order_items {
        INTEGER id PK
        INTEGER order_id FK
        INTEGER product_id FK
        INTEGER variant_id FK
        TEXT product_name "snapshot"
        INTEGER quantity
        NUMERIC unit_price
        NUMERIC total_price
    }

    cart_items {
        INTEGER id PK
        INTEGER user_id FK
        INTEGER product_id FK
        INTEGER variant_id FK
        JSONB variant
        INTEGER quantity
    }

    payments {
        INTEGER id PK
        INTEGER order_id FK
        INTEGER user_id FK
        VARCHAR method "cod|card|wallet|bank_transfer|stripe|paymob"
        VARCHAR status "pending|completed|failed|refunded"
        NUMERIC amount
        VARCHAR provider
        VARCHAR provider_txn_id
    }

    refunds {
        INTEGER id PK
        INTEGER order_id FK
        INTEGER payment_id FK
        INTEGER user_id FK
        NUMERIC amount
        TEXT reason
        VARCHAR status "requested|approved|rejected|processed"
    }

    transactions {
        INTEGER id PK
        INTEGER store_id FK
        VARCHAR type "order|withdrawal|refund|fee|adjustment"
        NUMERIC amount
        NUMERIC balance_after
    }
```

### Reviews & Social

```mermaid
erDiagram
    reviews {
        INTEGER id PK
        INTEGER product_id FK
        INTEGER store_id FK
        INTEGER customer_id FK
        INTEGER order_id FK
        SMALLINT rating "1-5"
        TEXT title
        TEXT comment
        TEXT_ARRAY images
        BOOLEAN is_verified
        BOOLEAN is_visible
        INTEGER helpful_count
        TEXT merchant_reply
    }

    wishlist {
        INTEGER id PK
        INTEGER user_id FK
        INTEGER product_id FK
        TEXT notes
    }

    store_followers {
        INTEGER id PK
        INTEGER store_id FK
        INTEGER user_id FK
        BOOLEAN notify_new_products
        BOOLEAN notify_offers
    }

    messages {
        INTEGER id PK
        INTEGER sender_id FK
        INTEGER receiver_id FK
        INTEGER store_id FK
        INTEGER product_id FK
        INTEGER order_id FK
        TEXT body
        JSONB attachments
        BOOLEAN is_read
    }

    disputes {
        INTEGER id PK
        INTEGER order_id FK
        INTEGER customer_id FK
        INTEGER store_id FK
        VARCHAR type
        VARCHAR status
        VARCHAR priority
        TEXT subject
        JSONB evidence
        NUMERIC refund_amount
    }
```

### System tables

```mermaid
erDiagram
    notifications {
        INTEGER id PK
        INTEGER user_id FK
        VARCHAR type "order|message|review|promo|system|dispute|refund"
        TEXT title
        TEXT body
        JSONB data
        BOOLEAN is_read
        TIMESTAMPTZ read_at
    }

    coupons {
        INTEGER id PK
        VARCHAR code UK
        VARCHAR type "percentage|fixed"
        NUMERIC value
        NUMERIC min_order_amount
        NUMERIC max_discount
        INTEGER usage_limit
        INTEGER usage_count
        INTEGER per_user_limit
        INTEGER store_id FK "NULL=site-wide"
        BOOLEAN is_active
    }

    coupon_usage {
        INTEGER id PK
        INTEGER coupon_id FK
        INTEGER user_id FK
        INTEGER order_id FK
        NUMERIC discount_amount
    }

    inventory_log {
        INTEGER id PK
        INTEGER product_id FK
        INTEGER store_id FK
        INTEGER change_amount
        VARCHAR reason
    }

    admin_audit_log {
        INTEGER id PK
        INTEGER user_id FK
        VARCHAR action
        VARCHAR entity_type
        VARCHAR entity_id
        JSONB old_values
        JSONB new_values
        INET ip_address
    }

    rate_limit_buckets {
        INTEGER id PK
        VARCHAR bucket
        VARCHAR key
        INTEGER count
        TIMESTAMPTZ reset_at
    }

    used_jtis {
        INTEGER id PK
        VARCHAR jti UK
        INTEGER user_id FK
        TIMESTAMPTZ expires_at
    }

    app_settings {
        VARCHAR key PK
        TEXT value
        TIMESTAMPTZ updated_at
        INTEGER updated_by FK
    }

    webhook_events {
        BIGSERIAL id PK
        VARCHAR provider
        VARCHAR event_id
        VARCHAR transaction_id
        VARCHAR event_type
        JSONB payload
        VARCHAR processing_state
    }

    search_logs {
        BIGSERIAL id PK
        TEXT query
        TEXT query_normalized
        INTEGER result_count
        INTEGER duration_ms
        INTEGER user_id FK
        VARCHAR request_id
    }

    schema_migrations {
        VARCHAR version PK
        TEXT description
        TIMESTAMPTZ applied_at
        TEXT checksum
    }
```

---

## Cardinality quick reference

| Relationship | Cardinality | Notes |
|---|---|---|
| user → addresses | 1:N | One default (partial UNIQUE index) |
| user → orders | 1:N | Customer only |
| store → orders | 1:N | Merchant only |
| user → store_followers | M:N | via store_followers |
| store → products | 1:N | ON DELETE RESTRICT |
| category → products | 1:N | ON DELETE SET NULL |
| product → variants | 1:N | ON DELETE CASCADE |
| order → order_items | 1:N | ON DELETE CASCADE |
| order → payment | 1:1 | One primary payment |
| user → review | 1:N (per product) | UNIQUE(user, product) |

---

## See also

- [Schema SQL](../../packages/db/schema.sql)
- [API reference](api.md)
- [Database reference](database.md)
- [Security model](security.md)
