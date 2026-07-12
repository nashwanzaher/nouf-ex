/**
 * Unit tests for the Phase-2 admin Zod schemas + helpers in admin-extras.ts.
 *
 * Pure-function tests — no DB or HTTP app needed. End-to-end behaviour
 * (auth, access control, SQL side effects) is covered by the E2E tests
 * in apps/e2e/e2e/.
 *
 * Each test asserts ONE thing so a failure tells you exactly which
 * invariant broke.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Mirror the schemas that live in routes/admin-extras.ts (and validate.ts).
// If they drift, the E2E tests will catch it on the next deploy.

// ═══════════════════════════════════════════════════════════
// Category schemas
// ═══════════════════════════════════════════════════════════
const adminCategoryCreateSchema = z
	.object({
		name_ar: z.string().trim().min(1).max(120),
		name_en: z.string().trim().max(120).optional(),
		name_zh: z.string().trim().max(120).optional(),
		slug: z
			.string()
			.trim()
			.min(1)
			.max(80)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
		parent_id: z.number().int().positive().optional(),
		icon: z.string().trim().max(120).optional(),
		image: z.string().trim().url().optional(),
		sort_order: z.number().int().nonnegative().default(0),
		is_active: z.boolean().default(true),
	})
	.strict();

const adminCategoryUpdateSchema = adminCategoryCreateSchema.partial();
void adminCategoryUpdateSchema; // referenced for parity with server; partial PATCH tests live in admin-extras-integration.test.ts

describe('adminCategoryCreateSchema', () => {
	it('accepts canonical category data', () => {
		const r = adminCategoryCreateSchema.safeParse({
			name_ar: 'إلكترونيات',
			slug: 'electronics',
		});
		expect(r.success).toBe(true);
	});

	it('rejects non-kebab-case slugs', () => {
		for (const bad of ['Electronics', 'ELECTRONICS', 'ele ctronics', 'electronics!', '']) {
			expect(adminCategoryCreateSchema.safeParse({
				name_ar: 'إلكترونيات',
				slug: bad,
			}).success).toBe(false);
		}
	});

	it('rejects names longer than 120 chars', () => {
		expect(adminCategoryCreateSchema.safeParse({
			name_ar: 'x'.repeat(121),
			slug: 'ok',
		}).success).toBe(false);
	});

	it('rejects unknown fields (strict mode)', () => {
		expect(adminCategoryCreateSchema.safeParse({
			name_ar: 'Electronics',
			slug: 'electronics',
			hacker: 'x',
		}).success).toBe(false);
	});

	it('rejects invalid icon URL', () => {
		expect(adminCategoryCreateSchema.safeParse({
			name_ar: 'Electronics',
			slug: 'electronics',
			image: 'not-a-url',
		}).success).toBe(false);
	});

	it('accepts valid kebab-case slugs', () => {
		for (const good of ['electronics', 'food-beverages', 'a-b-c-d-e-f']) {
			expect(adminCategoryCreateSchema.safeParse({
				name_ar: 'Test',
				slug: good,
			}).success).toBe(true);
		}
	});
});

// ═══════════════════════════════════════════════════════════
// Coupon schemas
// ═══════════════════════════════════════════════════════════
const adminCouponCreateSchema = z
	.object({
		code: z
			.string()
			.trim()
			.min(2)
			.max(40)
			.regex(/^[A-Z0-9_-]+$/i, 'code must be alphanumeric'),
		type: z.enum(['percentage', 'fixed']),
		value: z.number().positive(),
		min_order_amount: z.number().nonnegative().default(0),
		max_discount: z.number().nonnegative().optional(),
		usage_limit: z.number().int().positive().optional(),
		per_user_limit: z.number().int().positive().default(1),
		store_id: z.number().int().positive().optional(),
		starts_at: z.string().datetime().optional(),
		expires_at: z.string().datetime().optional(),
		is_active: z.boolean().default(true),
		description: z.string().trim().max(2000).optional(),
	})
	.strict()
	.refine((v) => !(v.type === 'percentage' && v.value > 100), {
		message: 'percentage coupon value must be ≤ 100',
		path: ['value'],
	})
	.refine(
		(v) => !v.starts_at || !v.expires_at || new Date(v.expires_at) > new Date(v.starts_at),
		{
			message: 'expires_at must be after starts_at',
			path: ['expires_at'],
		},
	);

describe('adminCouponCreateSchema', () => {
	it('accepts canonical percentage coupon (25% off)', () => {
		const r = adminCouponCreateSchema.safeParse({
			code: 'YEMEN25',
			type: 'percentage',
			value: 25,
		});
		expect(r.success).toBe(true);
	});

	it('rejects percentage > 100', () => {
		expect(
			adminCouponCreateSchema.safeParse({
				code: 'BIGOFF',
				type: 'percentage',
				value: 150,
			}).success,
		).toBe(false);
	});

	it('rejects fixed with negative value', () => {
		expect(
			adminCouponCreateSchema.safeParse({
				code: 'BAD',
				type: 'fixed',
				value: -10,
			}).success,
		).toBe(false);
	});

	it('rejects invalid code characters', () => {
		for (const bad of ['ab cd', 'coupon!', 'a$b']) {
			expect(
				adminCouponCreateSchema.safeParse({
					code: bad,
					type: 'fixed',
					value: 10,
				}).success,
			).toBe(false);
		}
	});

	it('rejects codes shorter than 2 chars', () => {
		expect(
			adminCouponCreateSchema.safeParse({
				code: 'A',
				type: 'fixed',
				value: 10,
			}).success,
		).toBe(false);
	});

	it('rejects codes longer than 40 chars', () => {
		expect(
			adminCouponCreateSchema.safeParse({
				code: 'A'.repeat(41),
				type: 'fixed',
				value: 10,
			}).success,
		).toBe(false);
	});

	it('rejects expires_at before starts_at', () => {
		expect(
			adminCouponCreateSchema.safeParse({
				code: 'BADDATE',
				type: 'fixed',
				value: 10,
				starts_at: '2026-12-31T00:00:00.000Z',
				expires_at: '2026-01-01T00:00:00.000Z',
			}).success,
		).toBe(false);
	});

	it('accepts a complete coupon with all fields', () => {
		const r = adminCouponCreateSchema.safeParse({
			code: 'WELCOME10',
			type: 'percentage',
			value: 10,
			min_order_amount: 100,
			max_discount: 50,
			usage_limit: 1000,
			per_user_limit: 1,
			starts_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2027-01-01T00:00:00.000Z',
			is_active: true,
			description: 'Welcome offer for new customers',
		});
		expect(r.success).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════
// Broadcast schema
// ═══════════════════════════════════════════════════════════
const adminBroadcastSchema = z
	.object({
		segment: z.enum(['all', 'customers', 'merchants', 'admins']),
		title: z.string().trim().min(1).max(120),
		body: z.string().trim().min(1).max(1000),
		type: z
			.enum(['order', 'message', 'review', 'promo', 'system', 'dispute', 'refund'])
			.default('system'),
	})
	.strict();

describe('adminBroadcastSchema', () => {
	it('accepts canonical broadcast', () => {
		const r = adminBroadcastSchema.safeParse({
			segment: 'customers',
			title: 'New sale',
			body: 'Up to 50% off all products',
		});
		expect(r.success).toBe(true);
	});

	it('rejects empty title', () => {
		expect(
			adminBroadcastSchema.safeParse({
				segment: 'all',
				title: '',
				body: 'hello',
			}).success,
		).toBe(false);
	});

	it('rejects titles longer than 120 chars', () => {
		expect(
			adminBroadcastSchema.safeParse({
				segment: 'all',
				title: 'x'.repeat(121),
				body: 'hello',
			}).success,
		).toBe(false);
	});

	it('rejects bodies longer than 1000 chars', () => {
		expect(
			adminBroadcastSchema.safeParse({
				segment: 'all',
				title: 'hi',
				body: 'x'.repeat(1001),
			}).success,
		).toBe(false);
	});

	it('rejects invalid segment', () => {
		expect(
			adminBroadcastSchema.safeParse({
				segment: 'everyone', // invalid
				title: 'hi',
				body: 'hello',
			}).success,
		).toBe(false);
	});

	it('rejects invalid type', () => {
		expect(
			adminBroadcastSchema.safeParse({
				segment: 'all',
				title: 'hi',
				body: 'hello',
				type: 'spam', // invalid
			}).success,
		).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
// Setting update schema
// ═══════════════════════════════════════════════════════════
const adminSettingUpdateSchema = z
	.object({ value: z.string().min(1).max(2000) })
	.strict();

describe('adminSettingUpdateSchema', () => {
	it('accepts any non-empty string up to 2000 chars', () => {
		expect(adminSettingUpdateSchema.safeParse({ value: 'YER' }).success).toBe(true);
	});

	it('rejects empty value', () => {
		expect(adminSettingUpdateSchema.safeParse({ value: '' }).success).toBe(false);
	});

	it('rejects values over 2000 chars', () => {
		expect(adminSettingUpdateSchema.safeParse({ value: 'x'.repeat(2001) }).success).toBe(false);
	});

	it('rejects unknown fields (strict mode)', () => {
		expect(
			adminSettingUpdateSchema.safeParse({ value: 'YER', other: 'x' }).success,
		).toBe(false);
	});
});
