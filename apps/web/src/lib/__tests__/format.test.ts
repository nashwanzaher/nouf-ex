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
	it('formats YER (default currency) with the default locale', () => {
		expect(formatMoney(25000)).toBe('25,000 YER');
	});

	it('handles zero', () => {
		expect(formatMoney(0)).toBe('0 YER');
	});

	it('handles negative amounts', () => {
		expect(formatMoney(-1500)).toBe('-1,500 YER');
	});

	it('uses Arabic abbreviation (ر.ي) when lang=ar', () => {
		// ar-YE locale uses Arabic-Indic digits (existing UX behavior —
		// preserved from the original formatYER() helper).
		expect(formatMoney(25000, { lang: 'ar' })).toBe('٢٥٬٠٠٠ ر.ي');
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
		expect(formatMoney(1234.56, { maximumFractionDigits: 2 })).toBe('1,234.56 YER');
		expect(formatMoney(1234.56)).toBe('1,235 YER'); // default = 0
	});

	it('omits the symbol when showSymbol=false', () => {
		expect(formatMoney(25000, { showSymbol: false })).toBe('25,000');
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
	it('formats amounts under 1000 as plain integer', () => {
		expect(formatMoneyCompact(450)).toBe('450 YER');
		// Arabic locale uses Arabic-Indic digits.
		expect(formatMoneyCompact(450, { lang: 'ar' })).toBe('٤٥٠ ر.ي');
	});

	it('uses k suffix for thousands', () => {
		expect(formatMoneyCompact(1500)).toBe('1.5k YER');
		expect(formatMoneyCompact(999_999)).toBe('1,000k YER');
	});

	it('uses m suffix for millions', () => {
		expect(formatMoneyCompact(2_500_000)).toBe('2.5m YER');
		expect(formatMoneyCompact(12_000_000)).toBe('12m YER');
	});

	it('keeps the sign on negative amounts', () => {
		expect(formatMoneyCompact(-1500)).toBe('-1.5k YER');
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
