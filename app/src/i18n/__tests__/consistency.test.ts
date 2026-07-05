/**
 * i18n key consistency check
 *
 * Enforces that the AR (source of truth), EN, and ZH locale files stay in
 * sync — i.e. no section or key in one file is silently missing from
 * another. The app's `fallbackLng: 'ar'` (see src/i18n/index.ts) hides
 * missing keys at runtime, so we catch them at test time instead.
 *
 * Closes P3 backlog item R-16 (i18n key consistency check, 2h, 🟢 Low).
 * See MIGRATION_EXECUTION_PLAN.md §45.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── Types ───────────────────────────────────────────────────

type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | { [k: string]: JsonValue } | JsonValue[];
type LocaleTree = Record<string, JsonValue>;

// ─── Load helpers ────────────────────────────────────────────

const LOCALES_DIR = resolve(__dirname, '..', 'locales');

function loadLocale(name: 'ar' | 'en' | 'zh'): LocaleTree {
	const path = resolve(LOCALES_DIR, `${name}.json`);
	return JSON.parse(readFileSync(path, 'utf8')) as LocaleTree;
}

const AR = loadLocale('ar');
const EN = loadLocale('en');
const ZH = loadLocale('zh');

// ─── Flatten helpers ────────────────────────────────────────

/**
 * Collect every leaf key path under an object, joined by dots.
 * Arrays are represented by their index. Nested objects recurse.
 */
function flattenKeys(obj: JsonValue, prefix = ''): string[] {
	const out: string[] = [];
	if (obj === null || typeof obj !== 'object') return out;
	if (Array.isArray(obj)) {
		obj.forEach((v, i) => {
			const next = prefix ? `${prefix}.${i}` : String(i);
			const sub = flattenKeys(v, next);
			out.push(...sub);
		});
		return out;
	}
	for (const k of Object.keys(obj)) {
		const value = (obj as Record<string, JsonValue>)[k];
		const next = prefix ? `${prefix}.${k}` : k;
		if (value !== null && typeof value === 'object') {
			out.push(...flattenKeys(value, next));
		} else {
			out.push(next);
		}
	}
	return out;
}

function setDifference(a: Set<string>, b: Set<string>): string[] {
	return [...a].filter((x) => !b.has(x)).sort();
}

function diffReport(missing: string[]): string {
	if (missing.length === 0) return '✓ parity';
	const preview = missing.slice(0, 5).join(', ');
	const more = missing.length > 5 ? ` (+${missing.length - 5} more)` : '';
	return `✗ ${missing.length} missing: ${preview}${more}`;
}

// ─── Test fixtures ──────────────────────────────────────────

const arKeys = new Set(flattenKeys(AR));
const enKeys = new Set(flattenKeys(EN));
const zhKeys = new Set(flattenKeys(ZH));

const topLevelAr = new Set(Object.keys(AR));
const topLevelEn = new Set(Object.keys(EN));
const topLevelZh = new Set(Object.keys(ZH));

// ─── Tests ───────────────────────────────────────────────────

describe('i18n locale consistency', () => {
	describe('top-level sections', () => {
		it('en.json has every section that ar.json has', () => {
			const missing = setDifference(topLevelAr, topLevelEn);
			expect(missing, `Missing sections in en.json: ${diffReport(missing)}`).toEqual([]);
		});

		it('zh.json has every section that ar.json has', () => {
			const missing = setDifference(topLevelAr, topLevelZh);
			expect(missing, `Missing sections in zh.json: ${diffReport(missing)}`).toEqual([]);
		});

		it('en.json has no extra sections not in ar.json (signal drift)', () => {
			const extra = setDifference(topLevelEn, topLevelAr);
			expect(extra, `Extra sections in en.json: ${diffReport(extra)}`).toEqual([]);
		});

		it('zh.json has no extra sections not in ar.json (signal drift)', () => {
			const extra = setDifference(topLevelZh, topLevelAr);
			expect(extra, `Extra sections in zh.json: ${diffReport(extra)}`).toEqual([]);
		});
	});

	describe('leaf keys (full recursive)', () => {
		it('en.json has every leaf key that ar.json has', () => {
			const missing = setDifference(arKeys, enKeys);
			expect(missing, `Missing keys in en.json: ${diffReport(missing)}`).toEqual([]);
		});

		it('zh.json has every leaf key that ar.json has', () => {
			const missing = setDifference(arKeys, zhKeys);
			expect(missing, `Missing keys in zh.json: ${diffReport(missing)}`).toEqual([]);
		});

		it('en.json has no extra leaf keys not in ar.json (signal drift)', () => {
			const extra = setDifference(enKeys, arKeys);
			expect(extra, `Extra keys in en.json: ${diffReport(extra)}`).toEqual([]);
		});

		it('zh.json has no extra leaf keys not in ar.json (signal drift)', () => {
			const extra = setDifference(zhKeys, arKeys);
			expect(extra, `Extra keys in zh.json: ${diffReport(extra)}`).toEqual([]);
		});
	});

	describe('summary', () => {
		it('reports the size of each locale', () => {
			// Output for CI logs — visible only when --reporter=verbose.
			// eslint-disable-next-line no-console
			console.log(
				`\n[i18n] ar.json: ${arKeys.size} keys | en.json: ${enKeys.size} keys | zh.json: ${zhKeys.size} keys`,
			);
			expect(arKeys.size).toBeGreaterThan(500);
		});
	});
});
