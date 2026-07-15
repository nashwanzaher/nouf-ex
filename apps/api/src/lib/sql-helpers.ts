/**
 * Tiny helpers for assembling parameterised SQL at runtime,
 * extracted from `shared.ts` as part of the P0-1 god object
 * refactor (Phase 7, 2026-07-04).
 *
 * Currently only `buildUpdateSet` lives here. Future helpers in
 * the same spirit (`buildInsertColumns`, `buildUpsert`, etc.)
 * should land here so all string-built SQL stays in one small
 * module that's easy to audit.
 */
import { HttpError } from '../middleware.js';

// SECURITY: only allow safe column names — lowercase letters, digits,
// and underscores. Prevents SQL injection via crafted column names.
const SAFE_COLUMN_RE = /^[a-z][a-z0-9_]*$/;

/** Builds a dynamic `SET col = $N` list from a partial object. Throws
 *  HttpError(400) when no updateable fields are present or when any
 *  column name is unsafe (SQL injection protection). */
export function buildUpdateSet(fields: Record<string, unknown>): {
	sql: string;
	params: unknown[];
} {
	const sets: string[] = [];
	const params: unknown[] = [];
	for (const [k, v] of Object.entries(fields)) {
		if (!SAFE_COLUMN_RE.test(k)) {
			throw new HttpError(400, `Invalid column name: "${k}"`, {
				code: 'INVALID_COLUMN',
			});
		}
		params.push(v);
		sets.push(`${k} = $${params.length}`);
	}
	if (sets.length === 0) {
		throw new HttpError(400, 'At least one updateable field must be provided.', {
			code: 'EMPTY_UPDATE',
		});
	}
	return { sql: sets.join(', '), params };
}
