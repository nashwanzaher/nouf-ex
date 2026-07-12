-- =====================================================================
-- Migration 0028 — transactions balance_after consistency (audit 2026-07-09)
-- =====================================================================
-- The transactions table is an append-only ledger. `balance_after`
-- must always equal the previous balance + amount. A BEFORE INSERT
-- trigger enforces this at the DB level so application bugs can't
-- corrupt the ledger silently.
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_transactions_check_balance_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
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

DROP TRIGGER IF EXISTS trg_transactions_balance_after ON transactions;
CREATE TRIGGER trg_transactions_balance_after
    BEFORE INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION trg_transactions_check_balance_after();

-- Add CHECK constraint to prevent negative balance_after
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_balance_non_negative'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT transactions_balance_non_negative
            CHECK (balance_after >= 0);
    END IF;
END $$;