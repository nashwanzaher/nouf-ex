import { db } from '../../lib/shared.ts';

export interface AgentRow {
	id: number;
	user_id: number;
	vehicle_type: string;
	vehicle_plate: string;
	license_number: string;
	status: 'active' | 'offline' | 'busy' | 'suspended';
	current_lat: number | null;
	current_lng: number | null;
	rating: number;
	total_deliveries: number;
	completed_deliveries: number;
	cancelled_deliveries: number;
	avg_delivery_time_minutes: number | null;
	created_at: string;
	updated_at: string;
	user: {
		id: number;
		email: string;
		full_name: string;
		phone: string;
		avatar: string | null;
		preferred_language: string;
	};
}

export interface OrderSummaryRow {
	id: number;
	order_number: string;
	customer_id: number;
	store_id: number;
	status: string;
	payment_method: string;
	payment_status: string;
	subtotal: number;
	shipping_cost: number;
	discount: number;
	total: number;
	shipping_address: string;
	store_name: string;
	store_logo: string | null;
	customer_name: string;
	customer_phone: string;
	assigned_at: string | null;
	picked_up_at: string | null;
	delivered_at: string | null;
	created_at: string;
}

export interface OrderItemRow {
	id: number;
	product_id: number;
	product_name: string;
	quantity: number;
	unit_price: number;
	total_price: number;
	main_image: string | null;
}

export interface StatsRow {
	total_deliveries: number;
	completed_deliveries: number;
	pending_deliveries: number;
	cancelled_deliveries: number;
	total_earnings: number;
	avg_rating: number;
	avg_delivery_time: number;
	online_hours: number;
}

export interface EarningsRow {
	date: string;
	earnings: number;
	deliveries: number;
}

export async function findAgentByUserId(userId: number): Promise<AgentRow | null> {
	const row = (await db.prepare(`
		SELECT
			da.*,
			u.id as user_id, u.email, u.full_name, u.phone, u.avatar, u.preferred_language
		FROM delivery_agents da
		JOIN users u ON u.id = da.user_id
		WHERE da.user_id = ?
	`).get(userId)) as AgentRow | undefined;
	return row ?? null;
}

export async function createAgent(userId: number, input: {
	vehicle_type?: string;
	vehicle_plate?: string;
	license_number?: string;
}): Promise<AgentRow> {
	const result = (await db.prepare(`
		INSERT INTO delivery_agents (user_id, vehicle_type, vehicle_plate, license_number, status)
		VALUES (?, ?, ?, ?, 'offline')
		RETURNING *
	`).get(userId, input.vehicle_type || 'motorcycle', input.vehicle_plate || '', input.license_number || '')) as unknown as AgentRow;

	await db.prepare(`UPDATE users SET role = 'delivery_agent' WHERE id = ?`).run(userId);

	return result;
}

export async function updateAgent(agentId: number, input: {
	vehicle_type?: string;
	vehicle_plate?: string;
	license_number?: string;
	status?: 'active' | 'offline' | 'busy' | 'suspended';
	current_lat?: number;
	current_lng?: number;
	avatar?: string;
}): Promise<AgentRow | null> {
	const fields: string[] = [];
	const params: unknown[] = [];

	if (input.vehicle_type !== undefined) { fields.push('vehicle_type = ?'); params.push(input.vehicle_type); }
	if (input.vehicle_plate !== undefined) { fields.push('vehicle_plate = ?'); params.push(input.vehicle_plate); }
	if (input.license_number !== undefined) { fields.push('license_number = ?'); params.push(input.license_number); }
	if (input.status !== undefined) { fields.push('status = ?'); params.push(input.status); }
	if (input.current_lat !== undefined) { fields.push('current_lat = ?'); params.push(input.current_lat); }
	if (input.current_lng !== undefined) { fields.push('current_lng = ?'); params.push(input.current_lng); }

	if (fields.length === 0) return findAgentByAgentId(agentId);

	fields.push('updated_at = CURRENT_TIMESTAMP');
	params.push(agentId);

	return (await db.prepare(`UPDATE delivery_agents SET ${fields.join(', ')} WHERE id = ? RETURNING *`).get(...params)) as unknown as AgentRow | null;
}

export async function findAgentByAgentId(agentId: number): Promise<AgentRow | null> {
	return (await db.prepare(`
		SELECT da.*, u.id as user_id, u.email, u.full_name, u.phone, u.avatar, u.preferred_language
		FROM delivery_agents da
		JOIN users u ON u.id = da.user_id
		WHERE da.id = ?
	`).get(agentId)) as unknown as AgentRow | null;
}

export async function updateLocation(userId: number, lat: number, lng: number): Promise<void> {
	const agent = await findAgentByUserId(userId);
	if (agent) {
		await db.prepare(`UPDATE delivery_agents SET current_lat = ?, current_lng = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(lat, lng, agent.id);
	}
	// Also update users table for quick lookups
	await db.prepare(`UPDATE users SET current_latitude = ?, current_longitude = ? WHERE id = ?`).run(lat, lng, userId);
}

export async function getAssignedOrders(agentId: number, status?: string): Promise<OrderSummaryRow[]> {
	let query = `
		SELECT
			o.id, o.order_number, o.customer_id, o.store_id, o.status, o.payment_method, o.payment_status,
			o.subtotal, o.shipping_cost, o.discount, o.total, o.shipping_address,
			s.store_name, s.logo as store_logo,
			u.full_name as customer_name, u.phone as customer_phone,
			daa.assigned_at, daa.picked_up_at, daa.delivered_at, o.created_at
		FROM orders o
		JOIN stores s ON s.id = o.store_id
		JOIN users u ON u.id = o.customer_id
		JOIN delivery_agent_assignments daa ON daa.order_id = o.id
		WHERE daa.agent_id = ?
	`;
	const params: unknown[] = [agentId];

	if (status) {
		query += ' AND o.status = ?';
		params.push(status);
	}

	query += ' ORDER BY daa.assigned_at DESC';

	return (await db.prepare(query).all(...params)) as unknown as OrderSummaryRow[];
}

export async function getOrderById(agentId: number, orderId: number): Promise<OrderSummaryRow | null> {
	const row = await db.prepare(`
		SELECT
			o.id, o.order_number, o.customer_id, o.store_id, o.status, o.payment_method, o.payment_status,
			o.subtotal, o.shipping_cost, o.discount, o.total, o.shipping_address,
			s.store_name, s.logo as store_logo,
			u.full_name as customer_name, u.phone as customer_phone,
			daa.assigned_at, daa.picked_up_at, daa.delivered_at, o.created_at
		FROM orders o
		JOIN stores s ON s.id = o.store_id
		JOIN users u ON u.id = o.customer_id
		JOIN delivery_agent_assignments daa ON daa.order_id = o.id
		WHERE daa.agent_id = ? AND o.id = ?
	`).get(agentId, orderId) as OrderSummaryRow | undefined;
	return row ?? null;
}

export async function getOrderItems(orderId: number): Promise<OrderItemRow[]> {
	return (await db.prepare(`
		SELECT oi.id, oi.product_id, oi.product_name as product_name, oi.quantity, oi.unit_price, oi.total_price,
			p.main_image
		FROM order_items oi
		LEFT JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = ?
	`).all(orderId)) as unknown as OrderItemRow[];
}

export async function getStats(agentId: number): Promise<StatsRow> {
	const row = await db.prepare(`
		SELECT
			COUNT(*) as total_deliveries,
			SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as completed_deliveries,
			SUM(CASE WHEN o.status IN ('out_for_delivery', 'shipped') THEN 1 ELSE 0 END) as pending_deliveries,
			SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_deliveries,
			COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.shipping_cost ELSE 0 END), 0) as total_earnings,
			da.rating as avg_rating,
			da.avg_delivery_time_minutes as avg_delivery_time,
			0 as online_hours
		FROM delivery_agent_assignments daa
		JOIN orders o ON o.id = daa.order_id
		JOIN delivery_agents da ON da.id = daa.agent_id
		WHERE daa.agent_id = ?
	`).get(agentId) as StatsRow | undefined;
	return row ?? {
		total_deliveries: 0,
		completed_deliveries: 0,
		pending_deliveries: 0,
		cancelled_deliveries: 0,
		total_earnings: 0,
		avg_rating: 5,
		avg_delivery_time: 0,
		online_hours: 0,
	};
}

export async function getEarningsHistory(agentId: number, days: number): Promise<EarningsRow[]> {
	return (await db.prepare(`
		SELECT
			DATE(o.delivered_at) as date,
			SUM(o.shipping_cost) as earnings,
			COUNT(*) as deliveries
		FROM delivery_agent_assignments daa
		JOIN orders o ON o.id = daa.order_id
		WHERE daa.agent_id = ? AND o.status = 'delivered' AND o.delivered_at >= DATE('now', ? || ' days')
		GROUP BY DATE(o.delivered_at)
		ORDER BY date DESC
	`).all(agentId, -days)) as unknown as EarningsRow[];
}

export async function getAvailableOrders(lat?: number, lng?: number): Promise<OrderSummaryRow[]> {
	// Get orders that are shipped/confirmed and not yet assigned to an agent
	// Prioritize orders near the agent's location
	let query = `
		SELECT
			o.id, o.order_number, o.customer_id, o.store_id, o.status, o.payment_method, o.payment_status,
			o.subtotal, o.shipping_cost, o.discount, o.total, o.shipping_address,
			s.store_name, s.logo as store_logo,
			u.full_name as customer_name, u.phone as customer_phone,
			null as assigned_at, null as picked_up_at, null as delivered_at, o.created_at
		FROM orders o
		JOIN stores s ON s.id = o.store_id
		JOIN users u ON u.id = o.customer_id
		WHERE o.status IN ('confirmed', 'processing', 'shipped')
		AND NOT EXISTS (
			SELECT 1 FROM delivery_agent_assignments daa WHERE daa.order_id = o.id
		)
	`;

	if (lat && lng) {
		// TODO: Add PostGIS distance calculation for better sorting
		query += ` ORDER BY o.created_at ASC`;
	} else {
		query += ` ORDER BY o.created_at ASC`;
	}

	query += ` LIMIT 20`;

	return (await db.prepare(query).all()) as unknown as OrderSummaryRow[];
}

export async function assignOrder(agentId: number, orderId: number): Promise<boolean> {
	try {
		await db.prepare(`BEGIN`).run();
		// Check if order is still available
		const assigned = await db.prepare(`SELECT 1 FROM delivery_agent_assignments WHERE order_id = ?`).get(orderId);
		if (assigned) return false;

		// Assign order
		await db.prepare(`
			INSERT INTO delivery_agent_assignments (agent_id, order_id, assigned_at)
			VALUES (?, ?, CURRENT_TIMESTAMP)
		`).run(agentId, orderId);

		// Update order status to shipped if it was confirmed/processing
		await db.prepare(`
			UPDATE orders SET status = 'shipped', updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND status IN ('confirmed', 'processing')
		`).run(orderId);

		await db.prepare(`COMMIT`).run();
		return true;
	} catch {
		await db.prepare(`ROLLBACK`).run();
		return false;
	}
}

export async function updateOrderStatus(agentId: number, orderId: number, status: 'out_for_delivery' | 'delivered'): Promise<boolean> {
	try {
		await db.prepare(`BEGIN`).run();

		// Verify assignment
		const assignment = await db.prepare(`
			SELECT 1 FROM delivery_agent_assignments WHERE agent_id = ? AND order_id = ?
		`).get(agentId, orderId);
		if (!assignment) return false;

		if (status === 'out_for_delivery') {
			await db.prepare(`
				UPDATE delivery_agent_assignments SET picked_up_at = CURRENT_TIMESTAMP WHERE agent_id = ? AND order_id = ?
			`).run(agentId, orderId);
			await db.prepare(`UPDATE orders SET status = 'out_for_delivery', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId);
		} else if (status === 'delivered') {
			await db.prepare(`
				UPDATE delivery_agent_assignments SET delivered_at = CURRENT_TIMESTAMP WHERE agent_id = ? AND order_id = ?
			`).run(agentId, orderId);
			await db.prepare(`UPDATE orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId);
		}

		await db.prepare(`COMMIT`).run();
		return true;
	} catch {
		await db.prepare(`ROLLBACK`).run();
		return false;
	}
}