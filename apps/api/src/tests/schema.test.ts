/**
 * Schema-level sanity tests for the project's SQL files.
 *
 * These do NOT execute the SQL against a real database. They just verify
 * the file contents are well-formed and contain the expected top-level
 * objects. Run with: `npm test -- schema`
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// apps/api/src/tests/ → apps/api/src → apps/api → apps → root
const ROOT = resolve(__dirname, '..', '..', '..', '..');

function readSql(relPath: string): string {
	const abs = resolve(ROOT, relPath);
	if (!existsSync(abs)) {
		throw new Error(`SQL file missing: ${relPath}`);
	}
	return readFileSync(abs, 'utf8');
}

describe('SQL schema files', () => {
	describe('database/schema.sql (master schema)', () => {
		const sql = readSql('packages/db/schema.sql');

		it('exists and is non-empty', () => {
			expect(sql.length).toBeGreaterThan(100);
		});

		it('declares the core e-commerce tables', () => {
			const expected = [
				'users',
				'categories',
				'stores',
				'products',
				'product_images',
				'orders',
				'order_items',
				'cart_items',
				'reviews',
				'wishlist',
				'addresses',
				'subscriptions',
				'product_variants',
			];
			for (const table of expected) {
				// We look for `CREATE TABLE` mentions of the name.
				const re = new RegExp(`CREATE TABLE\\s+(IF NOT EXISTS\\s+)?${table}\\b`, 'i');
				expect(sql, `Missing CREATE TABLE for "${table}"`).toMatch(re);
			}
		});

		it('uses PostgreSQL types', () => {
			// Modern PG 17 schema uses GENERATED ... AS IDENTITY (not legacy SERIAL).
			expect(sql).toMatch(/GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY/i);
			expect(sql).toMatch(/TIMESTAMP(TZ)?/i);
			expect(sql).toMatch(/VARCHAR/i);
		});

		it('declares foreign keys', () => {
			expect(sql).toMatch(/REFERENCES\s+users\b/i);
			expect(sql).toMatch(/REFERENCES\s+stores\b/i);
			expect(sql).toMatch(/REFERENCES\s+products\b/i);
		});
	});

	describe('database/schema-extra.sql (extra tables)', () => {
		const sql = readSql('packages/db/schema-extra.sql');

		it('exists and is non-empty', () => {
			expect(sql.length).toBeGreaterThan(50);
		});

		it('declares the extra business tables', () => {
			// product_variants and notifications live in schema.sql (referenced
			// by orders/order_items/notifications endpoints) so they are not
			// expected here. All other business tables come from schema-extra.sql.
			const expected = [
				'coupons',
				'coupon_usage',
				'payments',
				'refunds',
				'shipping_methods',
				'inventory_log',
				'transactions',
				'store_balance',
				'store_followers',
				'admin_audit_log',
			];
			for (const table of expected) {
				const re = new RegExp(`CREATE TABLE\\s+(IF NOT EXISTS\\s+)?${table}\\b`, 'i');
				expect(sql, `Missing CREATE TABLE for "${table}"`).toMatch(re);
			}
		});

		it('declares coupons BEFORE coupon_usage (dependency order)', () => {
			const couponsIdx = sql.search(/CREATE TABLE\s+(IF NOT EXISTS\s+)?coupons\b/i);
			const usageIdx = sql.search(/CREATE TABLE\s+(IF NOT EXISTS\s+)?coupon_usage\b/i);
			expect(couponsIdx).toBeGreaterThan(-1);
			expect(usageIdx).toBeGreaterThan(-1);
			expect(couponsIdx, 'coupons must be defined before coupon_usage').toBeLessThan(
				usageIdx,
			);
		});
	});

	describe('database/reference-seed.sql (production-safe reference data)', () => {
		const sql = readSql('packages/db/reference-seed.sql');

		it('exists and contains only reference inserts', () => {
			expect(sql.length).toBeGreaterThan(500);
			expect(sql).toMatch(/INSERT INTO\s+categories/i);
			expect(sql).toMatch(/INSERT INTO\s+shipping_methods/i);
			expect(sql).not.toMatch(/INSERT INTO\s+(users|stores|products|orders|payments|reviews)/i);
		});
	});

	describe('database/demo-seed.sql (development/test data)', () => {
		const sql = readSql('packages/db/demo-seed.sql');

		it('contains an explicit non-production gate', () => {
			expect(sql).toMatch(/noufex\.allow_demo_seed/);
			expect(sql).toMatch(/noufex\.environment/);
			expect(sql).toMatch(/production/);
		});

		it('does not contain a super-admin row or fixed admin credential', () => {
			expect(sql).not.toMatch(/admin@noufex\.com/i);
			expect(sql).not.toMatch(/admin123/i);
			expect(sql).toMatch(/INSERT INTO\s+users/i);
			expect(sql).toMatch(/INSERT INTO\s+stores/i);
		});
	});
});
