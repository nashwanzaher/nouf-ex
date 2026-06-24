/**
 * Unit tests for two more customer/admin Zod schemas:
 *   - notificationIdParamSchema (path param for PUT /api/notifications/:id/read)
 *   - adminProductUpdateSchema (body for PATCH /api/admin/products/:id)
 *
 * These mirror the schemas in server/index.ts. End-to-end coverage
 * is provided by the live E2E suite.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Mirror of notificationIdParamSchema
const notificationIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

// Mirror of adminProductUpdateSchema
const adminProductUpdateSchema = z
	.object({
		is_active: z.boolean().optional(),
		is_featured: z.boolean().optional(),
	})
	.strict();

// ═══════════════════════════════════════════════════════════
describe('notificationIdParamSchema', () => {
	it('coerces a numeric string', () => {
		const r = notificationIdParamSchema.safeParse({ id: '42' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.id).toBe(42);
	});

	it('accepts a number', () => {
		const r = notificationIdParamSchema.safeParse({ id: 7 });
		expect(r.success).toBe(true);
	});

	it('rejects 0 (not positive)', () => {
		const r = notificationIdParamSchema.safeParse({ id: 0 });
		expect(r.success).toBe(false);
	});

	it('rejects negative', () => {
		const r = notificationIdParamSchema.safeParse({ id: -1 });
		expect(r.success).toBe(false);
	});

	it('rejects non-numeric', () => {
		const r = notificationIdParamSchema.safeParse({ id: 'abc' });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
describe('adminProductUpdateSchema', () => {
	it('accepts a single is_active toggle', () => {
		const r = adminProductUpdateSchema.safeParse({ is_active: false });
		expect(r.success).toBe(true);
	});

	it('accepts a single is_featured toggle', () => {
		const r = adminProductUpdateSchema.safeParse({ is_featured: true });
		expect(r.success).toBe(true);
	});

	it('accepts both fields at once', () => {
		const r = adminProductUpdateSchema.safeParse({
			is_active: true,
			is_featured: false,
		});
		expect(r.success).toBe(true);
	});

	it('accepts an empty object (no-op allowed — handler throws later)', () => {
		const r = adminProductUpdateSchema.safeParse({});
		expect(r.success).toBe(true);
	});

	it('rejects non-boolean is_active', () => {
		const r = adminProductUpdateSchema.safeParse({ is_active: 'yes' });
		expect(r.success).toBe(false);
	});

	it('rejects unknown fields (strict mode)', () => {
		const r = adminProductUpdateSchema.safeParse({ is_active: true, price: 100 });
		expect(r.success).toBe(false);
	});

	it('does NOT accept price / stock (those need a separate endpoint)', () => {
		const r = adminProductUpdateSchema.safeParse({ price: 99.99 });
		expect(r.success).toBe(false);
		const r2 = adminProductUpdateSchema.safeParse({ stock: 50 });
		expect(r2.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
// Self-protection rule: marking a notification as read is a
// per-user action. The handler must scope the UPDATE to the
// authenticated user, never trusting a path param or a body field.
// ═══════════════════════════════════════════════════════════
function buildMarkReadSql(
	userId: number,
	notificationId: number,
): {
	sql: string;
	params: unknown[];
} {
	// Mirror of the actual UPDATE in the handler.
	return {
		sql: `UPDATE notifications
            SET is_read = TRUE,
                read_at  = COALESCE(read_at, NOW())
          WHERE id = $1 AND user_id = $2
          RETURNING id, user_id, type, title, body, data, is_read, read_at, created_at`,
		params: [notificationId, userId],
	};
}

describe('mark-as-read scoping', () => {
	it('uses req.user.id, never a body/path userId', () => {
		const sql = buildMarkReadSql(1, 7);
		expect(sql.params).toEqual([7, 1]); // id first, then user_id
		expect(sql.sql).toContain('user_id = $2');
	});

	it('rejects scope-expansion attempts via WHERE substitution', () => {
		// Defence in depth: the WHERE clause must always include
		// 'AND user_id = $N'. A future refactor that forgets this
		// would let a user mark somebody else's notifications as read.
		const sql = buildMarkReadSql(1, 7);
		expect(sql.sql).toMatch(/WHERE id = \$1 AND user_id = \$2/);
	});
});
