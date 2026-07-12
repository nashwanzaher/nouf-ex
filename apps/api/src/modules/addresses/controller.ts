/**
 * Addresses controller — HTTP handlers.
 */
import type { Request, Response } from 'express';
import { addressSchema, requireAuth, sendError, sendSuccess, validate } from '../../lib/shared.ts';
import * as middleware from '../../middleware.ts';
import * as service from './service.ts';

export function attachAddressesRoutes(router: import('express').Router) {
	router.get('/', requireAuth, listHandler);
	router.post('/', requireAuth, createHandler);
	router.delete('/:id', requireAuth, deleteHandler);
	router.put('/:id', requireAuth, updateHandler);
}

async function listHandler(req: Request, res: Response) {
	try {
		const rows = await service.listAddresses(req.user!.id);
		return sendSuccess(res, rows);
	} catch (err) {
		return sendError(res, err);
	}
}

async function createHandler(req: Request, res: Response) {
	try {
		const v = validate(addressSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const created = await service.createAddress(req.user!.id, v.data);
		return sendSuccess(res, created, 'Address created');
	} catch (err) {
		return sendError(res, err);
	}
}

async function deleteHandler(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const ok = await service.deleteAddress(id, req.user!.id);
		if (!ok) return sendError(res, 'Address not found', 404);
		return sendSuccess(res, { id }, 'Address deleted');
	} catch (err) {
		return sendError(res, err);
	}
}

async function updateHandler(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const v = validate(addressSchema, req.body);
		if (!v.ok)
			return sendError(
				res,
				'Invalid input: ' + v.error,
				400,
				middleware.ErrorCodes.VALIDATION_ERROR,
			);
		const updated = await service.updateAddress(id, req.user!.id, v.data);
		if (!updated) return sendError(res, 'Address not found', 404);
		return sendSuccess(res, updated, 'Address updated');
	} catch (err) {
		return sendError(res, err);
	}
}