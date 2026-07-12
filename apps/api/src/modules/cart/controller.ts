import type { Request, Response } from 'express';
import {
	cartAddSchema,
	cartItemIdParamSchema,
	cartItemUpdateSchema,
	requireAuth,
	sendError,
	sendSuccess,
	validate,
} from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachCartRoutes(router: import('express').Router) {
	router.delete('/clear/:userId', requireAuth, clearHandler);
	router.get('/count/:userId', requireAuth, countHandler);
	router.get('/:userId', requireAuth, listHandler);
	router.post('/', requireAuth, addHandler);
	router.put('/:id', requireAuth, updateHandler);
	router.delete('/:id', requireAuth, removeHandler);
}

async function clearHandler(req: Request, res: Response) {
	try {
		const result = await service.clear(req.user!.id);
		return sendSuccess(res, result, 'Cart cleared');
	} catch (err) {
		return sendError(res, err);
	}
}

async function countHandler(req: Request, res: Response) {
	try {
		const userId = Number(req.params.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return sendError(res, 'Invalid user id', 400);
		}
		const result = await service.count(userId, req.user!.id, req.user!.role);
		return sendSuccess(res, result);
	} catch (err) {
		return sendError(res, err);
	}
}

async function listHandler(req: Request, res: Response) {
	try {
		const userId = Number(req.params.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return sendError(res, 'Invalid user id', 400);
		}
		const items = await service.list(userId, req.user!.id, req.user!.role);
		return sendSuccess(res, items);
	} catch (err) {
		return sendError(res, err);
	}
}

async function addHandler(req: Request, res: Response) {
	try {
		const v = validate(cartAddSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const result = await service.add(req.user!.id, v.data.productId, v.data.quantity, v.data.variant ?? null);
		if ('existing' in result) return sendSuccess(res, { existing: true }, 'Already in cart');
		return sendSuccess(res, { id: result.id }, 'Added to cart');
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateHandler(req: Request, res: Response) {
	try {
		const v1 = validate(cartItemIdParamSchema, req.params);
		if (!v1.ok) return sendError(res, 'Invalid cart item id: ' + v1.error, 400);
		const v2 = validate(cartItemUpdateSchema, req.body);
		if (!v2.ok) return sendError(res, 'Invalid input: ' + v2.error, 400);
		const result = await service.update(v1.data.id, v2.data.quantity, req.user!.id);
		if (result.changes === 0) return sendError(res, 'Cart item not found', 404);
		return sendSuccess(res, result, 'Cart updated');
	} catch (err) {
		return sendError(res, err);
	}
}

async function removeHandler(req: Request, res: Response) {
	try {
		const v = validate(cartItemIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid cart item id: ' + v.error, 400);
		const result = await service.remove(v.data.id, req.user!.id);
		if (!result) return sendError(res, 'Cart item not found', 404);
		return sendSuccess(res, { id: result.id }, 'Removed from cart');
	} catch (err) {
		return sendError(res, err);
	}
}