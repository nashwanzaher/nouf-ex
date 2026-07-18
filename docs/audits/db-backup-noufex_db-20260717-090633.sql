--
-- PostgreSQL database dump
--

\restrict WEgIuQYVyJoxixSAv8afcMtFbNDv45taMICchRFW0cGm7pmOiB1JDaAHhy8ERgZ

-- Dumped from database version 17.10 (Debian 17.10-1.pgdg13+1)
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";


--
-- Name: EXTENSION "citext"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "citext" IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: admin_set_app_setting(character varying, "text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."admin_set_app_setting"("p_key" character varying, "p_value" "text", "p_user_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
BEGIN
  -- Validate key format (allow only [a-z0-9_]). Anything
  -- else is rejected outright, so a typo or injection
  -- never lands in the table.
  IF p_key !~ '^[a-z0-9_]{1,64}$' THEN
        RAISE EXCEPTION 'invalid app_settings key: %', p_key
            USING ERRCODE = 'invalid_parameter_value';
END
IF;

    -- INSERT or UPDATE.
    INSERT INTO app_settings
  (key, value, updated_at, updated_by)
VALUES
  (p_key, p_value, NOW(), p_user_id)
ON CONFLICT
(key) DO
UPDATE
        SET value      = EXCLUDED.value,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by;

-- Append to admin_audit_log so the change is part of the
-- existing audit trail. We use the SECURITY DEFINER helper
-- write_audit_log() - the same one used by admin handlers
-- in the application server.
PERFORM write_audit_log
(
        jsonb_build_object
('admin_user_id', p_user_id),
        'app_setting.update',
        'app_settings',
        p_key,
        NULL,
        jsonb_build_object
('value', p_value)
    );
END
$_$;


--
-- Name: calculate_agent_earnings(integer, "date", "date"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."calculate_agent_earnings"("p_agent_id" integer, "p_start_date" "date", "p_end_date" "date") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
	v_earnings NUMERIC(12,2);
BEGIN
	SELECT COALESCE(SUM(earnings), 0)
	INTO v_earnings
	FROM delivery_agent_assignments
	WHERE agent_id = p_agent_id
		AND status = 'delivered'
		AND delivered_at >= p_start_date
		AND delivered_at <= p_end_date;
	RETURN v_earnings;
END;
$$;


--
-- Name: cleanup_audit_logs(interval, interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."cleanup_audit_logs"("admin_retention" interval DEFAULT '2 years'::interval, "search_retention" interval DEFAULT '90 days'::interval) RETURNS TABLE("deleted_admin" bigint, "deleted_search" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_admin bigint;
    v_search bigint;
BEGIN
    DELETE FROM admin_audit_log
     WHERE created_at < now() - admin_retention;
    GET DIAGNOSTICS v_admin = ROW_COUNT;

    DELETE FROM search_logs
     WHERE created_at < now() - search_retention;
    GET DIAGNOSTICS v_search = ROW_COUNT;

    RETURN QUERY SELECT v_admin, v_search;
END;
$$;


--
-- Name: cleanup_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."cleanup_rate_limits"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_buckets WHERE reset_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END
$$;


--
-- Name: cleanup_used_jtis(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."cleanup_used_jtis"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM used_jtis
    WHERE expires_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: consume_rate_limit("text", "text", integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."consume_rate_limit"("p_bucket" "text", "p_key" "text", "p_window_ms" integer, "p_max" integer) RETURNS TABLE("allowed" boolean, "retry_after_ms" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_now       TIMESTAMPTZ := now();
    v_count     INTEGER;
    v_reset_at  TIMESTAMPTZ;
    v_retry_ms  INTEGER := 0;
    v_allowed   BOOLEAN := FALSE;
BEGIN
    INSERT INTO rate_limit_buckets (bucket, key, count, reset_at)
    VALUES (p_bucket, p_key, 1, v_now + (p_window_ms::TEXT || ' milliseconds')::interval)
    ON CONFLICT (bucket, key) DO UPDATE
      SET count = CASE
                    WHEN rate_limit_buckets.reset_at < v_now
                    THEN 1
                    ELSE rate_limit_buckets.count + 1
                  END,
          reset_at = CASE
                       WHEN rate_limit_buckets.reset_at < v_now
                       THEN v_now + (p_window_ms::TEXT || ' milliseconds')::interval
                       ELSE rate_limit_buckets.reset_at
                     END
    RETURNING rate_limit_buckets.count, rate_limit_buckets.reset_at
      INTO v_count, v_reset_at;

    v_allowed := v_count <= p_max;
    IF NOT v_allowed THEN
        v_retry_ms := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now)) * 1000))::INTEGER;
    END IF;

    RETURN QUERY SELECT v_allowed, v_retry_ms;
END
$$;


--
-- Name: coupon_discount_amount("text", numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."coupon_discount_amount"("p_type" "text", "p_value" numeric, "p_max_discount" numeric, "p_subtotal" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
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


--
-- Name: get_agent_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_agent_stats"("p_agent_id" integer) RETURNS TABLE("total_deliveries" integer, "completed_deliveries" integer, "pending_deliveries" integer, "cancelled_deliveries" integer, "total_earnings" numeric, "avg_rating" numeric, "avg_delivery_time" interval)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
	RETURN QUERY
	SELECT
		COUNT(*) as total_deliveries,
		COUNT(*) FILTER (WHERE daa.status = 'delivered') as completed_deliveries,
		COUNT(*) FILTER (WHERE daa.status IN ('accepted', 'picked_up')) as pending_deliveries,
		COUNT(*) FILTER (WHERE daa.status IN ('cancelled', 'returned')) as cancelled_deliveries,
		COALESCE(SUM(daa.earnings) FILTER (WHERE daa.status = 'delivered'), 0) as total_earnings,
		da.rating as avg_rating,
		AVG(daa.delivered_at - daa.picked_up_at) FILTER (WHERE daa.picked_up_at IS NOT NULL AND daa.delivered_at IS NOT NULL) as avg_delivery_time
	FROM delivery_agent_assignments daa
	JOIN delivery_agents da ON da.id = daa.agent_id
	WHERE daa.agent_id = p_agent_id;
END;
$$;


--
-- Name: trg_coupon_usage_decrement_on_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_coupon_usage_decrement_on_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
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


--
-- Name: trg_coupon_usage_enforce_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_coupon_usage_enforce_limits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
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


--
-- Name: trg_order_items_decrement_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_order_items_decrement_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_product_stock     int;
    v_variant_stock     int;
    v_store_id          int;
BEGIN
    -- Lock the product row to avoid race conditions.
    SELECT stock, store_id
      INTO v_product_stock, v_store_id
      FROM products
     WHERE id = NEW.product_id
       FOR UPDATE;

    IF v_product_stock IS NULL THEN
        RAISE EXCEPTION 'order_items.product_id % does not exist', NEW.product_id;
    END IF;

    -- Variant stock check (if specified)
    IF NEW.variant_id IS NOT NULL THEN
        SELECT stock INTO v_variant_stock
          FROM product_variants
         WHERE id = NEW.variant_id
           AND product_id = NEW.product_id
           FOR UPDATE;

        IF v_variant_stock IS NULL THEN
            RAISE EXCEPTION 'order_items.variant_id % does not belong to product %',
                NEW.variant_id, NEW.product_id;
        END IF;
        IF v_variant_stock < NEW.quantity THEN
            RAISE EXCEPTION
                'insufficient stock for variant % (have %, need %)',
                NEW.variant_id, v_variant_stock, NEW.quantity;
        END IF;

        UPDATE product_variants
           SET stock = stock - NEW.quantity
         WHERE id = NEW.variant_id;
    END IF;

    IF v_product_stock < NEW.quantity THEN
        RAISE EXCEPTION
            'insufficient stock for product % (have %, need %)',
            NEW.product_id, v_product_stock, NEW.quantity;
    END IF;

    UPDATE products
       SET stock = stock - NEW.quantity,
           sold_count = sold_count + NEW.quantity
     WHERE id = NEW.product_id;

    INSERT INTO inventory_log (product_id, store_id, change_amount,
                               reason, reference_type, reference_id)
    VALUES (NEW.product_id, v_store_id, -NEW.quantity,
            'order_placed', 'order', NEW.order_id);

    RETURN NEW;
END;
$$;


--
-- Name: trg_orders_append_timeline(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_orders_append_timeline"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.timeline := NEW.timeline ||
            jsonb_build_array(jsonb_build_object(
                'status',    NEW.status,
                'at',        now(),
                'payment',   NEW.payment_status
            ));
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: trg_orders_release_coupon_on_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_orders_release_coupon_on_cancel"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
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


--
-- Name: trg_orders_state_machine(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_orders_state_machine"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    transition_ok boolean := FALSE;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        transition_ok := (OLD.status || '→' || NEW.status) IN (
            'pending→confirmed',
            'pending→cancelled',
            'pending→refunded',
            'confirmed→processing',
            'confirmed→cancelled',
            'processing→shipped',
            'processing→cancelled',
            'shipped→delivered',
            'delivered→refunded'
        );

        IF NOT transition_ok THEN
            RAISE EXCEPTION
                'illegal orders.status transition: % → %',
                OLD.status, NEW.status
                USING ERRCODE = 'check_violation';
        END IF;

        -- Side effects per transition
        IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
            NEW.cancelled_at := now();
        ELSIF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
            NEW.delivered_at := now();
        END IF;
    END IF;

    RETURN NEW;
END
$$;


--
-- Name: trg_products_refresh_store_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_products_refresh_store_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    -- Handle store_id change on UPDATE: recalculate BOTH old and new store
    IF TG_OP = 'UPDATE' AND OLD.store_id IS DISTINCT FROM NEW.store_id THEN
        UPDATE stores
           SET products_count = (
                SELECT COUNT(*) FROM products
                 WHERE store_id = OLD.store_id
                   AND deleted_at IS NULL
                   AND is_active = TRUE
               )
         WHERE id = OLD.store_id;
    END IF;

    UPDATE stores
       SET products_count = (
            SELECT COUNT(*) FROM products
             WHERE store_id = COALESCE(NEW.store_id, OLD.store_id)
               AND deleted_at IS NULL
               AND is_active = TRUE
           )
     WHERE id = COALESCE(NEW.store_id, OLD.store_id);

    RETURN COALESCE(NEW, OLD);
END
$$;


--
-- Name: trg_refunds_resolve_payments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_refunds_resolve_payments"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF NEW.status = 'processed'
       AND COALESCE(OLD.status, '') IS DISTINCT FROM 'processed' THEN
        IF TG_OP = 'UPDATE' THEN
            NEW.resolved_at := now();
        END IF;

        UPDATE payments
           SET status = 'refunded',
               refunded_at = COALESCE(refunded_at, now())
         WHERE order_id = NEW.order_id
           AND status = 'completed'
           AND (NEW.payment_id IS NULL OR id = NEW.payment_id);
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: trg_reviews_refresh_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_reviews_refresh_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_product_id int;
    v_count       int;
    v_avg         numeric(2,1);
BEGIN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);

    SELECT COUNT(*), COALESCE(AVG(rating), 0)
      INTO v_count, v_avg
      FROM reviews
     WHERE product_id = v_product_id
       AND is_visible = TRUE;

    UPDATE products
       SET review_count = v_count,
           rating       = v_avg
     WHERE id = v_product_id;

    RETURN COALESCE(NEW, OLD);
END
$$;


--
-- Name: trg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END
$$;


--
-- Name: trg_stores_refresh_followers_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_stores_refresh_followers_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_store_id int;
BEGIN
    v_store_id := COALESCE(NEW.store_id, OLD.store_id);

    UPDATE stores
       SET followers_count = (
           SELECT COUNT(*) FROM store_followers
            WHERE store_id = v_store_id
       )
     WHERE id = v_store_id;

    RETURN COALESCE(NEW, OLD);
END
$$;


--
-- Name: trg_stores_refresh_review_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_stores_refresh_review_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_store_id int;
BEGIN
    v_store_id := COALESCE(NEW.store_id, OLD.store_id);

    -- Update rating + review_count for the store
    UPDATE stores
       SET rating = COALESCE((
               SELECT AVG(r.rating)
                 FROM reviews r
                 JOIN products p ON p.id = r.product_id
                WHERE p.store_id = v_store_id
                  AND r.is_visible = TRUE
           ), 0),
           review_count = (
               SELECT COUNT(*)
                 FROM reviews r
                 JOIN products p ON p.id = r.product_id
                WHERE p.store_id = v_store_id
                  AND r.is_visible = TRUE
           )
     WHERE id = v_store_id;

    RETURN COALESCE(NEW, OLD);
END
$$;


--
-- Name: trg_stores_refresh_sales_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_stores_refresh_sales_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
        UPDATE stores
           SET sales_count = sales_count + 1
         WHERE id = NEW.store_id;
    END IF;

    RETURN NEW;
END
$$;


--
-- Name: trg_sync_users_two_factor_enabled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_sync_users_two_factor_enabled"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    -- Only totp_enabled_at being NOT NULL means enrollment is confirmed.
    -- Having a totp_secret alone is not enough (user hasn't verified yet).
    NEW.two_factor_enabled := (NEW.totp_enabled_at IS NOT NULL);
    RETURN NEW;
END
$$;


--
-- Name: trg_transactions_check_balance_after(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_transactions_check_balance_after"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_previous_balance NUMERIC(12,2);
BEGIN
    -- Get the most recent balance_after for this store. If no prior
    -- transactions exist, the starting balance is 0.
    SELECT balance_after INTO v_previous_balance
      FROM transactions
     WHERE store_id = NEW.store_id
     ORDER BY created_at DESC, id DESC
     LIMIT 1;

    IF v_previous_balance IS NULL THEN
        v_previous_balance := 0;
    END IF;

    -- Enforce: NEW.balance_after = previous + NEW.amount
    IF NEW.balance_after <> v_previous_balance + NEW.amount THEN
        RAISE EXCEPTION
            'transactions.balance_after mismatch: expected %, got % (prev %, amount %)',
            v_previous_balance + NEW.amount,
            NEW.balance_after,
            v_previous_balance,
            NEW.amount
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END
$$;


--
-- Name: write_audit_log(integer, "text", "text", "text", "jsonb", "jsonb", "inet", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."write_audit_log"("p_user_id" integer, "p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO admin_audit_log (
        user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."addresses" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "label" character varying(40),
    "full_name" "text" NOT NULL,
    "phone" character varying(20) NOT NULL,
    "city" "text" NOT NULL,
    "governorate" "text",
    "district" "text",
    "street" "text" NOT NULL,
    "building" "text",
    "notes" "text",
    "latitude" numeric(9,6),
    "longitude" numeric(9,6),
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "addresses_check" CHECK ((("full_name" <> ''::"text") AND (("phone")::"text" <> ''::"text") AND ("city" <> ''::"text") AND ("street" <> ''::"text")))
);


--
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."addresses" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."addresses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."admin_audit_log" (
    "id" integer NOT NULL,
    "user_id" integer,
    "action" character varying(40) NOT NULL,
    "entity_type" character varying(40) NOT NULL,
    "entity_id" character varying(60),
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."admin_audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."app_settings" (
    "key" character varying(64) NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" integer
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."cart_items" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "variant_id" integer,
    "variant" "jsonb",
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "cart_items_quantity_check" CHECK (("quantity" > 0))
);


--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."cart_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."cart_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."categories" (
    "id" integer NOT NULL,
    "parent_id" integer,
    "name_ar" "text" NOT NULL,
    "name_en" "text",
    "name_zh" "text",
    "slug" character varying(80) NOT NULL,
    "icon" "text",
    "image" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "categories_name_ar_check" CHECK (("name_ar" <> ''::"text"))
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: coupon_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."coupon_usage" (
    "id" integer NOT NULL,
    "coupon_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "order_id" integer NOT NULL,
    "discount_amount" numeric(12,2) NOT NULL,
    "used_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "coupon_usage_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric))
);


--
-- Name: coupon_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."coupon_usage" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."coupon_usage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."coupons" (
    "id" integer NOT NULL,
    "code" character varying(40) NOT NULL,
    "type" character varying(20) NOT NULL,
    "value" numeric(8,2) NOT NULL,
    "min_order_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "max_discount" numeric(12,2),
    "usage_limit" integer,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "per_user_limit" integer DEFAULT 1 NOT NULL,
    "store_id" integer,
    "starts_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "chk_coupons_usage_count_within_limit" CHECK ((("usage_limit" IS NULL) OR ("usage_count" <= "usage_limit"))),
    CONSTRAINT "coupons_check" CHECK (((("type")::"text" <> 'percentage'::"text") OR ("value" <= (100)::numeric))),
    CONSTRAINT "coupons_check1" CHECK ((("starts_at" IS NULL) OR ("expires_at" IS NULL) OR ("expires_at" > "starts_at"))),
    CONSTRAINT "coupons_max_discount_check" CHECK ((("max_discount" IS NULL) OR ("max_discount" >= (0)::numeric))),
    CONSTRAINT "coupons_min_order_amount_check" CHECK (("min_order_amount" >= (0)::numeric)),
    CONSTRAINT "coupons_per_user_limit_check" CHECK (("per_user_limit" > 0)),
    CONSTRAINT "coupons_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::"text"[]))),
    CONSTRAINT "coupons_usage_count_check" CHECK (("usage_count" >= 0)),
    CONSTRAINT "coupons_usage_limit_check" CHECK ((("usage_limit" IS NULL) OR ("usage_limit" > 0))),
    CONSTRAINT "coupons_value_check" CHECK (("value" > (0)::numeric))
);


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."coupons" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."coupons_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: delivery_agent_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."delivery_agent_assignments" (
    "id" integer NOT NULL,
    "agent_id" integer NOT NULL,
    "order_id" integer NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "accepted_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "earnings" numeric(10,2) DEFAULT 0,
    "status" character varying(20) DEFAULT 'assigned'::character varying NOT NULL,
    "notes" "text",
    "cancelled_reason" "text",
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "delivery_agent_assignments_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['assigned'::character varying, 'accepted'::character varying, 'picked_up'::character varying, 'delivered'::character varying, 'cancelled'::character varying, 'returned'::character varying])::"text"[])))
);


--
-- Name: delivery_agent_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."delivery_agent_assignments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."delivery_agent_assignments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: delivery_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."delivery_agents" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "vehicle_type" character varying(50) DEFAULT 'motorcycle'::character varying NOT NULL,
    "vehicle_plate" character varying(20),
    "vehicle_color" character varying(30),
    "license_number" character varying(50),
    "license_expiry" "date",
    "insurance_number" character varying(50),
    "insurance_expiry" "date",
    "status" character varying(20) DEFAULT 'offline'::character varying NOT NULL,
    "current_lat" numeric(9,6),
    "current_lng" numeric(9,6),
    "last_location_update" timestamp with time zone,
    "rating" numeric(2,1) DEFAULT 5.0 NOT NULL,
    "total_deliveries" integer DEFAULT 0 NOT NULL,
    "completed_deliveries" integer DEFAULT 0 NOT NULL,
    "cancelled_deliveries" integer DEFAULT 0 NOT NULL,
    "avg_delivery_time_minutes" integer,
    "total_earnings" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "delivery_agents_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "delivery_agents_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['offline'::character varying, 'active'::character varying, 'busy'::character varying, 'suspended'::character varying, 'on_break'::character varying])::"text"[]))),
    CONSTRAINT "delivery_agents_vehicle_type_check" CHECK ((("vehicle_type")::"text" = ANY ((ARRAY['motorcycle'::character varying, 'bicycle'::character varying, 'car'::character varying, 'van'::character varying, 'truck'::character varying, 'scooter'::character varying])::"text"[])))
);


--
-- Name: delivery_agents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."delivery_agents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."delivery_agents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."disputes" (
    "id" integer NOT NULL,
    "order_id" integer NOT NULL,
    "customer_id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "type" character varying(30) NOT NULL,
    "status" character varying(20) DEFAULT 'open'::character varying NOT NULL,
    "priority" character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    "subject" character varying(200) NOT NULL,
    "description" "text" NOT NULL,
    "evidence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "resolution" "text",
    "refund_amount" numeric(12,2),
    "resolved_by" integer,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "disputes_check" CHECK (((("subject")::"text" <> ''::"text") AND ("description" <> ''::"text"))),
    CONSTRAINT "disputes_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "disputes_refund_amount_check" CHECK ((("refund_amount" IS NULL) OR ("refund_amount" >= (0)::numeric))),
    CONSTRAINT "disputes_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['open'::character varying, 'investigating'::character varying, 'resolved_buyer'::character varying, 'resolved_seller'::character varying, 'closed'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "disputes_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['not_received'::character varying, 'damaged'::character varying, 'wrong_item'::character varying, 'quality_issue'::character varying, 'refund_delay'::character varying, 'other'::character varying])::"text"[])))
);


--
-- Name: disputes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."disputes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."disputes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inventory_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."inventory_log" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "change_amount" integer NOT NULL,
    "reason" character varying(40) NOT NULL,
    "reference_type" character varying(40),
    "reference_id" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "inventory_log_change_amount_check" CHECK (("change_amount" <> 0)),
    CONSTRAINT "inventory_log_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['order_placed'::character varying, 'order_cancelled'::character varying, 'manual_adjust'::character varying, 'restock'::character varying, 'return'::character varying])::"text"[])))
);


--
-- Name: inventory_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."inventory_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."inventory_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."messages" (
    "id" integer NOT NULL,
    "sender_id" integer NOT NULL,
    "receiver_id" integer NOT NULL,
    "store_id" integer,
    "product_id" integer,
    "order_id" integer,
    "body" "text" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "messages_check" CHECK ((("body" <> ''::"text") AND ("sender_id" <> "receiver_id")))
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notifications" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "type" character varying(20) NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "notifications_title_check" CHECK (("title" <> ''::"text")),
    CONSTRAINT "notifications_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['order'::character varying, 'message'::character varying, 'review'::character varying, 'promo'::character varying, 'system'::character varying, 'dispute'::character varying, 'refund'::character varying])::"text"[])))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."order_items" (
    "id" integer NOT NULL,
    "order_id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "variant_id" integer,
    "product_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "total_price" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_total_price_check" CHECK (("total_price" >= (0)::numeric)),
    CONSTRAINT "order_items_unit_price_check" CHECK (("unit_price" > (0)::numeric))
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."orders" (
    "id" integer NOT NULL,
    "order_number" character varying(40) NOT NULL,
    "customer_id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "payment_method" character varying(20) NOT NULL,
    "payment_status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "shipping_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount" numeric(12,2) DEFAULT 0 NOT NULL,
    "coupon_code" character varying(50),
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'YER'::character varying NOT NULL,
    "shipping_address" "jsonb" NOT NULL,
    "billing_address" "jsonb",
    "notes" "text",
    "tracking_number" character varying(100),
    "shipping_company" character varying(100),
    "estimated_delivery" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "timeline" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "delivery_agent_id" integer,
    CONSTRAINT "orders_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "orders_discount_check" CHECK (("discount" >= (0)::numeric)),
    CONSTRAINT "orders_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['cod'::character varying, 'card'::character varying, 'wallet'::character varying, 'bank_transfer'::character varying, 'stripe'::character varying, 'paymob'::character varying])::"text"[]))),
    CONSTRAINT "orders_payment_status_check" CHECK ((("payment_status")::"text" = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'refunded'::character varying])::"text"[]))),
    CONSTRAINT "orders_shipping_cost_check" CHECK (("shipping_cost" >= (0)::numeric)),
    CONSTRAINT "orders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'processing'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::"text"[]))),
    CONSTRAINT "orders_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "orders_total_check" CHECK (("total" >= (0)::numeric)),
    CONSTRAINT "orders_total_consistency" CHECK (("total" = "round"((("subtotal" + "shipping_cost") - "discount_amount"), 2)))
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payments" (
    "id" integer NOT NULL,
    "order_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "method" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'YER'::character varying NOT NULL,
    "provider" character varying(40),
    "provider_txn_id" character varying(120),
    "provider_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "failure_reason" "text",
    "paid_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "payments_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_method_check" CHECK ((("method")::"text" = ANY ((ARRAY['cod'::character varying, 'card'::character varying, 'wallet'::character varying, 'bank_transfer'::character varying, 'stripe'::character varying, 'paymob'::character varying])::"text"[]))),
    CONSTRAINT "payments_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying, 'cancelled'::character varying])::"text"[])))
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."payments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."payments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."product_images" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "image_url" "text" NOT NULL,
    "alt_text" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."product_images" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_images_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."product_variants" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "sku" character varying(60),
    "name_ar" "text" NOT NULL,
    "name_en" "text",
    "name_zh" "text",
    "attributes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "price_delta" numeric(12,2) DEFAULT 0 NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "product_variants_price_delta" CHECK (("price_delta" > ('-1000000'::integer)::numeric)),
    CONSTRAINT "product_variants_stock_check" CHECK (("stock" >= 0))
);


--
-- Name: product_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."product_variants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_variants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."products" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "category_id" integer,
    "name_ar" "text" NOT NULL,
    "name_en" "text",
    "name_zh" "text",
    "description" "text",
    "description_en" "text",
    "description_zh" "text",
    "price" numeric(12,2) NOT NULL,
    "original_price" numeric(12,2),
    "currency" character varying(3) DEFAULT 'YER'::character varying NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "moq" integer DEFAULT 1 NOT NULL,
    "weight" integer,
    "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "is_digital" boolean DEFAULT false NOT NULL,
    "main_image" "text",
    "features" "text"[],
    "specifications" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "badges" "text"[],
    "rating" numeric(2,1) DEFAULT 0 NOT NULL,
    "review_count" integer DEFAULT 0 NOT NULL,
    "sold_count" integer DEFAULT 0 NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "deal_discount" numeric(5,2),
    "deal_ends_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "search_tsv" "tsvector" GENERATED ALWAYS AS (((((("setweight"("to_tsvector"('"simple"'::"regconfig", COALESCE("name_ar", ''::"text")), 'A'::"char") || "setweight"("to_tsvector"('"simple"'::"regconfig", COALESCE("name_en", ''::"text")), 'B'::"char")) || "setweight"("to_tsvector"('"simple"'::"regconfig", COALESCE("name_zh", ''::"text")), 'C'::"char")) || "setweight"("to_tsvector"('"simple"'::"regconfig", COALESCE("description", ''::"text")), 'D'::"char")) || "setweight"("to_tsvector"('"simple"'::"regconfig", COALESCE("description_en", ''::"text")), 'D'::"char")) || "setweight"("to_tsvector"('"simple"'::"regconfig", COALESCE("description_zh", ''::"text")), 'D'::"char"))) STORED,
    CONSTRAINT "products_deal_discount_check" CHECK ((("deal_discount" IS NULL) OR (("deal_discount" >= (1)::numeric) AND ("deal_discount" <= (99)::numeric)))),
    CONSTRAINT "products_deal_pairing" CHECK (((("deal_discount" IS NULL) AND ("deal_ends_at" IS NULL)) OR (("deal_discount" IS NOT NULL) AND ("deal_ends_at" IS NOT NULL)))),
    CONSTRAINT "products_moq_check" CHECK (("moq" >= 1)),
    CONSTRAINT "products_original_price_check" CHECK ((("original_price" IS NULL) OR ("original_price" > (0)::numeric))),
    CONSTRAINT "products_price_check" CHECK (("price" > (0)::numeric)),
    CONSTRAINT "products_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "products_stock_check" CHECK (("stock" >= 0)),
    CONSTRAINT "products_tax_rate_check" CHECK ((("tax_rate" >= (0)::numeric) AND ("tax_rate" <= (100)::numeric))),
    CONSTRAINT "products_weight_check" CHECK ((("weight" IS NULL) OR ("weight" > 0)))
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rate_limit_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rate_limit_buckets" (
    "bucket" "text" NOT NULL,
    "key" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."refunds" (
    "id" integer NOT NULL,
    "order_id" integer NOT NULL,
    "payment_id" integer,
    "user_id" integer NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "reason" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'requested'::character varying NOT NULL,
    "admin_notes" "text",
    "resolved_by" integer,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "refunds_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "refunds_reason_check" CHECK (("reason" <> ''::"text")),
    CONSTRAINT "refunds_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['requested'::character varying, 'approved'::character varying, 'rejected'::character varying, 'processed'::character varying])::"text"[])))
);


--
-- Name: refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."refunds" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."refunds_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."reviews" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "customer_id" integer NOT NULL,
    "order_id" integer,
    "rating" smallint NOT NULL,
    "title" character varying(120),
    "comment" "text",
    "images" "text"[],
    "is_verified" boolean DEFAULT false NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "helpful_count" integer DEFAULT 0 NOT NULL,
    "merchant_reply" "text",
    "merchant_replied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "reviews_check" CHECK ((("title" IS NOT NULL) OR ("comment" IS NOT NULL))),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."reviews" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."schema_migrations" (
    "version" character varying(100) NOT NULL,
    "description" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checksum" "text"
);


--
-- Name: search_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."search_logs" (
    "id" bigint NOT NULL,
    "query" "text" NOT NULL,
    "query_normalized" "text" NOT NULL,
    "result_count" integer DEFAULT 0 NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "user_id" integer,
    "request_id" character varying(64),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: search_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."search_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: search_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."search_logs_id_seq" OWNED BY "public"."search_logs"."id";


--
-- Name: shipping_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."shipping_methods" (
    "id" integer NOT NULL,
    "name_ar" "text" NOT NULL,
    "name_en" "text",
    "name_zh" "text",
    "base_cost" numeric(12,2) NOT NULL,
    "per_kg_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "estimated_days" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "shipping_methods_base_cost_check" CHECK (("base_cost" >= (0)::numeric)),
    CONSTRAINT "shipping_methods_estimated_days_check" CHECK (("estimated_days" > 0)),
    CONSTRAINT "shipping_methods_per_kg_cost_check" CHECK (("per_kg_cost" >= (0)::numeric))
);


--
-- Name: shipping_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."shipping_methods" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."shipping_methods_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: store_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."store_balance" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "available" numeric(12,2) DEFAULT 0 NOT NULL,
    "pending" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'YER'::character varying NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "store_balance_available_check" CHECK (("available" >= (0)::numeric)),
    CONSTRAINT "store_balance_pending_check" CHECK (("pending" >= (0)::numeric))
);


--
-- Name: store_balance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."store_balance" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."store_balance_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: store_followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."store_followers" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "notify_new_products" boolean DEFAULT true NOT NULL,
    "notify_offers" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: store_followers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."store_followers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."store_followers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."stores" (
    "id" integer NOT NULL,
    "owner_id" integer NOT NULL,
    "store_name" "text" NOT NULL,
    "store_name_en" "text",
    "store_name_zh" "text",
    "slug" character varying(80) NOT NULL,
    "description" "text",
    "description_en" "text",
    "description_zh" "text",
    "logo" "text",
    "banner" "text",
    "location" "text",
    "governorate" character varying(60),
    "trust_level" character varying(20) DEFAULT 'verified'::character varying NOT NULL,
    "response_rate" numeric(5,2) DEFAULT 95 NOT NULL,
    "on_time_delivery" numeric(5,2) DEFAULT 95 NOT NULL,
    "commission_rate" numeric(5,2) DEFAULT 5 NOT NULL,
    "rating" numeric(2,1) DEFAULT 0 NOT NULL,
    "review_count" integer DEFAULT 0 NOT NULL,
    "products_count" integer DEFAULT 0 NOT NULL,
    "sales_count" integer DEFAULT 0 NOT NULL,
    "followers_count" integer DEFAULT 0 NOT NULL,
    "since_year" smallint DEFAULT 2024,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "stores_commission_rate_check" CHECK ((("commission_rate" >= (0)::numeric) AND ("commission_rate" <= (100)::numeric))),
    CONSTRAINT "stores_on_time_delivery_check" CHECK ((("on_time_delivery" >= (0)::numeric) AND ("on_time_delivery" <= (100)::numeric))),
    CONSTRAINT "stores_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "stores_response_rate_check" CHECK ((("response_rate" >= (0)::numeric) AND ("response_rate" <= (100)::numeric))),
    CONSTRAINT "stores_since_year_check" CHECK ((("since_year" IS NULL) OR (("since_year" >= 2000) AND ("since_year" <= 2100)))),
    CONSTRAINT "stores_trust_level_check" CHECK ((("trust_level")::"text" = ANY ((ARRAY['verified'::character varying, 'golden'::character varying, 'diamond'::character varying])::"text"[])))
);


--
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."stores" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."subscriptions" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "plan" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'YER'::character varying NOT NULL,
    "auto_renew" boolean DEFAULT false NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "subscriptions_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "subscriptions_check" CHECK (("expires_at" > "started_at")),
    CONSTRAINT "subscriptions_plan_check" CHECK ((("plan")::"text" = ANY ((ARRAY['free'::character varying, 'starter'::character varying, 'pro'::character varying, 'enterprise'::character varying])::"text"[]))),
    CONSTRAINT "subscriptions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'past_due'::character varying])::"text"[])))
);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."transactions" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "type" character varying(20) NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "balance_after" numeric(12,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'YER'::character varying NOT NULL,
    "reference_type" character varying(40),
    "reference_id" integer,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "transactions_amount_sign" CHECK ((((("type")::"text" = 'withdrawal'::"text") AND ("amount" < (0)::numeric)) OR ((("type")::"text" <> 'withdrawal'::"text") AND ("amount" >= (0)::numeric)))),
    CONSTRAINT "transactions_balance_non_negative" CHECK (("balance_after" >= (0)::numeric)),
    CONSTRAINT "transactions_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['order'::character varying, 'withdrawal'::character varying, 'refund'::character varying, 'fee'::character varying, 'adjustment'::character varying])::"text"[])))
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."transactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: used_jtis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."used_jtis" (
    "jti" "text" NOT NULL,
    "user_id" integer NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."users" (
    "id" integer NOT NULL,
    "email" "public"."citext" NOT NULL,
    "password_hash" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" character varying(20),
    "role" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "phone_verified" boolean DEFAULT false NOT NULL,
    "avatar" "text",
    "two_factor_enabled" boolean DEFAULT false NOT NULL,
    "preferred_language" character varying(5) DEFAULT 'ar'::character varying NOT NULL,
    "gender" character varying(10),
    "last_login" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "totp_secret" "text",
    "totp_backup_codes" "text"[] DEFAULT '{}'::"text"[],
    "totp_enabled_at" timestamp with time zone,
    "token_version" integer DEFAULT 0 NOT NULL,
    "last_login_at" timestamp with time zone,
    "vehicle_type" character varying(50),
    "vehicle_plate" character varying(20),
    "license_number" character varying(50),
    "current_latitude" numeric(9,6),
    "current_longitude" numeric(9,6),
    "is_online" boolean DEFAULT false NOT NULL,
    "is_on_duty" boolean DEFAULT false NOT NULL,
    "rating" numeric(2,1) DEFAULT 5.0 NOT NULL,
    "total_deliveries" integer DEFAULT 0 NOT NULL,
    "completed_deliveries" integer DEFAULT 0 NOT NULL,
    "cancelled_deliveries" integer DEFAULT 0 NOT NULL,
    "avg_delivery_time_minutes" integer,
    CONSTRAINT "users_gender_check" CHECK ((("gender" IS NULL) OR (("gender")::"text" = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying])::"text"[])))),
    CONSTRAINT "users_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "users_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['customer'::character varying, 'merchant'::character varying, 'admin'::character varying, 'delivery_agent'::character varying])::"text"[]))),
    CONSTRAINT "users_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'banned'::character varying])::"text"[]))),
    CONSTRAINT "users_token_version_check" CHECK (("token_version" >= 0))
);


--
-- Name: COLUMN "users"."vehicle_type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."vehicle_type" IS 'Delivery vehicle type: motorcycle, car, van, bicycle';


--
-- Name: COLUMN "users"."vehicle_plate"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."vehicle_plate" IS 'Vehicle license plate number';


--
-- Name: COLUMN "users"."license_number"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."license_number" IS 'Driver license number';


--
-- Name: COLUMN "users"."current_latitude"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."current_latitude" IS 'Current GPS latitude for tracking';


--
-- Name: COLUMN "users"."current_longitude"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."current_longitude" IS 'Current GPS longitude for tracking';


--
-- Name: COLUMN "users"."is_online"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."is_online" IS 'Whether the delivery agent is online in the app';


--
-- Name: COLUMN "users"."is_on_duty"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."is_on_duty" IS 'Whether the delivery agent is currently on duty';


--
-- Name: COLUMN "users"."rating"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."rating" IS 'Delivery agent rating (0-5)';


--
-- Name: COLUMN "users"."total_deliveries"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."total_deliveries" IS 'Total assigned deliveries';


--
-- Name: COLUMN "users"."completed_deliveries"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."completed_deliveries" IS 'Successfully completed deliveries';


--
-- Name: COLUMN "users"."cancelled_deliveries"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."cancelled_deliveries" IS 'Cancelled deliveries';


--
-- Name: COLUMN "users"."avg_delivery_time_minutes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."users"."avg_delivery_time_minutes" IS 'Average delivery time in minutes';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."users" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_low_stock; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_low_stock" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "product_id",
    "p"."name_ar",
    "p"."name_en",
    "p"."stock",
    "p"."store_id",
    "s"."store_name",
    "s"."owner_id"
   FROM ("public"."products" "p"
     JOIN "public"."stores" "s" ON (("s"."id" = "p"."store_id")))
  WHERE (("p"."deleted_at" IS NULL) AND ("p"."is_active" = true) AND ("p"."stock" < 10));


--
-- Name: v_order_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_order_summary" AS
SELECT
    NULL::integer AS "id",
    NULL::character varying(40) AS "order_number",
    NULL::character varying(20) AS "status",
    NULL::character varying(20) AS "payment_status",
    NULL::character varying(20) AS "payment_method",
    NULL::numeric(12,2) AS "subtotal",
    NULL::numeric(12,2) AS "shipping_cost",
    NULL::numeric(12,2) AS "discount",
    NULL::numeric(12,2) AS "discount_amount",
    NULL::character varying(50) AS "coupon_code",
    NULL::numeric(12,2) AS "total",
    NULL::character varying(3) AS "currency",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::integer AS "customer_id",
    NULL::"text" AS "customer_name",
    NULL::"public"."citext" AS "customer_email",
    NULL::character varying(20) AS "customer_phone",
    NULL::integer AS "store_id",
    NULL::"text" AS "store_name_ar",
    NULL::character varying(80) AS "store_slug",
    NULL::"text" AS "store_logo",
    NULL::character varying(20) AS "trust_level",
    NULL::bigint AS "items_count",
    NULL::bigint AS "total_qty";


--
-- Name: v_product_with_store; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_product_with_store" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."store_id",
    "p"."category_id",
    "p"."name_ar",
    "p"."name_en",
    "p"."name_zh",
    "p"."description",
    "p"."description_en",
    "p"."description_zh",
    "p"."price",
    "p"."original_price",
    "p"."currency",
    "p"."stock",
    "p"."moq",
    "p"."weight",
    "p"."tax_rate",
    "p"."is_digital",
    "p"."main_image",
    "p"."features",
    "p"."specifications",
    "p"."badges",
    "p"."rating",
    "p"."review_count",
    "p"."sold_count",
    "p"."view_count",
    "p"."is_active",
    "p"."is_featured",
    "p"."deal_discount",
    "p"."deal_ends_at",
    "p"."created_at",
    "p"."updated_at",
    "s"."slug" AS "store_slug",
    "s"."store_name" AS "store_name_ar",
    "s"."store_name_en",
    "s"."store_name_zh",
    "s"."logo" AS "store_logo",
    "s"."banner" AS "store_banner",
    "s"."trust_level",
    "s"."rating" AS "store_rating",
    "s"."review_count" AS "store_review_count",
    "s"."response_rate",
    "s"."on_time_delivery",
    "s"."governorate",
    "s"."commission_rate",
    "c"."name_ar" AS "category_name_ar",
    "c"."name_en" AS "category_name_en",
    "c"."name_zh" AS "category_name_zh",
    "c"."slug" AS "category_slug"
   FROM (("public"."products" "p"
     JOIN "public"."stores" "s" ON (("s"."id" = "p"."store_id")))
     LEFT JOIN "public"."categories" "c" ON (("c"."id" = "p"."category_id")))
  WHERE (("p"."is_active" = true) AND ("p"."deleted_at" IS NULL) AND ("s"."is_active" = true) AND ("s"."deleted_at" IS NULL));


--
-- Name: v_store_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_store_stats" WITH ("security_invoker"='true') AS
 SELECT "id",
    "owner_id",
    "slug",
    "store_name",
    "store_name_en",
    "store_name_zh",
    "logo",
    "banner",
    "trust_level",
    "is_active",
    "is_verified",
    "created_at",
    "products_count" AS "total_products",
    "review_count" AS "total_reviews",
    "rating" AS "computed_rating",
    "sales_count" AS "total_orders",
    "followers_count" AS "total_followers",
    ( SELECT COALESCE("sum"("orders"."total"), (0)::numeric) AS "coalesce"
           FROM "public"."orders"
          WHERE (("orders"."store_id" = "s"."id") AND (("orders"."status")::"text" = ANY ((ARRAY['delivered'::character varying, 'shipped'::character varying])::"text"[])) AND (("orders"."payment_status")::"text" = 'paid'::"text"))) AS "total_revenue",
    (( SELECT "count"(*) AS "count"
           FROM "public"."products"
          WHERE (("products"."store_id" = "s"."id") AND ("products"."deleted_at" IS NULL) AND ("products"."is_active" = true))))::integer AS "active_products"
   FROM "public"."stores" "s"
  WHERE ("deleted_at" IS NULL);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."webhook_events" (
    "id" bigint NOT NULL,
    "provider" character varying(32) NOT NULL,
    "event_id" character varying(128) NOT NULL,
    "transaction_id" character varying(128) NOT NULL,
    "event_type" character varying(64) NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processing_state" character varying(16) DEFAULT 'received'::character varying NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "webhook_events_processing_state" CHECK ((("processing_state")::"text" = ANY ((ARRAY['received'::character varying, 'processed'::character varying])::"text"[])))
);


--
-- Name: webhook_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."webhook_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhook_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."webhook_events_id_seq" OWNED BY "public"."webhook_events"."id";


--
-- Name: wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."wishlist" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deleted_at" timestamp with time zone
);


--
-- Name: wishlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."wishlist" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."wishlist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: search_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."search_logs_id_seq"'::"regclass");


--
-- Name: webhook_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."webhook_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."webhook_events_id_seq"'::"regclass");


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."addresses" ("id", "user_id", "label", "full_name", "phone", "city", "governorate", "district", "street", "building", "notes", "latitude", "longitude", "is_default", "created_at", "updated_at") FROM stdin;
1	2	المنزل	أحمد المقتاري	+967712345671	صنعاء	صنعاء	الزبيري	شارع 30	عمارة النور	\N	\N	\N	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	2	العمل	أحمد المقتاري	+967712345671	صنعاء	صنعاء	التحرير	شارع 50	مبنى الشركة	\N	\N	\N	f	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	3	المنزل	سارة الحضرمي	+967712345672	عدن	عدن	المعلا	شارع 10	فيلا الزهراء	\N	\N	\N	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	3	الوالدة	سارة الحضرمي	+967712345672	عدن	عدن	خور مكسر	شارع 20	بيت الوالدة	\N	\N	\N	f	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
5	4	المنزل	عمر العمري	+967712345673	تعز	تعز	وادي القاضي	شارع 15	عمارة الأمل	\N	\N	\N	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
6	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 02:35:10.755591+00	2026-07-14 02:35:10.755591+00
7	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 02:37:04.307292+00	2026-07-14 02:37:04.307292+00
8	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 15:53:46.240613+00	2026-07-14 15:53:46.240613+00
9	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 15:54:20.549427+00	2026-07-14 15:54:20.549427+00
10	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 15:56:36.13202+00	2026-07-14 15:56:36.13202+00
11	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 15:57:10.877729+00	2026-07-14 15:57:10.877729+00
12	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 16:25:21.193427+00	2026-07-14 16:25:21.193427+00
13	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 16:26:45.306395+00	2026-07-14 16:26:45.306395+00
14	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 17:43:39.608547+00	2026-07-14 17:43:39.608547+00
15	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 17:44:20.625781+00	2026-07-14 17:44:20.625781+00
16	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 17:54:42.103745+00	2026-07-14 17:54:42.103745+00
17	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 17:55:19.262648+00	2026-07-14 17:55:19.262648+00
18	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 18:47:17.846519+00	2026-07-14 18:47:17.846519+00
19	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 18:47:45.260353+00	2026-07-14 18:47:45.260353+00
20	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 22:50:59.917018+00	2026-07-14 22:50:59.917018+00
21	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-14 23:24:11.374725+00	2026-07-14 23:24:11.374725+00
22	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 00:24:02.788973+00	2026-07-15 00:24:02.788973+00
23	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 01:37:30.448714+00	2026-07-15 01:37:30.448714+00
24	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 01:39:32.499495+00	2026-07-15 01:39:32.499495+00
25	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 01:39:47.680399+00	2026-07-15 01:39:47.680399+00
26	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 01:43:45.584324+00	2026-07-15 01:43:45.584324+00
27	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 02:01:17.737278+00	2026-07-15 02:01:17.737278+00
28	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 02:10:43.453566+00	2026-07-15 02:10:43.453566+00
29	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 03:52:14.099405+00	2026-07-15 03:52:14.099405+00
30	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 03:59:11.720288+00	2026-07-15 03:59:11.720288+00
31	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 04:39:19.137653+00	2026-07-15 04:39:19.137653+00
32	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 04:46:49.871369+00	2026-07-15 04:46:49.871369+00
33	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 15:17:30.616236+00	2026-07-15 15:17:30.616236+00
34	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 15:17:50.403285+00	2026-07-15 15:17:50.403285+00
35	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 15:40:23.820743+00	2026-07-15 15:40:23.820743+00
36	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 15:54:21.444681+00	2026-07-15 15:54:21.444681+00
37	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 16:17:06.711076+00	2026-07-15 16:17:06.711076+00
38	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 17:06:59.56436+00	2026-07-15 17:06:59.56436+00
39	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 18:21:59.5214+00	2026-07-15 18:21:59.5214+00
40	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 21:55:23.762528+00	2026-07-15 21:55:23.762528+00
41	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:31:02.392019+00	2026-07-15 22:31:02.392019+00
42	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:31:35.95504+00	2026-07-15 22:31:35.95504+00
43	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:31:55.550609+00	2026-07-15 22:31:55.550609+00
44	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:32:10.117235+00	2026-07-15 22:32:10.117235+00
45	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:32:39.615243+00	2026-07-15 22:32:39.615243+00
46	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:32:59.829829+00	2026-07-15 22:32:59.829829+00
47	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:34:05.288721+00	2026-07-15 22:34:05.288721+00
48	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:34:32.031225+00	2026-07-15 22:34:32.031225+00
49	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:34:54.340882+00	2026-07-15 22:34:54.340882+00
50	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:35:11.567897+00	2026-07-15 22:35:11.567897+00
51	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:44:04.205009+00	2026-07-15 22:44:04.205009+00
52	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:55:19.321716+00	2026-07-15 22:55:19.321716+00
53	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:56:45.063058+00	2026-07-15 22:56:45.063058+00
54	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:57:46.782625+00	2026-07-15 22:57:46.782625+00
55	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:58:02.651957+00	2026-07-15 22:58:02.651957+00
56	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:58:11.014512+00	2026-07-15 22:58:11.014512+00
57	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:58:31.158713+00	2026-07-15 22:58:31.158713+00
58	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:58:52.024547+00	2026-07-15 22:58:52.024547+00
59	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 22:59:12.224094+00	2026-07-15 22:59:12.224094+00
60	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:49:38.734148+00	2026-07-15 23:49:38.734148+00
61	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:51:07.907184+00	2026-07-15 23:51:07.907184+00
62	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:51:33.707977+00	2026-07-15 23:51:33.707977+00
63	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:51:58.541937+00	2026-07-15 23:51:58.541937+00
64	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:52:19.140541+00	2026-07-15 23:52:19.140541+00
65	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:52:40.311302+00	2026-07-15 23:52:40.311302+00
66	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:53:04.149145+00	2026-07-15 23:53:04.149145+00
67	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-15 23:54:10.160732+00	2026-07-15 23:54:10.160732+00
68	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:18:10.164423+00	2026-07-16 00:18:10.164423+00
69	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:21:33.866346+00	2026-07-16 00:21:33.866346+00
70	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:22:42.232653+00	2026-07-16 00:22:42.232653+00
71	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:25:20.232205+00	2026-07-16 00:25:20.232205+00
72	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:29:14.189985+00	2026-07-16 00:29:14.189985+00
73	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:40:25.946982+00	2026-07-16 00:40:25.946982+00
74	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:41:54.982814+00	2026-07-16 00:41:54.982814+00
75	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:42:12.426564+00	2026-07-16 00:42:12.426564+00
76	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:42:38.063936+00	2026-07-16 00:42:38.063936+00
77	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:48:23.341921+00	2026-07-16 00:48:23.341921+00
78	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:49:51.510021+00	2026-07-16 00:49:51.510021+00
79	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 00:50:43.972085+00	2026-07-16 00:50:43.972085+00
80	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:15:25.560376+00	2026-07-16 18:15:25.560376+00
81	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:15:52.967568+00	2026-07-16 18:15:52.967568+00
82	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:16:24.639738+00	2026-07-16 18:16:24.639738+00
83	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:16:45.384598+00	2026-07-16 18:16:45.384598+00
84	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:19:29.459887+00	2026-07-16 18:19:29.459887+00
85	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:19:52.178416+00	2026-07-16 18:19:52.178416+00
86	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:20:24.055022+00	2026-07-16 18:20:24.055022+00
87	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:31:25.971292+00	2026-07-16 18:31:25.971292+00
88	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:33:11.063909+00	2026-07-16 18:33:11.063909+00
89	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 18:35:13.569683+00	2026-07-16 18:35:13.569683+00
90	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 20:32:59.305514+00	2026-07-16 20:32:59.305514+00
91	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 20:33:29.519629+00	2026-07-16 20:33:29.519629+00
92	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 20:33:52.464908+00	2026-07-16 20:33:52.464908+00
93	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 20:34:15.567897+00	2026-07-16 20:34:15.567897+00
94	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 20:45:28.847129+00	2026-07-16 20:45:28.847129+00
95	7	Home	Nouf Ali	+967771122334	Sanaʾa	Sanaʾa	\N	Hadda St, Building 5	\N	\N	\N	\N	f	2026-07-16 20:46:18.165606+00	2026-07-16 20:46:18.165606+00
\.


--
-- Data for Name: admin_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."admin_audit_log" ("id", "user_id", "action", "entity_type", "entity_id", "old_values", "new_values", "ip_address", "user_agent", "created_at") FROM stdin;
1	1	APPROVE	store	7	{"is_verified": false, "trust_level": "verified"}	{"is_verified": true, "trust_level": "diamond"}	\N	\N	2026-06-14 01:16:08.475969+00
2	1	CREATE	coupon	1	\N	{"code": "WELCOME10", "type": "percentage", "value": 10}	\N	\N	2026-07-07 01:16:08.475969+00
3	1	RESOLVE	refund	1	\N	{"status": "processed", "admin_notes": "تم رد المبلغ"}	\N	\N	2026-07-13 01:16:08.475969+00
4	1	VERIFY	merchant	5	{"kyc_status": "pending"}	{"kyc_status": "verified"}	\N	\N	2026-05-15 01:16:08.475969+00
5	1	SUSPEND	user	4	{"status": "active"}	{"reason": "suspicious_activity", "status": "suspended"}	\N	\N	2026-06-29 01:16:08.475969+00
6	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 02:35:12.963172+00
7	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 02:37:08.121511+00
8	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 15:53:47.30285+00
9	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 15:54:21.634535+00
10	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 15:56:37.162647+00
11	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 15:57:10.956957+00
12	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 16:25:22.400326+00
13	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 16:26:46.579881+00
14	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 17:43:42.291587+00
15	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 17:44:24.207527+00
16	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 17:54:46.77107+00
17	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 17:55:20.581324+00
18	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 17:55:38.898163+00
19	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 18:47:18.961031+00
20	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 18:47:46.319166+00
21	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 22:51:00.815302+00
22	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-14 23:24:13.334124+00
23	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:37:31.686722+00
24	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:39:33.625984+00
25	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:39:48.684157+00
26	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:40:07.910776+00
27	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:41:39.832376+00
28	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:41:57.408142+00
29	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:42:46.100252+00
30	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 01:43:46.916978+00
31	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 02:01:18.991203+00
32	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 02:10:44.731642+00
33	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 03:52:15.404876+00
34	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 03:59:12.886737+00
35	35	store.create	stores	8	\N	{"store_name": "نشوان للتجارة العامة وخدمات حقول النفط والغاز"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-07-15 04:14:16.984023+00
36	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 04:39:21.283979+00
37	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 04:46:51.653017+00
38	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 15:17:32.630027+00
39	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 15:17:52.763816+00
40	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 15:40:25.986838+00
41	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 15:54:20.886423+00
42	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 16:17:08.406504+00
43	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 17:07:02.080603+00
44	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 18:22:00.406911+00
45	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 21:55:24.620609+00
46	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:31:03.458824+00
47	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:31:37.249607+00
48	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:31:56.747351+00
49	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:32:11.395391+00
50	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:32:39.139503+00
51	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:33:01.128115+00
52	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:34:06.667924+00
53	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:34:31.712641+00
54	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:34:55.657072+00
55	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:35:12.859914+00
56	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:44:05.746033+00
57	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:55:22.438999+00
58	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:56:48.010504+00
59	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:57:48.927398+00
60	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:58:02.150394+00
61	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:58:13.318072+00
62	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:58:33.13527+00
63	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:58:54.150726+00
64	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 22:59:14.221382+00
65	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:49:40.182215+00
66	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:51:09.416742+00
67	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:51:36.214442+00
68	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:52:01.140293+00
69	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:52:20.869229+00
70	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:52:42.010999+00
71	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:53:05.845765+00
72	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-15 23:54:12.251031+00
73	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:18:14.643328+00
74	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:21:36.342985+00
75	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:22:42.608769+00
76	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:25:23.106061+00
77	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:29:11.679794+00
78	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:40:29.8933+00
79	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:41:52.822047+00
80	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:42:13.860558+00
81	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:42:36.101585+00
82	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:48:21.349427+00
83	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:49:53.688186+00
84	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 00:50:42.770731+00
85	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:15:28.053689+00
86	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:15:55.602456+00
87	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:16:22.944762+00
88	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:16:47.991367+00
89	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:19:29.04565+00
90	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:19:54.126336+00
91	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:20:26.422898+00
92	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:31:26.687909+00
93	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:33:08.488621+00
94	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 18:35:16.341774+00
95	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 20:33:00.433084+00
96	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 20:33:31.131654+00
97	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 20:33:51.988065+00
98	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 20:34:16.670247+00
99	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 20:45:27.347043+00
100	7	change_password	user	7	\N	\N	::ffff:127.0.0.1	\N	2026-07-16 20:46:19.445169+00
101	101	store.create	stores	9	\N	{"store_name": "ام توب للتجارة المعدات الصناعية"}	::ffff:172.19.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-07-17 03:17:02.132292+00
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."app_settings" ("key", "value", "description", "updated_at", "updated_by") FROM stdin;
DEFAULT_CURRENCY	YER	ISO-4217 currency code used as default when an order / subscription row has currency IS NULL or unknown. See 0022_coupon_atomicity / 0021_schema_hygiene for historical context.	2026-07-14 01:16:08.065515+00	\N
FREE_SHIPPING_THRESHOLD	10000	Order subtotal (in minor units; 10000 = 100.00 of the DEFAULT_CURRENCY) at and above which shipping is free. Below this, FLAT_SHIPPING_COST applies.	2026-07-14 01:16:08.065515+00	\N
FLAT_SHIPPING_COST	500	Flat shipping fee (in minor units) charged when the order subtotal is below FREE_SHIPPING_THRESHOLD. Used by server/routes/orders.cts.	2026-07-14 01:16:08.065515+00	\N
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."cart_items" ("id", "user_id", "product_id", "variant_id", "variant", "quantity", "created_at", "updated_at") FROM stdin;
1	2	3	\N	\N	2	2026-07-13 01:16:08.475969+00	2026-07-13 01:16:08.475969+00
2	3	14	\N	\N	1	2026-07-12 01:16:08.475969+00	2026-07-12 01:16:08.475969+00
3	4	8	\N	\N	1	2026-07-13 22:16:08.475969+00	2026-07-13 22:16:08.475969+00
81	35	14	\N	\N	1	2026-07-16 18:19:07.36147+00	2026-07-16 18:19:07.36147+00
29	2	1	\N	\N	2	2026-07-15 17:01:01.579041+00	2026-07-15 17:01:01.579041+00
31	2	1	\N	\N	2	2026-07-15 17:44:07.635318+00	2026-07-15 17:44:07.635318+00
32	2	1	\N	\N	2	2026-07-15 17:58:49.007966+00	2026-07-15 17:58:49.007966+00
33	2	1	\N	\N	2	2026-07-15 18:10:42.540864+00	2026-07-15 18:10:42.540864+00
35	2	1	\N	\N	2	2026-07-15 18:37:45.001872+00	2026-07-15 18:37:45.001872+00
36	2	1	\N	\N	2	2026-07-15 21:20:39.013505+00	2026-07-15 21:20:39.013505+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."categories" ("id", "parent_id", "name_ar", "name_en", "name_zh", "slug", "icon", "image", "sort_order", "is_active", "created_at", "updated_at") FROM stdin;
1	\N	إلكترونيات	Electronics	电子产品	electronics	📱	\N	1	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	\N	المواد الغذائية	Food & Beverages	食品饮料	food-beverages	🍯	\N	2	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	\N	الأزياء	Fashion	服装	fashion	👗	\N	3	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	\N	المنزل والمطبخ	Home & Kitchen	家居厨房	home-kitchen	🏠	\N	4	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
5	\N	الجمال والعناية	Beauty & Care	美容护理	beauty-care	💄	\N	5	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
6	\N	الحرف اليدوية	Handicrafts	手工艺品	handicrafts	🧶	\N	6	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
7	\N	السيارات	Automotive	汽车	automotive	🚗	\N	7	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
8	1	هواتف	Phones	手机	phones	📞	\N	1	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
9	1	أجهزة لوحية	Tablets	平板电脑	tablets	💻	\N	2	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
10	1	سماعات	Headphones	耳机	headphones	🎧	\N	3	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
11	2	عسل	Honey	蜂蜜	honey	🍯	\N	1	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
12	2	قهوة	Coffee	咖啡	coffee	☕	\N	2	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
13	2	تمور	Dates	椰枣	dates	🌴	\N	3	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
14	3	رجالي	Men	男装	men	👔	\N	1	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
15	3	نسائي	Women	女装	women	👗	\N	2	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
16	6	سلال	Baskets	篮子	baskets	🧺	\N	1	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
17	6	فضيات	Silverware	银器	silverware	🥈	\N	2	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
18	5	عطور	Perfumes	香水	perfumes	🌹	\N	1	t	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: coupon_usage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."coupon_usage" ("id", "coupon_id", "user_id", "order_id", "discount_amount", "used_at") FROM stdin;
1	1	4	5	5000.00	2026-07-14 01:16:08.475969+00
2	2	3	4	500.00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."coupons" ("id", "code", "type", "value", "min_order_amount", "max_discount", "usage_limit", "usage_count", "per_user_limit", "store_id", "starts_at", "expires_at", "is_active", "description", "created_at", "updated_at") FROM stdin;
3	YEMEN25	percentage	25.00	10000.00	10000.00	500	0	1	\N	2026-06-14 01:16:08.475969+00	2026-09-12 01:16:08.475969+00	t	عروض اليوم الوطني 25%	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	SPICE20	percentage	20.00	3000.00	3000.00	200	0	2	1	2026-06-30 01:16:08.475969+00	2026-08-13 01:16:08.475969+00	t	خصم 20% على بهارات اليمن	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
1	WELCOME10	percentage	10.00	5000.00	5000.00	1000	1	1	\N	2026-07-13 01:16:08.475969+00	2026-08-13 01:16:08.475969+00	t	خصم ترحيبي 10% لأول طلب (حد أقصى 5000 ر.ي)	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	FREESHIP	fixed	500.00	0.00	\N	\N	1	999	\N	2026-07-07 01:16:08.475969+00	2026-10-12 01:16:08.475969+00	t	شحن مجاني	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: delivery_agent_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."delivery_agent_assignments" ("id", "agent_id", "order_id", "assigned_at", "accepted_at", "picked_up_at", "delivered_at", "earnings", "status", "notes", "cancelled_reason", "cancelled_at", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: delivery_agents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."delivery_agents" ("id", "user_id", "vehicle_type", "vehicle_plate", "vehicle_color", "license_number", "license_expiry", "insurance_number", "insurance_expiry", "status", "current_lat", "current_lng", "last_location_update", "rating", "total_deliveries", "completed_deliveries", "cancelled_deliveries", "avg_delivery_time_minutes", "total_earnings", "created_at", "updated_at") FROM stdin;
1	11	motorcycle	1234-أ	\N	DL123456	\N	\N	\N	active	12.785500	45.016200	\N	4.9	156	148	0	25	0.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	12	motorcycle	5678-ب	\N	DL789012	\N	\N	\N	active	12.856700	44.987600	\N	4.8	203	195	0	22	0.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	13	bicycle	9012-ج	\N	DL345678	\N	\N	\N	offline	12.723400	45.123400	\N	4.7	89	85	0	30	0.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: disputes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."disputes" ("id", "order_id", "customer_id", "store_id", "type", "status", "priority", "subject", "description", "evidence", "resolution", "refund_amount", "resolved_by", "resolved_at", "created_at", "updated_at") FROM stdin;
1	7	3	1	not_received	investigating	high	لم يصل الطلب	الطلب لم يصل حتى الآن رغم مرور 48 ساعة	[]	\N	\N	\N	\N	2026-07-13 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: inventory_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."inventory_log" ("id", "product_id", "store_id", "change_amount", "reason", "reference_type", "reference_id", "notes", "created_at") FROM stdin;
1	1	1	-1	order_placed	order	1	\N	2026-07-14 01:16:08.475969+00
2	2	1	-1	order_placed	order	1	\N	2026-07-14 01:16:08.475969+00
3	4	3	-1	order_placed	order	2	\N	2026-07-14 01:16:08.475969+00
4	9	2	-1	order_placed	order	3	\N	2026-07-14 01:16:08.475969+00
5	18	7	-1	order_placed	order	4	\N	2026-07-14 01:16:08.475969+00
6	12	5	-1	order_placed	order	5	\N	2026-07-14 01:16:08.475969+00
7	7	4	-1	order_placed	order	6	\N	2026-07-14 01:16:08.475969+00
8	1	1	-1	order_placed	order	7	\N	2026-07-14 01:16:08.475969+00
9	19	7	-1	order_placed	order	8	\N	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."messages" ("id", "sender_id", "receiver_id", "store_id", "product_id", "order_id", "body", "attachments", "is_read", "read_at", "created_at", "deleted_at") FROM stdin;
1	2	5	1	\N	\N	مرحباً، هل المنتج متوفر؟	[]	t	2026-07-13 23:16:08.475969+00	2026-07-13 22:16:08.475969+00	\N
2	5	2	1	\N	\N	نعم متوفر، يمكنني تأكيد الطلب	[]	t	2026-07-14 00:16:08.475969+00	2026-07-13 23:16:08.475969+00	\N
3	3	6	3	\N	\N	متى يصل الطلب؟	[]	t	2026-07-14 00:46:08.475969+00	2026-07-14 00:16:08.475969+00	\N
4	6	3	3	\N	\N	خلال 24 ساعة بإذن الله	[]	f	\N	2026-07-14 01:01:08.475969+00	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."notifications" ("id", "user_id", "type", "title", "body", "data", "is_read", "read_at", "created_at", "deleted_at") FROM stdin;
1	2	order	تم استلام طلبك	طلبك #NOF-2026-0001 قيد المعالجة	{"order_id": 1, "order_number": "NOF-2026-0001"}	f	\N	2026-07-07 01:16:08.475969+00	\N
2	2	order	تم شحن طلبك	طلبك #NOF-2026-0001 في الطريق إليك	{"order_id": 1, "tracking": "YE1234567890"}	t	2026-07-11 01:16:08.475969+00	2026-07-10 01:16:08.475969+00	\N
3	2	order	تم تسليم طلبك	تم تسليم طلبك بنجاح	{"order_id": 1}	f	\N	2026-07-12 01:16:08.475969+00	\N
4	3	order	تم استلام طلبك	طلبك #NOF-2026-0003	{"order_id": 3}	t	2026-07-13 13:16:08.475969+00	2026-07-11 01:16:08.475969+00	\N
5	3	promo	عرض خاص!	خصم 25% على المنتجات المختارة	{"coupon_code": "YEMEN25"}	f	\N	2026-07-13 01:16:08.475969+00	\N
6	4	order	تم تسليم طلبك	تم تسليم طلبك #NOF-2026-0005	{"order_id": 5}	t	2026-07-11 01:16:08.475969+00	2026-07-10 01:16:08.475969+00	\N
7	3	refund	تم استلام طلب الاسترجاع	طلب استرجاع #1 قيد المراجعة	{"refund_id": 1}	f	\N	2026-07-13 01:16:08.475969+00	\N
8	4	system	تحديث النظام	تم تحديث نظام المدفوعات	{}	t	2026-07-12 01:16:08.475969+00	2026-07-11 01:16:08.475969+00	\N
9	14	system	مرحباً بك في نوف-إكس، Nouf Ali!	مرحباً Nouf Ali،\n\nمرحباً بك في نوف-إكس — السوق الموثوق B2B/B2C لليمن والشرق الأوسط.\n\nابدأ الآن: تصفح المنتجات، تابع متاجرك المفضلة، واستمتع بمدفوعات آمنة.\n\n— فريق نوف-إكس	{"eventType": "welcome"}	f	\N	2026-07-14 02:35:12.13476+00	\N
10	5	review	تقييم جديد على Original Yemeni Sidr Honey 500g	مرحباً،\n\nتم نشر تقييم جديد 4 نجوم على منتجك "Original Yemeni Sidr Honey 500g".\n\nالتعليق: Would buy again.\n\n— فريق نوف-إكس	{"eventType": "review_posted", "productId": 1}	f	\N	2026-07-14 15:53:46.699389+00	\N
11	35	system	مرحباً بك في نوف-إكس، Nashwan corp!	مرحباً Nashwan corp،\n\nمرحباً بك في نوف-إكس — السوق الموثوق B2B/B2C لليمن والشرق الأوسط.\n\nابدأ الآن: تصفح المنتجات، تابع متاجرك المفضلة، واستمتع بمدفوعات آمنة.\n\n— فريق نوف-إكس	{"eventType": "welcome"}	f	\N	2026-07-15 04:13:20.491942+00	\N
12	101	system	مرحباً بك في نوف-إكس، emtop!	مرحباً emtop،\n\nمرحباً بك في نوف-إكس — السوق الموثوق B2B/B2C لليمن والشرق الأوسط.\n\nابدأ الآن: تصفح المنتجات، تابع متاجرك المفضلة، واستمتع بمدفوعات آمنة.\n\n— فريق نوف-إكس	{"eventType": "welcome"}	f	\N	2026-07-17 03:11:33.578354+00	\N
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."order_items" ("id", "order_id", "product_id", "variant_id", "product_name", "quantity", "unit_price", "total_price", "created_at", "updated_at") FROM stdin;
1	1	1	\N	عسل السدر اليمني الأصلي 500غ	1	8500.00	8500.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	1	2	\N	قهوة مخا اليمنية 250غ	1	4500.00	4500.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	2	4	\N	تمور مجدول فاخرة 1 كغ	1	6500.00	6500.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	3	9	\N	عود كمبودي فاخر 100غ	1	25000.00	25000.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
5	4	18	\N	قهوة عربية بالهيل 250غ	1	5500.00	5500.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
6	5	12	\N	هاتف ذكي 6.5 إنش	1	85000.00	85000.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
7	6	7	\N	طقم فضيات يمنية	1	15000.00	15000.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
8	7	1	\N	عسل السدر اليمني الأصلي 500غ	1	8500.00	8500.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
9	8	19	\N	قهوة تركية محمصة 500غ	1	7500.00	7500.00	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."orders" ("id", "order_number", "customer_id", "store_id", "status", "payment_method", "payment_status", "subtotal", "shipping_cost", "discount", "coupon_code", "discount_amount", "total", "currency", "shipping_address", "billing_address", "notes", "tracking_number", "shipping_company", "estimated_delivery", "delivered_at", "cancelled_at", "timeline", "created_at", "updated_at", "delivery_agent_id") FROM stdin;
1	NOF-2026-0001	2	1	delivered	cod	paid	13000.00	700.00	0.00	\N	0.00	13700.00	YER	{"city": "صنعاء", "name": "أحمد المقتاري", "phone": "+967712345671", "street": "شارع 30", "building": "عمارة النور"}	\N	\N	YE1234567890	Yemen Post	2026-07-09 01:16:08.475969+00	2026-07-12 01:16:08.475969+00	\N	[{"at": "2026-06-15T10:00:00Z", "status": "pending", "payment": "pending"}, {"at": "2026-06-18T14:30:00Z", "status": "delivered", "payment": "paid"}]	2026-07-07 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
2	NOF-2026-0002	2	3	shipped	cod	pending	6500.00	700.00	0.00	\N	0.00	7200.00	YER	{"city": "صنعاء", "name": "أحمد المقتاري", "phone": "+967712345671", "street": "شارع 30", "building": "عمارة النور"}	\N	\N	YE0987654321	Yemen Post	2026-07-16 01:16:08.475969+00	\N	\N	[{"at": "2026-06-20T11:00:00Z", "status": "pending", "payment": "pending"}]	2026-07-12 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
3	NOF-2026-0003	3	2	processing	card	paid	25000.00	1000.00	0.00	\N	0.00	26000.00	YER	{"city": "عدن", "name": "سارة الحضرمي", "phone": "+967712345672", "street": "شارع 10", "building": "فيلا الزهراء"}	\N	\N	\N	\N	\N	\N	\N	[{"at": "2026-06-19T09:00:00Z", "status": "pending", "payment": "pending"}, {"at": "2026-06-19T10:30:00Z", "status": "confirmed", "payment": "paid"}]	2026-07-11 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
4	NOF-2026-0004	3	7	pending	cod	pending	4500.00	500.00	500.00	FREESHIP	500.00	4500.00	YER	{"city": "عدن", "name": "سارة الحضرمي", "phone": "+967712345672", "street": "شارع 10", "building": "فيلا الزهراء"}	\N	\N	\N	\N	\N	\N	\N	[{"at": "2026-06-21T08:00:00Z", "status": "pending", "payment": "pending"}]	2026-07-13 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
5	NOF-2026-0005	4	5	delivered	wallet	paid	85000.00	1500.00	5000.00	WELCOME10	5000.00	81500.00	YER	{"city": "تعز", "name": "عمر العمري", "phone": "+967712345673", "street": "شارع 15", "building": "عمارة الأمل"}	\N	\N	YE1122334455	Aramex	2026-07-06 01:16:08.475969+00	2026-07-10 01:16:08.475969+00	\N	[{"at": "2026-06-13T15:00:00Z", "status": "pending", "payment": "pending"}, {"at": "2026-06-16T12:00:00Z", "status": "delivered", "payment": "paid"}]	2026-07-04 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
6	NOF-2026-0006	2	4	confirmed	bank_transfer	paid	15000.00	1000.00	0.00	\N	0.00	16000.00	YER	{"city": "صنعاء", "name": "أحمد المقتاري", "phone": "+967712345671", "street": "شارع 30", "building": "عمارة النور"}	\N	\N	\N	\N	\N	\N	\N	[{"at": "2026-06-21T07:00:00Z", "status": "pending", "payment": "pending"}, {"at": "2026-06-21T08:00:00Z", "status": "confirmed", "payment": "paid"}]	2026-07-13 13:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
7	NOF-2026-0007	3	1	cancelled	card	failed	8500.00	700.00	0.00	\N	0.00	9200.00	YER	{"city": "عدن", "name": "سارة الحضرمي", "phone": "+967712345672", "street": "شارع 10", "building": "فيلا الزهراء"}	\N	\N	\N	\N	\N	\N	2026-07-13 19:16:08.475969+00	[{"at": "2026-06-19T14:00:00Z", "status": "pending", "payment": "pending"}, {"at": "2026-06-19T15:00:00Z", "status": "cancelled", "payment": "failed"}]	2026-07-12 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
8	NOF-2026-0008	4	7	delivered	cod	paid	7500.00	500.00	0.00	\N	0.00	8000.00	YER	{"city": "تعز", "name": "عمر العمري", "phone": "+967712345673", "street": "شارع 15", "building": "عمارة الأمل"}	\N	\N	YE5566778899	Yemen Post	2026-07-08 01:16:08.475969+00	2026-07-11 01:16:08.475969+00	\N	[{"at": "2026-06-15T08:00:00Z", "status": "pending", "payment": "pending"}, {"at": "2026-06-17T11:00:00Z", "status": "delivered", "payment": "paid"}]	2026-07-06 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."payments" ("id", "order_id", "user_id", "method", "status", "amount", "currency", "provider", "provider_txn_id", "provider_meta", "failure_reason", "paid_at", "refunded_at", "created_at", "updated_at") FROM stdin;
1	1	2	cod	completed	13700.00	YER	manual	\N	{}	\N	2026-07-12 01:16:08.475969+00	\N	2026-07-07 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	3	3	card	completed	26000.00	YER	stripe	pi_3MxxxDemo0001	{}	\N	2026-07-11 01:16:08.475969+00	\N	2026-07-11 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	5	4	wallet	completed	78000.00	YER	manual	WALLET-TXN-0001	{}	\N	2026-07-10 01:16:08.475969+00	\N	2026-07-04 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	6	2	bank_transfer	completed	16000.00	YER	manual	BANK-TXN-0001	{}	\N	2026-07-13 13:16:08.475969+00	\N	2026-07-13 13:16:08.475969+00	2026-07-14 01:16:08.475969+00
5	8	4	cod	completed	8000.00	YER	manual	\N	{}	\N	2026-07-11 01:16:08.475969+00	\N	2026-07-06 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
6	7	3	card	failed	9200.00	YER	stripe	pi_3MxxxDemo0002	{}	\N	\N	\N	2026-07-12 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."product_images" ("id", "product_id", "image_url", "alt_text", "sort_order", "is_primary", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."product_variants" ("id", "product_id", "sku", "name_ar", "name_en", "name_zh", "attributes", "price_delta", "stock", "is_active", "sort_order", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."products" ("id", "store_id", "category_id", "name_ar", "name_en", "name_zh", "description", "description_en", "description_zh", "price", "original_price", "currency", "stock", "moq", "weight", "tax_rate", "is_digital", "main_image", "features", "specifications", "badges", "rating", "review_count", "sold_count", "view_count", "is_active", "is_featured", "deal_discount", "deal_ends_at", "deleted_at", "created_at", "updated_at") FROM stdin;
3	1	11	عسل المنجل البري 1 كغ	Wild Thyme Honey 1kg	野生百里香蜂蜜 1公斤	عسل منجل بري طبيعي 100%	Pure wild thyme honey	纯野生百里香蜂蜜	15000.00	18000.00	YER	30	1	1000	0.00	f	/products/p3-wild-thyme-honey-1kg.jpg	\N	{}	\N	5.0	12	89	0	t	f	17.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
6	4	16	سلة خوص يمنية يدوية	Handmade Yemeni Palm Basket	手工也门棕榈篮	سلة مصنوعة يدوياً من الخوص الطبيعي	Handmade basket from natural palm leaves	天然棕榈叶手工编织篮子	3500.00	\N	YER	40	1	800	0.00	f	/products/p6-handmade-yemeni-palm-basket.jpg	\N	{}	\N	4.6	18	92	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
8	4	6	مبخرة خشبية محفورة	Carved Wooden Incense Burner	手工雕刻木质香炉	مبخرة محفورة يدوياً بخشب الأرز	Hand-carved cedar incense burner	手工雕刻雪松香炉	4500.00	\N	YER	25	1	700	0.00	f	/products/p8-carved-wooden-incense-burner.jpg	\N	{}	\N	4.7	11	67	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
11	2	18	دهن العود الأصلي 25مل	Original Oud Oil 25ml	正沉香油 25毫升	دهن عود طبيعي نقي	Pure natural oud oil	纯天然沉香油	18000.00	22000.00	YER	18	1	25	0.00	f	/products/p11-original-oud-oil-25ml.jpg	\N	{}	\N	5.0	9	45	0	t	t	18.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
13	5	9	تابلت 10 إنش	Tablet 10 inch	平板电脑 10英寸	تابلت بدقة عالية	High-resolution tablet	高分辨率平板电脑	65000.00	\N	YER	20	1	500	0.00	f	/products/p13-tablet-10-inch.jpg	\N	{}	\N	4.4	34	178	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
15	5	10	باور بانك 20000 mAh	Power Bank 20000 mAh	充电宝 20000毫安	بطارية محمولة عالية السعة	High-capacity portable battery	大容量便携电池	8500.00	\N	YER	80	1	400	0.00	f	/products/p15-power-bank-20000-mah.jpg	\N	{}	\N	4.5	45	267	0	t	t	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
16	6	11	عسل أسود يمني 500غ	Yemeni Black Honey 500g	也门黑蜂蜜 500克	عسل أسود طبيعي	Natural black honey	天然黑蜂蜜	7500.00	\N	YER	35	1	500	0.00	f	/products/p16-yemeni-black-honey-500g.jpg	\N	{}	\N	4.7	18	89	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
17	6	11	عسل المراعي 1 كغ	Meadow Honey 1kg	草地蜂蜜 1公斤	عسل من رحيق المراعي	Honey from meadow nectar	草地花蜜蜂蜜	12000.00	14000.00	YER	25	1	1000	0.00	f	/products/p17-meadow-honey-1kg.jpg	\N	{}	\N	4.6	14	67	0	t	t	14.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
20	7	12	بن أرابيكا درجة أولى	Premium Arabica Beans	优质阿拉比卡咖啡豆	حبوب بن أرابيكا فاخرة	Premium Arabica coffee beans	优质阿拉比卡咖啡豆	9500.00	\N	YER	50	1	1000	0.00	f	/products/p20-premium-arabica-beans.jpg	\N	{}	\N	4.9	28	167	0	t	t	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
1	1	11	عسل السدر اليمني الأصلي 500غ	Original Yemeni Sidr Honey 500g	正宗也门西德里蜂蜜 500克	عسل سدر يمني طبيعي 100% من جبال حضرموت، غني بالمعادن والفيتامينات	Pure Yemeni Sidr honey from Hadramaut mountains, rich in minerals and vitamins	也门哈德拉毛山纯天然西德里蜂蜜，富含矿物质和维生素	8500.00	10000.00	YER	48	1	500	0.00	f	/products/p1-original-yemeni-sidr-honey-500g.jpg	\N	{}	\N	4.7	3	158	0	t	t	15.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
7	4	17	طقم فضيات يمنية	Yemeni Silver Set	也门银器套装	طقم فضيات مصنوع يدوياً	Handcrafted silver set	手工制作的银器套装	15000.00	18000.00	YER	14	1	600	0.00	f	/products/p7-yemeni-silver-set.jpg	\N	{}	\N	4.8	14	57	0	t	t	17.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
18	7	12	قهوة عربية بالهيل 250غ	Arabic Cardamom Coffee 250g	阿拉伯豆蔻咖啡 250克	قهوة عربية فاخرة	Premium Arabic coffee	优质阿拉伯咖啡	5500.00	\N	YER	59	1	250	0.00	f	/products/p18-arabic-cardamom-coffee-250g.jpg	\N	{}	\N	4.8	32	146	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
2	1	12	قهوة مخا اليمنية 250غ	Yemeni Mokha Coffee 250g	也门摩卡咖啡 250克	قهوة مخا الفاخرة المحمصة طازجة	Premium freshly roasted Mokha coffee	优质新鲜烘焙摩卡咖啡	4500.00	\N	YER	99	1	250	0.00	f	/products/p2-yemeni-mokha-coffee-250g.jpg	\N	{}	\N	4.0	1	235	0	t	t	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
4	3	13	تمور مجدول فاخرة 1 كغ	Premium Majdool Dates 1kg	优质马吉杜尔椰枣 1公斤	تمور مجدول درجة أولى	First grade Majdool dates	一级马吉杜尔椰枣	6500.00	\N	YER	199	1	1000	0.00	f	/products/p4-premium-majdool-dates-1kg.jpg	\N	{}	\N	5.0	1	168	0	t	t	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
5	3	13	تمور عجوة المدينة 500غ	Ajwa Madinah Dates 500g	麦地那艾吉瓦椰枣 500克	تمور العجوة النبوية	Prophetic Ajwa dates	圣训艾吉瓦椰枣	9500.00	12000.00	YER	75	1	500	0.00	f	/products/p5-ajwa-madinah-dates-500g.jpg	\N	{}	\N	5.0	1	145	0	t	t	21.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
9	2	18	عود كمبودي فاخر 100غ	Premium Cambodian Oud 100g	优质柬埔寨沉香 100克	عود طبيعي 100%	Pure natural oud	纯天然沉香	25000.00	30000.00	YER	19	1	100	0.00	f	/products/p9-premium-malaysian-oud-incense.jpg	\N	{}	\N	5.0	1	90	0	t	t	17.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
10	2	18	مسك أبيض نقي 50مل	Pure White Musk 50ml	纯白麝香 50毫升	مسك طبيعي بدون كحول	Natural alcohol-free musk	天然无酒精麝香	5500.00	\N	YER	60	1	50	0.00	f	/products/p10-pure-white-musk-50ml.jpg	\N	{}	\N	4.0	1	134	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
12	5	8	هاتف ذكي 6.5 إنش	Smartphone 6.5 inch	智能手机 6.5英寸	هاتف ذكي بشاشة كبيرة	Smartphone with large screen	大屏智能手机	85000.00	95000.00	YER	29	1	250	0.00	f	/products/p12-smartphone-6-5-inch.jpg	\N	{}	\N	4.0	1	235	0	t	t	11.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
14	5	10	سماعات بلوتوث لاسلكية	Wireless Bluetooth Headphones	无线蓝牙耳机	سماعات لاسلكية بجودة عالية	High-quality wireless headphones	高品质无线耳机	12000.00	15000.00	YER	45	1	300	0.00	f	/products/p14-wireless-bluetooth-headphones.jpg	\N	{}	\N	5.0	1	356	0	t	t	20.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
19	7	12	قهوة تركية محمصة 500غ	Roasted Turkish Coffee 500g	土耳其烘焙咖啡 500克	قهوة تركية طازجة	Fresh Turkish coffee	新鲜土耳其咖啡	7500.00	9000.00	YER	39	1	500	0.00	f	/products/p19-roasted-turkish-coffee-500g.jpg	\N	{}	\N	5.0	1	99	0	t	t	17.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
21	3	13	تمور صقعي 500غ	Saqei Dates 500g	萨基椰枣 500克	تمور صقعي يمنية	Yemeni Saqei dates	也门萨基椰枣	7500.00	\N	YER	80	1	500	0.00	f	/products/p21-saqei-dates-500g.jpg	\N	{}	\N	4.5	19	89	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
22	4	17	خنجر يمني تقليدي	Traditional Yemeni Jambiya	传统也门匕首	خنجر يمني مصنوع يدوياً	Handmade traditional Yemeni dagger	手工制作传统也门匕首	22000.00	25000.00	YER	8	1	400	0.00	f	/products/p22-traditional-yemeni-jambiya.jpg	\N	{}	\N	4.9	7	34	0	t	t	12.00	2026-08-13 01:16:08.475969+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
23	2	18	بخور بلدي فاخر 100غ	Premium Bakhour Badi 100g	优质巴迪熏香 100克	بخور بلدي طبيعي	Natural traditional incense	天然传统熏香	3500.00	\N	YER	100	1	100	0.00	f	/products/p23-premium-bakhour-badi-100g.jpg	\N	{}	\N	4.6	25	134	0	t	f	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
24	7	12	قهوة إسبريسو إيطالية 250غ	Italian Espresso 250g	意大利浓缩咖啡 250克	قهوة إسبريسو فاخرة	Premium espresso coffee	优质浓缩咖啡	6500.00	\N	YER	35	1	250	0.00	f	/products/p24-italian-espresso-250g.jpg	\N	{}	\N	4.7	17	78	0	t	t	\N	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
\.


--
-- Data for Name: rate_limit_buckets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."rate_limit_buckets" ("bucket", "key", "count", "reset_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."refunds" ("id", "order_id", "payment_id", "user_id", "amount", "reason", "status", "admin_notes", "resolved_by", "resolved_at", "created_at", "updated_at") FROM stdin;
1	7	\N	3	9200.00	المنتج لم يصل في الوقت المحدد	processed	\N	\N	2026-07-14 02:35:10.712481+00	2026-07-13 01:16:08.475969+00	2026-07-14 02:35:10.712481+00
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."reviews" ("id", "product_id", "store_id", "customer_id", "order_id", "rating", "title", "comment", "images", "is_verified", "is_visible", "helpful_count", "merchant_reply", "merchant_replied_at", "created_at", "updated_at") FROM stdin;
1	1	1	2	1	5	عسل ممتاز	عسل أصلي بجودة عالية جداً، وصلني في الوقت المحدد وبتغليف ممتاز	\N	t	t	12	شكراً لاختيارك منتجاتنا، نتطلع لخدمتك مرة أخرى	2026-07-13 01:16:08.475969+00	2026-07-12 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	1	1	3	3	5	أفضل عسل سدر	جربت عسل السدر من عدة أماكن وهذا أفضلهم على الإطلاق	\N	t	t	8	\N	\N	2026-07-13 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	2	1	2	1	4	قهوة جيدة	قهوة مخا بنكهة قوية، مناسبة لعشاق القهوة	\N	t	t	5	\N	\N	2026-07-13 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	4	3	3	\N	5	تمور فاخرة	تمور مجدول درجة أولى، طعم رائع وحجم كبير	\N	f	t	3	\N	\N	2026-07-11 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
5	5	3	2	\N	5	عجوة المدينة	التمور العجوة طعم لا يُقاوم، شكراً لكم	\N	f	t	7	يسعدنا خدمتك	2026-07-12 01:16:08.475969+00	2026-07-09 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
6	9	2	3	3	5	عود فاخر	عود كمبودي بجودة عالية جداً، الرائحة مميزة	\N	t	t	4	\N	\N	2026-07-13 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
7	10	2	2	\N	4	مسك جيد	مسك نقي وطبيعي، يدوم طويلاً	\N	f	t	2	\N	\N	2026-07-10 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
8	12	5	4	5	4	هاتف ممتاز	أداء قوي وكاميرا رائعة، يستحق الشراء	\N	t	t	9	شكراً لثقتك بنا	2026-07-11 01:16:08.475969+00	2026-07-10 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
9	14	5	2	\N	5	سماعات رائعة	جودة صوت ممتازة وعمر بطارية طويل	\N	f	t	6	\N	\N	2026-07-12 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
10	19	7	4	8	5	قهوة ممتازة	قهوة تركية بنكهة أصيلة، تغليف ممتاز	\N	t	t	4	شكراً لتقييمك	2026-07-12 01:16:08.475969+00	2026-07-11 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
14	1	1	7	\N	4	Solid product	Would buy again.	\N	f	t	0	\N	\N	2026-07-14 15:53:46.370002+00	2026-07-14 15:53:46.370002+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."schema_migrations" ("version", "description", "applied_at", "checksum") FROM stdin;
0001	baseline schema + seed	2026-07-14 01:16:07.131926+00	\N
0001_baseline	Migration 0001_baseline	2026-07-14 01:16:07.368961+00	\N
0002_add_cart_variant	Migration 0002_add_cart_variant	2026-07-14 01:16:07.406293+00	\N
0003_unique_user_email	Migration 0003_unique_user_email	2026-07-14 01:16:07.434065+00	\N
0004_rate_limit_buckets	Migration 0004_rate_limit_buckets	2026-07-14 01:16:07.461468+00	\N
0005_coupon_discount	Migration 0005_coupon_discount	2026-07-14 01:16:07.491925+00	\N
0006_admin_audit_log_grants	Migration 0006_admin_audit_log_grants	2026-07-14 01:16:07.514334+00	\N
0007_pi_unique_pair	Migration 0007_pi_unique_pair	2026-07-14 01:16:07.540697+00	\N
0008_totp_columns	Migration 0008_totp_columns	2026-07-14 01:16:07.5652+00	\N
0009_search_backend	Migration 0009_search_backend	2026-07-14 01:16:07.5913+00	\N
0010_used_jtis	Migration 0010_used_jtis	2026-07-14 01:16:07.626474+00	\N
0011_audit_log_security_definer	Migration 0011_audit_log_security_definer	2026-07-14 01:16:07.655324+00	\N
0012_payment_tx_index_and_jti_sweeper	Migration 0012_payment_tx_index_and_jti_sweeper	2026-07-14 01:16:07.676195+00	\N
0013_inventory_log_trigger_definer	Migration 0013_inventory_log_trigger_definer	2026-07-14 01:16:07.701407+00	\N
0014_grants_critical_fix	Migration 0014_grants_critical_fix	2026-07-14 01:16:07.731896+00	\N
0015_subscriptions_unique_active	Migration 0015_subscriptions_unique_active	2026-07-14 01:16:07.783176+00	\N
0016_audit_log_retention	Migration 0016_audit_log_retention	2026-07-14 01:16:07.805584+00	\N
0017_token_version	Migration 0017_token_version	2026-07-14 01:16:07.835249+00	\N
0018_products_popular_index	Migration 0018_products_popular_index	2026-07-14 01:16:07.87221+00	\N
0019_unique_user_phone	Migration 0019_unique_user_phone	2026-07-14 01:16:07.9236+00	\N
0020_webhook_idempotency	Migration 0020_webhook_idempotency	2026-07-14 01:16:07.944598+00	\N
0021_schema_hygiene	Migration 0021_schema_hygiene	2026-07-14 01:16:07.987376+00	\N
0022_coupon_atomicity	Migration 0022_coupon_atomicity	2026-07-14 01:16:08.044412+00	\N
0023_app_settings	Migration 0023_app_settings	2026-07-14 01:16:08.065515+00	\N
0024_production_hardening	Migration 0024_production_hardening	2026-07-14 01:16:08.082587+00	\N
0025_store_counters_and_indexes	Migration 0025_store_counters_and_indexes	2026-07-14 01:16:08.13358+00	\N
0026_critical_fixes	Migration 0026_critical_fixes	2026-07-14 01:16:08.16152+00	\N
0027_integrity_constraints	Migration 0027_integrity_constraints	2026-07-14 01:16:08.218651+00	\N
0028_transactions_balance_consistency	Migration 0028_transactions_balance_consistency	2026-07-14 01:16:08.262485+00	\N
0029_orders_total_consistency	Migration 0029_orders_total_consistency	2026-07-14 01:16:08.296369+00	\N
0030_updated_at_triggers	Migration 0030_updated_at_triggers	2026-07-14 01:16:08.331327+00	\N
0031_delivery_agent_role	Migration 0031_delivery_agent_role	2026-07-14 01:16:08.359514+00	\N
0031_delivery_agent_tables	Migration 0031_delivery_agent_tables	2026-07-14 01:16:08.385261+00	\N
\.


--
-- Data for Name: search_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."search_logs" ("id", "query", "query_normalized", "result_count", "duration_ms", "user_id", "request_id", "created_at") FROM stdin;
1	honey	honey	4	11	\N	a10189ed-6345-404f-a368-6ba4257c2947	2026-07-14 01:35:06.604015+00
2	honey	honey	4	50	\N	test-req-id	2026-07-14 02:35:07.055537+00
3	honey	honey	4	36	\N	test-req-id	2026-07-14 02:35:07.132135+00
4	honey	honey	4	47	\N	test-req-id	2026-07-14 02:35:07.21329+00
5	honey	honey	4	45	\N	test-req-id	2026-07-14 02:35:07.301369+00
6	عسل	عسل	4	34	\N	test-req-id	2026-07-14 02:35:07.390637+00
7	honey	honey	0	45	\N	test-req-id	2026-07-14 02:35:07.499368+00
8	honey	honey	4	34	\N	test-req-id	2026-07-14 02:35:08.127003+00
9	honey	honey	4	92	\N	test-req-id	2026-07-14 02:37:08.677033+00
10	honey	honey	4	18	\N	test-req-id	2026-07-14 02:37:08.744126+00
11	honey	honey	4	39	\N	test-req-id	2026-07-14 02:37:08.814669+00
12	honey	honey	4	23	\N	test-req-id	2026-07-14 02:37:08.876131+00
13	عسل	عسل	4	12	\N	test-req-id	2026-07-14 02:37:08.914824+00
14	honey	honey	0	15	\N	test-req-id	2026-07-14 02:37:08.954801+00
15	honey	honey	4	6	\N	test-req-id	2026-07-14 02:37:09.157125+00
16	honey	honey	4	16	\N	test-req-id	2026-07-14 15:53:46.327089+00
17	honey	honey	4	6	\N	test-req-id	2026-07-14 15:53:46.382359+00
18	honey	honey	4	5	\N	test-req-id	2026-07-14 15:53:46.412438+00
19	honey	honey	4	10	\N	test-req-id	2026-07-14 15:53:46.451282+00
20	عسل	عسل	4	6	\N	test-req-id	2026-07-14 15:53:46.47232+00
21	honey	honey	0	7	\N	test-req-id	2026-07-14 15:53:46.502807+00
22	honey	honey	4	5	\N	test-req-id	2026-07-14 15:53:46.661036+00
23	honey	honey	4	27	\N	test-req-id	2026-07-14 15:54:20.511565+00
24	honey	honey	4	5	\N	test-req-id	2026-07-14 15:54:20.537779+00
25	honey	honey	4	8	\N	test-req-id	2026-07-14 15:54:20.556453+00
26	honey	honey	4	17	\N	test-req-id	2026-07-14 15:54:20.626196+00
27	عسل	عسل	4	4	\N	test-req-id	2026-07-14 15:54:20.657164+00
28	honey	honey	0	6	\N	test-req-id	2026-07-14 15:54:20.698534+00
29	honey	honey	4	5	\N	test-req-id	2026-07-14 15:54:20.839565+00
30	honey	honey	4	8	\N	test-req-id	2026-07-14 15:56:36.118121+00
31	honey	honey	4	9	\N	test-req-id	2026-07-14 15:56:36.156396+00
32	honey	honey	4	5	\N	test-req-id	2026-07-14 15:56:36.191788+00
33	honey	honey	4	11	\N	test-req-id	2026-07-14 15:56:36.234881+00
34	عسل	عسل	4	7	\N	test-req-id	2026-07-14 15:56:36.258831+00
35	honey	honey	0	9	\N	test-req-id	2026-07-14 15:56:36.310204+00
36	honey	honey	4	4	\N	test-req-id	2026-07-14 15:56:36.47607+00
37	honey	honey	4	9	\N	test-req-id	2026-07-14 15:57:09.750113+00
38	honey	honey	4	10	\N	test-req-id	2026-07-14 15:57:09.783473+00
39	honey	honey	4	5	\N	test-req-id	2026-07-14 15:57:09.817417+00
40	honey	honey	4	7	\N	test-req-id	2026-07-14 15:57:09.891474+00
41	عسل	عسل	4	7	\N	test-req-id	2026-07-14 15:57:09.949146+00
42	honey	honey	0	4	\N	test-req-id	2026-07-14 15:57:09.977057+00
43	honey	honey	4	4	\N	test-req-id	2026-07-14 15:57:10.13394+00
44	honey	honey	4	25	\N	test-req-id	2026-07-14 16:25:20.981727+00
45	honey	honey	4	6	\N	test-req-id	2026-07-14 16:25:21.033733+00
46	honey	honey	4	11	\N	test-req-id	2026-07-14 16:25:21.063724+00
47	honey	honey	4	7	\N	test-req-id	2026-07-14 16:25:21.109413+00
48	عسل	عسل	4	4	\N	test-req-id	2026-07-14 16:25:21.139497+00
49	honey	honey	0	9	\N	test-req-id	2026-07-14 16:25:21.256276+00
50	honey	honey	4	8	\N	test-req-id	2026-07-14 16:25:21.481231+00
51	honey	honey	4	7	\N	test-req-id	2026-07-14 16:26:45.180536+00
52	honey	honey	4	6	\N	test-req-id	2026-07-14 16:26:45.21595+00
53	honey	honey	4	4	\N	test-req-id	2026-07-14 16:26:45.261108+00
54	honey	honey	4	6	\N	test-req-id	2026-07-14 16:26:45.28285+00
55	عسل	عسل	4	7	\N	test-req-id	2026-07-14 16:26:45.310393+00
56	honey	honey	0	16	\N	test-req-id	2026-07-14 16:26:45.411753+00
57	honey	honey	4	8	\N	test-req-id	2026-07-14 16:26:45.567133+00
58	honey	honey	4	91	\N	test-req-id	2026-07-14 17:43:39.905047+00
59	honey	honey	4	55	\N	test-req-id	2026-07-14 17:43:40.023086+00
60	honey	honey	4	47	\N	test-req-id	2026-07-14 17:43:40.185724+00
61	honey	honey	4	33	\N	test-req-id	2026-07-14 17:43:40.272984+00
62	عسل	عسل	4	34	\N	test-req-id	2026-07-14 17:43:40.397893+00
63	honey	honey	0	53	\N	test-req-id	2026-07-14 17:43:40.656907+00
64	honey	honey	4	60	\N	test-req-id	2026-07-14 17:43:42.090336+00
65	honey	honey	4	52	\N	test-req-id	2026-07-14 17:44:20.365395+00
66	honey	honey	4	62	\N	test-req-id	2026-07-14 17:44:20.496062+00
67	honey	honey	4	34	\N	test-req-id	2026-07-14 17:44:20.5834+00
68	honey	honey	4	53	\N	test-req-id	2026-07-14 17:44:20.717666+00
69	عسل	عسل	4	99	\N	test-req-id	2026-07-14 17:44:20.908223+00
70	honey	honey	0	29	\N	test-req-id	2026-07-14 17:44:21.020942+00
71	honey	honey	4	71	\N	test-req-id	2026-07-14 17:44:23.298235+00
72	honey	honey	4	7	\N	test-req-id	2026-07-14 17:54:41.094131+00
73	honey	honey	4	7	\N	test-req-id	2026-07-14 17:54:41.204731+00
74	honey	honey	4	7	\N	test-req-id	2026-07-14 17:54:41.235583+00
75	honey	honey	4	10	\N	test-req-id	2026-07-14 17:54:41.31744+00
76	عسل	عسل	4	6	\N	test-req-id	2026-07-14 17:54:41.390482+00
77	honey	honey	0	11	\N	test-req-id	2026-07-14 17:54:41.456259+00
78	honey	honey	4	5	\N	test-req-id	2026-07-14 17:54:41.639451+00
79	honey	honey	4	9	\N	test-req-id	2026-07-14 17:55:19.147444+00
80	honey	honey	4	6	\N	test-req-id	2026-07-14 17:55:19.186487+00
81	honey	honey	4	9	\N	test-req-id	2026-07-14 17:55:19.234354+00
82	honey	honey	4	5	\N	test-req-id	2026-07-14 17:55:19.277067+00
83	عسل	عسل	4	17	\N	test-req-id	2026-07-14 17:55:19.355406+00
84	honey	honey	0	9	\N	test-req-id	2026-07-14 17:55:19.424705+00
85	honey	honey	4	12	\N	test-req-id	2026-07-14 17:55:19.649903+00
86	honey	honey	4	6	\N	test-req-id	2026-07-14 18:47:17.711355+00
87	honey	honey	4	6	\N	test-req-id	2026-07-14 18:47:17.745441+00
88	honey	honey	4	7	\N	test-req-id	2026-07-14 18:47:17.769941+00
89	honey	honey	4	6	\N	test-req-id	2026-07-14 18:47:17.791702+00
90	عسل	عسل	4	7	\N	test-req-id	2026-07-14 18:47:17.824267+00
91	honey	honey	0	7	\N	test-req-id	2026-07-14 18:47:17.862137+00
92	honey	honey	4	4	\N	test-req-id	2026-07-14 18:47:18.019784+00
93	honey	honey	4	12	\N	test-req-id	2026-07-14 18:47:45.104919+00
94	honey	honey	4	5	\N	test-req-id	2026-07-14 18:47:45.134661+00
95	honey	honey	4	8	\N	test-req-id	2026-07-14 18:47:45.160174+00
96	honey	honey	4	9	\N	test-req-id	2026-07-14 18:47:45.18999+00
97	عسل	عسل	4	6	\N	test-req-id	2026-07-14 18:47:45.234635+00
98	honey	honey	0	5	\N	test-req-id	2026-07-14 18:47:45.253906+00
99	honey	honey	4	7	\N	test-req-id	2026-07-14 18:47:45.415772+00
100	honey	honey	4	15	\N	test-req-id	2026-07-14 22:50:59.543534+00
101	honey	honey	4	5	\N	test-req-id	2026-07-14 22:50:59.560732+00
102	honey	honey	4	4	\N	test-req-id	2026-07-14 22:50:59.575775+00
103	honey	honey	4	3	\N	test-req-id	2026-07-14 22:50:59.587425+00
104	عسل	عسل	4	4	\N	test-req-id	2026-07-14 22:50:59.602193+00
105	honey	honey	0	4	\N	test-req-id	2026-07-14 22:50:59.617222+00
106	honey	honey	4	7	\N	test-req-id	2026-07-14 22:50:59.708807+00
107	honey	honey	4	30	\N	test-req-id	2026-07-14 23:24:09.411037+00
108	honey	honey	4	16	\N	test-req-id	2026-07-14 23:24:09.452937+00
109	honey	honey	4	19	\N	test-req-id	2026-07-14 23:24:09.491374+00
110	honey	honey	4	14	\N	test-req-id	2026-07-14 23:24:09.521374+00
111	عسل	عسل	4	16	\N	test-req-id	2026-07-14 23:24:09.558505+00
112	honey	honey	0	12	\N	test-req-id	2026-07-14 23:24:09.5916+00
113	honey	honey	4	14	\N	test-req-id	2026-07-14 23:24:09.759714+00
114	honey	honey	4	25	\N	test-req-id	2026-07-15 01:37:30.245277+00
115	honey	honey	4	6	\N	test-req-id	2026-07-15 01:37:30.329946+00
116	honey	honey	4	10	\N	test-req-id	2026-07-15 01:37:30.377361+00
117	honey	honey	4	5	\N	test-req-id	2026-07-15 01:37:30.446305+00
118	عسل	عسل	4	6	\N	test-req-id	2026-07-15 01:37:30.465183+00
119	honey	honey	0	8	\N	test-req-id	2026-07-15 01:37:30.492963+00
120	honey	honey	4	6	\N	test-req-id	2026-07-15 01:37:30.67397+00
121	honey	honey	4	8	\N	test-req-id	2026-07-15 01:39:32.330594+00
122	honey	honey	4	9	\N	test-req-id	2026-07-15 01:39:32.371162+00
123	honey	honey	4	5	\N	test-req-id	2026-07-15 01:39:32.433527+00
124	honey	honey	4	7	\N	test-req-id	2026-07-15 01:39:32.463536+00
125	عسل	عسل	4	8	\N	test-req-id	2026-07-15 01:39:32.503571+00
126	honey	honey	0	4	\N	test-req-id	2026-07-15 01:39:32.557696+00
127	honey	honey	4	4	\N	test-req-id	2026-07-15 01:39:32.731574+00
128	honey	honey	4	6	\N	test-req-id	2026-07-15 01:39:47.550717+00
129	honey	honey	4	5	\N	test-req-id	2026-07-15 01:39:47.602066+00
130	honey	honey	4	6	\N	test-req-id	2026-07-15 01:39:47.634372+00
131	honey	honey	4	6	\N	test-req-id	2026-07-15 01:39:47.66529+00
132	عسل	عسل	4	4	\N	test-req-id	2026-07-15 01:39:47.70363+00
133	honey	honey	0	5	\N	test-req-id	2026-07-15 01:39:47.768132+00
134	honey	honey	4	8	\N	test-req-id	2026-07-15 01:39:48.027788+00
135	honey	honey	4	6	\N	test-req-id	2026-07-15 01:43:45.494682+00
136	honey	honey	4	11	\N	test-req-id	2026-07-15 01:43:45.540978+00
137	honey	honey	4	8	\N	test-req-id	2026-07-15 01:43:45.574602+00
138	honey	honey	4	7	\N	test-req-id	2026-07-15 01:43:45.598457+00
139	عسل	عسل	4	11	\N	test-req-id	2026-07-15 01:43:45.637892+00
140	honey	honey	0	6	\N	test-req-id	2026-07-15 01:43:45.695713+00
141	honey	honey	4	9	\N	test-req-id	2026-07-15 01:43:45.859546+00
142	honey	honey	4	7	\N	test-req-id	2026-07-15 02:01:17.575947+00
143	honey	honey	4	5	\N	test-req-id	2026-07-15 02:01:17.620509+00
144	honey	honey	4	7	\N	test-req-id	2026-07-15 02:01:17.713064+00
145	honey	honey	4	6	\N	test-req-id	2026-07-15 02:01:17.742611+00
146	عسل	عسل	4	8	\N	test-req-id	2026-07-15 02:01:17.779777+00
147	honey	honey	0	5	\N	test-req-id	2026-07-15 02:01:17.805653+00
148	honey	honey	4	5	\N	test-req-id	2026-07-15 02:01:17.983748+00
149	honey	honey	4	10	\N	test-req-id	2026-07-15 02:10:43.176025+00
150	honey	honey	4	12	\N	test-req-id	2026-07-15 02:10:43.210137+00
151	honey	honey	4	9	\N	test-req-id	2026-07-15 02:10:43.26064+00
152	honey	honey	4	5	\N	test-req-id	2026-07-15 02:10:43.29785+00
153	عسل	عسل	4	8	\N	test-req-id	2026-07-15 02:10:43.340762+00
154	honey	honey	0	9	\N	test-req-id	2026-07-15 02:10:43.374376+00
155	honey	honey	4	6	\N	test-req-id	2026-07-15 02:10:43.546489+00
156	honey	honey	4	27	\N	test-req-id	2026-07-15 03:52:13.799051+00
157	honey	honey	4	9	\N	test-req-id	2026-07-15 03:52:13.965005+00
158	honey	honey	4	19	\N	test-req-id	2026-07-15 03:52:14.06248+00
159	honey	honey	4	11	\N	test-req-id	2026-07-15 03:52:14.099317+00
160	عسل	عسل	4	27	\N	test-req-id	2026-07-15 03:52:14.149462+00
161	honey	honey	0	15	\N	test-req-id	2026-07-15 03:52:14.207878+00
162	honey	honey	4	9	\N	test-req-id	2026-07-15 03:52:14.446602+00
163	honey	honey	4	8	\N	test-req-id	2026-07-15 03:59:11.603452+00
164	honey	honey	4	5	\N	test-req-id	2026-07-15 03:59:11.638977+00
165	honey	honey	4	6	\N	test-req-id	2026-07-15 03:59:11.675025+00
166	honey	honey	4	5	\N	test-req-id	2026-07-15 03:59:11.747436+00
167	عسل	عسل	4	5	\N	test-req-id	2026-07-15 03:59:11.76853+00
168	honey	honey	0	7	\N	test-req-id	2026-07-15 03:59:11.804016+00
169	honey	honey	4	4	\N	test-req-id	2026-07-15 03:59:11.953993+00
170	honey	honey	4	99	\N	test-req-id	2026-07-15 04:39:19.92262+00
171	honey	honey	4	173	\N	test-req-id	2026-07-15 04:39:20.167763+00
172	honey	honey	4	100	\N	test-req-id	2026-07-15 04:39:20.349796+00
173	honey	honey	4	24	\N	test-req-id	2026-07-15 04:39:20.455941+00
174	عسل	عسل	4	62	\N	test-req-id	2026-07-15 04:39:20.569279+00
175	honey	honey	0	58	\N	test-req-id	2026-07-15 04:39:20.761508+00
176	honey	honey	4	26	\N	test-req-id	2026-07-15 04:39:21.233933+00
177	honey	honey	4	66	\N	test-req-id	2026-07-15 04:46:50.075687+00
178	honey	honey	4	53	\N	test-req-id	2026-07-15 04:46:50.220971+00
179	honey	honey	4	87	\N	test-req-id	2026-07-15 04:46:50.395494+00
180	honey	honey	4	56	\N	test-req-id	2026-07-15 04:46:50.498321+00
181	عسل	عسل	4	24	\N	test-req-id	2026-07-15 04:46:50.566346+00
182	honey	honey	0	60	\N	test-req-id	2026-07-15 04:46:50.688309+00
183	honey	honey	4	20	\N	test-req-id	2026-07-15 04:46:51.282228+00
184	honey	honey	4	77	\N	test-req-id	2026-07-15 15:17:31.516103+00
185	honey	honey	4	63	\N	test-req-id	2026-07-15 15:17:31.695685+00
186	honey	honey	4	181	\N	test-req-id	2026-07-15 15:17:32.061298+00
187	honey	honey	4	115	\N	test-req-id	2026-07-15 15:17:32.255235+00
188	عسل	عسل	4	141	\N	test-req-id	2026-07-15 15:17:32.5708+00
189	honey	honey	0	33	\N	test-req-id	2026-07-15 15:17:32.731135+00
190	honey	honey	4	26	\N	test-req-id	2026-07-15 15:17:33.747775+00
191	honey	honey	4	45	\N	test-req-id	2026-07-15 15:17:51.04431+00
192	honey	honey	4	175	\N	test-req-id	2026-07-15 15:17:51.370921+00
193	honey	honey	4	120	\N	test-req-id	2026-07-15 15:17:51.579032+00
194	honey	honey	4	126	\N	test-req-id	2026-07-15 15:17:51.79284+00
195	عسل	عسل	4	53	\N	test-req-id	2026-07-15 15:17:51.888301+00
196	honey	honey	0	70	\N	test-req-id	2026-07-15 15:17:52.059552+00
197	honey	honey	4	22	\N	test-req-id	2026-07-15 15:17:52.891373+00
198	honey	honey	4	171	\N	test-req-id	2026-07-15 15:40:24.322219+00
199	honey	honey	4	156	\N	test-req-id	2026-07-15 15:40:24.617634+00
200	honey	honey	4	125	\N	test-req-id	2026-07-15 15:40:24.921327+00
201	honey	honey	4	67	\N	test-req-id	2026-07-15 15:40:25.14465+00
202	عسل	عسل	4	114	\N	test-req-id	2026-07-15 15:40:25.355627+00
203	honey	honey	0	75	\N	test-req-id	2026-07-15 15:40:25.616398+00
204	honey	honey	4	17	\N	test-req-id	2026-07-15 15:40:26.750804+00
205	honey	honey	4	75	\N	test-req-id	2026-07-15 15:54:17.703612+00
206	honey	honey	4	2158	\N	test-req-id	2026-07-15 15:54:20.372238+00
207	honey	honey	4	45	\N	test-req-id	2026-07-15 15:54:20.516538+00
208	honey	honey	4	55	\N	test-req-id	2026-07-15 15:54:20.651746+00
209	عسل	عسل	4	659	\N	test-req-id	2026-07-15 15:54:21.385821+00
210	honey	honey	0	52	\N	test-req-id	2026-07-15 15:54:21.567174+00
211	honey	honey	4	7	\N	test-req-id	2026-07-15 15:54:22.066612+00
212	honey	honey	4	11	\N	46b51561-ed36-43e7-b753-744ceb6e4596	2026-07-15 16:01:08.834745+00
213	coffee	coffee	5	11	\N	0cd7a431-5bab-465c-996e-2fd1e95ab81d	2026-07-15 16:12:48.106916+00
214	honey	honey	4	104	\N	test-req-id	2026-07-15 16:17:07.207383+00
215	honey	honey	4	136	\N	test-req-id	2026-07-15 16:17:07.452901+00
216	honey	honey	4	56	\N	test-req-id	2026-07-15 16:17:07.632598+00
217	honey	honey	4	134	\N	test-req-id	2026-07-15 16:17:08.043712+00
218	عسل	عسل	4	146	\N	test-req-id	2026-07-15 16:17:08.317302+00
219	honey	honey	0	38	\N	test-req-id	2026-07-15 16:17:08.406065+00
220	honey	honey	4	42	\N	test-req-id	2026-07-15 16:17:09.399768+00
221	<script>alert(1)</script>	<script>alert(1)</script>	0	14	\N	501b3fcc-7089-4b46-84b0-b390845b88ed	2026-07-15 16:20:07.84144+00
222	' OR 1=1 --	' or 1=1 --	0	9	\N	0fb02d85-0422-4997-8f32-725384868b94	2026-07-15 16:20:08.023037+00
223	honey	honey	4	10	\N	ea3b49fd-114c-44e9-a215-2928b128458a	2026-07-15 16:21:20.013368+00
224	honey	honey	4	11	\N	c1570471-f300-447c-a137-14c435ba7375	2026-07-15 16:55:39.984029+00
225	coffee	coffee	5	10	\N	54972fb0-5d65-49f3-a8db-a67551ae8a9c	2026-07-15 16:58:29.391177+00
226	honey	honey	4	143	\N	test-req-id	2026-07-15 17:07:00.172496+00
227	honey	honey	4	192	\N	test-req-id	2026-07-15 17:07:00.513685+00
228	honey	honey	4	57	\N	test-req-id	2026-07-15 17:07:01.014347+00
229	honey	honey	4	70	\N	test-req-id	2026-07-15 17:07:01.345147+00
230	عسل	عسل	4	266	\N	test-req-id	2026-07-15 17:07:01.754391+00
231	honey	honey	0	157	\N	test-req-id	2026-07-15 17:07:01.965737+00
232	honey	honey	4	34	\N	test-req-id	2026-07-15 17:07:02.977127+00
233	honey	honey	4	18	\N	test-req-id	2026-07-15 18:21:59.455389+00
234	honey	honey	4	6	\N	test-req-id	2026-07-15 18:21:59.50302+00
235	honey	honey	4	5	\N	test-req-id	2026-07-15 18:21:59.522988+00
236	honey	honey	4	6	\N	test-req-id	2026-07-15 18:21:59.55832+00
237	عسل	عسل	4	6	\N	test-req-id	2026-07-15 18:21:59.583766+00
238	honey	honey	0	6	\N	test-req-id	2026-07-15 18:21:59.606208+00
239	honey	honey	4	5	\N	test-req-id	2026-07-15 18:21:59.73755+00
240	honey	honey	4	31	\N	test-req-id	2026-07-15 21:55:23.668936+00
241	honey	honey	4	6	\N	test-req-id	2026-07-15 21:55:23.712826+00
242	honey	honey	4	10	\N	test-req-id	2026-07-15 21:55:23.744371+00
243	honey	honey	4	14	\N	test-req-id	2026-07-15 21:55:23.777123+00
244	عسل	عسل	4	6	\N	test-req-id	2026-07-15 21:55:23.829498+00
245	honey	honey	0	4	\N	test-req-id	2026-07-15 21:55:23.874373+00
246	honey	honey	4	5	\N	test-req-id	2026-07-15 21:55:24.098427+00
247	honey	honey	4	7	\N	test-req-id	2026-07-15 22:31:18.491223+00
248	honey	honey	4	4	\N	test-req-id	2026-07-15 22:31:18.521168+00
249	honey	honey	4	3	\N	test-req-id	2026-07-15 22:31:18.532456+00
250	honey	honey	4	5	\N	test-req-id	2026-07-15 22:31:18.546615+00
251	عسل	عسل	4	3	\N	test-req-id	2026-07-15 22:31:18.558976+00
252	honey	honey	0	5	\N	test-req-id	2026-07-15 22:31:18.574122+00
253	honey	honey	4	4	\N	test-req-id	2026-07-15 22:31:18.706266+00
254	honey	honey	4	11	\N	test-req-id	2026-07-15 22:31:37.126954+00
255	honey	honey	4	16	\N	test-req-id	2026-07-15 22:31:37.180127+00
256	honey	honey	4	18	\N	test-req-id	2026-07-15 22:31:37.216164+00
257	honey	honey	4	7	\N	test-req-id	2026-07-15 22:31:37.247188+00
258	عسل	عسل	4	8	\N	test-req-id	2026-07-15 22:31:37.277053+00
259	honey	honey	0	16	\N	test-req-id	2026-07-15 22:31:37.313826+00
260	honey	honey	4	36	\N	test-req-id	2026-07-15 22:31:37.730943+00
261	honey	honey	4	17	\N	test-req-id	2026-07-15 22:31:56.32637+00
262	honey	honey	4	8	\N	test-req-id	2026-07-15 22:31:56.374828+00
263	honey	honey	4	11	\N	test-req-id	2026-07-15 22:31:56.399802+00
264	honey	honey	4	24	\N	test-req-id	2026-07-15 22:31:56.441044+00
265	عسل	عسل	4	22	\N	test-req-id	2026-07-15 22:31:56.488242+00
266	honey	honey	0	24	\N	test-req-id	2026-07-15 22:31:56.559105+00
267	honey	honey	4	28	\N	test-req-id	2026-07-15 22:31:56.884441+00
268	honey	honey	4	16	\N	test-req-id	2026-07-15 22:32:11.223137+00
269	honey	honey	4	11	\N	test-req-id	2026-07-15 22:32:11.266321+00
270	honey	honey	4	9	\N	test-req-id	2026-07-15 22:32:11.29907+00
271	honey	honey	4	33	\N	test-req-id	2026-07-15 22:32:11.353717+00
272	عسل	عسل	4	7	\N	test-req-id	2026-07-15 22:32:11.4014+00
273	honey	honey	0	11	\N	test-req-id	2026-07-15 22:32:11.432371+00
274	honey	honey	4	10	\N	test-req-id	2026-07-15 22:32:11.785957+00
275	honey	honey	4	15	\N	test-req-id	2026-07-15 22:32:38.758985+00
276	honey	honey	4	11	\N	test-req-id	2026-07-15 22:32:38.793919+00
277	honey	honey	4	5	\N	test-req-id	2026-07-15 22:32:38.816839+00
278	honey	honey	4	6	\N	test-req-id	2026-07-15 22:32:38.841153+00
279	عسل	عسل	4	11	\N	test-req-id	2026-07-15 22:32:38.874353+00
280	honey	honey	0	15	\N	test-req-id	2026-07-15 22:32:38.926688+00
281	honey	honey	4	10	\N	test-req-id	2026-07-15 22:32:39.139444+00
282	honey	honey	4	12	\N	test-req-id	2026-07-15 22:33:00.936149+00
283	honey	honey	4	20	\N	test-req-id	2026-07-15 22:33:00.974901+00
284	honey	honey	4	22	\N	test-req-id	2026-07-15 22:33:01.02814+00
285	honey	honey	4	7	\N	test-req-id	2026-07-15 22:33:01.047482+00
286	عسل	عسل	4	8	\N	test-req-id	2026-07-15 22:33:01.075598+00
287	honey	honey	0	15	\N	test-req-id	2026-07-15 22:33:01.130287+00
288	honey	honey	4	11	\N	test-req-id	2026-07-15 22:33:01.377259+00
289	honey	honey	4	14	\N	test-req-id	2026-07-15 22:34:06.571785+00
290	honey	honey	4	13	\N	test-req-id	2026-07-15 22:34:06.610901+00
291	honey	honey	4	11	\N	test-req-id	2026-07-15 22:34:06.641913+00
292	honey	honey	4	20	\N	test-req-id	2026-07-15 22:34:06.677741+00
293	عسل	عسل	4	14	\N	test-req-id	2026-07-15 22:34:06.725999+00
294	honey	honey	0	12	\N	test-req-id	2026-07-15 22:34:06.780866+00
295	honey	honey	4	6	\N	test-req-id	2026-07-15 22:34:07.005062+00
296	honey	honey	4	8	\N	test-req-id	2026-07-15 22:34:31.34879+00
297	honey	honey	4	8	\N	test-req-id	2026-07-15 22:34:31.371938+00
298	honey	honey	4	18	\N	test-req-id	2026-07-15 22:34:31.402455+00
299	honey	honey	4	6	\N	test-req-id	2026-07-15 22:34:31.452429+00
300	عسل	عسل	4	25	\N	test-req-id	2026-07-15 22:34:31.500979+00
301	honey	honey	0	25	\N	test-req-id	2026-07-15 22:34:31.545845+00
302	honey	honey	4	18	\N	test-req-id	2026-07-15 22:34:31.892291+00
303	honey	honey	4	21	\N	test-req-id	2026-07-15 22:34:55.344439+00
304	honey	honey	4	21	\N	test-req-id	2026-07-15 22:34:55.433015+00
305	honey	honey	4	16	\N	test-req-id	2026-07-15 22:34:55.477102+00
306	honey	honey	4	12	\N	test-req-id	2026-07-15 22:34:55.536229+00
307	عسل	عسل	4	20	\N	test-req-id	2026-07-15 22:34:55.579007+00
308	honey	honey	0	14	\N	test-req-id	2026-07-15 22:34:55.636741+00
309	honey	honey	4	14	\N	test-req-id	2026-07-15 22:34:55.959061+00
310	honey	honey	4	9	\N	test-req-id	2026-07-15 22:35:12.492669+00
311	honey	honey	4	13	\N	test-req-id	2026-07-15 22:35:12.559403+00
312	honey	honey	4	5	\N	test-req-id	2026-07-15 22:35:12.593187+00
313	honey	honey	4	13	\N	test-req-id	2026-07-15 22:35:12.629396+00
314	عسل	عسل	4	9	\N	test-req-id	2026-07-15 22:35:12.664999+00
315	honey	honey	0	26	\N	test-req-id	2026-07-15 22:35:12.711472+00
316	honey	honey	4	13	\N	test-req-id	2026-07-15 22:35:13.026713+00
317	honey	honey	4	41	\N	test-req-id	2026-07-15 22:44:05.503405+00
318	honey	honey	4	23	\N	test-req-id	2026-07-15 22:44:05.584732+00
319	honey	honey	4	18	\N	test-req-id	2026-07-15 22:44:05.623234+00
320	honey	honey	4	44	\N	test-req-id	2026-07-15 22:44:05.70237+00
321	عسل	عسل	4	28	\N	test-req-id	2026-07-15 22:44:05.774929+00
322	honey	honey	0	51	\N	test-req-id	2026-07-15 22:44:05.878937+00
323	honey	honey	4	18	\N	test-req-id	2026-07-15 22:44:06.371587+00
324	honey	honey	4	45	\N	test-req-id	2026-07-15 22:55:21.420577+00
325	honey	honey	4	15	\N	test-req-id	2026-07-15 22:55:21.500134+00
326	honey	honey	4	8	\N	test-req-id	2026-07-15 22:55:21.6202+00
327	honey	honey	4	15	\N	test-req-id	2026-07-15 22:55:21.70973+00
328	عسل	عسل	4	36	\N	test-req-id	2026-07-15 22:55:21.830137+00
329	honey	honey	0	41	\N	test-req-id	2026-07-15 22:55:21.918829+00
330	honey	honey	4	39	\N	test-req-id	2026-07-15 22:55:22.687829+00
331	honey	honey	4	52	\N	test-req-id	2026-07-15 22:56:46.685297+00
332	honey	honey	4	18	\N	test-req-id	2026-07-15 22:56:46.77074+00
333	honey	honey	4	17	\N	test-req-id	2026-07-15 22:56:46.871427+00
334	honey	honey	4	14	\N	test-req-id	2026-07-15 22:56:46.915869+00
335	عسل	عسل	4	58	\N	test-req-id	2026-07-15 22:56:47.064909+00
336	honey	honey	0	32	\N	test-req-id	2026-07-15 22:56:47.191523+00
337	honey	honey	4	33	\N	test-req-id	2026-07-15 22:56:48.313228+00
338	honey	honey	4	49	\N	test-req-id	2026-07-15 22:57:48.807258+00
339	honey	honey	4	30	\N	test-req-id	2026-07-15 22:57:48.947666+00
340	honey	honey	4	35	\N	test-req-id	2026-07-15 22:57:49.020774+00
341	honey	honey	4	42	\N	test-req-id	2026-07-15 22:57:49.115849+00
342	عسل	عسل	4	135	\N	test-req-id	2026-07-15 22:57:49.323641+00
343	honey	honey	0	47	\N	test-req-id	2026-07-15 22:57:49.495171+00
344	honey	honey	4	90	\N	test-req-id	2026-07-15 22:57:50.79439+00
345	honey	honey	4	50	\N	test-req-id	2026-07-15 22:58:01.756362+00
346	honey	honey	4	45	\N	test-req-id	2026-07-15 22:58:01.875605+00
347	honey	honey	4	37	\N	test-req-id	2026-07-15 22:58:02.106872+00
348	honey	honey	4	61	\N	test-req-id	2026-07-15 22:58:02.241611+00
349	عسل	عسل	4	44	\N	test-req-id	2026-07-15 22:58:02.36276+00
350	honey	honey	0	33	\N	test-req-id	2026-07-15 22:58:02.483492+00
351	honey	honey	4	38	\N	test-req-id	2026-07-15 22:58:03.467283+00
352	honey	honey	4	21	\N	test-req-id	2026-07-15 22:58:12.539048+00
353	honey	honey	4	49	\N	test-req-id	2026-07-15 22:58:12.627896+00
354	honey	honey	4	24	\N	test-req-id	2026-07-15 22:58:12.714887+00
355	honey	honey	4	6	\N	test-req-id	2026-07-15 22:58:12.769209+00
356	عسل	عسل	4	18	\N	test-req-id	2026-07-15 22:58:12.826305+00
357	honey	honey	0	39	\N	test-req-id	2026-07-15 22:58:12.931487+00
358	honey	honey	4	14	\N	test-req-id	2026-07-15 22:58:13.561374+00
359	honey	honey	4	69	\N	test-req-id	2026-07-15 22:58:33.555003+00
360	honey	honey	4	119	\N	test-req-id	2026-07-15 22:58:33.766818+00
361	honey	honey	4	103	\N	test-req-id	2026-07-15 22:58:33.954661+00
362	honey	honey	4	73	\N	test-req-id	2026-07-15 22:58:34.163218+00
363	عسل	عسل	4	46	\N	test-req-id	2026-07-15 22:58:34.292449+00
364	honey	honey	0	28	\N	test-req-id	2026-07-15 22:58:34.42495+00
365	honey	honey	4	41	\N	test-req-id	2026-07-15 22:58:35.167344+00
366	honey	honey	4	35	\N	test-req-id	2026-07-15 22:58:53.593507+00
367	honey	honey	4	63	\N	test-req-id	2026-07-15 22:58:53.736905+00
368	honey	honey	4	15	\N	test-req-id	2026-07-15 22:58:53.806055+00
369	honey	honey	4	72	\N	test-req-id	2026-07-15 22:58:54.038912+00
370	عسل	عسل	4	29	\N	test-req-id	2026-07-15 22:58:54.189283+00
371	honey	honey	0	75	\N	test-req-id	2026-07-15 22:58:54.360493+00
372	honey	honey	4	48	\N	test-req-id	2026-07-15 22:58:55.405241+00
373	honey	honey	4	68	\N	test-req-id	2026-07-15 22:59:14.980926+00
374	honey	honey	4	28	\N	test-req-id	2026-07-15 22:59:15.069104+00
375	honey	honey	4	82	\N	test-req-id	2026-07-15 22:59:15.234841+00
376	honey	honey	4	12	\N	test-req-id	2026-07-15 22:59:15.284097+00
377	عسل	عسل	4	67	\N	test-req-id	2026-07-15 22:59:15.471631+00
378	honey	honey	0	25	\N	test-req-id	2026-07-15 22:59:15.543887+00
379	honey	honey	4	43	\N	test-req-id	2026-07-15 22:59:16.461095+00
380	honey	honey	4	20	\N	test-req-id	2026-07-15 23:50:34.70221+00
381	honey	honey	4	27	\N	test-req-id	2026-07-15 23:50:34.722329+00
382	honey	honey	4	5	\N	test-req-id	2026-07-15 23:50:34.736951+00
383	honey	honey	4	5	\N	test-req-id	2026-07-15 23:50:34.751501+00
384	عسل	عسل	4	3	\N	test-req-id	2026-07-15 23:50:34.764551+00
385	honey	honey	0	5	\N	test-req-id	2026-07-15 23:50:34.779144+00
386	honey	honey	4	4	\N	test-req-id	2026-07-15 23:50:34.869547+00
387	honey	honey	4	82	\N	test-req-id	2026-07-15 23:51:09.849464+00
388	honey	honey	4	35	\N	test-req-id	2026-07-15 23:51:09.951438+00
389	honey	honey	4	27	\N	test-req-id	2026-07-15 23:51:10.039029+00
390	honey	honey	4	57	\N	test-req-id	2026-07-15 23:51:10.178179+00
391	عسل	عسل	4	57	\N	test-req-id	2026-07-15 23:51:10.348985+00
392	honey	honey	0	71	\N	test-req-id	2026-07-15 23:51:10.456229+00
393	honey	honey	4	31	\N	test-req-id	2026-07-15 23:51:11.323871+00
394	honey	honey	4	56	\N	test-req-id	2026-07-15 23:51:35.502318+00
395	honey	honey	4	64	\N	test-req-id	2026-07-15 23:51:35.644293+00
396	honey	honey	4	10	\N	test-req-id	2026-07-15 23:51:35.734007+00
397	honey	honey	4	26	\N	test-req-id	2026-07-15 23:51:35.816224+00
398	عسل	عسل	4	40	\N	test-req-id	2026-07-15 23:51:35.922677+00
399	honey	honey	0	20	\N	test-req-id	2026-07-15 23:51:36.003356+00
400	honey	honey	4	36	\N	test-req-id	2026-07-15 23:51:36.768046+00
401	honey	honey	4	7	\N	test-req-id	2026-07-15 23:52:02.725899+00
402	honey	honey	4	5	\N	test-req-id	2026-07-15 23:52:02.751258+00
403	honey	honey	4	6	\N	test-req-id	2026-07-15 23:52:02.771356+00
404	honey	honey	4	7	\N	test-req-id	2026-07-15 23:52:02.791884+00
405	عسل	عسل	4	5	\N	test-req-id	2026-07-15 23:52:02.807552+00
406	honey	honey	0	6	\N	test-req-id	2026-07-15 23:52:02.827692+00
407	honey	honey	4	5	\N	test-req-id	2026-07-15 23:52:02.978057+00
408	honey	honey	4	45	\N	test-req-id	2026-07-15 23:52:21.484929+00
409	honey	honey	4	39	\N	test-req-id	2026-07-15 23:52:21.630736+00
410	honey	honey	4	18	\N	test-req-id	2026-07-15 23:52:21.68714+00
411	honey	honey	4	31	\N	test-req-id	2026-07-15 23:52:21.762632+00
412	عسل	عسل	4	10	\N	test-req-id	2026-07-15 23:52:21.828295+00
413	honey	honey	0	33	\N	test-req-id	2026-07-15 23:52:21.921993+00
414	honey	honey	4	23	\N	test-req-id	2026-07-15 23:52:22.615633+00
415	honey	honey	4	60	\N	test-req-id	2026-07-15 23:52:42.094678+00
416	honey	honey	4	27	\N	test-req-id	2026-07-15 23:52:42.226008+00
417	honey	honey	4	27	\N	test-req-id	2026-07-15 23:52:42.333649+00
418	honey	honey	4	60	\N	test-req-id	2026-07-15 23:52:42.495343+00
419	عسل	عسل	4	38	\N	test-req-id	2026-07-15 23:52:42.648729+00
420	honey	honey	0	21	\N	test-req-id	2026-07-15 23:52:42.751334+00
421	honey	honey	4	109	\N	test-req-id	2026-07-15 23:52:43.550332+00
422	honey	honey	4	63	\N	test-req-id	2026-07-15 23:53:05.801615+00
423	honey	honey	4	10	\N	test-req-id	2026-07-15 23:53:05.87351+00
424	honey	honey	4	39	\N	test-req-id	2026-07-15 23:53:06.002205+00
425	honey	honey	4	52	\N	test-req-id	2026-07-15 23:53:06.125292+00
426	عسل	عسل	4	45	\N	test-req-id	2026-07-15 23:53:06.250239+00
427	honey	honey	0	67	\N	test-req-id	2026-07-15 23:53:06.389538+00
428	honey	honey	4	26	\N	test-req-id	2026-07-15 23:53:07.084726+00
429	honey	honey	4	22	\N	test-req-id	2026-07-15 23:54:11.734831+00
430	honey	honey	4	21	\N	test-req-id	2026-07-15 23:54:11.814534+00
431	honey	honey	4	30	\N	test-req-id	2026-07-15 23:54:11.912501+00
432	honey	honey	4	53	\N	test-req-id	2026-07-15 23:54:12.036159+00
433	عسل	عسل	4	29	\N	test-req-id	2026-07-15 23:54:12.335045+00
434	honey	honey	0	30	\N	test-req-id	2026-07-15 23:54:12.42843+00
435	honey	honey	4	27	\N	test-req-id	2026-07-15 23:54:13.771074+00
436	honey	honey	4	86	\N	test-req-id	2026-07-16 00:18:13.124071+00
437	honey	honey	4	74	\N	test-req-id	2026-07-16 00:18:13.304968+00
438	honey	honey	4	36	\N	test-req-id	2026-07-16 00:18:13.546433+00
439	honey	honey	4	36	\N	test-req-id	2026-07-16 00:18:13.658232+00
440	عسل	عسل	4	58	\N	test-req-id	2026-07-16 00:18:13.854962+00
441	honey	honey	0	36	\N	test-req-id	2026-07-16 00:18:14.024574+00
442	honey	honey	4	48	\N	test-req-id	2026-07-16 00:18:14.737691+00
443	honey	honey	4	71	\N	test-req-id	2026-07-16 00:21:36.078092+00
444	honey	honey	4	21	\N	test-req-id	2026-07-16 00:21:36.176106+00
445	honey	honey	4	80	\N	test-req-id	2026-07-16 00:21:36.303543+00
446	honey	honey	4	95	\N	test-req-id	2026-07-16 00:21:36.452977+00
447	عسل	عسل	4	27	\N	test-req-id	2026-07-16 00:21:36.594755+00
448	honey	honey	0	23	\N	test-req-id	2026-07-16 00:21:36.663964+00
449	honey	honey	4	31	\N	test-req-id	2026-07-16 00:21:37.710705+00
450	honey	honey	4	91	\N	test-req-id	2026-07-16 00:22:41.064106+00
451	honey	honey	4	12	\N	test-req-id	2026-07-16 00:22:41.305992+00
452	honey	honey	4	52	\N	test-req-id	2026-07-16 00:22:41.453804+00
453	honey	honey	4	26	\N	test-req-id	2026-07-16 00:22:41.563692+00
454	عسل	عسل	4	13	\N	test-req-id	2026-07-16 00:22:41.634125+00
455	honey	honey	0	16	\N	test-req-id	2026-07-16 00:22:41.728524+00
456	honey	honey	4	13	\N	test-req-id	2026-07-16 00:22:42.541811+00
457	honey	honey	4	28	\N	test-req-id	2026-07-16 00:25:22.362803+00
458	honey	honey	4	25	\N	test-req-id	2026-07-16 00:25:22.504505+00
459	honey	honey	4	17	\N	test-req-id	2026-07-16 00:25:22.592182+00
460	honey	honey	4	62	\N	test-req-id	2026-07-16 00:25:22.69808+00
461	عسل	عسل	4	22	\N	test-req-id	2026-07-16 00:25:22.76281+00
462	honey	honey	0	126	\N	test-req-id	2026-07-16 00:25:23.033804+00
463	honey	honey	4	18	\N	test-req-id	2026-07-16 00:25:24.173729+00
464	honey	honey	4	102	\N	test-req-id	2026-07-16 00:29:11.909361+00
465	honey	honey	4	6	\N	test-req-id	2026-07-16 00:29:11.952338+00
466	honey	honey	4	25	\N	test-req-id	2026-07-16 00:29:12.032131+00
467	honey	honey	4	23	\N	test-req-id	2026-07-16 00:29:12.113952+00
468	عسل	عسل	4	88	\N	test-req-id	2026-07-16 00:29:12.260335+00
469	honey	honey	0	28	\N	test-req-id	2026-07-16 00:29:12.378928+00
470	honey	honey	4	60	\N	test-req-id	2026-07-16 00:29:13.122981+00
471	honey	honey	4	37	\N	test-req-id	2026-07-16 00:40:28.791025+00
472	honey	honey	4	20	\N	test-req-id	2026-07-16 00:40:28.922969+00
473	honey	honey	4	29	\N	test-req-id	2026-07-16 00:40:29.034096+00
474	honey	honey	4	12	\N	test-req-id	2026-07-16 00:40:29.103802+00
475	عسل	عسل	4	91	\N	test-req-id	2026-07-16 00:40:29.318657+00
476	honey	honey	0	78	\N	test-req-id	2026-07-16 00:40:29.472571+00
477	honey	honey	4	58	\N	test-req-id	2026-07-16 00:40:30.274486+00
478	honey	honey	4	45	\N	test-req-id	2026-07-16 00:41:52.638308+00
479	honey	honey	4	17	\N	test-req-id	2026-07-16 00:41:52.752032+00
480	honey	honey	4	32	\N	test-req-id	2026-07-16 00:41:52.835723+00
481	honey	honey	4	13	\N	test-req-id	2026-07-16 00:41:52.898569+00
482	عسل	عسل	4	32	\N	test-req-id	2026-07-16 00:41:53.01772+00
483	honey	honey	0	7	\N	test-req-id	2026-07-16 00:41:53.234545+00
484	honey	honey	4	55	\N	test-req-id	2026-07-16 00:41:53.9418+00
485	honey	honey	4	49	\N	test-req-id	2026-07-16 00:42:13.860443+00
486	honey	honey	4	48	\N	test-req-id	2026-07-16 00:42:14.030509+00
487	honey	honey	4	39	\N	test-req-id	2026-07-16 00:42:14.143177+00
488	honey	honey	4	41	\N	test-req-id	2026-07-16 00:42:14.273109+00
489	عسل	عسل	4	77	\N	test-req-id	2026-07-16 00:42:14.475847+00
490	honey	honey	0	22	\N	test-req-id	2026-07-16 00:42:14.637907+00
491	honey	honey	4	62	\N	test-req-id	2026-07-16 00:42:15.379678+00
492	honey	honey	4	24	\N	test-req-id	2026-07-16 00:42:36.448487+00
493	honey	honey	4	36	\N	test-req-id	2026-07-16 00:42:36.562117+00
494	honey	honey	4	30	\N	test-req-id	2026-07-16 00:42:36.736462+00
495	honey	honey	4	46	\N	test-req-id	2026-07-16 00:42:36.842365+00
496	عسل	عسل	4	31	\N	test-req-id	2026-07-16 00:42:36.992563+00
497	honey	honey	0	49	\N	test-req-id	2026-07-16 00:42:37.106164+00
498	honey	honey	4	65	\N	test-req-id	2026-07-16 00:42:37.807115+00
499	honey	honey	4	111	\N	test-req-id	2026-07-16 00:48:20.06271+00
500	honey	honey	4	60	\N	test-req-id	2026-07-16 00:48:20.316601+00
501	honey	honey	4	46	\N	test-req-id	2026-07-16 00:48:20.453509+00
502	honey	honey	4	102	\N	test-req-id	2026-07-16 00:48:20.74836+00
503	عسل	عسل	4	120	\N	test-req-id	2026-07-16 00:48:21.076144+00
504	honey	honey	0	77	\N	test-req-id	2026-07-16 00:48:21.279014+00
505	honey	honey	4	97	\N	test-req-id	2026-07-16 00:48:22.640197+00
506	honey	honey	4	53	\N	test-req-id	2026-07-16 00:49:52.98366+00
507	honey	honey	4	28	\N	test-req-id	2026-07-16 00:49:53.095326+00
508	honey	honey	4	53	\N	test-req-id	2026-07-16 00:49:53.184079+00
509	honey	honey	4	15	\N	test-req-id	2026-07-16 00:49:53.252107+00
510	عسل	عسل	4	14	\N	test-req-id	2026-07-16 00:49:53.298676+00
511	honey	honey	0	48	\N	test-req-id	2026-07-16 00:49:53.395749+00
512	honey	honey	4	22	\N	test-req-id	2026-07-16 00:49:54.220147+00
513	honey	honey	4	33	\N	test-req-id	2026-07-16 00:50:43.493008+00
514	honey	honey	4	14	\N	test-req-id	2026-07-16 00:50:43.549552+00
515	honey	honey	4	10	\N	test-req-id	2026-07-16 00:50:43.631273+00
516	honey	honey	4	22	\N	test-req-id	2026-07-16 00:50:43.736124+00
517	عسل	عسل	4	9	\N	test-req-id	2026-07-16 00:50:43.775827+00
518	honey	honey	0	47	\N	test-req-id	2026-07-16 00:50:43.839637+00
519	honey	honey	4	26	\N	test-req-id	2026-07-16 00:50:44.386549+00
520	honey	honey	4	173	\N	test-req-id	2026-07-16 18:15:29.201061+00
521	honey	honey	4	102	\N	test-req-id	2026-07-16 18:15:29.442153+00
522	honey	honey	4	107	\N	test-req-id	2026-07-16 18:15:29.766136+00
523	honey	honey	4	36	\N	test-req-id	2026-07-16 18:15:29.942091+00
524	عسل	عسل	4	61	\N	test-req-id	2026-07-16 18:15:30.122841+00
525	honey	honey	0	90	\N	test-req-id	2026-07-16 18:15:30.276743+00
526	honey	honey	4	101	\N	test-req-id	2026-07-16 18:15:32.057021+00
527	honey	honey	4	87	\N	test-req-id	2026-07-16 18:15:56.140329+00
528	honey	honey	4	41	\N	test-req-id	2026-07-16 18:15:56.26023+00
529	honey	honey	4	123	\N	test-req-id	2026-07-16 18:15:56.536818+00
530	honey	honey	4	53	\N	test-req-id	2026-07-16 18:15:56.786517+00
531	عسل	عسل	4	190	\N	test-req-id	2026-07-16 18:15:57.177153+00
532	honey	honey	0	164	\N	test-req-id	2026-07-16 18:15:57.501985+00
533	honey	honey	4	335	\N	test-req-id	2026-07-16 18:16:00.108203+00
534	honey	honey	4	101	\N	test-req-id	2026-07-16 18:16:23.849718+00
535	honey	honey	4	266	\N	test-req-id	2026-07-16 18:16:24.238595+00
536	honey	honey	4	248	\N	test-req-id	2026-07-16 18:16:24.713386+00
537	honey	honey	4	485	\N	test-req-id	2026-07-16 18:16:25.396375+00
538	عسل	عسل	4	85	\N	test-req-id	2026-07-16 18:16:27.167015+00
539	honey	honey	0	86	\N	test-req-id	2026-07-16 18:16:27.436934+00
540	honey	honey	4	91	\N	test-req-id	2026-07-16 18:16:28.170034+00
541	honey	honey	4	112	\N	test-req-id	2026-07-16 18:16:48.587669+00
542	honey	honey	4	261	\N	test-req-id	2026-07-16 18:16:48.970379+00
543	honey	honey	4	170	\N	test-req-id	2026-07-16 18:16:49.297861+00
544	honey	honey	4	95	\N	test-req-id	2026-07-16 18:16:49.647991+00
545	عسل	عسل	4	114	\N	test-req-id	2026-07-16 18:16:49.934078+00
546	honey	honey	0	21	\N	test-req-id	2026-07-16 18:16:50.109566+00
547	honey	honey	4	49	\N	test-req-id	2026-07-16 18:16:52.39996+00
548	honey	honey	4	92	\N	test-req-id	2026-07-16 18:19:28.539084+00
549	honey	honey	4	52	\N	test-req-id	2026-07-16 18:19:28.676516+00
550	honey	honey	4	99	\N	test-req-id	2026-07-16 18:19:28.881883+00
551	honey	honey	4	57	\N	test-req-id	2026-07-16 18:19:28.990607+00
552	عسل	عسل	4	35	\N	test-req-id	2026-07-16 18:19:29.182902+00
553	honey	honey	0	101	\N	test-req-id	2026-07-16 18:19:29.37851+00
554	honey	honey	4	102	\N	test-req-id	2026-07-16 18:19:30.756489+00
555	honey	honey	4	50	\N	test-req-id	2026-07-16 18:19:54.610931+00
556	honey	honey	4	67	\N	test-req-id	2026-07-16 18:19:54.840597+00
557	honey	honey	4	146	\N	test-req-id	2026-07-16 18:19:55.122861+00
558	honey	honey	4	286	\N	test-req-id	2026-07-16 18:19:55.547706+00
559	عسل	عسل	4	157	\N	test-req-id	2026-07-16 18:19:55.814278+00
560	honey	honey	0	129	\N	test-req-id	2026-07-16 18:19:56.119759+00
561	honey	honey	4	80	\N	test-req-id	2026-07-16 18:19:58.286202+00
562	honey	honey	4	69	\N	test-req-id	2026-07-16 18:20:27.039515+00
563	honey	honey	4	142	\N	test-req-id	2026-07-16 18:20:27.262752+00
564	honey	honey	4	107	\N	test-req-id	2026-07-16 18:20:27.484057+00
565	honey	honey	4	643	\N	test-req-id	2026-07-16 18:20:28.206541+00
566	عسل	عسل	4	31	\N	test-req-id	2026-07-16 18:20:28.387159+00
567	honey	honey	0	72	\N	test-req-id	2026-07-16 18:20:28.600128+00
568	honey	honey	4	32	\N	test-req-id	2026-07-16 18:20:30.581943+00
569	honey	honey	4	144	\N	test-req-id	2026-07-16 18:31:27.237878+00
570	honey	honey	4	92	\N	test-req-id	2026-07-16 18:31:27.49016+00
571	honey	honey	4	62	\N	test-req-id	2026-07-16 18:31:27.696806+00
572	honey	honey	4	28	\N	test-req-id	2026-07-16 18:31:27.822162+00
573	عسل	عسل	4	42	\N	test-req-id	2026-07-16 18:31:27.941828+00
574	honey	honey	0	115	\N	test-req-id	2026-07-16 18:31:28.216639+00
575	honey	honey	4	59	\N	test-req-id	2026-07-16 18:31:31.058661+00
576	honey	honey	4	210	\N	test-req-id	2026-07-16 18:33:08.808346+00
577	honey	honey	4	77	\N	test-req-id	2026-07-16 18:33:09.083222+00
578	honey	honey	4	102	\N	test-req-id	2026-07-16 18:33:09.388711+00
579	honey	honey	4	285	\N	test-req-id	2026-07-16 18:33:09.758348+00
580	عسل	عسل	4	95	\N	test-req-id	2026-07-16 18:33:10.002358+00
581	honey	honey	0	26	\N	test-req-id	2026-07-16 18:33:10.131231+00
582	honey	honey	4	90	\N	test-req-id	2026-07-16 18:33:13.21224+00
583	honey	honey	4	115	\N	test-req-id	2026-07-16 18:35:15.799709+00
584	honey	honey	4	22	\N	test-req-id	2026-07-16 18:35:15.897757+00
585	honey	honey	4	75	\N	test-req-id	2026-07-16 18:35:16.031895+00
586	honey	honey	4	77	\N	test-req-id	2026-07-16 18:35:16.346199+00
587	عسل	عسل	4	87	\N	test-req-id	2026-07-16 18:35:16.534536+00
588	honey	honey	0	125	\N	test-req-id	2026-07-16 18:35:16.745962+00
589	honey	honey	4	83	\N	test-req-id	2026-07-16 18:35:18.213786+00
590	honey	honey	4	24	\N	test-req-id	2026-07-16 20:33:00.53166+00
591	honey	honey	4	6	\N	test-req-id	2026-07-16 20:33:00.624976+00
592	honey	honey	4	7	\N	test-req-id	2026-07-16 20:33:00.650861+00
593	honey	honey	4	6	\N	test-req-id	2026-07-16 20:33:00.671387+00
594	عسل	عسل	4	5	\N	test-req-id	2026-07-16 20:33:00.714469+00
595	honey	honey	0	5	\N	test-req-id	2026-07-16 20:33:00.754122+00
596	honey	honey	4	6	\N	test-req-id	2026-07-16 20:33:00.968965+00
597	honey	honey	4	37	\N	test-req-id	2026-07-16 20:33:30.854904+00
598	honey	honey	4	5	\N	test-req-id	2026-07-16 20:33:30.903208+00
599	honey	honey	4	21	\N	test-req-id	2026-07-16 20:33:30.952562+00
600	honey	honey	4	7	\N	test-req-id	2026-07-16 20:33:31.013597+00
601	عسل	عسل	4	7	\N	test-req-id	2026-07-16 20:33:31.049236+00
602	honey	honey	0	22	\N	test-req-id	2026-07-16 20:33:31.118292+00
603	honey	honey	4	6	\N	test-req-id	2026-07-16 20:33:31.360437+00
604	honey	honey	4	31	\N	test-req-id	2026-07-16 20:33:51.632335+00
605	honey	honey	4	12	\N	test-req-id	2026-07-16 20:33:51.726821+00
606	honey	honey	4	9	\N	test-req-id	2026-07-16 20:33:51.881146+00
607	honey	honey	4	11	\N	test-req-id	2026-07-16 20:33:51.91707+00
608	عسل	عسل	4	7	\N	test-req-id	2026-07-16 20:33:51.942507+00
609	honey	honey	0	15	\N	test-req-id	2026-07-16 20:33:51.99878+00
610	honey	honey	4	13	\N	test-req-id	2026-07-16 20:33:52.260199+00
611	honey	honey	4	10	\N	test-req-id	2026-07-16 20:34:16.615504+00
612	honey	honey	4	7	\N	test-req-id	2026-07-16 20:34:16.69251+00
613	honey	honey	4	14	\N	test-req-id	2026-07-16 20:34:16.727555+00
614	honey	honey	4	7	\N	test-req-id	2026-07-16 20:34:16.762937+00
615	عسل	عسل	4	28	\N	test-req-id	2026-07-16 20:34:16.986014+00
616	honey	honey	0	9	\N	test-req-id	2026-07-16 20:34:17.048492+00
617	honey	honey	4	9	\N	test-req-id	2026-07-16 20:34:17.278413+00
618	honey	honey	4	6	\N	test-req-id	2026-07-16 20:45:27.47872+00
619	honey	honey	4	18	\N	test-req-id	2026-07-16 20:45:27.576032+00
620	honey	honey	4	9	\N	test-req-id	2026-07-16 20:45:27.616105+00
621	honey	honey	4	6	\N	test-req-id	2026-07-16 20:45:27.746896+00
622	عسل	عسل	4	13	\N	test-req-id	2026-07-16 20:45:27.779712+00
623	honey	honey	0	6	\N	test-req-id	2026-07-16 20:45:27.803499+00
624	honey	honey	4	5	\N	test-req-id	2026-07-16 20:45:27.996924+00
625	honey	honey	4	20	\N	test-req-id	2026-07-16 20:46:19.393531+00
626	honey	honey	4	10	\N	test-req-id	2026-07-16 20:46:19.468273+00
627	honey	honey	4	19	\N	test-req-id	2026-07-16 20:46:19.536265+00
628	honey	honey	4	8	\N	test-req-id	2026-07-16 20:46:19.611495+00
629	عسل	عسل	4	11	\N	test-req-id	2026-07-16 20:46:19.725929+00
630	honey	honey	0	17	\N	test-req-id	2026-07-16 20:46:19.797249+00
631	honey	honey	4	10	\N	test-req-id	2026-07-16 20:46:20.074623+00
\.


--
-- Data for Name: shipping_methods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."shipping_methods" ("id", "name_ar", "name_en", "name_zh", "base_cost", "per_kg_cost", "estimated_days", "is_active", "sort_order", "created_at", "updated_at") FROM stdin;
1	توصيل عادي	Standard Delivery	标准配送	500.00	200.00	3	t	1	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	توصيل سريع	Express Delivery	快速配送	1000.00	350.00	1	t	2	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	توصيل في اليوم التالي	Next-Day Delivery	次日达	1500.00	500.00	1	t	3	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	استلام من المتجر	Store Pickup	门店自提	0.00	0.00	1	t	4	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: store_balance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."store_balance" ("id", "store_id", "available", "pending", "currency", "updated_at") FROM stdin;
1	1	250000.00	35000.00	YER	2026-07-14 01:16:08.475969+00
2	2	180000.00	22000.00	YER	2026-07-14 01:16:08.475969+00
3	3	320000.00	45000.00	YER	2026-07-14 01:16:08.475969+00
4	4	95000.00	12000.00	YER	2026-07-14 01:16:08.475969+00
5	5	150000.00	28000.00	YER	2026-07-14 01:16:08.475969+00
6	6	75000.00	8000.00	YER	2026-07-14 01:16:08.475969+00
7	7	420000.00	65000.00	YER	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: store_followers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."store_followers" ("id", "store_id", "user_id", "notify_new_products", "notify_offers", "created_at") FROM stdin;
1	1	2	t	t	2026-06-14 01:16:08.475969+00
2	1	3	t	t	2026-06-29 01:16:08.475969+00
3	2	2	t	f	2026-07-04 01:16:08.475969+00
4	3	3	t	t	2026-06-24 01:16:08.475969+00
5	4	4	f	t	2026-07-09 01:16:08.475969+00
6	5	2	t	t	2026-07-07 01:16:08.475969+00
7	7	3	t	t	2026-07-02 01:16:08.475969+00
8	7	4	t	f	2026-07-06 01:16:08.475969+00
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."stores" ("id", "owner_id", "store_name", "store_name_en", "store_name_zh", "slug", "description", "description_en", "description_zh", "logo", "banner", "location", "governorate", "trust_level", "response_rate", "on_time_delivery", "commission_rate", "rating", "review_count", "products_count", "sales_count", "followers_count", "since_year", "is_active", "is_verified", "deleted_at", "created_at", "updated_at") FROM stdin;
8	35	نشوان للتجارة العامة وخدمات حقول النفط والغاز	\N	\N	store-35	\N	\N	\N	\N	\N	Sana'a, صنعاء	صنعاء	verified	95.00	95.00	5.00	0.0	0	0	0	0	2026	t	f	\N	2026-07-15 04:14:16.969727+00	2026-07-15 04:14:16.969727+00
3	6	تمور الجوف	Jawf Dates	焦夫椰枣	jawf-dates	تمور فاخرة من الجوف	Premium dates from Al-Jawf	焦夫优质椰枣	/stores/jawf-dates-logo.png	/stores/jawf-dates-banner.jpg	الجوف	الجوف	diamond	98.90	97.20	5.00	5.0	2	3	0	1	2017	t	t	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
4	7	حرف يدوية يمنية	Yemen Handicrafts	也门手工艺品	yemen-handicrafts	حرف يدوية تراثية أصيلة	Authentic traditional handicrafts	正宗传统手工艺品	/stores/yemen-handicrafts-logo.png	/stores/yemen-handicrafts-banner.jpg	صنعاء	صنعاء	golden	96.30	95.80	7.00	0.0	0	4	0	1	2019	t	t	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
2	5	عطور الملكة	Queen Perfumes	女王香水	queen-perfumes	عطور شرقية فاخرة	Luxury oriental perfumes	奢华东方香水	/stores/queen-perfumes-logo.png	/stores/queen-perfumes-banner.jpg	صنعاء	صنعاء	golden	97.80	96.50	6.00	4.5	2	4	0	1	2020	t	t	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
7	10	بن المخا	Mokha Coffee	摩卡咖啡	mokha-coffee	بن يمني فاخر	Premium Yemeni coffee	优质也门咖啡	/stores/mokha-coffee-logo.png	/stores/mokha-coffee-banner.jpg	المخا	تعز	diamond	99.10	98.00	5.00	5.0	1	4	1	2	2016	t	t	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
9	101	ام توب للتجارة المعدات الصناعية	\N	\N	store-101	\N	\N	\N	\N	\N	Sana'a, صنعاء	صنعاء	verified	95.00	95.00	5.00	0.0	0	0	0	0	2026	t	f	\N	2026-07-17 03:17:02.125452+00	2026-07-17 03:17:02.125452+00
6	9	بخور وعطور	Incense & Perfumes	熏香和香水	incense-perfumes	بخور عربي أصيل	Authentic Arabian incense	正宗阿拉伯熏香	/stores/incense-perfumes-logo.png	/stores/incense-perfumes-banner.jpg	تعز	تعز	verified	94.70	93.50	7.00	0.0	0	2	0	0	2020	t	f	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
1	5	بهارات اليمن	Yemen Spice House	也门香料之家	yemen-spice-house	بهارات يمنية أصيلة من قلب حضرموت	Authentic Yemeni spices from Hadramaut	也门哈德拉毛正宗香料	/stores/yemen-spice-logo.png	/stores/yemen-spice-banner.jpg	المكلا	حضرموت	diamond	99.50	98.70	5.00	4.5	4	3	1	2	2018	t	t	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
5	8	إلكترونيات اليمن	Yemen Electronics	也门电子产品	yemen-electronics	كل ما تحتاجه من إلكترونيات	All your electronics needs	您所有的电子产品需求	/stores/yemen-electronics-logo.png	/stores/yemen-electronics-banner.jpg	عدن	عدن	verified	95.20	94.10	6.00	4.5	2	4	1	1	2021	t	f	\N	2026-07-14 01:16:08.475969+00	2026-07-15 18:48:39.381664+00
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."subscriptions" ("id", "store_id", "plan", "status", "started_at", "expires_at", "amount", "currency", "auto_renew", "features", "created_at", "updated_at") FROM stdin;
1	1	pro	active	2026-04-15 01:16:08.475969+00	2027-04-15 01:16:08.475969+00	15000.00	YER	t	{"analytics": true, "max_products": 500, "featured_slots": 5}	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
2	2	starter	active	2026-05-15 01:16:08.475969+00	2027-05-15 01:16:08.475969+00	5000.00	YER	t	{"analytics": false, "max_products": 100, "featured_slots": 1}	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
3	3	enterprise	active	2026-01-15 01:16:08.475969+00	2027-01-15 01:16:08.475969+00	50000.00	YER	t	{"analytics": true, "max_products": -1, "featured_slots": 20, "priority_support": true}	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
4	4	starter	active	2026-06-14 01:16:08.475969+00	2027-06-14 01:16:08.475969+00	5000.00	YER	f	{"analytics": false, "max_products": 100, "featured_slots": 1}	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
5	5	free	active	2026-06-29 01:16:08.475969+00	2027-06-29 01:16:08.475969+00	0.00	YER	f	{"analytics": false, "max_products": 20, "featured_slots": 0}	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
6	6	free	active	2026-07-04 01:16:08.475969+00	2027-07-04 01:16:08.475969+00	0.00	YER	f	{"analytics": false, "max_products": 20, "featured_slots": 0}	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
7	7	pro	active	2026-01-15 01:16:08.475969+00	2027-01-15 01:16:08.475969+00	15000.00	YER	t	{"analytics": true, "max_products": 500, "featured_slots": 5}	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."transactions" ("id", "store_id", "type", "amount", "balance_after", "currency", "reference_type", "reference_id", "description", "created_at") FROM stdin;
1	1	order	10700.00	10700.00	YER	order	1	Order #NOF-2026-0001	2026-07-07 01:16:08.475969+00
2	1	fee	535.00	11235.00	YER	order	1	Platform fee 5%	2026-07-07 01:16:08.475969+00
3	2	order	26000.00	26000.00	YER	order	3	Order #NOF-2026-0003	2026-07-11 01:16:08.475969+00
4	2	fee	1300.00	27300.00	YER	order	3	Platform fee 5%	2026-07-11 01:16:08.475969+00
5	3	order	7200.00	7200.00	YER	order	2	Order #NOF-2026-0002	2026-07-12 01:16:08.475969+00
6	3	fee	360.00	7560.00	YER	order	2	Platform fee 5%	2026-07-12 01:16:08.475969+00
7	7	order	8000.00	8000.00	YER	order	8	Order #NOF-2026-0008	2026-07-06 01:16:08.475969+00
8	7	fee	400.00	8400.00	YER	order	8	Platform fee 5%	2026-07-06 01:16:08.475969+00
\.


--
-- Data for Name: used_jtis; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."used_jtis" ("jti", "user_id", "expires_at", "created_at") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."users" ("id", "email", "password_hash", "full_name", "phone", "role", "status", "is_verified", "email_verified", "phone_verified", "avatar", "two_factor_enabled", "preferred_language", "gender", "last_login", "deleted_at", "created_at", "updated_at", "totp_secret", "totp_backup_codes", "totp_enabled_at", "token_version", "last_login_at", "vehicle_type", "vehicle_plate", "license_number", "current_latitude", "current_longitude", "is_online", "is_on_duty", "rating", "total_deliveries", "completed_deliveries", "cancelled_deliveries", "avg_delivery_time_minutes") FROM stdin;
3	sara@gmail.com	scrypt$Ffq03xyB6kIPtfM97Bl45A==$4V4FoGQPq2qCtqjVZvTrvI2EGcgvXlWj/Gr/8IX4/s1jO99rb6G6BTobkfc0piSIcuxoXuxjuCZZ4t8ViUTXsQ==	Sara Al-Hadhrami	+967712345672	customer	active	t	t	t	\N	f	ar	female	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
4	omar@gmail.com	scrypt$PH6pMAHXPST2bNUQ/DyvOw==$AaXDgr2fCP397LuqaRSkx38ov3f4uWNGcovShH9+JSuQrZoCLhnUh3KuE9hjL535n8LENvcevq8azaf2hWJ/Ig==	Omar Al-Amiri	+967712345673	customer	active	f	f	f	\N	f	ar	male	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
6	hassan@dates-yemen.com	scrypt$Avl2w1gUqPMJuqlHO22DvA==$HK3bhnv2BTpDuVnyQqDuZJCS6Xl3bJPilx8PiHhOBTU847R2GRlu2G6LDrHU5Cn7zPSrAQPGd2tD91qUKFLcNQ==	Hassan Al-Mahdi	+967712345675	merchant	active	t	t	t	\N	f	ar	male	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
8	khalid@electronics-yemen.com	scrypt$jsxYGtdEZaclhyAiXW+aSQ==$Q11qCszs74Xm4WVPeZHHpYl6V1eYDKofMm18eBsxWE0HRG01gg0Yr/BLp5PHRwL4bbR159cwxiV1fnUJUTNP6w==	Khalid Al-Sharjabi	+967712345677	merchant	active	t	t	t	\N	f	ar	male	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
9	noor@perfume-yemen.com	scrypt$jS30qMRM6PJh+wS0lxz2zw==$79MVwe3lISndUcNBMQsCY95Kgg39pKMyiBh3SDKPYPo6YueYdlHy31vEsVUcm6YcE0F/6H2A43EimIhuyeLZeg==	Noor Al-Khazen	+967712345678	merchant	active	t	t	t	\N	f	ar	female	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
10	layla@mokha-coffee.com	scrypt$4+NUHh9EY7TlQjfvtpxIGw==$E48o2DOf7Yqc1QFkRJJFzEM3efKn+CjMd/fmhzZT3bkPTE2rIMrVcopScYomUZjJeKaXxdueKA+mHCYnvvMFEQ==	Layla Al-Maqtari	+967712345679	merchant	active	t	t	t	\N	f	ar	female	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
11	ahmed.delivery@noufex.com	scrypt$4+NUHh9EY7TlQjfvtpxIGw==$E48o2DOf7Yqc1QFkRJJFzEM3efKn+CjMd/fmhzZT3bkPTE2rIMrVcopScYomUZjJeKaXxdueKA+mHCYnvvMFEQ==	Ahmed Delivery	+967712345680	delivery_agent	active	t	t	t	\N	f	ar	male	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
12	mohammed.delivery@noufex.com	scrypt$4+NUHh9EY7TlQjfvtpxIGw==$E48o2DOf7Yqc1QFkRJJFzEM3efKn+CjMd/fmhzZT3bkPTE2rIMrVcopScYomUZjJeKaXxdueKA+mHCYnvvMFEQ==	Mohammed Delivery	+967712345681	delivery_agent	active	t	t	t	\N	f	ar	male	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
13	sara.delivery@noufex.com	scrypt$4+NUHh9EY7TlQjfvtpxIGw==$E48o2DOf7Yqc1QFkRJJFzEM3efKn+CjMd/fmhzZT3bkPTE2rIMrVcopScYomUZjJeKaXxdueKA+mHCYnvvMFEQ==	Sara Delivery	+967712345682	delivery_agent	active	t	t	t	\N	f	ar	female	\N	\N	2026-07-14 01:16:08.475969+00	2026-07-14 01:16:08.475969+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
14	n@example.com	scrypt$Txy9W0MRMkAigubmu7Ng1g==$cKFOe6LWQIX4Insyt4Erg9RMoHGKgOUgN1q7cj70iZbQAGGuIx1EkBo12HWx09qqaRT7gGADPH3cCb93i9jimQ==	Nouf Ali	\N	customer	active	f	f	f	\N	f	ar	\N	\N	\N	2026-07-14 02:35:10.980615+00	2026-07-14 02:35:10.980615+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
35	zaher.nashwan@yahoo.com	scrypt$2l+Jm8CpjLR2tCjYc1CxnA==$N9GiQiTXal/qCI/nvE+6WYMMUMAN3oqXEmsILvbssJA2HH3RULZd6UwvUjW/wttc3144ZVukogFZu+lvILjMGA==	Nashwan corp	\N	merchant	active	f	f	f	\N	f	ar	\N	\N	\N	2026-07-15 04:13:20.470523+00	2026-07-15 04:13:20.470523+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
7	mohammed@handicrafts-yemen.com	scrypt$xbjupiWOirt8unePsFnUcg==$KE/Tqb+OzqhekoH3r63FyDS//+KipWHUEh7NyCxex5ZrICqC52/mcKqhLC/qivUgkEBPnIOI5NG/jo6UxBzwMw==	Mohammed Bani Hushaish	+967712345676	merchant	active	t	t	t	\N	f	ar	male	2026-07-16 20:46:20.274217+00	\N	2026-07-14 01:16:08.475969+00	2026-07-16 20:46:20.274217+00	\N	{}	\N	94	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
101	emtopyemen@gmai.com	scrypt$fcT4zRLJj+BUC2bvI3Mydg==$GdN64BvSmPSv9aewshL7F8EBEJ7eNKLI5L3I0Exb61ZtJcebxzTBiw/ydmUJRHx9TTqAskNgEFQYCTPUY5+uYg==	emtop	\N	merchant	active	f	f	f	\N	f	ar	\N	\N	\N	2026-07-17 03:11:33.560398+00	2026-07-17 03:11:33.560398+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
2	ahmed@gmail.com	scrypt$69zEFtT9PMjmDlFrA31t1w==$kkWH6q3VvawE03v7Ls+eqhgFPYERf70SbxxVCp6d1cxno+5qDdqRtOdOg1+s0awXdP0kwJWQcyjXEerfh1f7sg==	Ahmed Al-Maqtari	+967712345671	customer	active	t	t	t	\N	f	ar	male	2026-07-15 21:20:38.206498+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 21:20:38.206498+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
5	fatima@spice-yemen.com	scrypt$s1Z7B+i1yiaJWlmq9+93MA==$gHS2qArujTbgZmTyfiJN8iRbD52MXBu7Q6fodUraz0Fop/5eSDfcUKttNKwWpmJ6IThuRBuLjMXM6wZWXSBXpQ==	Fatima Al-Sharabi	+967712345674	merchant	active	t	t	t	\N	f	ar	female	2026-07-15 21:20:40.728603+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 21:20:40.728603+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
1	admin@noufex.com	scrypt$OnSXEANSpcXJkTYryVu2Qw==$fb2h3uxf8jVS3rNUThwMSeC89WpCKl6wFcfiKRl3suUFbDh5lN3kTkqPoUuntI/54I5CJ7J/4zbeo5Qglx8mTg==	System Administrator	+967711111111	admin	active	t	t	t	\N	f	ar	\N	2026-07-15 23:21:06.81835+00	\N	2026-07-14 01:16:08.475969+00	2026-07-15 23:21:06.81835+00	\N	{}	\N	0	\N	\N	\N	\N	\N	\N	f	f	5.0	0	0	0	\N
\.


--
-- Data for Name: webhook_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."webhook_events" ("id", "provider", "event_id", "transaction_id", "event_type", "payload", "processing_state", "processed_at", "created_at") FROM stdin;
1	stripe	tx_p1_1_1783996511717_i4t5ql	tx_p1_1_1783996511717_i4t5ql	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 02:35:11.911208+00	2026-07-14 02:35:11.779909+00
2	stripe	tx_p1_1_1783996625346_yr4v22	tx_p1_1_1783996625346_yr4v22	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 02:37:05.566108+00	2026-07-14 02:37:05.498563+00
3	stripe	tx_p1_1_1784044426572_8qql3q	tx_p1_1_1784044426572_8qql3q	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 15:53:46.621166+00	2026-07-14 15:53:46.591446+00
4	stripe	tx_p1_1_1784044460850_ee3rnp	tx_p1_1_1784044460850_ee3rnp	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 15:54:20.922957+00	2026-07-14 15:54:20.900697+00
5	stripe	tx_p1_1_1784044516605_015wxt	tx_p1_1_1784044516605_015wxt	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 15:55:16.618993+00	2026-07-14 15:55:16.616238+00
6	stripe	tx_p1_1_1784044596398_gs87f6	tx_p1_1_1784044596398_gs87f6	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 15:56:36.429152+00	2026-07-14 15:56:36.419168+00
7	stripe	tx_p1_1_1784044630245_ebtu45	tx_p1_1_1784044630245_ebtu45	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 15:57:10.281185+00	2026-07-14 15:57:10.269325+00
8	stripe	tx_p1_1_1784046321263_khtly1	tx_p1_1_1784046321263_khtly1	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 16:25:21.368869+00	2026-07-14 16:25:21.358776+00
9	stripe	tx_p1_1_1784046405610_4s25by	tx_p1_1_1784046405610_4s25by	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 16:26:45.63896+00	2026-07-14 16:26:45.629171+00
10	stripe	tx_p1_1_1784051020432_pbco5f	tx_p1_1_1784051020432_pbco5f	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 17:43:40.862864+00	2026-07-14 17:43:40.657168+00
11	stripe	tx_p1_1_1784051060766_0pslqb	tx_p1_1_1784051060766_0pslqb	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 17:44:20.908785+00	2026-07-14 17:44:20.80943+00
12	stripe	tx_p1_1_1784051681774_nvk6eq	tx_p1_1_1784051681774_nvk6eq	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 17:54:42.030104+00	2026-07-14 17:54:41.901501+00
13	stripe	tx_p1_1_1784051719499_jqm9bx	tx_p1_1_1784051719499_jqm9bx	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 17:55:19.583108+00	2026-07-14 17:55:19.566136+00
14	stripe	tx_p1_1_1784054837968_zynjg8	tx_p1_1_1784054837968_zynjg8	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 18:47:18.018138+00	2026-07-14 18:47:17.993906+00
15	stripe	tx_p1_1_1784054865377_jwxz5o	tx_p1_1_1784054865377_jwxz5o	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 18:47:45.429658+00	2026-07-14 18:47:45.403045+00
16	stripe	tx_p1_1_1784069460231_a2vhmp	tx_p1_1_1784069460231_a2vhmp	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 22:51:00.270971+00	2026-07-14 22:51:00.25651+00
17	stripe	tx_p1_1_1784071452947_jhzihp	tx_p1_1_1784071452947_jhzihp	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-14 23:24:13.002961+00	2026-07-14 23:24:12.980645+00
18	stripe	tx_p1_1_1784079450611_y0optn	tx_p1_1_1784079450611_y0optn	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 01:37:30.68456+00	2026-07-15 01:37:30.649508+00
19	stripe	tx_p1_1_1784079572675_ze5pcr	tx_p1_1_1784079572675_ze5pcr	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 01:39:32.737524+00	2026-07-15 01:39:32.723013+00
20	stripe	tx_p1_1_1784079587979_h938ta	tx_p1_1_1784079587979_h938ta	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 01:39:48.027584+00	2026-07-15 01:39:47.998088+00
21	stripe	tx_p1_1_1784079780498_1z4xjp	tx_p1_1_1784079780498_1z4xjp	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 01:43:00.520975+00	2026-07-15 01:43:00.516154+00
22	stripe	tx_p1_1_1784079825936_boiwq9	tx_p1_1_1784079825936_boiwq9	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 01:43:45.992075+00	2026-07-15 01:43:45.952626+00
23	stripe	tx_p1_1_1784080878088_p6v79g	tx_p1_1_1784080878088_p6v79g	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 02:01:18.18515+00	2026-07-15 02:01:18.117578+00
24	stripe	tx_p1_1_1784081443726_mvexe0	tx_p1_1_1784081443726_mvexe0	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 02:10:43.793695+00	2026-07-15 02:10:43.744923+00
25	stripe	tx_p1_1_1784087535193_dfbrqx	tx_p1_1_1784087535193_dfbrqx	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 03:52:15.259243+00	2026-07-15 03:52:15.207163+00
26	stripe	tx_p1_1_1784087952707_cxcgla	tx_p1_1_1784087952707_cxcgla	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 03:59:12.763568+00	2026-07-15 03:59:12.719731+00
27	stripe	tx_p1_1_1784090360861_cybho4	tx_p1_1_1784090360861_cybho4	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 04:39:20.914265+00	2026-07-15 04:39:20.877345+00
28	stripe	tx_p1_1_1784090811365_s5kliv	tx_p1_1_1784090811365_s5kliv	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 04:46:51.454289+00	2026-07-15 04:46:51.381822+00
29	stripe	tx_p1_1_1784128652318_4zgldb	tx_p1_1_1784128652318_4zgldb	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 15:17:32.52393+00	2026-07-15 15:17:32.435995+00
30	stripe	tx_p1_1_1784128672193_et82ac	tx_p1_1_1784128672193_et82ac	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 15:17:52.259437+00	2026-07-15 15:17:52.201032+00
31	stripe	tx_p1_1_1784130025589_xlbs5b	tx_p1_1_1784130025589_xlbs5b	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 15:40:25.66264+00	2026-07-15 15:40:25.597748+00
32	stripe	tx_p1_1_1784130860435_jz4rew	tx_p1_1_1784130860435_jz4rew	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 15:54:20.676483+00	2026-07-15 15:54:20.459929+00
33	stripe	tx_p1_1_1784132228456_a8bkxu	tx_p1_1_1784132228456_a8bkxu	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 16:17:08.643039+00	2026-07-15 16:17:08.475608+00
34	stripe	tx_p1_1_1784135221625_j02znx	tx_p1_1_1784135221625_j02znx	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 17:07:01.804865+00	2026-07-15 17:07:01.699586+00
35	stripe	tx_p1_1_1784139720203_e7oa14	tx_p1_1_1784139720203_e7oa14	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 18:22:00.263878+00	2026-07-15 18:22:00.213579+00
36	stripe	tx_p1_1_1784152524626_wxfykg	tx_p1_1_1784152524626_wxfykg	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 21:55:24.669181+00	2026-07-15 21:55:24.639997+00
37	stripe	tx_p1_1_1784154662803_khu3cl	tx_p1_1_1784154662803_khu3cl	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:31:02.860613+00	2026-07-15 22:31:02.815276+00
38	stripe	tx_p1_1_1784154697242_w2aapi	tx_p1_1_1784154697242_w2aapi	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:31:37.269077+00	2026-07-15 22:31:37.255052+00
39	stripe	tx_p1_1_1784154716338_01qmo8	tx_p1_1_1784154716338_01qmo8	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:31:56.370151+00	2026-07-15 22:31:56.345808+00
40	stripe	tx_p1_1_1784154731228_cki19f	tx_p1_1_1784154731228_cki19f	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:32:11.272602+00	2026-07-15 22:32:11.25196+00
41	stripe	tx_p1_1_1784154758920_lph23k	tx_p1_1_1784154758920_lph23k	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:32:38.945419+00	2026-07-15 22:32:38.933601+00
42	stripe	tx_p1_1_1784154780853_j7nb9u	tx_p1_1_1784154780853_j7nb9u	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:33:00.895723+00	2026-07-15 22:33:00.865817+00
43	stripe	tx_p1_1_1784154846501_q6v0fh	tx_p1_1_1784154846501_q6v0fh	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:34:06.537231+00	2026-07-15 22:34:06.520952+00
44	stripe	tx_p1_1_1784154871323_24y1gb	tx_p1_1_1784154871323_24y1gb	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:34:31.34879+00	2026-07-15 22:34:31.338373+00
45	stripe	tx_p1_1_1784154895192_2hr9sf	tx_p1_1_1784154895192_2hr9sf	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:34:55.247003+00	2026-07-15 22:34:55.222356+00
46	stripe	tx_p1_1_1784154912523_9h2zho	tx_p1_1_1784154912523_9h2zho	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:35:12.559404+00	2026-07-15 22:35:12.533758+00
47	stripe	tx_p1_1_1784155445603_6mt15f	tx_p1_1_1784155445603_6mt15f	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:44:05.713771+00	2026-07-15 22:44:05.625825+00
48	stripe	tx_p1_1_1784156122443_7q3v3r	tx_p1_1_1784156122443_7q3v3r	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:55:22.647505+00	2026-07-15 22:55:22.481044+00
49	stripe	tx_p1_1_1784156142933_z1yyas	tx_p1_1_1784156142933_z1yyas	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:55:42.954145+00	2026-07-15 22:55:42.947119+00
50	stripe	tx_p1_1_1784156183762_94a263	tx_p1_1_1784156183762_94a263	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:56:23.779301+00	2026-07-15 22:56:23.771661+00
51	stripe	tx_p1_1_1784156208364_huz0e5	tx_p1_1_1784156208364_huz0e5	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:56:48.419987+00	2026-07-15 22:56:48.393513+00
52	stripe	tx_p1_1_1784156269234_dpwt2t	tx_p1_1_1784156269234_dpwt2t	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:57:49.437298+00	2026-07-15 22:57:49.261273+00
53	stripe	tx_p1_1_1784156283380_iumwus	tx_p1_1_1784156283380_iumwus	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:58:03.467403+00	2026-07-15 22:58:03.428452+00
54	stripe	tx_p1_1_1784156293190_gtkzy3	tx_p1_1_1784156293190_gtkzy3	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:58:13.25718+00	2026-07-15 22:58:13.21303+00
55	stripe	tx_p1_1_1784156314592_juo9og	tx_p1_1_1784156314592_juo9og	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:58:34.679024+00	2026-07-15 22:58:34.617897+00
56	stripe	tx_p1_1_1784156334412_xmbz8v	tx_p1_1_1784156334412_xmbz8v	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:58:54.522636+00	2026-07-15 22:58:54.423992+00
57	stripe	tx_p1_1_1784156354525_h0uez9	tx_p1_1_1784156354525_h0uez9	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 22:59:14.626384+00	2026-07-15 22:59:14.574061+00
58	stripe	tx_p1_1_1784159380266_zytgd9	tx_p1_1_1784159380266_zytgd9	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:49:40.37186+00	2026-07-15 23:49:40.300773+00
59	stripe	tx_p1_1_1784159469911_orvkfe	tx_p1_1_1784159469911_orvkfe	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:51:09.951228+00	2026-07-15 23:51:09.923169+00
60	stripe	tx_p1_1_1784159496909_xm83lq	tx_p1_1_1784159496909_xm83lq	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:51:36.983247+00	2026-07-15 23:51:36.950834+00
61	stripe	tx_p1_1_1784159521591_1py0tq	tx_p1_1_1784159521591_1py0tq	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:52:01.681668+00	2026-07-15 23:52:01.611588+00
62	stripe	tx_p1_1_1784159542545_v6woj0	tx_p1_1_1784159542545_v6woj0	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:52:22.615353+00	2026-07-15 23:52:22.561028+00
63	stripe	tx_p1_1_1784159562563_kssi7u	tx_p1_1_1784159562563_kssi7u	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:52:42.717031+00	2026-07-15 23:52:42.611+00
64	stripe	tx_p1_1_1784159586099_gom9b3	tx_p1_1_1784159586099_gom9b3	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:53:06.250586+00	2026-07-15 23:53:06.125505+00
65	stripe	tx_p1_1_1784159652037_xl70w1	tx_p1_1_1784159652037_xl70w1	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-15 23:54:12.304349+00	2026-07-15 23:54:12.058234+00
66	stripe	tx_p1_1_1784161094511_sgkdn3	tx_p1_1_1784161094511_sgkdn3	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:18:14.598723+00	2026-07-16 00:18:14.521885+00
67	stripe	tx_p1_1_1784161296541_gumwji	tx_p1_1_1784161296541_gumwji	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:21:36.604968+00	2026-07-16 00:21:36.556554+00
68	stripe	tx_p1_1_1784161362528_y6wrc2	tx_p1_1_1784161362528_y6wrc2	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:22:42.599934+00	2026-07-16 00:22:42.540267+00
69	stripe	tx_p1_1_1784161524386_9ajogh	tx_p1_1_1784161524386_9ajogh	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:25:24.455667+00	2026-07-16 00:25:24.402983+00
70	stripe	tx_p1_1_1784161752819_g0gloa	tx_p1_1_1784161752819_g0gloa	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:29:12.946349+00	2026-07-16 00:29:12.849021+00
71	stripe	tx_p1_1_1784162430269_lm98te	tx_p1_1_1784162430269_lm98te	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:40:30.417064+00	2026-07-16 00:40:30.293866+00
72	stripe	tx_p1_1_1784162513543_kp3fpl	tx_p1_1_1784162513543_kp3fpl	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:41:53.757106+00	2026-07-16 00:41:53.560965+00
73	stripe	tx_p1_1_1784162535005_hutwrl	tx_p1_1_1784162535005_hutwrl	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:42:15.069606+00	2026-07-16 00:42:15.018991+00
74	stripe	tx_p1_1_1784162557146_wwizq0	tx_p1_1_1784162557146_wwizq0	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:42:37.180436+00	2026-07-16 00:42:37.157585+00
75	stripe	tx_p1_1_1784162901579_4da6p1	tx_p1_1_1784162901579_4da6p1	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:48:21.715205+00	2026-07-16 00:48:21.5955+00
76	stripe	tx_p1_1_1784162993397_mykn3f	tx_p1_1_1784162993397_mykn3f	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:49:53.497776+00	2026-07-16 00:49:53.409457+00
77	stripe	tx_p1_1_1784163043201_vmaipp	tx_p1_1_1784163043201_vmaipp	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 00:50:43.319455+00	2026-07-16 00:50:43.244881+00
78	stripe	tx_p1_1_1784225727083_3mmque	tx_p1_1_1784225727083_3mmque	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:15:27.293808+00	2026-07-16 18:15:27.144653+00
79	stripe	tx_p1_1_1784225754954_okj1sn	tx_p1_1_1784225754954_okj1sn	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:15:55.173583+00	2026-07-16 18:15:55.020269+00
80	stripe	tx_p1_1_1784225781676_4lzv42	tx_p1_1_1784225781676_4lzv42	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:16:22.005773+00	2026-07-16 18:16:21.667981+00
81	stripe	tx_p1_1_1784225807147_ly3bjk	tx_p1_1_1784225807147_ly3bjk	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:16:47.252473+00	2026-07-16 18:16:47.209397+00
82	stripe	tx_p1_1_1784225968170_zge96i	tx_p1_1_1784225968170_zge96i	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:19:28.312661+00	2026-07-16 18:19:28.191214+00
83	stripe	tx_p1_1_1784225993322_9drrzy	tx_p1_1_1784225993322_9drrzy	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:19:53.49293+00	2026-07-16 18:19:53.379551+00
84	stripe	tx_p1_1_1784226025994_t7r0aa	tx_p1_1_1784226025994_t7r0aa	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:20:26.176869+00	2026-07-16 18:20:26.032624+00
85	stripe	tx_p1_1_1784226688207_utttr6	tx_p1_1_1784226688207_utttr6	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:31:28.251718+00	2026-07-16 18:31:28.073116+00
86	stripe	tx_p1_1_1784226788325_pm80zc	tx_p1_1_1784226788325_pm80zc	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:33:08.488517+00	2026-07-16 18:33:08.35158+00
87	stripe	tx_p1_1_1784226915622_ja0vf2	tx_p1_1_1784226915622_ja0vf2	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 18:35:15.837695+00	2026-07-16 18:35:15.640855+00
88	stripe	tx_p1_1_1784233980394_akfcxw	tx_p1_1_1784233980394_akfcxw	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 20:33:00.44082+00	2026-07-16 20:33:00.414275+00
89	stripe	tx_p1_1_1784234010973_ajgzj5	tx_p1_1_1784234010973_ajgzj5	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 20:33:31.00045+00	2026-07-16 20:33:30.986771+00
90	stripe	tx_p1_1_1784234031970_k0r6u1	tx_p1_1_1784234031970_k0r6u1	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 20:33:52.034153+00	2026-07-16 20:33:52.015384+00
91	stripe	tx_p1_1_1784234056419_fq9o99	tx_p1_1_1784234056419_fq9o99	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 20:34:16.477727+00	2026-07-16 20:34:16.434265+00
92	stripe	tx_p1_1_1784234727898_s4nipc	tx_p1_1_1784234727898_s4nipc	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 20:45:27.960538+00	2026-07-16 20:45:27.922324+00
93	stripe	tx_p1_1_1784234780246_rljqkl	tx_p1_1_1784234780246_rljqkl	completed	{"body_len": 0, "header_count": 5}	processed	2026-07-16 20:46:20.339266+00	2026-07-16 20:46:20.258152+00
\.


--
-- Data for Name: wishlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."wishlist" ("id", "user_id", "product_id", "notes", "created_at", "deleted_at") FROM stdin;
1	2	5	هدية لشخص عزيز	2026-07-04 01:16:08.475969+00	\N
2	2	11	\N	2026-07-06 01:16:08.475969+00	\N
3	2	22	إذا توفر بسعر أقل	2026-07-09 01:16:08.475969+00	\N
4	3	9	\N	2026-07-02 01:16:08.475969+00	\N
5	3	11	\N	2026-07-08 01:16:08.475969+00	\N
6	3	14	\N	2026-07-10 01:16:08.475969+00	\N
7	4	15	\N	2026-07-11 01:16:08.475969+00	\N
8	4	12	انتظر عرض أفضل	2026-07-07 01:16:08.475969+00	\N
9	7	1	\N	2026-07-14 02:35:11.797221+00	\N
10	2	3	\N	2026-07-15 17:01:01.590234+00	\N
\.


--
-- Name: addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."addresses_id_seq"', 95, true);


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."admin_audit_log_id_seq"', 101, true);


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."cart_items_id_seq"', 93, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."categories_id_seq"', 18, true);


--
-- Name: coupon_usage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."coupon_usage_id_seq"', 2, true);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."coupons_id_seq"', 4, true);


--
-- Name: delivery_agent_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."delivery_agent_assignments_id_seq"', 1, false);


--
-- Name: delivery_agents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."delivery_agents_id_seq"', 3, true);


--
-- Name: disputes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."disputes_id_seq"', 1, true);


--
-- Name: inventory_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."inventory_log_id_seq"', 9, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."messages_id_seq"', 4, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."notifications_id_seq"', 12, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."order_items_id_seq"', 9, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."orders_id_seq"', 8, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."payments_id_seq"', 6, true);


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."product_images_id_seq"', 1, false);


--
-- Name: product_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."product_variants_id_seq"', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."products_id_seq"', 24, true);


--
-- Name: refunds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."refunds_id_seq"', 1, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."reviews_id_seq"', 14, true);


--
-- Name: search_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."search_logs_id_seq"', 631, true);


--
-- Name: shipping_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."shipping_methods_id_seq"', 4, true);


--
-- Name: store_balance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."store_balance_id_seq"', 7, true);


--
-- Name: store_followers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."store_followers_id_seq"', 8, true);


--
-- Name: stores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."stores_id_seq"', 9, true);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."subscriptions_id_seq"', 7, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."transactions_id_seq"', 9, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."users_id_seq"', 101, true);


--
-- Name: webhook_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."webhook_events_id_seq"', 93, true);


--
-- Name: wishlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."wishlist_id_seq"', 10, true);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");


--
-- Name: cart_items cart_items_user_id_product_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_product_id_variant_id_key" UNIQUE ("user_id", "product_id", "variant_id");


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");


--
-- Name: coupon_usage coupon_usage_coupon_id_user_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_coupon_id_user_id_order_id_key" UNIQUE ("coupon_id", "user_id", "order_id");


--
-- Name: coupon_usage coupon_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id");


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");


--
-- Name: delivery_agent_assignments delivery_agent_assignments_agent_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_agent_assignments"
    ADD CONSTRAINT "delivery_agent_assignments_agent_id_order_id_key" UNIQUE ("agent_id", "order_id");


--
-- Name: delivery_agent_assignments delivery_agent_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_agent_assignments"
    ADD CONSTRAINT "delivery_agent_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: delivery_agents delivery_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_agents"
    ADD CONSTRAINT "delivery_agents_pkey" PRIMARY KEY ("id");


--
-- Name: delivery_agents delivery_agents_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_agents"
    ADD CONSTRAINT "delivery_agents_user_id_key" UNIQUE ("user_id");


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_pkey" PRIMARY KEY ("id");


--
-- Name: inventory_log inventory_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inventory_log"
    ADD CONSTRAINT "inventory_log_pkey" PRIMARY KEY ("id");


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id");


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");


--
-- Name: product_variants product_variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_sku_key" UNIQUE ("sku");


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");


--
-- Name: rate_limit_buckets rate_limit_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("bucket", "key");


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");


--
-- Name: search_logs search_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_logs"
    ADD CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id");


--
-- Name: shipping_methods shipping_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shipping_methods"
    ADD CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id");


--
-- Name: store_balance store_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."store_balance"
    ADD CONSTRAINT "store_balance_pkey" PRIMARY KEY ("id");


--
-- Name: store_balance store_balance_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."store_balance"
    ADD CONSTRAINT "store_balance_store_id_key" UNIQUE ("store_id");


--
-- Name: store_followers store_followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_pkey" PRIMARY KEY ("id");


--
-- Name: store_followers store_followers_store_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_store_id_user_id_key" UNIQUE ("store_id", "user_id");


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");


--
-- Name: stores stores_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_slug_key" UNIQUE ("slug");


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");


--
-- Name: product_images uq_product_images_product_url; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "uq_product_images_product_url" UNIQUE ("product_id", "image_url");


--
-- Name: used_jtis used_jtis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."used_jtis"
    ADD CONSTRAINT "used_jtis_pkey" PRIMARY KEY ("jti");


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: webhook_events webhook_events_dedup_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_dedup_key" UNIQUE ("provider", "event_id", "transaction_id", "event_type");


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");


--
-- Name: wishlist wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id");


--
-- Name: wishlist wishlist_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_user_id_product_id_key" UNIQUE ("user_id", "product_id");


--
-- Name: idx_addresses_one_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_addresses_one_default" ON "public"."addresses" USING "btree" ("user_id") WHERE ("is_default" = true);


--
-- Name: idx_addresses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_addresses_user" ON "public"."addresses" USING "btree" ("user_id");


--
-- Name: idx_app_settings_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_settings_updated_at" ON "public"."app_settings" USING "btree" ("updated_at" DESC);


--
-- Name: idx_assignments_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignments_agent" ON "public"."delivery_agent_assignments" USING "btree" ("agent_id", "assigned_at" DESC);


--
-- Name: idx_assignments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignments_order" ON "public"."delivery_agent_assignments" USING "btree" ("order_id");


--
-- Name: idx_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignments_status" ON "public"."delivery_agent_assignments" USING "btree" ("status");


--
-- Name: idx_audit_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_created_brin" ON "public"."admin_audit_log" USING "brin" ("created_at");


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_entity" ON "public"."admin_audit_log" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_user" ON "public"."admin_audit_log" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_cart_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cart_items_product" ON "public"."cart_items" USING "btree" ("product_id");


--
-- Name: idx_cart_items_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cart_items_user" ON "public"."cart_items" USING "btree" ("user_id");


--
-- Name: idx_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_categories_active" ON "public"."categories" USING "btree" ("is_active", "sort_order");


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_categories_parent" ON "public"."categories" USING "btree" ("parent_id");


--
-- Name: idx_coupon_usage_coupon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coupon_usage_coupon" ON "public"."coupon_usage" USING "btree" ("coupon_id");


--
-- Name: idx_coupon_usage_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coupon_usage_order" ON "public"."coupon_usage" USING "btree" ("order_id");


--
-- Name: idx_coupon_usage_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coupon_usage_user" ON "public"."coupon_usage" USING "btree" ("user_id");


--
-- Name: idx_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coupons_active" ON "public"."coupons" USING "btree" ("is_active");


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coupons_code" ON "public"."coupons" USING "btree" ("code") WHERE ("is_active" = true);


--
-- Name: idx_coupons_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coupons_store" ON "public"."coupons" USING "btree" ("store_id");


--
-- Name: idx_delivery_agents_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_delivery_agents_location" ON "public"."delivery_agents" USING "btree" ("current_lat", "current_lng") WHERE (("current_lat" IS NOT NULL) AND ("current_lng" IS NOT NULL));


--
-- Name: idx_delivery_agents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_delivery_agents_status" ON "public"."delivery_agents" USING "btree" ("status");


--
-- Name: idx_delivery_agents_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_delivery_agents_user" ON "public"."delivery_agents" USING "btree" ("user_id");


--
-- Name: idx_disputes_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_disputes_customer" ON "public"."disputes" USING "btree" ("customer_id");


--
-- Name: idx_disputes_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_disputes_order" ON "public"."disputes" USING "btree" ("order_id");


--
-- Name: idx_disputes_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_disputes_priority" ON "public"."disputes" USING "btree" ("priority", "created_at") WHERE (("priority")::"text" = ANY ((ARRAY['high'::character varying, 'urgent'::character varying])::"text"[]));


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_disputes_status" ON "public"."disputes" USING "btree" ("status") WHERE (("status")::"text" <> ALL ((ARRAY['closed'::character varying, 'rejected'::character varying])::"text"[]));


--
-- Name: idx_disputes_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_disputes_store" ON "public"."disputes" USING "btree" ("store_id");


--
-- Name: idx_followers_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_followers_store" ON "public"."store_followers" USING "btree" ("store_id");


--
-- Name: idx_followers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_followers_user" ON "public"."store_followers" USING "btree" ("user_id");


--
-- Name: idx_inventory_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_inventory_created_brin" ON "public"."inventory_log" USING "brin" ("created_at");


--
-- Name: idx_inventory_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_inventory_product" ON "public"."inventory_log" USING "btree" ("product_id", "created_at" DESC);


--
-- Name: idx_inventory_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_inventory_store" ON "public"."inventory_log" USING "btree" ("store_id", "created_at" DESC);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("sender_id", "receiver_id", "created_at" DESC);


--
-- Name: idx_messages_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_product" ON "public"."messages" USING "btree" ("product_id");


--
-- Name: idx_messages_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_receiver" ON "public"."messages" USING "btree" ("receiver_id", "created_at" DESC);


--
-- Name: idx_messages_receiver_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_receiver_active" ON "public"."messages" USING "btree" ("receiver_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC);


--
-- Name: idx_messages_sender_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_sender_active" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);


--
-- Name: idx_messages_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_store" ON "public"."messages" USING "btree" ("store_id");


--
-- Name: idx_notifications_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_created_brin" ON "public"."notifications" USING "brin" ("created_at");


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC) WHERE (("is_read" = false) AND ("deleted_at" IS NULL));


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_notifications_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_user_active" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");


--
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_order_items_product" ON "public"."order_items" USING "btree" ("product_id");


--
-- Name: idx_orders_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_created_brin" ON "public"."orders" USING "brin" ("created_at");


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_customer" ON "public"."orders" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: idx_orders_delivery_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_delivery_agent" ON "public"."orders" USING "btree" ("delivery_agent_id") WHERE ("delivery_agent_id" IS NOT NULL);


--
-- Name: idx_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_payment_status" ON "public"."orders" USING "btree" ("payment_status");


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");


--
-- Name: idx_orders_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_store" ON "public"."orders" USING "btree" ("store_id", "created_at" DESC);


--
-- Name: idx_orders_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_store_status" ON "public"."orders" USING "btree" ("store_id", "status", "created_at" DESC);


--
-- Name: idx_payments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payments_order" ON "public"."payments" USING "btree" ("order_id");


--
-- Name: idx_payments_provider_txn_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payments_provider_txn_id" ON "public"."payments" USING "btree" ("provider_txn_id") WHERE ("provider_txn_id" IS NOT NULL);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");


--
-- Name: idx_payments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payments_user" ON "public"."payments" USING "btree" ("user_id");


--
-- Name: idx_product_images_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_product_images_primary" ON "public"."product_images" USING "btree" ("product_id", "is_primary") WHERE ("is_primary" = true);


--
-- Name: idx_product_images_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_product_images_product" ON "public"."product_images" USING "btree" ("product_id");


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_active" ON "public"."products" USING "btree" ("is_active") WHERE (("is_active" = true) AND ("deleted_at" IS NULL));


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category_id");


--
-- Name: idx_products_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_created" ON "public"."products" USING "btree" ("created_at" DESC);


--
-- Name: idx_products_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_deal" ON "public"."products" USING "btree" ("deal_discount") WHERE ("deal_discount" IS NOT NULL);


--
-- Name: idx_products_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_featured" ON "public"."products" USING "btree" ("is_featured") WHERE (("is_featured" = true) AND ("deleted_at" IS NULL));


--
-- Name: idx_products_popular; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_popular" ON "public"."products" USING "btree" ("sold_count" DESC, "created_at" DESC) WHERE (("is_active" = true) AND ("deleted_at" IS NULL));


--
-- Name: idx_products_search_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_search_tsv" ON "public"."products" USING "gin" ("search_tsv") WHERE (("is_active" = true) AND ("deleted_at" IS NULL));


--
-- Name: idx_products_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_store" ON "public"."products" USING "btree" ("store_id");


--
-- Name: idx_products_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_store_active" ON "public"."products" USING "btree" ("store_id", "is_active") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_rate_limit_reset_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rate_limit_reset_at" ON "public"."rate_limit_buckets" USING "btree" ("reset_at");


--
-- Name: idx_refunds_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_refunds_order" ON "public"."refunds" USING "btree" ("order_id");


--
-- Name: idx_refunds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_refunds_status" ON "public"."refunds" USING "btree" ("status");


--
-- Name: idx_refunds_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_refunds_user" ON "public"."refunds" USING "btree" ("user_id");


--
-- Name: idx_reviews_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reviews_customer" ON "public"."reviews" USING "btree" ("customer_id");


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reviews_product" ON "public"."reviews" USING "btree" ("product_id", "created_at" DESC);


--
-- Name: idx_reviews_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reviews_store" ON "public"."reviews" USING "btree" ("store_id", "created_at" DESC);


--
-- Name: idx_reviews_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reviews_visible" ON "public"."reviews" USING "btree" ("is_visible") WHERE ("is_visible" = true);


--
-- Name: idx_search_logs_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_search_logs_created_brin" ON "public"."search_logs" USING "brin" ("created_at");


--
-- Name: idx_search_logs_normalized_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_search_logs_normalized_time" ON "public"."search_logs" USING "btree" ("query_normalized", "created_at" DESC) WHERE ("created_at" > '2026-01-01 00:00:00+00'::timestamp with time zone);


--
-- Name: idx_shipping_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_shipping_active" ON "public"."shipping_methods" USING "btree" ("is_active", "sort_order");


--
-- Name: idx_stores_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_stores_active" ON "public"."stores" USING "btree" ("is_active") WHERE ("is_active" = true);


--
-- Name: idx_stores_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_stores_created" ON "public"."stores" USING "brin" ("created_at");


--
-- Name: idx_stores_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_stores_owner" ON "public"."stores" USING "btree" ("owner_id");


--
-- Name: idx_stores_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_stores_rating" ON "public"."stores" USING "btree" ("rating" DESC);


--
-- Name: idx_stores_trust; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_stores_trust" ON "public"."stores" USING "btree" ("trust_level");


--
-- Name: idx_subscriptions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_subscriptions_expires_at" ON "public"."subscriptions" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);


--
-- Name: idx_subscriptions_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_subscriptions_one_active" ON "public"."subscriptions" USING "btree" ("store_id") WHERE (("status")::"text" = ANY ((ARRAY['active'::character varying, 'past_due'::character varying])::"text"[]));


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['active'::character varying, 'past_due'::character varying])::"text"[]));


--
-- Name: idx_subscriptions_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_subscriptions_store" ON "public"."subscriptions" USING "btree" ("store_id");


--
-- Name: idx_transactions_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_transactions_created_brin" ON "public"."transactions" USING "brin" ("created_at");


--
-- Name: idx_transactions_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_transactions_store" ON "public"."transactions" USING "btree" ("store_id", "created_at" DESC);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_transactions_type" ON "public"."transactions" USING "btree" ("type");


--
-- Name: idx_used_jtis_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_used_jtis_expires_at" ON "public"."used_jtis" USING "btree" ("expires_at");


--
-- Name: idx_users_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_users_created_brin" ON "public"."users" USING "brin" ("created_at");


--
-- Name: idx_users_delivery_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_users_delivery_agent" ON "public"."users" USING "btree" ("role") WHERE (("role")::"text" = 'delivery_agent'::"text");


--
-- Name: idx_users_delivery_agent_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_users_delivery_agent_status" ON "public"."users" USING "btree" ("status", "is_online") WHERE (("role")::"text" = 'delivery_agent'::"text");


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_users_phone" ON "public"."users" USING "btree" ("phone") WHERE (("deleted_at" IS NULL) AND ("phone" IS NOT NULL));


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_users_status" ON "public"."users" USING "btree" ("status") WHERE (("status")::"text" <> 'active'::"text");


--
-- Name: idx_variants_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_variants_active" ON "public"."product_variants" USING "btree" ("is_active") WHERE ("is_active" = true);


--
-- Name: idx_variants_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_variants_product" ON "public"."product_variants" USING "btree" ("product_id");


--
-- Name: idx_webhook_events_txn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_webhook_events_txn" ON "public"."webhook_events" USING "btree" ("provider", "transaction_id", "created_at" DESC);


--
-- Name: idx_wishlist_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wishlist_product" ON "public"."wishlist" USING "btree" ("product_id");


--
-- Name: idx_wishlist_product_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wishlist_product_active" ON "public"."wishlist" USING "btree" ("product_id") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_wishlist_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wishlist_user" ON "public"."wishlist" USING "btree" ("user_id");


--
-- Name: idx_wishlist_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wishlist_user_active" ON "public"."wishlist" USING "btree" ("user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);


--
-- Name: v_order_summary _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."v_order_summary" WITH ("security_invoker"='true') AS
 SELECT "o"."id",
    "o"."order_number",
    "o"."status",
    "o"."payment_status",
    "o"."payment_method",
    "o"."subtotal",
    "o"."shipping_cost",
    "o"."discount",
    "o"."discount_amount",
    "o"."coupon_code",
    "o"."total",
    "o"."currency",
    "o"."created_at",
    "o"."updated_at",
    "o"."customer_id",
    "u"."full_name" AS "customer_name",
    "u"."email" AS "customer_email",
    "u"."phone" AS "customer_phone",
    "o"."store_id",
    "s"."store_name" AS "store_name_ar",
    "s"."slug" AS "store_slug",
    "s"."logo" AS "store_logo",
    "s"."trust_level",
    "count"("i"."id") AS "items_count",
    "sum"("i"."quantity") AS "total_qty"
   FROM ((("public"."orders" "o"
     JOIN "public"."users" "u" ON (("u"."id" = "o"."customer_id")))
     JOIN "public"."stores" "s" ON (("s"."id" = "o"."store_id")))
     LEFT JOIN "public"."order_items" "i" ON (("i"."order_id" = "o"."id")))
  GROUP BY "o"."id", "u"."full_name", "u"."email", "u"."phone", "s"."store_name", "s"."slug", "s"."logo", "s"."trust_level";


--
-- Name: addresses trg_addresses_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_addresses_set_updated_at" BEFORE UPDATE ON "public"."addresses" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: cart_items trg_cart_items_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_cart_items_set_updated_at" BEFORE UPDATE ON "public"."cart_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: categories trg_categories_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_categories_set_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: coupon_usage trg_coupon_usage_decrement_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_coupon_usage_decrement_count" AFTER DELETE ON "public"."coupon_usage" FOR EACH ROW EXECUTE FUNCTION "public"."trg_coupon_usage_decrement_on_delete"();


--
-- Name: coupon_usage trg_coupon_usage_enforce_limits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_coupon_usage_enforce_limits" BEFORE INSERT ON "public"."coupon_usage" FOR EACH ROW EXECUTE FUNCTION "public"."trg_coupon_usage_enforce_limits"();


--
-- Name: coupons trg_coupons_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_coupons_set_updated_at" BEFORE UPDATE ON "public"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: delivery_agent_assignments trg_delivery_agent_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_delivery_agent_assignments_updated_at" BEFORE UPDATE ON "public"."delivery_agent_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: delivery_agents trg_delivery_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_delivery_agents_updated_at" BEFORE UPDATE ON "public"."delivery_agents" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: disputes trg_disputes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_disputes_set_updated_at" BEFORE UPDATE ON "public"."disputes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: store_followers trg_followers_refresh_count_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_followers_refresh_count_del" AFTER DELETE ON "public"."store_followers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_stores_refresh_followers_count"();


--
-- Name: store_followers trg_followers_refresh_count_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_followers_refresh_count_ins" AFTER INSERT ON "public"."store_followers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_stores_refresh_followers_count"();


--
-- Name: store_followers trg_followers_refresh_count_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_followers_refresh_count_upd" AFTER UPDATE ON "public"."store_followers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_stores_refresh_followers_count"();


--
-- Name: order_items trg_order_items_decrement_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_order_items_decrement_stock" BEFORE INSERT ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_order_items_decrement_stock"();


--
-- Name: order_items trg_order_items_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_order_items_set_updated_at" BEFORE UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: orders trg_orders_a_state_machine; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_orders_a_state_machine" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trg_orders_state_machine"();


--
-- Name: orders trg_orders_append_timeline; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_orders_append_timeline" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trg_orders_append_timeline"();


--
-- Name: orders trg_orders_refresh_store_sales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_orders_refresh_store_sales" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trg_stores_refresh_sales_count"();


--
-- Name: orders trg_orders_release_coupon_on_cancel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_orders_release_coupon_on_cancel" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trg_orders_release_coupon_on_cancel"();


--
-- Name: orders trg_orders_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_orders_set_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: payments trg_payments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: product_images trg_product_images_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_product_images_set_updated_at" BEFORE UPDATE ON "public"."product_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: product_variants trg_product_variants_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_product_variants_set_updated_at" BEFORE UPDATE ON "public"."product_variants" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: products trg_products_refresh_store_count_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_products_refresh_store_count_del" AFTER DELETE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."trg_products_refresh_store_count"();


--
-- Name: products trg_products_refresh_store_count_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_products_refresh_store_count_ins" AFTER INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."trg_products_refresh_store_count"();


--
-- Name: products trg_products_refresh_store_count_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_products_refresh_store_count_upd" AFTER UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."trg_products_refresh_store_count"();


--
-- Name: products trg_products_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_products_set_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: rate_limit_buckets trg_rate_limit_buckets_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_rate_limit_buckets_set_updated_at" BEFORE UPDATE ON "public"."rate_limit_buckets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: refunds trg_refunds_resolve_payments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_refunds_resolve_payments" BEFORE INSERT OR UPDATE ON "public"."refunds" FOR EACH ROW EXECUTE FUNCTION "public"."trg_refunds_resolve_payments"();


--
-- Name: refunds trg_refunds_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_refunds_set_updated_at" BEFORE UPDATE ON "public"."refunds" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: reviews trg_reviews_refresh_rating_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_reviews_refresh_rating_del" AFTER DELETE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_reviews_refresh_rating"();


--
-- Name: reviews trg_reviews_refresh_rating_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_reviews_refresh_rating_ins" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_reviews_refresh_rating"();


--
-- Name: reviews trg_reviews_refresh_rating_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_reviews_refresh_rating_upd" AFTER UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_reviews_refresh_rating"();


--
-- Name: reviews trg_reviews_refresh_store_stats_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_reviews_refresh_store_stats_del" AFTER DELETE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_stores_refresh_review_stats"();


--
-- Name: reviews trg_reviews_refresh_store_stats_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_reviews_refresh_store_stats_ins" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_stores_refresh_review_stats"();


--
-- Name: reviews trg_reviews_refresh_store_stats_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_reviews_refresh_store_stats_upd" AFTER UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_stores_refresh_review_stats"();


--
-- Name: reviews trg_reviews_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_reviews_set_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: shipping_methods trg_shipping_methods_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_shipping_methods_set_updated_at" BEFORE UPDATE ON "public"."shipping_methods" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: store_balance trg_store_balance_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_store_balance_set_updated_at" BEFORE UPDATE ON "public"."store_balance" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: stores trg_stores_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_stores_set_updated_at" BEFORE UPDATE ON "public"."stores" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: subscriptions trg_subscriptions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_subscriptions_set_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: users trg_sync_users_two_factor_enabled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_sync_users_two_factor_enabled" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_users_two_factor_enabled"();


--
-- Name: transactions trg_transactions_balance_after; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_transactions_balance_after" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_transactions_check_balance_after"();


--
-- Name: users trg_users_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_users_set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: admin_audit_log admin_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


--
-- Name: app_settings app_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;


--
-- Name: coupon_usage coupon_usage_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE CASCADE;


--
-- Name: coupon_usage coupon_usage_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;


--
-- Name: coupon_usage coupon_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;


--
-- Name: coupons coupons_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;


--
-- Name: delivery_agent_assignments delivery_agent_assignments_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_agent_assignments"
    ADD CONSTRAINT "delivery_agent_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."delivery_agents"("id") ON DELETE CASCADE;


--
-- Name: delivery_agent_assignments delivery_agent_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_agent_assignments"
    ADD CONSTRAINT "delivery_agent_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: delivery_agents delivery_agents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_agents"
    ADD CONSTRAINT "delivery_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: disputes disputes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;


--
-- Name: disputes disputes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;


--
-- Name: disputes disputes_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


--
-- Name: disputes disputes_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE RESTRICT;


--
-- Name: inventory_log inventory_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inventory_log"
    ADD CONSTRAINT "inventory_log_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


--
-- Name: inventory_log inventory_log_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inventory_log"
    ADD CONSTRAINT "inventory_log_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE RESTRICT;


--
-- Name: messages messages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;


--
-- Name: messages messages_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: messages messages_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;


--
-- Name: orders orders_delivery_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_delivery_agent_id_fkey" FOREIGN KEY ("delivery_agent_id") REFERENCES "public"."delivery_agents"("id") ON DELETE SET NULL;


--
-- Name: orders orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE RESTRICT;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;


--
-- Name: products products_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE RESTRICT;


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;


--
-- Name: refunds refunds_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


--
-- Name: refunds refunds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;


--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: reviews reviews_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;


--
-- Name: search_logs search_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_logs"
    ADD CONSTRAINT "search_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


--
-- Name: store_balance store_balance_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."store_balance"
    ADD CONSTRAINT "store_balance_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;


--
-- Name: store_followers store_followers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;


--
-- Name: store_followers store_followers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: stores stores_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;


--
-- Name: subscriptions subscriptions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;


--
-- Name: transactions transactions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE RESTRICT;


--
-- Name: used_jtis used_jtis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."used_jtis"
    ADD CONSTRAINT "used_jtis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: wishlist wishlist_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: wishlist wishlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings app_settings_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "app_settings_admin_update" ON "public"."app_settings" FOR UPDATE TO "noufex_owner" USING (true) WITH CHECK (true);


--
-- Name: app_settings app_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "app_settings_select" ON "public"."app_settings" FOR SELECT TO "noufex_app" USING (true);


--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_events webhook_events_app_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "webhook_events_app_insert" ON "public"."webhook_events" FOR INSERT TO "noufex_app" WITH CHECK (true);


--
-- Name: webhook_events webhook_events_app_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "webhook_events_app_select" ON "public"."webhook_events" FOR SELECT TO "noufex_app" USING (true);


--
-- Name: webhook_events webhook_events_app_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "webhook_events_app_update" ON "public"."webhook_events" FOR UPDATE TO "noufex_app" USING ((("processing_state")::"text" = 'received'::"text")) WITH CHECK ((("processing_state")::"text" = 'processed'::"text"));


--
-- PostgreSQL database dump complete
--

\unrestrict WEgIuQYVyJoxixSAv8afcMtFbNDv45taMICchRFW0cGm7pmOiB1JDaAHhy8ERgZ

