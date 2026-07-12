-- =====================================================================
-- Migration: Add delivery_agent role
-- =====================================================================

-- Update users table role CHECK constraint to include delivery_agent
-- We need to drop the existing constraint and recreate it

-- First, check if constraint exists and drop it
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
EXCEPTION WHEN OTHERS THEN
    -- constraint might not exist or have different name
    NULL;
END $$;

-- Add the new constraint with delivery_agent
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('customer','merchant','admin','delivery_agent'));

-- Create index for delivery_agents for faster queries
CREATE INDEX IF NOT EXISTS idx_users_delivery_agent ON users(role) WHERE role = 'delivery_agent';

-- Add delivery_agent specific columns to users table (optional profile fields)
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_latitude NUMERIC(9,6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_longitude NUMERIC(9,6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_on_duty BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) NOT NULL DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_deliveries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_deliveries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_deliveries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_delivery_time_minutes INTEGER;

-- Add index for delivery agent queries
CREATE INDEX IF NOT EXISTS idx_users_delivery_agent_status ON users(status, is_online) WHERE role = 'delivery_agent';

-- Add comment
COMMENT ON COLUMN users.vehicle_type IS 'Delivery vehicle type: motorcycle, car, van, bicycle';
COMMENT ON COLUMN users.vehicle_plate IS 'Vehicle license plate number';
COMMENT ON COLUMN users.license_number IS 'Driver license number';
COMMENT ON COLUMN users.current_latitude IS 'Current GPS latitude for tracking';
COMMENT ON COLUMN users.current_longitude IS 'Current GPS longitude for tracking';
COMMENT ON COLUMN users.is_online IS 'Whether the delivery agent is online in the app';
COMMENT ON COLUMN users.is_on_duty IS 'Whether the delivery agent is currently on duty';
COMMENT ON COLUMN users.rating IS 'Delivery agent rating (0-5)';
COMMENT ON COLUMN users.total_deliveries IS 'Total assigned deliveries';
COMMENT ON COLUMN users.completed_deliveries IS 'Successfully completed deliveries';
COMMENT ON COLUMN users.cancelled_deliveries IS 'Cancelled deliveries';
COMMENT ON COLUMN users.avg_delivery_time_minutes IS 'Average delivery time in minutes';