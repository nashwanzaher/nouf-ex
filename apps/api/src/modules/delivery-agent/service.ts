import * as repo from './repository.ts';

export interface RegisterAgentData {
	vehicle_type?: string;
	vehicle_plate?: string;
	license_number?: string;
}

export async function registerAgent(userId: number, data: RegisterAgentData) {
	const existing = await repo.findAgentByUserId(userId);
	if (existing) {
		throw new Error('Agent already registered');
	}
	return repo.createAgent(userId, data);
}

export async function getAgentProfile(userId: number) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found. Please register first.');
	}
	return agent;
}

interface UpdateAgentInput {
	vehicle_type?: string;
	vehicle_plate?: string;
	license_number?: string;
	status?: 'active' | 'offline' | 'busy' | 'suspended';
	current_lat?: number;
	current_lng?: number;
	avatar?: string;
}

export async function updateAgentProfile(userId: number, data: UpdateAgentInput) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}
	return repo.updateAgent(userId, data);
}

export async function updateAgentLocation(userId: number, coords: { lat: number; lng: number }) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}
	return repo.updateLocation(userId, coords.lat, coords.lng);
}

export async function getAssignedOrders(userId: number, status?: string) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}
	return repo.getAssignedOrders(agent.id, status);
}

export async function getOrderDetails(userId: number, orderId: number) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}

	const order = await repo.getOrderById(agent.id, orderId);
	if (!order) {
		throw new Error('Order not found or not assigned to you');
	}

	const items = await repo.getOrderItems(orderId);
	return { ...order, items };
}

export async function getDashboardStats(userId: number) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}

	const [stats, earningsHistory] = await Promise.all([
		repo.getStats(agent.id),
		repo.getEarningsHistory(agent.id, 30),
	]);

	return { stats, earningsHistory };
}

export async function getAvailableOrders(userId: number, lat?: number, lng?: number) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}

	// Only agents who are online can see available orders
	if (agent.status !== 'active' && agent.status !== 'offline') {
		throw new Error('You must be online to view available orders');
	}

	return repo.getAvailableOrders(lat, lng);
}

export async function acceptOrder(userId: number, orderId: number) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}

	if (agent.status !== 'active') {
		throw new Error('You must be online to accept orders');
	}

	const success = await repo.assignOrder(agent.id, orderId);
	if (!success) {
		throw new Error('Order no longer available or already assigned');
	}

	// Update agent status to busy
	await repo.updateAgent(userId, { status: 'busy' });
	return true;
}

export async function updateDeliveryStatus(userId: number, orderId: number, status: 'out_for_delivery' | 'delivered') {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}

	const success = await repo.updateOrderStatus(agent.id, orderId, status);
	if (!success) {
		throw new Error('Cannot update order status. Invalid transition or order not assigned to you.');
	}

	if (status === 'delivered') {
		// Check if agent has more orders
		const remaining = await repo.getAssignedOrders(agent.id, 'out_for_delivery');
		if (remaining.length === 0) {
			await repo.updateAgent(userId, { status: 'active' });
		}
	}
	return true;
}

export async function goOnline(userId: number) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}
	await repo.updateAgent(userId, { status: 'active' });
	return true;
}

export async function goOffline(userId: number) {
	const agent = await repo.findAgentByUserId(userId);
	if (!agent) {
		throw new Error('Agent profile not found');
	}
	await repo.updateAgent(userId, { status: 'offline' });
	return true;
}