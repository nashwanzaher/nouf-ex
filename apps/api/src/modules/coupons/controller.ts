import type { Request, Response } from 'express';
import { z } from 'zod';
import { couponRedeemSchema, requireAuth, sendError, sendSuccess, validate } from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachCouponsRoutes(router: import('express').Router) {
	router.post('/validate', requireAuth, validateHandler);
	router.post('/redeem', requireAuth, redeemHandler);
}

async function validateHandler(req: Request, res: Response) {
	try {
		const v = validate(couponRedeemSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const result = await service.validateCoupon(v.data.code, v.data.order_subtotal, req.user!.id);
		if (!result.ok) return sendError(res, result.error, 400);
		return sendSuccess(res, result.data);
	} catch (err) {
		return sendError(res, err);
	}
}

async function redeemHandler(req: Request, res: Response) {
	try {
		const schema = couponRedeemSchema.extend({ order_id: z.number().int().positive() });
		const v = validate(schema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const result = await service.redeemCoupon(v.data.code, v.data.order_id, req.user!.id);
		if (!result.ok) return sendError(res, result.error, result.status);
		if (result.alreadyRedeemed)
			return sendSuccess(res, { id: result.id }, 'Already redeemed');
		return sendSuccess(res, { id: result.id, discount: result.discount }, 'Coupon redeemed');
	} catch (err) {
		return sendError(res, err);
	}
}