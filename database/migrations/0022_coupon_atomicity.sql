-- =====================================================================
-- 0022_coupon_atomicity.sql
--
-- DB-Gap 1 (CRITICAL) from the deep audit 2026-06-30, closed.
--
-- BACKGROUND
-- ----------
-- The previous flow: the application code (server/routes/orders.cts)
-- loads the coupon row with `FOR UPDATE`, checks
-- `usage_limit / usage_count` and per-user limits in the
-- application transaction, and only THEN INSERTs into
-- coupon_usage. That works for the single-row, in-transaction
-- code path, but the database itself had NO constraint. A
-- direct INSERT into coupon_usage (e.g. via a misbehaving
-- import script, psql session, or future RPC that doesn't
-- take the lock) could over-redeem a coupon: usage_count
-- would drift up beyond usage_limit, and a future legitimate
-- user would be told "limit reached" with no row to show
-- for it.
--
-- The deeper bug is two-fold:
--   1. usage_count has no upper bound (could exceed usage_limit).
--   2. The matching decrement on cancel/refund does not
--      exist - usage_count stays sticky even if the order
--      is cancelled and the coupon should be returned.
--
-- FIX (this migration adds the DB-level guarantees):
--   (a) CHECK constraint: usage_count <= usage_limit. When
--       usage_limit is NULL (unlimited), no upper bound.
--   (b) BEFORE INSERT trigger on coupon_usage:
--       * Verifies the global usage_limit (using the locked
--         row from `SELECT ... FOR UPDATE`).
--       * Verifies the per-user per_user_limit (count of
--         existing coupon_usage rows for the same user).
--       * Atomically increments coupons.usage_count.
--       * Aborts the INSERT with a clear error if either
--         limit would be exceeded.
--   (c) AFTER DELETE trigger on coupon_usage: decrements
--       coupons.usage_count.
--   (d) AFTER UPDATE trigger on orders: when the new
--       status is 'cancelled' or 'refunded', DELETEs the
--       matching coupon_usage row(s). The DELETE fires
--       trigger (c), which decrements usage_count -
--       returning the coupon to the pool atomically.
--   (e) SECURITY DEFINER + SET search_path = pg_catalog,
--       public on every function (PG 17 requirement).
--   (f) Idempotent: every CREATE OR REPLACE ensures the
--       functions and triggers are at the latest version
--       on re-run.
--
-- IMPACT
-- ------
-- After this migration:
--   - Application code can still do its `FOR UPDATE` lock
--     and pre-check, but the DB is the last line of defense.
--   - Even a malicious or buggy client cannot over-redeem.
--   - Cancelling a coupon-using order returns the coupon
--     to the pool without any application code change.
--
-- IMPORTANT (do-not-break): each DO block in this file is a
-- single PL/pgSQL unit terminated by END $$. The token
-- 'END IF;' must be on one line; the token 'END $$;' must
-- be on one line. A formatter or pre-commit hook that
-- line-wraps these tokens will corrupt the migration.
-- (See 0021_schema_hygiene.sql commit 384cc05 for the
-- prior foot-gun.)
-- =====================================================================


-- =====================================================================
-- Part 1:  CHECK constraint on coupons (last-ditch upper bound)
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name   = 'coupons'
          AND constraint_name = 'chk_coupons_usage_count_within_limit'
    ) THEN
        ALTER TABLE coupons
            ADD CONSTRAINT chk_coupons_usage_count_within_limit
            CHECK (usage_limit IS NULL OR usage_count <= usage_limit);
    END IF;
END $$;


-- =====================================================================
-- Part 2:  Trigger function - enforce limits on coupon_usage INSERT
--          and atomically increment coupons.usage_count.
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_coupon_usage_enforce_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_limit       INTEGER;
    v_count       INTEGER;
    v_per_user    INTEGER;
    v_user_count  INTEGER;
    v_coupon_code VARCHAR(40);
BEGIN
    -- Acquire a row lock on the coupon so two concurrent INSERTs
    -- cannot both pass the limit check and then both increment.
    SELECT usage_limit, usage_count, per_user_limit, code
      INTO v_limit, v_count, v_per_user, v_coupon_code
      FROM coupons
     WHERE id = NEW.coupon_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'coupon % not found', NEW.coupon_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Global limit check.
    IF v_limit IS NOT NULL AND v_count >= v_limit THEN
        RAISE EXCEPTION
            'coupon % (%) usage limit reached (% / %)',
            v_coupon_code, NEW.coupon_id, v_count, v_limit
            USING ERRCODE = 'check_violation';
    END IF;

    -- Per-user limit check.
    IF v_per_user IS NOT NULL AND v_per_user > 0 THEN
        SELECT COUNT(*) INTO v_user_count
          FROM coupon_usage
         WHERE coupon_id = NEW.coupon_id
           AND user_id   = NEW.user_id;
        IF v_user_count >= v_per_user THEN
            RAISE EXCEPTION
                'coupon % (%) per-user limit reached for user % (% / %)',
                v_coupon_code, NEW.coupon_id, NEW.user_id,
                v_user_count, v_per_user
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- Atomically bump the global count. The row lock from
    -- `SELECT ... FOR UPDATE` above ensures serial behaviour.
    UPDATE coupons
       SET usage_count = usage_count + 1,
           updated_at  = NOW()
     WHERE id = NEW.coupon_id;

    RETURN NEW;
END
$$;


-- =====================================================================
-- Part 3:  Trigger function - decrement coupons.usage_count on
--          coupon_usage DELETE.
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_coupon_usage_decrement_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Defensive: never let usage_count go negative even if
    -- an out-of-band INSERT bumped the row without firing
    -- the matching INSERT trigger.
    UPDATE coupons
       SET usage_count = GREATEST(usage_count - 1, 0),
           updated_at  = NOW()
     WHERE id = OLD.coupon_id;
    RETURN OLD;
END
$$;


-- =====================================================================
-- Part 4:  Trigger function - when an order transitions to
--          cancelled / refunded, delete its coupon_usage
--          rows so the coupon returns to the pool.
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_orders_release_coupon_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Only fire on the transition INTO a terminal state that
    -- releases the coupon.
    IF NEW.status IN ('cancelled', 'refunded')
       AND OLD.status IS DISTINCT FROM NEW.status
    THEN
        DELETE FROM coupon_usage
         WHERE order_id = NEW.id;
        -- The DELETE above fires trg_coupon_usage_decrement_on_delete,
        -- so coupons.usage_count is updated atomically.
    END IF;
    RETURN NEW;
END
$$;


-- =====================================================================
-- Part 5:  Wire the triggers.
-- =====================================================================

DROP TRIGGER IF EXISTS trg_coupon_usage_enforce_limits ON coupon_usage;
CREATE TRIGGER trg_coupon_usage_enforce_limits
    BEFORE INSERT ON coupon_usage
    FOR EACH ROW EXECUTE FUNCTION trg_coupon_usage_enforce_limits();

DROP TRIGGER IF EXISTS trg_coupon_usage_decrement_count ON coupon_usage;
CREATE TRIGGER trg_coupon_usage_decrement_count
    AFTER DELETE ON coupon_usage
    FOR EACH ROW EXECUTE FUNCTION trg_coupon_usage_decrement_on_delete();

DROP TRIGGER IF EXISTS trg_orders_release_coupon_on_cancel ON orders;
CREATE TRIGGER trg_orders_release_coupon_on_cancel
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION trg_orders_release_coupon_on_cancel();


-- =====================================================================
-- Part 6:  RLS - the new triggers are SECURITY DEFINER, so the
--          noufex_app role inherits EXECUTE. The two tables
--          (coupons, coupon_usage) already have RLS policies
--          in roles.sql; this section does not change them.
--
--          One operational caveat: if a row in coupon_usage is
--          pre-existing without the matching INSERT trigger
--          having fired (e.g. legacy data before this migration
--          ran), the DELETE trigger will safely GREATEST(... , 0)
--          the usage_count - it cannot go negative.
-- =====================================================================


-- =====================================================================
-- Part 7:  ANALYZE so the planner picks up the new constraint
--          and triggers immediately.
-- =====================================================================
ANALYZE coupons;
ANALYZE coupon_usage;
