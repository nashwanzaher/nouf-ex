-- =====================================================================
-- Migration: Add delivery agents tables
-- =====================================================================

-- Create delivery_agents table
CREATE TABLE IF NOT EXISTS delivery_agents (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
	vehicle_type VARCHAR(50) NOT NULL DEFAULT 'motorcycle' CHECK (vehicle_type IN ('motorcycle', 'bicycle', 'car', 'van', 'truck', 'scooter')),
	vehicle_plate VARCHAR(20),
	vehicle_color VARCHAR(30),
	license_number VARCHAR(50),
	license_expiry DATE,
	insurance_number VARCHAR(50),
	insurance_expiry DATE,
	status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'active', 'busy', 'suspended', 'on_break')),
	current_lat NUMERIC(9,6),
	current_lng NUMERIC(9,6),
	last_location_update TIMESTAMPTZ,
	rating NUMERIC(2,1) NOT NULL DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
	total_deliveries INTEGER NOT NULL DEFAULT 0,
	completed_deliveries INTEGER NOT NULL DEFAULT 0,
	cancelled_deliveries INTEGER NOT NULL DEFAULT 0,
	avg_delivery_time_minutes INTEGER,
	total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_agents_user ON delivery_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_agents_status ON delivery_agents(status);
CREATE INDEX IF NOT EXISTS idx_delivery_agents_location ON delivery_agents(current_lat, current_lng) WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL;

-- Create delivery_agent_assignments table
CREATE TABLE IF NOT EXISTS delivery_agent_assignments (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	agent_id INTEGER NOT NULL REFERENCES delivery_agents(id) ON DELETE CASCADE,
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	accepted_at TIMESTAMPTZ,
	picked_up_at TIMESTAMPTZ,
	delivered_at TIMESTAMPTZ,
	earnings NUMERIC(10,2) DEFAULT 0,
	status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'picked_up', 'delivered', 'cancelled', 'returned')),
	notes TEXT,
	cancelled_reason TEXT,
	cancelled_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE (agent_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_agent ON delivery_agent_assignments(agent_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON delivery_agent_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON delivery_agent_assignments(status);

-- Add delivery_agent_id to orders table for quick lookup
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_agent_id INTEGER REFERENCES delivery_agents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_agent ON orders(delivery_agent_id) WHERE delivery_agent_id IS NOT NULL;

-- Add location columns to users table for all roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_latitude NUMERIC(9,6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_longitude NUMERIC(9,6);

-- Trigger to update updated_at on delivery_agents
CREATE TRIGGER trg_delivery_agents_updated_at
BEFORE UPDATE ON delivery_agents
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Trigger to update updated_at on delivery_agent_assignments
CREATE TRIGGER trg_delivery_agent_assignments_updated_at
BEFORE UPDATE ON delivery_agent_assignments
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Function to calculate agent earnings
CREATE OR REPLACE FUNCTION calculate_agent_earnings(p_agent_id INTEGER, p_start_date DATE, p_end_date DATE)
RETURNS NUMERIC(12,2) LANGUAGE plpgsql AS $$
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

-- Function to get agent stats
CREATE OR REPLACE FUNCTION get_agent_stats(p_agent_id INTEGER)
RETURNS TABLE(
	total_deliveries INTEGER,
	completed_deliveries INTEGER,
	pending_deliveries INTEGER,
	cancelled_deliveries INTEGER,
	total_earnings NUMERIC(12,2),
	avg_rating NUMERIC(2,1),
	avg_delivery_time INTERVAL
) LANGUAGE plpgsql AS $$
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