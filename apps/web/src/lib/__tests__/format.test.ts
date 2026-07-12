/**
 * Tests for src/lib/format.ts (K.3 — formatMoney helper).
 *
 * Covers:
 *  - formatMoney with default + custom currency / locale
 *  - formatMoneyCompact (k/m suffixes)
 *  - parseMoney (Arabic-Indic digit handling)
 *  - NaN / Infinity / null / undefined safety
 *  - Currency symbol selection per language
 */

import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyCompact, parseMoney, resolveLocale } from '../format';

describe('formatMoney', () => {
	it('defaults to Arabic locale (Yemen-first)', () => {
		// ar-YE locale uses Arabic-Indic digits (project is Yemen-first).
		expect(formatMoney(25000)).toBe('٢٥٬٠٠٠ ر.ي');
	});

	it('handles zero in Arabic', () => {
		expect(formatMoney(0)).toBe('٠ ر.ي');
	});

	it('handles negative amounts in Arabic', () => {
		expect(formatMoney(-1500)).toBe('؜-١٬٥٠٠ ر.ي');
	});

	it('formats English locale when lang=en', () => {
		expect(formatMoney(25000, { lang: 'en' })).toBe('25,000 YER');
	});

	it('handles zero in English', () => {
		expect(formatMoney(0, { lang: 'en' })).toBe('0 YER');
	});

	it('handles negative amounts in English', () => {
		expect(formatMoney(-1500, { lang: 'en' })).toBe('-1,500 YER');
	});

	it('puts USD symbol AFTER number for consistency with YER', () => {
		// Consistent with our existing UX — every currency puts its
		// symbol after the number to avoid RTL/LTR mixing issues.
		expect(formatMoney(25000, { currency: 'USD', lang: 'en' })).toBe('25,000 $');
	});

	it('supports SAR / AED / EUR', () => {
		expect(formatMoney(100, { currency: 'SAR', lang: 'en' })).toBe('100 SAR');
		expect(formatMoney(100, { currency: 'AED', lang: 'en' })).toBe('100 AED');
		expect(formatMoney(100, { currency: 'EUR', lang: 'en' })).toBe('100 €');
	});

	it('respects maximumFractionDigits', () => {
		expect(formatMoney(1234.56, { maximumFractionDigits: 2, lang: 'en' })).toBe('1,234.56 YER');
		expect(formatMoney(1234.56, { lang: 'en' })).toBe('1,235 YER'); // default = 0
	});

	it('omits the symbol when showSymbol=false', () => {
		expect(formatMoney(25000, { showSymbol: false, lang: 'en' })).toBe('25,000');
	});

	it('returns em-dash for null / undefined / NaN / Infinity', () => {
		expect(formatMoney(null)).toBe('—');
		expect(formatMoney(undefined)).toBe('—');
		expect(formatMoney(NaN)).toBe('—');
		expect(formatMoney(Infinity)).toBe('—');
		expect(formatMoney(-Infinity)).toBe('—');
	});
});

describe('formatMoneyCompact', () => {
	it('formats amounts under 1000 as plain integer (Arabic default)', () => {
		expect(formatMoneyCompact(450)).toBe('٤٥٠ ر.ي');
	});

	it('formats amounts under 1000 in English', () => {
		expect(formatMoneyCompact(450, { lang: 'en' })).toBe('450 YER');
	});

	it('uses k suffix for thousands (English)', () => {
		expect(formatMoneyCompact(1500, { lang: 'en' })).toBe('1.5k YER');
		expect(formatMoneyCompact(999_999, { lang: 'en' })).toBe('1,000k YER');
	});

	it('uses m suffix for millions (English)', () => {
		expect(formatMoneyCompact(2_500_000, { lang: 'en' })).toBe('2.5m YER');
		expect(formatMoneyCompact(12_000_000, { lang: 'en' })).toBe('12m YER');
	});

	it('keeps the sign on negative amounts (English)', () => {
		expect(formatMoneyCompact(-1500, { lang: 'en' })).toBe('-1.5k YER');
	});

	it('returns em-dash for non-finite', () => {
		expect(formatMoneyCompact(null)).toBe('—');
		expect(formatMoneyCompact(NaN)).toBe('—');
	});
});

describe('parseMoney', () => {
	it('parses plain integer strings', () => {
		expect(parseMoney('25000')).toBe(25000);
	});

	it('parses comma-grouped strings', () => {
		expect(parseMoney('25,000')).toBe(25000);
		expect(parseMoney('1,234,567.89')).toBe(1234567.89);
	});

	it('parses Arabic-Indic digits (٠-٩)', () => {
		expect(parseMoney('١٢٫٥')).toBe(12.5);
		expect(parseMoney('١٬٢٣٤')).toBe(1234);
	});

	it('parses negative values', () => {
		expect(parseMoney('-1500')).toBe(-1500);
	});

	it('returns NaN for empty / non-numeric', () => {
		expect(Number.isNaN(parseMoney(''))).toBe(true);
		expect(Number.isNaN(parseMoney('not a number'))).toBe(true);
	});
});

describe('resolveLocale', () => {
	it('maps language codes to BCP-47 locales', () => {
		expect(resolveLocale('ar')).toBe('ar-YE');
		expect(resolveLocale('en')).toBe('en-US');
		expect(resolveLocale('zh')).toBe('zh-CN');
	});
});
