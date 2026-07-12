import type { Request, Response } from 'express';
import { ErrorCodes } from '../../lib/error-codes.ts';
import { requireAuth, sendError, sendSuccess, validate, wishlistAddSchema, wishlistItemIdParamSchema } from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachWishlistRoutes(router: import('express').Router) {
	router.get('/', requireAuth, listHandler);
	router.post('/', requireAuth, addHandler);
	router.delete('/:id', requireAuth, removeHandler);
}

async function listHandler(req: Request, res: Response) {
	try {
		const items = await service.list(req.user!.id);
		return sendSuccess(res, items);
	} catch (err) {
		return sendError(res, err);
	}
}

async function addHandler(req: Request, res: Response) {
	try {
		const v = validate(wishlistAddSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		const result = await service.add(req.user!.id, v.data.productId);
		if ('alreadyExists' in result) return sendSuccess(res, null, 'Already in wishlist');
		if ('error' in result) return sendError(res, 'Failed to add to wishlist', 500, ErrorCodes.INSERT_FAILED);
		return sendSuccess(res, { id: result.id }, 'Added to wishlist');
	} catch (err) {
		return sendError(res, err);
	}
}

async function removeHandler(req: Request, res: Response) {
	try {
		const v = validate(wishlistItemIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid wishlist item id: ' + v.error, 400);
		const result = await service.remove(v.data.id, req.user!.id);
		if (!result) return sendError(res, 'Wishlist item not found', 404);
		return sendSuccess(res, { id: result.id }, 'Removed from wishlist');
	} catch (err) {
		return sendError(res, err);
	}
}