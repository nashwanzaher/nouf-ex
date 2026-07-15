import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendError, sendSuccess, requireAuth, requireRole, validate, ErrorCodes } from '../../lib/shared.ts';
import * as service from './service.ts';

// ── Zod schemas (OWASP ASVS 5.1.1, NIST SP 800-53 SI-10) ─────────────
// SECURITY: every mutation endpoint now validates input through Zod
// before it reaches the service layer. This prevents:
//   - NaN / Infinity flowing into SQL (22P02 errors)
//   - Unexpected fields being accepted (mass assignment)
//   - Missing required fields causing runtime crashes

const registerAgentSchema = z.object({
	vehicle_type: z.enum(['motorcycle', 'bicycle', 'car', 'van', 'truck', 'scooter']).default('motorcycle'),
	vehicle_plate: z.string().trim().min(1).max(20).optional(),
	vehicle_color: z.string().trim().min(1).max(30).optional(),
	license_number: z.string().trim().min(1).max(50).optional(),
	license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	insurance_number: z.string().trim().min(1).max(50).optional(),
	insurance_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

const updateProfileSchema = z.object({
	vehicle_type: z.enum(['motorcycle', 'bicycle', 'car', 'van', 'truck', 'scooter']).optional(),
	vehicle_plate: z.string().trim().min(1).max(20).optional(),
	vehicle_color: z.string().trim().min(1).max(30).optional(),
	license_number: z.string().trim().min(1).max(50).optional(),
	license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	insurance_number: z.string().trim().min(1).max(50).optional(),
	insurance_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

const updateLocationSchema = z.object({
	lat: z.number().finite().min(-90).max(90),
	lng: z.number().finite().min(-180).max(180),
}).strict();

const deliveryStatusSchema = z.enum(['out_for_delivery', 'delivered']);

const orderStatusQuerySchema = z.object({
	status: z.enum(['assigned', 'accepted', 'picked_up', 'delivered', 'cancelled', 'returned']).optional(),
});

const locationQuerySchema = z.object({
	lat: z.coerce.number().finite().min(-90).max(90).optional(),
	lng: z.coerce.number().finite().min(-180).max(180).optional(),
});

const orderIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

// ── Role guard ─────────────────────────────────────────────────────────
// SECURITY (NIST SP 800-53 AC-3, OWASP ASVS 4.1.1):
//   All delivery-agent endpoints require the 'delivery_agent' role.
//   Without this, any authenticated user (customer, merchant, admin)
//   could access delivery-agent-only operations like accepting orders
//   or updating delivery status.
const deliveryAgentAuth = [requireAuth, requireRole('delivery_agent')];

export function attachDeliveryAgentRoutes(router: import('express').Router) {
	router.post('/register', ...deliveryAgentAuth, registerHandler);
	router.get('/profile', ...deliveryAgentAuth, profileHandler);
	router.patch('/profile', ...deliveryAgentAuth, updateProfileHandler);
	router.post('/location', ...deliveryAgentAuth, updateLocationHandler);
	router.get('/orders', ...deliveryAgentAuth, ordersHandler);
	router.get('/orders/:id', ...deliveryAgentAuth, orderDetailHandler);
	router.get('/dashboard', ...deliveryAgentAuth, dashboardHandler);
	router.get('/available-orders', ...deliveryAgentAuth, availableOrdersHandler);
	router.post('/orders/:id/accept', ...deliveryAgentAuth, acceptOrderHandler);
	router.post('/orders/:id/status', ...deliveryAgentAuth, updateStatusHandler);
	router.post('/go-online', ...deliveryAgentAuth, goOnlineHandler);
	router.post('/go-offline', ...deliveryAgentAuth, goOfflineHandler);
}

async function registerHandler(req: Request, res: Response) {
	try {
		const v = validate(registerAgentSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const userId = req.user!.id;
		const agent = await service.registerAgent(userId, v.data);
		return sendSuccess(res, agent, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

async function profileHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const agent = await service.getAgentProfile(userId);
		return sendSuccess(res, agent);
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateProfileHandler(req: Request, res: Response) {
	try {
		const v = validate(updateProfileSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const userId = req.user!.id;
		const agent = await service.updateAgentProfile(userId, v.data);
		return sendSuccess(res, agent);
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateLocationHandler(req: Request, res: Response) {
	try {
		const v = validate(updateLocationSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}
		const userId = req.user!.id;
		await service.updateAgentLocation(userId, { lat: v.data.lat, lng: v.data.lng });
		return sendSuccess(res, { success: true });
	} catch (err) {
		return sendError(res, err);
	}
}

async function ordersHandler(req: Request, res: Response) {
	try {
		const v = validate(orderStatusQuerySchema, req.query);
		const userId = req.user!.id;
		const orders = await service.getAssignedOrders(userId, v.ok ? v.data.status : undefined);
		return sendSuccess(res, orders);
	} catch (err) {
		return sendError(res, err);
	}
}

async function orderDetailHandler(req: Request, res: Response) {
	try {
		const v = validate(orderIdParamSchema, req.params);
		if (!v.ok) {
			return sendError(res, 'Invalid order ID', 400, ErrorCodes.VALIDATION_ERROR);
		}
		const userId = req.user!.id;
		const order = await service.getOrderDetails(userId, v.data.id);
		return sendSuccess(res, order);
	} catch (err) {
		return sendError(res, err);
	}
}

async function dashboardHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const data = await service.getDashboardStats(userId);
		return sendSuccess(res, data);
	} catch (err) {
		return sendError(res, err);
	}
}

async function availableOrdersHandler(req: Request, res: Response) {
	try {
		const v = validate(locationQuerySchema, req.query);
		const userId = req.user!.id;
		const orders = await service.getAvailableOrders(
			userId,
			v.ok ? v.data.lat : undefined,
			v.ok ? v.data.lng : undefined,
		);
		return sendSuccess(res, orders);
	} catch (err) {
		return sendError(res, err);
	}
}

async function acceptOrderHandler(req: Request, res: Response) {
	try {
		const v = validate(orderIdParamSchema, req.params);
		if (!v.ok) {
			return sendError(res, 'Invalid order ID', 400, ErrorCodes.VALIDATION_ERROR);
		}
		const userId = req.user!.id;
		await service.acceptOrder(userId, v.data.id);
		return sendSuccess(res, { success: true });
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateStatusHandler(req: Request, res: Response) {
	try {
		const v = validate(orderIdParamSchema, req.params);
		if (!v.ok) {
			return sendError(res, 'Invalid order ID', 400, ErrorCodes.VALIDATION_ERROR);
		}
		const statusV = validate(deliveryStatusSchema, req.body?.status);
		if (!statusV.ok) {
			return sendError(res, 'Invalid status: must be out_for_delivery or delivered', 400, ErrorCodes.VALIDATION_ERROR);
		}
		const userId = req.user!.id;
		await service.updateDeliveryStatus(userId, v.data.id, statusV.data);
		return sendSuccess(res, { success: true });
	} catch (err) {
		return sendError(res, err);
	}
}

async function goOnlineHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		await service.goOnline(userId);
		return sendSuccess(res, { success: true, status: 'active' });
	} catch (err) {
		return sendError(res, err);
	}
}

async function goOfflineHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		await service.goOffline(userId);
		return sendSuccess(res, { success: true, status: 'offline' });
	} catch (err) {
		return sendError(res, err);
	}
}
