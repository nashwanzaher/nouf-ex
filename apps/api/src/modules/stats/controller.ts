import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../lib/shared.ts';
import * as service from './service.ts';

export function attachStatsRoutes(router: import('express').Router) {
	router.get('/home', homeHandler);
}

async function homeHandler(_req: Request, res: Response) {
	try {
		const stats = await service.getHomeStats();
		return sendSuccess(res, stats);
	} catch (err) {
		return sendError(res, err);
	}
}