-- =====================================================================
-- Migration 0034: Add Alipay and WeChat Pay payment methods
-- =====================================================================
-- Updates the orders and payments tables to support Alipay and WeChat Pay
-- as valid payment methods.
-- =====================================================================

-- Update orders table constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cod','card','wallet','bank_transfer','stripe','paymob','alipay','wechat_pay'));

-- Update payments table constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
    CHECK (method IN ('cod','card','wallet','bank_transfer','stripe','paymob','alipay','wechat_pay'));

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('0034_payment_methods_extend', 'Migration 0034: Add Alipay and WeChat Pay payment methods')
ON CONFLICT (version) DO NOTHING;
