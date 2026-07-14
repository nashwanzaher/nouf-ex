import type { Request, Response } from 'express';
import { sendError, sendSuccess, requireAuth } from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachDeliveryAgentRoutes(router: import('express').Router) {
	router.post('/register', requireAuth, registerHandler);
	router.get('/profile', requireAuth, profileHandler);
	router.patch('/profile', requireAuth, updateProfileHandler);
	router.post('/location', requireAuth, updateLocationHandler);
	router.get('/orders', requireAuth, ordersHandler);
	router.get('/orders/:id', requireAuth, orderDetailHandler);
	router.get('/dashboard', requireAuth, dashboardHandler);
	router.get('/available-orders', requireAuth, availableOrdersHandler);
	router.post('/orders/:id/accept', requireAuth, acceptOrderHandler);
	router.post('/orders/:id/status', requireAuth, updateStatusHandler);
	router.post('/go-online', requireAuth, goOnlineHandler);
	router.post('/go-offline', requireAuth, goOfflineHandler);
}

async function registerHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const input = req.body;
		const agent = await service.registerAgent(userId, input);
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
		const userId = req.user!.id;
		const input = req.body;
		const agent = await service.updateAgentProfile(userId, input);
		return sendSuccess(res, agent);
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateLocationHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const { lat, lng } = req.body;
		if (typeof lat !== 'number' || typeof lng !== 'number') {
			return sendError(res, new Error('Invalid coordinates'));
		}
		await service.updateAgentLocation(userId, { lat, lng });
		return sendSuccess(res, { success: true });
	} catch (err) {
		return sendError(res, err);
	}
}

async function ordersHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const { status } = req.query;
		const orders = await service.getAssignedOrders(userId, status as string);
		return sendSuccess(res, orders);
	} catch (err) {
		return sendError(res, err);
	}
}

async function orderDetailHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const orderId = Number(req.params.id);
		const order = await service.getOrderDetails(userId, orderId);
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
		const userId = req.user!.id;
		const { lat, lng } = req.query;
		const orders = await service.getAvailableOrders(
			userId,
			lat ? Number(lat) : undefined,
			lng ? Number(lng) : undefined
		);
		return sendSuccess(res, orders);
	} catch (err) {
		return sendError(res, err);
	}
}

async function acceptOrderHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const orderId = Number(req.params.id);
		await service.acceptOrder(userId, orderId);
		return sendSuccess(res, { success: true });
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateStatusHandler(req: Request, res: Response) {
	try {
		const userId = req.user!.id;
		const orderId = Number(req.params.id);
		const { status } = req.body;
		if (!['out_for_delivery', 'delivered'].includes(status)) {
			return sendError(res, new Error('Invalid status'));
		}
		await service.updateDeliveryStatus(userId, orderId, status);
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