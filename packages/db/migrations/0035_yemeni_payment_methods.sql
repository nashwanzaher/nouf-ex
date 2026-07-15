-- =====================================================================
-- Migration 0035: Yemeni payment methods
-- =====================================================================
-- Adds Jib, Al-Karimi, Jawali, Floosk, and Yemen Wallet as valid
-- payment methods in the orders and payments tables.
-- =====================================================================

-- Update orders table constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN (
        'cod','card','wallet','bank_transfer','stripe','paymob',
        'alipay','wechat_pay',
        'jib','alkarimi','jawali','floosk','yemen_wallet'
    ));

-- Update payments table constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
    CHECK (method IN (
        'cod','card','wallet','bank_transfer','stripe','paymob',
        'alipay','wechat_pay',
        'jib','alkarimi','jawali','floosk','yemen_wallet'
    ));

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('0035_yemeni_payment_methods', 'Migration 0035: Add Yemeni payment methods (Jib, Al-Karimi, Jawali, Floosk, Yemen Wallet)')
ON CONFLICT (version) DO NOTHING;
