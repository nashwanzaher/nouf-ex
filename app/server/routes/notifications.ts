import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	notificationIdParamSchema,
} from '../lib/shared.ts';

export const notificationsRouter = Router();

notificationsRouter.get('/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.id;
		const items = await db
			.prepare(
				`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
			)
			.all(userId);
		sendSuccess(res, items);
	} catch (err) {
		return sendError(res, err);
	}
});

notificationsRouter.put('/:id/read', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(notificationIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid notification id: ' + v.error, 400);
		const notificationId = v.data.id;
		const userId = req.user!.id;

		const updated = (await db
			.prepare(
				`UPDATE notifications
            SET is_read = TRUE,
                read_at  = COALESCE(read_at, NOW())
          WHERE id = $1 AND user_id = $2
          RETURNING id, user_id, type, title, body, data, is_read, read_at, created_at`,
			)
			.get(notificationId, userId)) as
			| {
					id: number;
					user_id: number;
					type: string;
					title: string;
					body: string | null;
					data: unknown;
					is_read: boolean;
					read_at: string;
					created_at: string;
			  }
			| undefined;
		if (!updated) return sendError(res, 'Notification not found', 404);
		return sendSuccess(res, updated, 'Notification marked as read');
	} catch (err) {
		return sendError(res, err);
	}
});

notificationsRouter.get(
	'/unread-count/:userId',
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = Number(req.params.userId);
			if (!Number.isInteger(userId) || userId <= 0) {
				return sendError(res, 'Invalid user id', 400);
			}
			if (req.user!.id !== userId && req.user!.role !== 'admin') {
				return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
			}
			const row = (await db
				.prepare(
					'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
				)
				.get(userId)) as { c: number } | undefined;
			// `get()` returns undefined when no row matches; default to 0
			// so a fresh database (or the test mock) renders as "0 unread"
			// instead of throwing a TypeError.
			return sendSuccess(res, { user_id: userId, unread: row?.c ?? 0 });
		} catch (err) {
			return sendError(res, err);
		}
	},
);
