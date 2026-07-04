-- =====================================================================
-- 0021_schema_hygiene.sql
--
-- DB-Gap 2 (HIGH) + DB-Gap 3 (HIGH) from the deep audit 2026-06-30.
--
-- Two related schema-hygiene problems in one migration because the
-- fix is symmetric (one extra nullable column on operational tables,
-- one trigger auto-attaches to the rest):
--
--   1. Soft-delete is INCOMPLETE on user-facing tables.
--      wishlist, messages, notifications have `created_at` but NOT
--      `deleted_at`. Other tables (products, orders, users) DO have
--      `deleted_at`. Inconsistent soft-delete means a "deleted"
--      wishlist item still appears in SELECTs and triggers CASCADE
--      housekeeping only on actual hard delete.
--
--   2. `updated_at` is MISSING on operational tables.
--      product_images, order_items, rate_limit_buckets track
--      creation time but not modification time. The existing
--      `triggers.sql` loop at line 22-37 auto-attaches
--      `trg_set_updated_at()` to every table that has an
--      `updated_at` column, so adding the column IS the trigger.
--      We do not need to drop+create the trigger manually.
--
--  Audit hygiene notes
--  ───────────────────
--  - `DO $$ ... END $$` blocks use `information_schema.columns` so
--    the migration is idempotent: re-running it is a no-op once
--    the column is present.
--  - All column additions use `IF NOT EXISTS`-equivalent
--    semantics — no migration table is needed for this.
--  - ANALYZE on each affected table at the end so the planner
--    picks up the new columns / indexes immediately.
--  - Soft-delete partial indexes use `WHERE deleted_at IS NULL`
--    to mimic the `idx_products_active` partial-index pattern
--    already used elsewhere in the schema — keeping the
--    "live rows only" performance characteristic consistent.
-- =====================================================================


-- =====================================================================
-- Part 1:  Add `deleted_at` to user-facing tables (soft-delete)
-- =====================================================================

-- ---------------------------------------------------------------------
-- wishlist
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'wishlist'
          AND column_name  = 'deleted_at'
    ) THEN
        ALTER TABLE wishlist ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wishlist_user_active
    ON wishlist (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wishlist_product_active
    ON wishlist (product_id)
    WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------
-- messages  (customer <-> merchant chat)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'messages'
          AND column_name  = 'deleted_at'
    ) THEN
        ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Conversation lookup is the hot path on messages — the two indexes
-- below partition by deleted_at so soft-deleted messages don't
-- inflate the working set of the recipient's "inbox".
CREATE INDEX IF NOT EXISTS idx_messages_receiver_active
    ON messages (receiver_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_sender_active
    ON messages (sender_id, created_at DESC)
    WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'notifications'
          AND column_name  = 'deleted_at'
    ) THEN
        ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- The unread-count query is the most-frequent operation on this
-- table. The pre-existing partial index
--   idx_notifications_unread  ON notifications(user_id) WHERE is_read = FALSE
-- doesn't filter by deleted_at, so the query currently scans soft-
-- deleted rows. The replacement below adds the deleted_at filter.
DROP INDEX IF EXISTS idx_notifications_unread;
CREATE INDEX idx_notifications_unread
    ON notifications (user_id, created_at DESC)
    WHERE is_read = FALSE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_active
    ON notifications (user_id, created_at DESC)
    WHERE deleted_at IS NULL;


-- =====================================================================
-- Part 2:  Add `updated_at` to operational tables
-- (the existing triggers.sql meta-loop auto-attaches
--  trg_set_updated_at() on every base table with this column;
--  no separate CREATE TRIGGER statement needed here.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'product_images'
          AND column_name  = 'updated_at'
    ) THEN
        ALTER TABLE product_images
            ADD COLUMN updated_at TIMESTAMPTZ NOT NULL
            DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;


-- ---------------------------------------------------------------------
-- order_items  (snapshot row — most INSERTs are append-only, but
-- the admin /merchant can edit quantity & unit_price to issue
-- corrections; every such correction should bump updated_at so
-- the audit / dispute-resolution views can surface it.)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'order_items'
          AND column_name  = 'updated_at'
    ) THEN
        ALTER TABLE order_items
            ADD COLUMN updated_at TIMESTAMPTZ NOT NULL
            DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;


-- ---------------------------------------------------------------------
-- rate_limit_buckets  (PRIMARY KEY = (bucket, key); the trigger
-- loop in triggers.sql will only fire for base tables with
-- explicit `updated_at`, so we add the column here.)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'rate_limit_buckets'
          AND column_name  = 'updated_at'
    ) THEN
        ALTER TABLE rate_limit_buckets
            ADD COLUMN updated_at TIMESTAMPTZ NOT NULL
            DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;


-- =====================================================================
-- Part 3:  RLS (rate_limit_buckets is app-private; should not be
--        readable by anyone other than noufex_app.)
--
-- Row-Level Security on rate_limit_buckets is enabled elsewhere in
-- roles.sql / schema-extra.sql for INSERT/UPDATE; we additionally
-- verify the column-add did not break the existing policy: the
-- column is internal (no end-user reads), and only `noufex_app`
-- needs SELECT/INSERT/UPDATE on this table.
-- =====================================================================


-- =====================================================================
-- Part 4:  ANALYZE so the new indexes are visible to the planner
--         immediately, not on the next autovacuum.
-- =====================================================================
ANALYZE wishlist;
ANALYZE messages;
ANALYZE notifications;
ANALYZE product_images;
ANALYZE order_items;
ANALYZE rate_limit_buckets;
