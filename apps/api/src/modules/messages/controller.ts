import type { Request, Response } from 'express';
import { z as zod } from 'zod';
import { requireAuth, sendError, sendSuccess } from '../../lib/shared.ts';
import * as service from './service.ts';

const sendMessageSchema = zod.object({
	receiver_id: zod.number().int().positive(),
	body: zod.string().trim().min(1).max(4000),
	store_id: zod.number().int().positive().optional(),
	product_id: zod.number().int().positive().optional(),
	order_id: zod.number().int().positive().optional(),
	attachments: zod.array(zod.string().url().max(500)).max(10).optional(),
});

const conversationQuerySchema = zod.object({
	peer_id: zod.coerce.number().int().positive(),
	limit: zod.coerce.number().int().min(1).max(100).default(50),
	before_id: zod.coerce.number().int().positive().optional(),
});

const messageIdParamSchema = zod.object({
	id: zod.coerce.number().int().positive(),
});

export function attachMessagesRoutes(router: import('express').Router) {
	router.post('/', requireAuth, sendHandler);
	router.get('/inbox', requireAuth, inboxHandler);
	router.get('/sent', requireAuth, sentHandler);
	router.get('/conversation', requireAuth, conversationHandler);
	router.get('/unread-count', requireAuth, unreadCountHandler);
	router.put('/:id/read', requireAuth, markReadHandler);
}

async function sendHandler(req: Request, res: Response) {
	try {
		const parsed = sendMessageSchema.safeParse(req.body);
		if (!parsed.success) {
			return sendError(
				res,
				'Invalid input: ' +
					parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
				400,
			);
		}
		const input = parsed.data;
		const result = await service.send({
			senderId: req.user!.id,
			receiverId: input.receiver_id,
			body: input.body,
			storeId: input.store_id,
			productId: input.product_id,
			orderId: input.order_id,
			attachments: input.attachments,
			role: req.user!.role,
		});
		if (!result.ok) return sendError(res, result.error, result.status);
		return sendSuccess(res, { id: result.id, created_at: result.created_at }, 'Message sent');
	} catch (err) {
		return sendError(res, err);
	}
}

async function inboxHandler(req: Request, res: Response) {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
		const beforeId = req.query.before_id ? Number(req.query.before_id) : null;
		const onlyUnread = req.query.unread === '1' || req.query.unread === 'true';
		const result = await service.inbox(req.user!.id, { limit, beforeId, onlyUnread });
		return sendSuccess(res, result);
	} catch (err) {
		return sendError(res, err);
	}
}

async function sentHandler(req: Request, res: Response) {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
		const beforeId = req.query.before_id ? Number(req.query.before_id) : null;
		const result = await service.sent(req.user!.id, { limit, beforeId });
		return sendSuccess(res, result);
	} catch (err) {
		return sendError(res, err);
	}
}

async function conversationHandler(req: Request, res: Response) {
	try {
		const parsed = conversationQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return sendError(
				res,
				'Invalid query: ' +
					parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
				400,
			);
		}
		const result = await service.conversation({
			userId: req.user!.id,
			peerId: parsed.data.peer_id,
			limit: parsed.data.limit,
			beforeId: parsed.data.before_id,
		});
		if (!result.ok) return sendError(res, result.error, result.status);
		const { ok: _ok, ...payload } = result;
		return sendSuccess(res, payload);
	} catch (err) {
		return sendError(res, err);
	}
}

async function unreadCountHandler(req: Request, res: Response) {
	try {
		const count = await service.inbox(req.user!.id, { limit: 1, beforeId: null, onlyUnread: true });
		return sendSuccess(res, { unread_count: count.unread_count });
	} catch (err) {
		return sendError(res, err);
	}
}

async function markReadHandler(req: Request, res: Response) {
	try {
		const parsed = messageIdParamSchema.safeParse(req.params);
		if (!parsed.success) return sendError(res, 'Invalid message id', 400);
		const result = await service.markRead(parsed.data.id, req.user!.id);
		if (!result.ok) return sendError(res, result.error, result.status);
		return sendSuccess(res, result.data, 'Marked as read');
	} catch (err) {
		return sendError(res, err);
	}
}