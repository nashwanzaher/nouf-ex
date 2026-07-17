import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, sendError, sendSuccess, validate, isAdminOperator } from '../../lib/shared.ts';
import * as service from './service.ts';

const checkFollowSchema = z.object({
	store_id: z.coerce.number().int().positive(),
	user_id: z.coerce.number().int().positive(),
});

const followStoreSchema = z.object({
	store_id: z.coerce.number().int().positive(),
	notify_new_products: z.boolean().optional().default(true),
	notify_offers: z.boolean().optional().default(true),
});

const unfollowStoreSchema = z.object({
	store_id: z.number().int().positive(),
});

export function attachStoreFollowersRoutes(router: import('express').Router) {
	router.get('/check', requireAuth, checkHandler);
	router.post('/', requireAuth, followHandler);
	router.delete('/', requireAuth, unfollowHandler);
}

async function checkHandler(req: Request, res: Response) {
	try {
		const v = validate(checkFollowSchema, req.query);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);
		if (req.user!.id !== v.data.user_id && !isAdminOperator(req.user!.role)) {
			return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
		}
		const result = await service.check(v.data.store_id, v.data.user_id);
		return sendSuccess(res, result);
	} catch (err) {
		return sendError(res, err);
	}
}

async function followHandler(req: Request, res: Response) {
	try {
		const v = validate(followStoreSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const result = await service.follow(
			v.data.store_id,
			req.user!.id,
			v.data.notify_new_products,
			v.data.notify_offers,
		);
		return sendSuccess(
			res,
			{ id: result.id, store_id: result.store_id, following: result.following },
			result.updated ? 'Follow updated' : 'Store followed',
		);
	} catch (err) {
		return sendError(res, err);
	}
}

async function unfollowHandler(req: Request, res: Response) {
	try {
		const v = validate(unfollowStoreSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const result = await service.unfollow(v.data.store_id, req.user!.id);
		return sendSuccess(res, result, 'Store unfollowed');
	} catch (err) {
		return sendError(res, err);
	}
}