-- =====================================================================
-- Migration 0027 — Additional integrity fixes (audit 2026-07-09)
-- =====================================================================
-- Adds missing CHECK constraints and indexes for production hardening.
-- All changes are idempotent (IF NOT EXISTS / DO blocks).
-- =====================================================================

-- ── 1. transactions: sign consistency ───────────────────────────────
-- Without sign constraints, a withdrawal could be inserted with a
-- positive amount, corrupting the store wallet ledger. Enforce:
--   - order / refund / fee / adjustment: amount >= 0 (positive)
--   - withdrawal:                      amount <  0 (negative)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_sign'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT transactions_amount_sign CHECK (
                (type = 'withdrawal' AND amount < 0) OR
                (type <> 'withdrawal' AND amount >= 0)
            );
    END IF;
END $$;

-- ── 2. product_variants: prevent negative effective price ──────────
-- price_delta could be set to a value more negative than product.price,
-- resulting in a negative effective price (would credit the buyer).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_price_delta'
    ) THEN
        ALTER TABLE product_variants
            ADD CONSTRAINT product_variants_price_delta
            CHECK (price_delta > -1000000);
    END IF;
END $$;

-- ── 3. webhook_events: validate processing_state ────────────────────
-- The RLS policy on line 99 of migration 0020 checks
-- processing_state = 'received', so invalid states could bypass RLS.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_processing_state'
    ) THEN
        ALTER TABLE webhook_events
            ADD CONSTRAINT webhook_events_processing_state
            CHECK (processing_state IN ('received', 'processed'));
    END IF;
END $$;

-- ── 4. subscriptions: index on expires_at ───────────────────────────
-- Auto-renewal jobs and expiry notifications need to scan by expires_at.
-- The existing partial index on status won't help when the status
-- filter is omitted.
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at
    ON subscriptions(expires_at) WHERE expires_at IS NOT NULL;

-- ── 5. messages: composite index for conversation queries ───────────
-- The most common query is "conversation between A and B":
--   WHERE (sender_id = A AND receiver_id = B)
--      OR (sender_id = B AND receiver_id = A)
-- The existing single-column indexes don't serve this efficiently.
CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(sender_id, receiver_id, created_at DESC);