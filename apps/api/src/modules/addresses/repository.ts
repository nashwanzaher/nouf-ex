/**
 * Addresses repository — pure database access.
 */
import { db } from '../../lib/shared.ts';

export async function listByUser(userId: number) {
	return db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(userId);
}

export async function clearDefault(userId: number): Promise<void> {
	await db.prepare('UPDATE addresses SET is_default = FALSE WHERE user_id = ?').run(userId);
}

export async function clearDefaultExcept(userId: number, exceptId: number): Promise<void> {
	await db.prepare('UPDATE addresses SET is_default = FALSE WHERE user_id = ? AND id <> ?').run(userId, exceptId);
}

export async function insert(input: {
	userId: number;
	data: {
		label: string;
		full_name: string;
		phone: string;
		governorate: string;
		city: string;
		district?: string | null;
		street: string;
		building?: string | null;
		notes?: string | null;
		is_default?: boolean;
	};
}) {
	const { userId, data } = input;
	return db
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
}

export async function existsOwned(id: number, userId: number): Promise<boolean> {
	const row = (await db
		.prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?')
		.get(id, userId)) as { id: number } | undefined;
	return !!row;
}

export async function updateOwned(
	id: number,
	userId: number,
	data: {
		label: string;
		full_name: string;
		phone: string;
		governorate: string;
		city: string;
		district?: string | null;
		street: string;
		building?: string | null;
		notes?: string | null;
		is_default?: boolean | null;
	},
) {
	return (await db
		.prepare(
			`UPDATE addresses
			 SET label = ?, full_name = ?, phone = ?, governorate = ?, city = ?,
			     district = ?, street = ?, building = ?, notes = ?,
			     is_default = COALESCE(?, is_default), updated_at = NOW()
			 WHERE id = ? AND user_id = ?
			 RETURNING *`,
		)
		.get(
			data.label,
			data.full_name,
			data.phone,
			data.governorate,
			data.city,
			data.district ?? null,
			data.street,
			data.building ?? null,
			data.notes ?? null,
			data.is_default ?? null,
			id,
			userId,
		)) as Record<string, unknown> | undefined;
}

export async function deleteOwned(id: number, userId: number): Promise<number | null> {
	const row = (await db
		.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ? RETURNING id')
		.get(id, userId)) as { id: number } | undefined;
	return row?.id ?? null;
}