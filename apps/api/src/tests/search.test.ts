/**
 * Unit tests for apps/api/src/lib/search.ts (P1-1).
 *
 * The tests target the pure helpers (normalizeQuery) and the
 * parameter-building logic. The full SQL execution is covered
 * separately by the live-DB smoke check in `apply-migration`
 * and by manual verification of /api/search via the catalog
 * router integration test.
 */
import { describe, it, expect } from 'vitest';
import { normalizeQuery } from '../lib/search.ts';

describe('normalizeQuery()', () => {
	it('lowercases', () => {
		expect(normalizeQuery('HONEY')).toBe('honey');
	});

	it('trims whitespace', () => {
		expect(normalizeQuery('  honey  ')).toBe('honey');
	});

	it('collapses internal whitespace', () => {
		expect(normalizeQuery('honey    beeswax')).toBe('honey beeswax');
	});

	it('caps at 200 chars', () => {
		const long = 'a'.repeat(300);
		expect(normalizeQuery(long).length).toBe(200);
	});

	it('returns the empty string for an empty input', () => {
		expect(normalizeQuery('')).toBe('');
	});

	it('returns the empty string for whitespace-only input', () => {
		expect(normalizeQuery('   \t\n  ')).toBe('');
	});

	it('preserves Arabic text (lowercasing is a no-op for Arabic)', () => {
		expect(normalizeQuery('عسل يمني')).toBe('عسل يمني');
	});

	it('preserves Chinese text', () => {
		expect(normalizeQuery('高端  无线  耳机')).toBe('高端 无线 耳机');
	});
});
