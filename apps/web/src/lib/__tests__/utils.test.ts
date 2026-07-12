/**
 * Tests for the small utility helpers in src/lib/utils.ts.
 *
 * The `cn` helper is the only export — it composes Tailwind class names
 * via `clsx` and runs them through `tailwind-merge` so conflicting
 * utilities (e.g. `p-2 p-4`) keep only the last value.
 */

import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
	it('returns an empty string for no input', () => {
		expect(cn()).toBe('');
	});

	it('returns a single class unchanged', () => {
		expect(cn('text-aliText')).toBe('text-aliText');
	});

	it('joins multiple classes with a single space', () => {
		expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
	});

	it('drops falsy values (undefined, null, false, "")', () => {
		expect(cn('a', undefined, null, false, '', 'b')).toBe('a b');
	});

	it('expands an array of class names', () => {
		expect(cn(['a', 'b'])).toBe('a b');
	});

	it('expands nested arrays', () => {
		expect(cn(['a', ['b', 'c']])).toBe('a b c');
	});

	it('expands object notation (clsx-style)', () => {
		expect(cn({ 'text-bold': true, hidden: false, block: true })).toBe('text-bold block');
	});

	it('lets the last conflicting Tailwind utility win', () => {
		// tailwind-merge collapses `p-2` and `p-4` to just `p-4`.
		expect(cn('p-2', 'p-4')).toBe('p-4');
		// Same for text-size:
		expect(cn('text-sm', 'text-lg')).toBe('text-lg');
	});

	it('keeps non-conflicting utilities together', () => {
		expect(cn('text-sm', 'font-bold', 'p-2')).toBe('text-sm font-bold p-2');
	});

	it('keeps the order of non-conflicting classes', () => {
		expect(cn('font-bold', 'text-sm')).toBe('font-bold text-sm');
	});
});
