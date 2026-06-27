/**
 * User addresses — authenticated CRUD.
 *
 * All endpoints trust only the authenticated user id (`req.user!.id`).
 * The DELETE handler scopes the WHERE clause by user_id so a user can
 * never delete another user's address; the same row is returned in a
 * 404 envelope to avoid leaking the existence of unrelated rows.
 */
import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	addressSchema,
} from '../lib/shared.cts';

export const addressesRouter = Router();

addressesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.id;
		const rows = await db
			.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
			.all(userId);
		sendSuccess(res, rows);
	} catch (err) {
		return sendError(res, err);
	}
});

addressesRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(addressSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const data = v.data;
		const userId = req.user!.id;

		if (data.is_default) {
			await db
				.prepare('UPDATE addresses SET is_default = FALSE WHERE user_id = ?')
				.run(userId);
		}
		const result = await db
			.prepare(
				`INSERT INTO addresses (user_id, label, full_name, phone, governorate, city, district,
           street, building, notes, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, FALSE), NOW(), NOW())
         RETURNING *`,
			)
			.get(
				userId,
				data.label,
				data.full_name,
				data.phone,
				data.governorate,
				data.city,
				data.district ?? null,
				data.street,
				data.building ?? null,
				data.notes ?? null,
				data.is_default ?? false,
			);
		sendSuccess(res, result, 'Address created');
	} catch (err) {
		return sendError(res, err);
	}
});

addressesRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const userId = req.user!.id;
		// Guard: only delete addresses owned by the authenticated user.
		const result = (await db
			.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ? RETURNING id')
			.get(id, userId)) as { id: number } | undefined;
		if (!result) return sendError(res, 'Address not found', 404);
		sendSuccess(res, { id: result.id }, 'Address deleted');
	} catch (err) {
		return sendError(res, err);
	}
});
