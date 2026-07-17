import type { Request, Response } from 'express';
import { notificationIdParamSchema, requireAuth, sendError, sendSuccess, validate, isAdminOperator } from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachNotificationsRoutes(router: import('express').Router) {
	router.get('/', requireAuth, listHandler);
	router.put('/:id/read', requireAuth, markReadHandler);
	router.get('/unread-count/:userId', requireAuth, unreadCountHandler);
}

async function listHandler(req: Request, res: Response) {
	try {
		const items = await service.list(req.user!.id);
		return sendSuccess(res, items);
	} catch (err) {
		return sendError(res, err);
	}
}

async function markReadHandler(req: Request, res: Response) {
	try {
		const v = validate(notificationIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid notification id: ' + v.error, 400);
		const updated = await service.markAsRead(v.data.id, req.user!.id);
		if (!updated) return sendError(res, 'Notification not found', 404);
		return sendSuccess(res, updated, 'Notification marked as read');
	} catch (err) {
		return sendError(res, err);
	}
}

async function unreadCountHandler(req: Request, res: Response) {
	try {
		const userId = Number(req.params.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return sendError(res, 'Invalid user id', 400);
		}
		if (req.user!.id !== userId && !isAdminOperator(req.user!.role)) {
			return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
		}
		const unread = await service.getUnreadCount(userId);
		return sendSuccess(res, { user_id: userId, unread });
	} catch (err) {
		return sendError(res, err);
	}
}