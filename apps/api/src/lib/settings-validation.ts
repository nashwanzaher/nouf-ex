/**
 * Settings validation helpers (added 2026-07-12 — P0 fix).
 *
 * Why this lives in its own file (and not in validation.cts):
 *   - Settings validation is per-key: the same schema cannot cover
 *     "DEFAULT_CURRENCY must be a 3-char ISO code" AND "FLAT_SHIPPING_COST
 *     must be a positive integer string". We want a clear, single-file
 *     registry that admins can audit at a glance.
 *   - It needs to call into lib/shared.ts (for `db`) which would create
 *     a circular import if added to validation.ts (validation.ts is
 *     imported by every route module; shared.ts already imports it).
 *
 * Each known key has a `validate(key, value)` function that throws an
 * HttpError(400) on failure. Unknown keys are accepted as plain
 * non-empty strings (forward-compatible: a new key added via SQL or a
 * migration does not require a code change here).
 */
import { HttpError } from './shared.js';

interface ValidationResult {
	value: string;
}

/** Trim then length-check the value. */
function trimAndCheckLen(value: string, min: number, max: number): string {
	const trimmed = value.trim();
	if (trimmed.length < min) {
		throw new HttpError(400, `Value must be at least ${min} characters.`, {
			code: 'SETTING_VALUE_TOO_SHORT',
		});
	}
	if (trimmed.length > max) {
		throw new HttpError(400, `Value must be at most ${max} characters.`, {
			code: 'SETTING_VALUE_TOO_LONG',
		});
	}
	return trimmed;
}

/** Validates ISO 4217-like 3-char uppercase currency codes. */
function isValidCurrencyCode(code: string): boolean {
	return /^[A-Z]{3}$/.test(code);
}

/** Validates that a string parses as a non-negative integer. */
function isNonNegativeInt(s: string): boolean {
	return /^\d+$/.test(s) && Number(s) >= 0;
}

/** Validates that a string parses as a positive integer. */
function isPositiveInt(s: string): boolean {
	return /^\d+$/.test(s) && Number(s) > 0;
}

// ── Per-key validators ────────────────────────────────────────────────
// Each function returns the canonical (trimmed) value to store, or
// throws an HttpError. The keys are deliberately the same as the ones
// seeded in migration 0023 + app_settings.ts defaults — see
// docs/operations/deployment.md for the full list.

const validators: Record<string, (value: string) => ValidationResult> = {
	// ISO 4217 currency code (e.g. 'YER', 'SAR', 'USD')
	DEFAULT_CURRENCY: (v) => {
		const code = trimAndCheckLen(v, 3, 3).toUpperCase();
		if (!isValidCurrencyCode(code)) {
			throw new HttpError(
				400,
				'DEFAULT_CURRENCY must be a 3-letter uppercase ISO 4217 code (e.g. YER, SAR, USD).',
				{ code: 'SETTING_INVALID_CURRENCY' },
			);
		}
		return { value: code };
	},

	// Free-shipping threshold in minor units (e.g. '10000' = 100.00 YER)
	FREE_SHIPPING_THRESHOLD: (v) => {
		const trimmed = trimAndCheckLen(v, 1, 12);
		if (!isNonNegativeInt(trimmed)) {
			throw new HttpError(
				400,
				'FREE_SHIPPING_THRESHOLD must be a non-negative integer (minor units, e.g. 10000).',
				{ code: 'SETTING_INVALID_INTEGER' },
			);
		}
		return { value: trimmed };
	},

	// Flat shipping cost in minor units (e.g. '500' = 5.00 YER)
	FLAT_SHIPPING_COST: (v) => {
		const trimmed = trimAndCheckLen(v, 1, 12);
		if (!isNonNegativeInt(trimmed)) {
			throw new HttpError(
				400,
				'FLAT_SHIPPING_COST must be a non-negative integer (minor units, e.g. 500).',
				{ code: 'SETTING_INVALID_INTEGER' },
			);
		}
		return { value: trimmed };
	},

	// Cron expression — accept any non-empty string. We trust the
	// admins not to put garbage here; node-cron.validate() runs at
	// the next process start (and will be caught by the scheduler).
	AUDIT_CLEANUP_CRON: (v) => {
		return { value: trimAndCheckLen(v, 1, 100) };
	},

	// Numeric retention windows (days). Used by /cleanup-audit-logs
	AUDIT_CLEANUP_ADMIN_DAYS: (v) => {
		const trimmed = trimAndCheckLen(v, 1, 6);
		if (!isPositiveInt(trimmed)) {
			throw new HttpError(
				400,
				'AUDIT_CLEANUP_ADMIN_DAYS must be a positive integer (1..3650).',
				{ code: 'SETTING_INVALID_INTEGER' },
			);
		}
		const n = Number(trimmed);
		if (n > 3650) {
			throw new HttpError(
				400,
				'AUDIT_CLEANUP_ADMIN_DAYS must not exceed 10 years (3650 days).',
				{ code: 'SETTING_VALUE_OUT_OF_RANGE' },
			);
		}
		return { value: trimmed };
	},

	AUDIT_CLEANUP_SEARCH_DAYS: (v) => {
		const trimmed = trimAndCheckLen(v, 1, 6);
		if (!isPositiveInt(trimmed)) {
			throw new HttpError(
				400,
				'AUDIT_CLEANUP_SEARCH_DAYS must be a positive integer (1..365).',
				{ code: 'SETTING_INVALID_INTEGER' },
			);
		}
		const n = Number(trimmed);
		if (n > 365) {
			throw new HttpError(
				400,
				'AUDIT_CLEANUP_SEARCH_DAYS must not exceed 1 year (365 days).',
				{ code: 'SETTING_VALUE_OUT_OF_RANGE' },
			);
		}
		return { value: trimmed };
	},

	// Timezone — IANA name (e.g. 'UTC', 'Asia/Riyadh'). We do not enforce
	// the IANA list server-side (would require a heavy dependency); we
	// just sanity-check length + charset.
	AUDIT_CLEANUP_TZ: (v) => {
		const tz = trimAndCheckLen(v, 1, 50);
		if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(tz)) {
			throw new HttpError(
				400,
				'AUDIT_CLEANUP_TZ must be a valid timezone identifier (e.g. UTC).',
				{ code: 'SETTING_INVALID_TIMEZONE' },
			);
		}
		return { value: tz };
	},
};

/**
 * Validate a setting value against the per-key schema. Throws HttpError
 * on failure; returns the canonical value on success.
 */
export function validateSettingValue(key: string, value: string): string {
	const validator = validators[key];
	if (!validator) {
		// Unknown key: forward-compatible fallback. Non-empty string,
		// capped at 2000 chars (matches the Zod .max(2000) in
		// adminSettingUpdateSchema above).
		return trimAndCheckLen(value, 1, 2000);
	}
	return validator(value).value;
}

/** Returns the list of known setting keys (for admin UI dropdowns). */
export function getKnownSettingKeys(): string[] {
	return Object.keys(validators);
}
