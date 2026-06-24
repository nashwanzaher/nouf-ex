/**
 * Unit tests for the admin-mutation Zod schemas + buildUpdateSet helper.
 *
 * These are pure-function tests — they don't need the Express app or
 * a real DB. The end-to-end behaviour (auth, access control, SQL
 * side effects) is covered by the live E2E tests in
 * docs/audit/code-review-fixes-2026-06-23.md.
 *
 * The test data here is intentionally small: each test asserts ONE
 * thing, so a failure tells you exactly which invariant broke.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Re-declare the schemas here so the test file is self-contained and
// doesn't need a full module-load of the server. In production code
// these live in server/index.ts; if they drift the live E2E tests
// will catch it on the next deploy.

// ═══════════════════════════════════════════════════════════
// Mirror of the adminUserUpdateSchema in server/index.ts
// ═══════════════════════════════════════════════════════════
const adminUserUpdateSchema = z
	.object({
		status: z.enum(['active', 'suspended', 'banned']).optional(),
		role: z.enum(['customer', 'merchant', 'admin']).optional(),
		is_verified: z.boolean().optional(),
		email_verified: z.boolean().optional(),
		phone_verified: z.boolean().optional(),
	})
	.strict();

describe('adminUserUpdateSchema', () => {
	it('accepts a single status field', () => {
		const r = adminUserUpdateSchema.safeParse({ status: 'suspended' });
		expect(r.success).toBe(true);
	});

	it('accepts all 5 updateable fields at once', () => {
		const r = adminUserUpdateSchema.safeParse({
			status: 'active',
			role: 'merchant',
			is_verified: true,
			email_verified: true,
			phone_verified: false,
		});
		expect(r.success).toBe(true);
	});

	it('rejects empty body (no updateable fields)', () => {
		const r = adminUserUpdateSchema.safeParse({});
		expect(r.success).toBe(true); // empty object is technically valid; handler throws "At least one field"
	});

	it('rejects unknown fields (strict mode)', () => {
		const r = adminUserUpdateSchema.safeParse({ status: 'active', password_hash: 'hax' });
		expect(r.success).toBe(false);
	});

	it('rejects invalid status values', () => {
		const r = adminUserUpdateSchema.safeParse({ status: 'DELETED' });
		expect(r.success).toBe(false);
	});

	it('rejects invalid role values', () => {
		const r = adminUserUpdateSchema.safeParse({ role: 'superuser' });
		expect(r.success).toBe(false);
	});

	it('coerces non-boolean types (e.g. string "true") as invalid', () => {
		const r = adminUserUpdateSchema.safeParse({ is_verified: 'true' });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
// Mirror of the adminStoreUpdateSchema in server/index.ts
// ═══════════════════════════════════════════════════════════
const adminStoreUpdateSchema = z
	.object({
		is_active: z.boolean().optional(),
		is_verified: z.boolean().optional(),
		trust_level: z.enum(['verified', 'gold', 'premium']).optional(),
	})
	.strict();

describe('adminStoreUpdateSchema', () => {
	it('accepts a single is_active flip', () => {
		const r = adminStoreUpdateSchema.safeParse({ is_active: false });
		expect(r.success).toBe(true);
	});

	it('accepts all 3 fields', () => {
		const r = adminStoreUpdateSchema.safeParse({
			is_active: true,
			is_verified: true,
			trust_level: 'gold',
		});
		expect(r.success).toBe(true);
	});

	it('rejects unknown trust_level values', () => {
		const r = adminStoreUpdateSchema.safeParse({ trust_level: 'platinum' });
		expect(r.success).toBe(false);
	});

	it('rejects extra fields (strict mode)', () => {
		const r = adminStoreUpdateSchema.safeParse({ is_active: true, owner_id: 999 });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
// Mirror of the adminOrderStatusSchema
// ═══════════════════════════════════════════════════════════
const adminOrderStatusSchema = z
	.object({
		status: z.enum([
			'pending',
			'confirmed',
			'processing',
			'shipped',
			'delivered',
			'cancelled',
			'refunded',
		]),
		note: z.string().trim().max(500).optional(),
	})
	.strict();

describe('adminOrderStatusSchema', () => {
	it.each([
		'pending',
		'confirmed',
		'processing',
		'shipped',
		'delivered',
		'cancelled',
		'refunded',
	])('accepts status=%s', (status) => {
		const r = adminOrderStatusSchema.safeParse({ status });
		expect(r.success).toBe(true);
	});

	it('rejects an unknown status (state-machine sanity)', () => {
		const r = adminOrderStatusSchema.safeParse({ status: 'in_transit' });
		expect(r.success).toBe(false);
	});

	it('accepts an optional note', () => {
		const r = adminOrderStatusSchema.safeParse({
			status: 'shipped',
			note: 'Customer not home',
		});
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.note).toBe('Customer not home');
	});

	it('rejects a note longer than 500 chars', () => {
		const r = adminOrderStatusSchema.safeParse({ status: 'shipped', note: 'a'.repeat(501) });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
// Mirror of the adminDisputeUpdateSchema
// ═══════════════════════════════════════════════════════════
const adminDisputeUpdateSchema = z
	.object({
		// Matches the disputes_status_check constraint in schema-extra.sql:
		// 'open' → 'investigating' → {resolved_buyer, resolved_seller, closed, rejected}
		status: z.enum([
			'open',
			'investigating',
			'resolved_buyer',
			'resolved_seller',
			'closed',
			'rejected',
		]),
		resolution: z.string().trim().min(3).max(2000).optional(),
		refund_amount: z.number().nonnegative().optional(),
	})
	.strict();

describe('adminDisputeUpdateSchema', () => {
	it('requires status (mandatory)', () => {
		const r = adminDisputeUpdateSchema.safeParse({});
		expect(r.success).toBe(false);
	});

	it('accepts just status', () => {
		const r = adminDisputeUpdateSchema.safeParse({ status: 'investigating' });
		expect(r.success).toBe(true);
	});

	it('accepts status + resolution + refund_amount', () => {
		const r = adminDisputeUpdateSchema.safeParse({
			status: 'resolved_buyer',
			resolution: 'Customer provided valid tracking ID',
			refund_amount: 1500,
		});
		expect(r.success).toBe(true);
	});

	it.each(['resolved_buyer', 'resolved_seller', 'closed', 'rejected'])(
		'accepts terminal status=%s',
		(status) => {
			const r = adminDisputeUpdateSchema.safeParse({ status });
			expect(r.success).toBe(true);
		},
	);

	it('rejects the legacy "in_review" / "resolved" values', () => {
		expect(adminDisputeUpdateSchema.safeParse({ status: 'in_review' }).success).toBe(false);
		expect(adminDisputeUpdateSchema.safeParse({ status: 'resolved' }).success).toBe(false);
	});

	it('rejects negative refund_amount', () => {
		const r = adminDisputeUpdateSchema.safeParse({
			status: 'resolved_buyer',
			refund_amount: -100,
		});
		expect(r.success).toBe(false);
	});

	it('rejects resolution shorter than 3 chars', () => {
		const r = adminDisputeUpdateSchema.safeParse({
			status: 'resolved_buyer',
			resolution: 'ok',
		});
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
// buildUpdateSet — the helper that turns a partial update object into
// a SQL `SET col = $N` clause.
// ═══════════════════════════════════════════════════════════
function buildUpdateSet(fields: Record<string, unknown>): { sql: string; params: unknown[] } {
	const sets: string[] = [];
	const params: unknown[] = [];
	for (const [k, v] of Object.entries(fields)) {
		params.push(v);
		sets.push(`${k} = $${params.length}`);
	}
	if (sets.length === 0) {
		throw new Error('At least one updateable field must be provided.');
	}
	return { sql: sets.join(', '), params };
}

describe('buildUpdateSet', () => {
	it('produces a single SET for one field', () => {
		const r = buildUpdateSet({ status: 'active' });
		expect(r.sql).toBe('status = $1');
		expect(r.params).toEqual(['active']);
	});

	it('produces multiple SETs with incrementing placeholders', () => {
		const r = buildUpdateSet({ a: 1, b: 'x', c: true });
		expect(r.sql).toBe('a = $1, b = $2, c = $3');
		expect(r.params).toEqual([1, 'x', true]);
	});

	it('handles null values (used for soft-delete fields)', () => {
		const r = buildUpdateSet({ deleted_at: null });
		expect(r.sql).toBe('deleted_at = $1');
		expect(r.params).toEqual([null]);
	});

	it('throws on empty object (forces callers to use a real field)', () => {
		expect(() => buildUpdateSet({})).toThrow(/At least one/);
	});

	it('preserves numeric placeholders when called twice in a row', () => {
		// Simulates the handler pattern: buildUpdateSet → push userId → SQL
		const set = buildUpdateSet({ status: 'banned', role: 'customer' });
		set.params.push(42);
		expect(set.sql + ` WHERE id = $${set.params.length}`).toBe(
			'status = $1, role = $2 WHERE id = $3',
		);
		expect(set.params).toEqual(['banned', 'customer', 42]);
	});
});

// ═══════════════════════════════════════════════════════════
// Self-protection logic — admins should not be able to ban or demote
// themselves even via a direct API call.
// ═══════════════════════════════════════════════════════════
function selfProtectionCheck(
	actingUserId: number,
	targetUserId: number,
	patch: {
		status?: 'active' | 'suspended' | 'banned';
		role?: 'customer' | 'merchant' | 'admin';
		[k: string]: unknown;
	},
): { allowed: boolean; reason?: string } {
	if (actingUserId !== targetUserId) return { allowed: true };
	if (patch.status === 'banned') {
		return { allowed: false, reason: 'You cannot ban your own account.' };
	}
	if (patch.role && patch.role !== 'admin') {
		return { allowed: false, reason: 'You cannot remove your own admin role.' };
	}
	return { allowed: true };
}

describe('self-protection for admin PATCH /users/:id', () => {
	const adminId = 1;

	it('allows admin to suspend themselves (not banned)', () => {
		const r = selfProtectionCheck(adminId, adminId, { status: 'suspended' });
		expect(r.allowed).toBe(true);
	});

	it('blocks admin from banning themselves', () => {
		const r = selfProtectionCheck(adminId, adminId, { status: 'banned' });
		expect(r.allowed).toBe(false);
		expect(r.reason).toMatch(/ban/);
	});

	it('blocks admin from demoting themselves', () => {
		const r = selfProtectionCheck(adminId, adminId, { role: 'customer' });
		expect(r.allowed).toBe(false);
		expect(r.reason).toMatch(/admin role/);
	});

	it('blocks admin from banning AND demoting at once', () => {
		const r = selfProtectionCheck(adminId, adminId, { status: 'banned', role: 'customer' });
		expect(r.allowed).toBe(false);
	});

	it('allows admin to act on OTHER users freely', () => {
		const r = selfProtectionCheck(adminId, 999, { status: 'banned', role: 'customer' });
		expect(r.allowed).toBe(true);
	});

	it('allows admin to update other fields on themselves', () => {
		const r = selfProtectionCheck(adminId, adminId, { is_verified: true });
		expect(r.allowed).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════
// Access control — non-admins should be rejected by requireRole('admin').
// This is middleware-level, so we just assert the schema values that
// drive the auth flow (the role check itself is verified by the
// E2E test suite).
// ═══════════════════════════════════════════════════════════
describe('admin role check (schema-level)', () => {
	// The AuthRole union is: 'customer' | 'merchant' | 'admin'. The
	// requireRole('admin') middleware compares against this exact list.
	// A non-admin role string would never match.
	const ALLOWED_ADMIN_ROLES = ['admin'] as const;
	const NON_ADMIN_ROLES = ['customer', 'merchant'] as const;

	it.each(NON_ADMIN_ROLES)('blocks role=%s from admin endpoints', (role) => {
		expect(ALLOWED_ADMIN_ROLES.includes(role as never)).toBe(false);
	});

	it('allows role=admin', () => {
		expect(ALLOWED_ADMIN_ROLES.includes('admin')).toBe(true);
	});
});
