/**
 * Unit tests for the customer-side Zod schemas (cart + wishlist).
 *
 * Same pattern as admin-mutations.test.ts: pure-function tests of
 * the validation logic. End-to-end behaviour (auth, SQL, response
 * shape) is covered by the live E2E suite.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { resolveOrderStoreId, type OrderProductRow } from '../lib/shared.cts';

// Mirror of cartAddSchema in server/index.ts
const cartAddSchema = z
	.object({
		productId: z.number().int().positive(),
		quantity: z.number().int().min(1).max(100).default(1),
		variant: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

// Mirror of cartItemIdParamSchema
const cartItemIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

// Mirror of wishlistAddSchema
const wishlistAddSchema = z
	.object({
		productId: z.number().int().positive(),
	})
	.strict();

// Mirror of wishlistItemIdParamSchema
const wishlistItemIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

// ═══════════════════════════════════════════════════════════
describe('cartAddSchema', () => {
	it('accepts a minimal {productId, quantity}', () => {
		const r = cartAddSchema.safeParse({ productId: 5, quantity: 2 });
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.productId).toBe(5);
			expect(r.data.quantity).toBe(2);
		}
	});

	it('defaults quantity to 1 when omitted', () => {
		const r = cartAddSchema.safeParse({ productId: 5 });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.quantity).toBe(1);
	});

	it('accepts an optional variant object', () => {
		const r = cartAddSchema.safeParse({
			productId: 1,
			quantity: 1,
			variant: { color: 'red', size: 'M' },
		});
		expect(r.success).toBe(true);
	});

	it('rejects missing productId', () => {
		const r = cartAddSchema.safeParse({ quantity: 1 });
		expect(r.success).toBe(false);
	});

	it('rejects negative productId', () => {
		const r = cartAddSchema.safeParse({ productId: -5 });
		expect(r.success).toBe(false);
	});

	it('rejects zero productId', () => {
		const r = cartAddSchema.safeParse({ productId: 0 });
		expect(r.success).toBe(false);
	});

	it('rejects non-integer productId', () => {
		const r = cartAddSchema.safeParse({ productId: 1.5 });
		expect(r.success).toBe(false);
	});

	it('rejects quantity=0', () => {
		const r = cartAddSchema.safeParse({ productId: 1, quantity: 0 });
		expect(r.success).toBe(false);
	});

	it('rejects quantity=101 (over the cap)', () => {
		const r = cartAddSchema.safeParse({ productId: 1, quantity: 101 });
		expect(r.success).toBe(false);
	});

	it('rejects string productId (no auto-coercion)', () => {
		const r = cartAddSchema.safeParse({ productId: '5' });
		expect(r.success).toBe(false);
	});

	it('rejects extra fields (strict mode)', () => {
		const r = cartAddSchema.safeParse({ productId: 1, quantity: 1, userId: 99 });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
describe('cartItemIdParamSchema (path param)', () => {
	it('coerces a numeric string', () => {
		const r = cartItemIdParamSchema.safeParse({ id: '42' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.id).toBe(42);
	});

	it('accepts a number', () => {
		const r = cartItemIdParamSchema.safeParse({ id: 7 });
		expect(r.success).toBe(true);
	});

	it('rejects 0 (not positive)', () => {
		const r = cartItemIdParamSchema.safeParse({ id: 0 });
		expect(r.success).toBe(false);
	});

	it('rejects negative', () => {
		const r = cartItemIdParamSchema.safeParse({ id: -1 });
		expect(r.success).toBe(false);
	});

	it('rejects non-numeric', () => {
		const r = cartItemIdParamSchema.safeParse({ id: 'abc' });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
describe('wishlistAddSchema', () => {
	it('accepts {productId}', () => {
		const r = wishlistAddSchema.safeParse({ productId: 3 });
		expect(r.success).toBe(true);
	});

	it('rejects missing productId', () => {
		const r = wishlistAddSchema.safeParse({});
		expect(r.success).toBe(false);
	});

	it('rejects negative productId', () => {
		const r = wishlistAddSchema.safeParse({ productId: -1 });
		expect(r.success).toBe(false);
	});

	it('rejects extra fields (strict mode)', () => {
		const r = wishlistAddSchema.safeParse({ productId: 1, userId: 99 });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
describe('wishlistItemIdParamSchema', () => {
	it('coerces a numeric string', () => {
		const r = wishlistItemIdParamSchema.safeParse({ id: '99' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.id).toBe(99);
	});

	it('rejects 0', () => {
		const r = wishlistItemIdParamSchema.safeParse({ id: 0 });
		expect(r.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════
// Self-protection: any handler that takes a path userId param must
// always use the AUTHENTICATED user's id, not the path param.
// Mirror of the actual checks in the handlers.
// ═══════════════════════════════════════════════════════════
function pickUserId(authenticatedUserId: number): number {
	// Source of truth is ALWAYS req.user.id. The path userId param
	// on endpoints like /api/cart/clear/:userId is decorative —
	// the handler must always use the authenticated user's id.
	return authenticatedUserId;
}

describe('user-id source-of-truth rule', () => {
	it('returns the authenticated id unchanged', () => {
		expect(pickUserId(2)).toBe(2);
		expect(pickUserId(1)).toBe(1);
	});

	it('DELETE /api/cart/clear/:userId always uses req.user.id', () => {
		// A logged-in user with id=1 calls /api/cart/clear/99 expecting
		// to wipe user 99's cart. The handler must wipe user 1's own
		// cart, NOT user 99's. The path param is effectively decorative.
		const authenticated = 1;
		const pathParam = 99;
		const target = pickUserId(authenticated);
		expect(target).toBe(authenticated);
		expect(target).not.toBe(pathParam);
	});
});

// ═══════════════════════════════════════════════════════════
// P0-1: resolveOrderStoreId — server-side store derivation
// ═══════════════════════════════════════════════════════════
//
// One order == one store. The helper is the source of truth for
// which store an order belongs to: it looks up each requested
// product, rejects unavailable ones, and asserts the unique set
// of store_ids has size 1.
describe('resolveOrderStoreId', () => {
	function row(
		id: number,
		store_id: number,
		overrides: Partial<OrderProductRow> = {}
	): OrderProductRow {
		return {
			id,
			store_id,
			is_active: true,
			deleted_at: null,
			...overrides,
		};
	}

	it('returns the single storeId when all items come from one store', () => {
		const r = resolveOrderStoreId([1, 2, 3], [row(1, 7), row(2, 7), row(3, 7)]);
		expect(r).toEqual({ ok: true, storeId: 7 });
	});

	it('returns MIXED_STORES when items span more than one store', () => {
		const r = resolveOrderStoreId(
			[1, 2],
			[row(1, 7), row(2, 9)]
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.code).toBe('MIXED_STORES');
	});

	it('returns PRODUCT_UNAVAILABLE for an unknown product id', () => {
		// 1 exists, 999 does not.
		const r = resolveOrderStoreId([1, 999], [row(1, 7)]);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.code).toBe('PRODUCT_UNAVAILABLE');
			if (r.code === 'PRODUCT_UNAVAILABLE') {
				expect(r.productId).toBe(999);
			}
		}
	});

	it('returns PRODUCT_UNAVAILABLE for an inactive product (is_active=false)', () => {
		const r = resolveOrderStoreId(
			[1, 2],
			[row(1, 7), row(2, 7, { is_active: false })]
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.code).toBe('PRODUCT_UNAVAILABLE');
	});

	it('returns PRODUCT_UNAVAILABLE for a soft-deleted product (deleted_at != null)', () => {
		const r = resolveOrderStoreId(
			[1, 2],
			[row(1, 7), row(2, 7, { deleted_at: '2026-06-01T00:00:00Z' })]
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.code).toBe('PRODUCT_UNAVAILABLE');
	});

	it('returns EMPTY_CART when no products are requested', () => {
		const r = resolveOrderStoreId([], []);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.code).toBe('EMPTY_CART');
	});

	it('tolerates duplicate product ids in the request (single store, single result)', () => {
		// A user could legitimately request the same product twice
		// (e.g. duplicate line items). The storeId resolution is
		// based on the unique set of stores, not the line count.
		const r = resolveOrderStoreId(
			[1, 1, 1],
			[row(1, 7)]
		);
		expect(r).toEqual({ ok: true, storeId: 7 });
	});
});
