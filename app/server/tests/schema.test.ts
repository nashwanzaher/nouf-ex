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

// app/server/tests/ → app/server → app → project root
const ROOT = resolve(__dirname, '..', '..', '..');

function readSql(relPath: string): string {
	const abs = resolve(ROOT, relPath);
	if (!existsSync(abs)) {
		throw new Error(`SQL file missing: ${relPath}`);
	}
	return readFileSync(abs, 'utf8');
}

describe('SQL schema files', () => {
	describe('database/schema.sql (master schema)', () => {
		const sql = readSql('database/schema.sql');

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
			];
			for (const table of expected) {
				// We look for `CREATE TABLE` mentions of the name.
				const re = new RegExp(`CREATE TABLE\\s+(IF NOT EXISTS\\s+)?${table}\\b`, 'i');
				expect(sql, `Missing CREATE TABLE for "${table}"`).toMatch(re);
			}
		});

		it('uses PostgreSQL types', () => {
			expect(sql).toMatch(/SERIAL/i);
			expect(sql).toMatch(/TIMESTAMP/i);
			expect(sql).toMatch(/VARCHAR/i);
		});

		it('declares foreign keys', () => {
			expect(sql).toMatch(/REFERENCES\s+users\b/i);
			expect(sql).toMatch(/REFERENCES\s+stores\b/i);
			expect(sql).toMatch(/REFERENCES\s+products\b/i);
		});
	});

	describe('database/schema-extra.sql (extra tables)', () => {
		const sql = readSql('database/schema-extra.sql');

		it('exists and is non-empty', () => {
			expect(sql.length).toBeGreaterThan(50);
		});

		it('declares the extra business tables', () => {
			const expected = [
				'coupons',
				'coupon_usage',
				'payments',
				'refunds',
				'shipping_methods',
				'inventory_log',
				'product_variants',
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
			expect(couponsIdx, 'coupons must be defined before coupon_usage').toBeLessThan(usageIdx);
		});
	});

	describe('database/seed.sql (data dump)', () => {
		const sql = readSql('database/seed.sql');

		it('exists and contains INSERT statements', () => {
			expect(sql.length).toBeGreaterThan(1000);
			expect(sql).toMatch(/INSERT INTO/i);
		});

		it('contains data for the core business tables', () => {
			const tables = ['users', 'categories', 'stores', 'products', 'orders'];
			// The dump uses double-quoted identifiers ("users"). Match both forms.
			// We require whitespace after the table name (always true in valid SQL).
			// We can't use \b here because after "users" the next char is `"` (a
			// non-word char before another non-word char — no boundary).
			for (const t of tables) {
				const re = new RegExp(`INSERT INTO\\s+(?:"${t}"|${t})\\s`, 'i');
				expect(sql, `Missing INSERT for "${t}"`).toMatch(re);
			}
		});

		it('uses TRUE/FALSE for boolean literals (PG-compatible)', () => {
			// Spot-check: we expect at least some TRUE/FALSE tokens.
			const hasTrue = /\bTRUE\b/.test(sql);
			const hasFalse = /\bFALSE\b/.test(sql);
			expect(hasTrue || hasFalse).toBe(true);
		});
	});
});
