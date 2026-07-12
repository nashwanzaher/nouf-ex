import { db } from '../../lib/shared.ts';

export async function listActive() {
	return (await db
		.prepare(
			'SELECT id, name_ar, name_en, base_cost, per_kg_cost, estimated_days FROM shipping_methods WHERE is_active = TRUE ORDER BY base_cost ASC',
		)
		.all()) as Array<{
		id: number;
		name_ar: string;
		name_en: string;
		base_cost: number;
		per_kg_cost: number | null;
		estimated_days: number | null;
	}>;
}