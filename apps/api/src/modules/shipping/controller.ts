import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachShippingRoutes(router: import('express').Router) {
	router.get('/methods', methodsHandler);
}

async function methodsHandler(req: Request, res: Response) {
	try {
		const weight = Number(req.query.weight_kg) || 1;
		const list = await service.listMethods(weight);
		return sendSuccess(res, list);
	} catch (err) {
		return sendError(res, err);
	}
}