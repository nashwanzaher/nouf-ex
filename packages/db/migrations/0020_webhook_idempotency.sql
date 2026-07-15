-- =====================================================================
-- 0020_webhook_idempotency.sql
--
-- P1-1 (deep audit 2026-06-30): the payments webhook endpoint at
-- POST /api/payments/webhook/:method was not idempotent. Each
-- invocation ran an UNCONDITIONAL UPDATE on payments by
-- provider_txn_id, so:
--
--   - A provider retry caused the SAME state-transition to be
--     re-applied (wasted work + audit log noise).
--   - Out-of-order events (e.g. "succeeded" arrives, then "failed",
--     then a delayed retry of the original "succeeded") would
--     silently land on whichever event arrived LAST — leaving
--     NO audit trail of the intermediate state and potentially
--     marking a payment as failed when it actually succeeded.
--   - Two near-simultaneous webhooks for the same transaction
--     could race on the UPDATE and double-credit / double-debit.
--
-- This migration adds a webhook_events dedup table whose UNIQUE
-- constraint (provider, event_id, transaction_id, event_type) is
-- the atomic dedup primitive. Application code uses
-- `INSERT ... ON CONFLICT DO NOTHING` to claim the event; the
-- payment UPDATE and the dedup-row "processed" flag transition
-- happen inside the same transaction so concurrent duplicates
-- update at most once.
--
-- Why a separate table instead of a column on `payments`:
--   payments rows are created AFTER the first webhook for that
--   provider_txn_id arrives in some flows, so dedup state lives
--   independently. Also, providers may emit multiple distinct
--   event_types for the same transaction (succeeded, failed,
--   refunded) and we want each to be processed exactly once.
-- =====================================================================

CREATE TABLE
IF NOT EXISTS webhook_events
(
    id              BIGSERIAL PRIMARY KEY,
    provider        VARCHAR(32)
                    -- 'stripe', 'paymob', future providers.
                    NOT NULL,
    event_id        VARCHAR(128)
                    -- Provider's unique event id from the payload
                    -- (e.g. Stripe's `evt_...`). Falls back to
                    -- transaction_id when the provider does not
                    -- emit an event id (most non-Stripe APIs).
                    NOT NULL,
    transaction_id  VARCHAR(128) NOT NULL,
    event_type      VARCHAR(64)
                    -- Normalised to status names ('succeeded',
                    -- 'failed', 'refunded'), see payments.ts.
                    NOT NULL,
    payload         JSONB        NOT NULL,
    processing_state VARCHAR(16)
                    -- 'received' → 'processed' (set inside the
                    -- same transaction as the payments UPDATE).
                    NOT NULL DEFAULT 'received',
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT webhook_events_dedup_key
        UNIQUE (provider, event_id, transaction_id, event_type)
);

CREATE INDEX
IF NOT EXISTS idx_webhook_events_txn
    ON webhook_events (provider, transaction_id, created_at DESC);

-- RLS: app role can INSERT and SELECT to claim + read dedup state.
-- UPDATE is also needed by the in-transaction "processed" flag
-- transition. DELETE is denied — the dedup table is append-only
-- so the audit trail of webhook activity is preserved.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Drop any previously-created policies so this migration is
-- idempotent (safe to re-run).
DROP POLICY
IF EXISTS webhook_events_app_select ON webhook_events;
DROP POLICY
IF EXISTS webhook_events_app_insert ON webhook_events;
DROP POLICY
IF EXISTS webhook_events_app_update ON webhook_events;

CREATE POLICY webhook_events_app_select
    ON webhook_events
    FOR SELECT
    TO noufex_app
    USING (TRUE);

CREATE POLICY webhook_events_app_insert
    ON webhook_events
    FOR INSERT
    TO noufex_app
    WITH CHECK (TRUE);

CREATE POLICY webhook_events_app_update
    ON webhook_events
    FOR UPDATE
    TO noufex_app
    USING (processing_state = 'received')
    WITH CHECK (processing_state = 'processed');

-- ANALYZE so the dedup UNIQUE index is fully visible to the
-- planner immediately.
ANALYZE webhook_events;
