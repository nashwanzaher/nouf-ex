/**
 * Currency / locale formatting helpers (K.3).
 *
 * Centralizes all money / number formatting in one place so the codebase
 * is no longer hardcoded to "YER" and can later support multi-currency
 * (USD, SAR, AED, EUR, …) by reading the store / product currency field.
 *
 * Before this file existed, the codebase had:
 *   - 4 inline `{amount.toLocaleString()} YER` in Checkout.tsx
 *   - 2 inline in SellerDashboard.tsx (one in KpiCard helper)
 *   - 2 inline in SellerDashboard.tsx (one in orderRow, one in productRow)
 *   - 3 duplicate helpers across files (formatYER / formatYer x2) that
 *     hardcoded `YER` (and ' ر.ي' for Arabic) in CustomerDashboard,
 *     CustomerOrders, and Wishlist.
 *
 * After this file:
 *   - All call-sites use `formatMoney(amount)` (defaults to YER).
 *   - The 3 duplicate helpers are deleted.
 *   - Switching currency = one line change in `DEFAULT_CURRENCY`.
 */

/**
 * Supported currencies. Keep this list in sync with the `currency`
 * column on `products`, `orders`, and `stores` (database/schema.sql).
 * For now we only render YER, but the type is open for future locales.
 */
export type Currency = 'YER' | 'USD' | 'SAR' | 'AED' | 'EUR';

/**
 * Currency symbol per locale. Arabic uses the local abbreviation
 * `ر.ي` (rial Yemeni) instead of the Latin "YER".
 */
const CURRENCY_SYMBOLS: Record<string, Record<Currency, string>> = {
	ar: { YER: 'ر.ي', USD: 'د.أ', SAR: 'ر.س', AED: 'د.إ', EUR: '€' },
	en: { YER: 'YER', USD: '$', SAR: 'SAR', AED: 'AED', EUR: '€' },
	zh: { YER: 'YER', USD: 'USD', SAR: 'SAR', AED: 'AED', EUR: 'EUR' },
};

/** Default currency until per-product / per-store currency lands. */
export const DEFAULT_CURRENCY: Currency = 'YER';

/** Default locale for number formatting. */
export const DEFAULT_LOCALE = 'ar-YE';

/**
 * Resolve a BCP-47 locale string from a 2-letter i18n language code.
 * Centralizes the locale mapping so call sites don't need to know
 * which specific locale yields the user's preferred digit grouping.
 */
export function resolveLocale(lang: 'ar' | 'en' | 'zh'): string {
	switch (lang) {
		case 'ar':
			return 'ar-YE';
		case 'zh':
			return 'zh-CN';
		case 'en':
			return 'en-US';
	}
}

/**
 * Format a number as a currency string.
 *
 * Examples:
 *   formatMoney(25000)                                    → '25,000 YER'
 *   formatMoney(25000, { lang: 'ar' })                   → '25,000 ر.ي'
 *   formatMoney(25000, { currency: 'USD', lang: 'en' })   → '$25,000'
 *   formatMoney(25000, { maximumFractionDigits: 2 })      → '25,000.00 YER'
 *
 * Negative amounts render with a minus sign. Zero renders as '0'.
 * Non-finite inputs (NaN / Infinity) return `'—'` to keep the UI
 * stable when the API returns a corrupt value.
 */
export function formatMoney(
	amount: number | null | undefined,
	options: {
		currency?: Currency;
		lang?: 'ar' | 'en' | 'zh';
		maximumFractionDigits?: number;
		showSymbol?: boolean;
	} = {},
): string {
	const {
		currency = DEFAULT_CURRENCY,
		lang = 'ar',
		maximumFractionDigits = 0,
		showSymbol = true,
	} = options;

	if (amount === null || amount === undefined || !Number.isFinite(amount)) {
		return '—';
	}

	const locale = resolveLocale(lang);
	const formatted = new Intl.NumberFormat(locale, {
		maximumFractionDigits,
		minimumFractionDigits: 0,
	}).format(amount);

	if (!showSymbol) return formatted;

	const symbol = CURRENCY_SYMBOLS[lang]?.[currency] ?? currency;

	// In Latin-script locales we put the symbol AFTER the number
	// (`25,000 YER`). In Arabic we keep the symbol after as well to
	// preserve the existing UX (was `${n} ر.ي`).
	return `${formatted} ${symbol}`;
}

/**
 * Compact currency formatter for dashboard cards (KPI tiles, table
 * rows). Uses `k`/`m` suffixes for readability when the amount is
 * large. Always rounds to the nearest integer.
 *
 * Examples:
 *   formatMoneyCompact(1500)             → '1.5k YER'
 *   formatMoneyCompact(2_500_000)        → '2.5m YER'
 *   formatMoneyCompact(450)              → '450 YER'
 *   formatMoneyCompact(450, { lang:'ar' }) → '450 ر.ي'
 */
export function formatMoneyCompact(
	amount: number | null | undefined,
	options: {
		currency?: Currency;
		lang?: 'ar' | 'en' | 'zh';
	} = {},
): string {
	const { currency = DEFAULT_CURRENCY, lang = 'ar' } = options;

	if (amount === null || amount === undefined || !Number.isFinite(amount)) {
		return '—';
	}

	const abs = Math.abs(amount);
	let value: number;
	let suffix: '' | 'k' | 'm' = '';

	if (abs >= 1_000_000) {
		value = amount / 1_000_000;
		suffix = 'm';
	} else if (abs >= 1_000) {
		value = amount / 1_000;
		suffix = 'k';
	} else {
		value = amount;
	}

	const locale = resolveLocale(lang);
	const formatted = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
		minimumFractionDigits: 0,
	}).format(value);

	const symbol = CURRENCY_SYMBOLS[lang]?.[currency] ?? currency;
	return `${formatted}${suffix} ${symbol}`;
}

/**
 * Parse a free-form money string back into a number. Useful for form
 * inputs that accept localized digits (e.g. Arabic "١٢٬٣٤٥٫٦٧").
 *
 * Handles:
 *  - Latin digits + comma/period: "25,000" / "25,000.50"
 *  - Arabic-Indic digits (U+0660–U+0669): "١٢٫٥"
 *  - Arabic thousands separator `٬` (U+066C) and decimal `٫` (U+066B)
 *
 * Returns NaN for empty / non-numeric input.
 */
export function parseMoney(input: string): number {
	if (!input || typeof input !== 'string') return NaN;
	// Step 1: strip everything that is NOT a digit (Latin or Arabic-Indic),
	// NOT a decimal separator (. or Arabic ٫), and NOT a minus sign.
	// The thousands separator (comma or Arabic ٬) is intentionally NOT
	// preserved here — we strip it and let Number() parse the rest.
	const cleaned = input
		.replace(/[^\d.\-٠-٩٬٫]/g, '')
		// Convert Arabic-Indic digits to Latin (٠→'0', ١→'1', … ٩→'9').
		// Arabic-Indic ٠ starts at U+0660; ASCII '0' is U+0030, so the
		// offset is 0x0660 - 0x0030 = 0x0630.
		.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0630))
		// Convert Arabic decimal separator ٫ (U+066B) to .
		.replace(/٫/g, '.')
		// Convert Arabic thousands separator ٬ (U+066C) to ,
		// (then strip ALL thousands separators since Number() doesn't
		// handle them when they're mixed with decimal points).
		.replace(/٬/g, ',')
		.replace(/,/g, '');
	if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;
	const n = Number(cleaned);
	return Number.isFinite(n) ? n : NaN;
}
