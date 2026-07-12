import { db } from '../../lib/shared.ts';

export async function listForUser(userId: number) {
	return db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`).all(userId);
}

export async function markRead(id: number, userId: number) {
	return (await db
		.prepare(
			`UPDATE notifications
			 SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
			 WHERE id = $1 AND user_id = $2
			 RETURNING id, user_id, type, title, body, data, is_read, read_at, created_at`,
		)
		.get(id, userId)) as
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
}

export async function unreadCount(userId: number): Promise<number> {
	const row = (await db
		.prepare('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE')
		.get(userId)) as { c: number } | undefined;
	return row?.c ?? 0;
}