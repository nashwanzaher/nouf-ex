import * as repo from './repository.ts';

export async function listMethods(weightKg: number) {
	const weight = Math.max(0.1, weightKg || 1);
	const rows = await repo.listActive();
	return rows.map((m) => ({
		...m,
		estimated_total: Math.round((m.base_cost + (m.per_kg_cost ?? 0) * weight) * 100) / 100,
	}));
}