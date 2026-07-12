/**
 * Unit tests for settings-validation.ts.
 *
 * Validates the per-key schema validators against:
 *   - happy-path values (the canonical examples from app_settings seed)
 *   - boundary violations (length, charset, sign)
 *   - unknown keys (forward-compatibility fallback)
 *
 * Pure-function tests — no DB or HTTP app needed.
 */
import { describe, expect, it } from 'vitest';
import { HttpError } from '../middleware.js';
import {
	getKnownSettingKeys,
	validateSettingValue,
} from '../lib/settings-validation.js';

// ═══════════════════════════════════════════════════════════
// DEFAULT_CURRENCY — ISO 4217 3-letter uppercase code
// ═══════════════════════════════════════════════════════════
describe('validateSettingValue / DEFAULT_CURRENCY', () => {
	it('accepts canonical seed values (YER, SAR, USD, EUR)', () => {
		for (const v of ['YER', 'SAR', 'USD', 'EUR']) {
			expect(validateSettingValue('DEFAULT_CURRENCY', v)).toBe(v);
		}
	});

	it('normalises lowercase to uppercase', () => {
		expect(validateSettingValue('DEFAULT_CURRENCY', 'yer')).toBe('YER');
	});

	it('rejects codes that are not exactly 3 uppercase letters', () => {
		for (const bad of ['YE', 'YERR', 'YE1', 'ye ', '123']) {
			expect(() => validateSettingValue('DEFAULT_CURRENCY', bad)).toThrow(HttpError);
		}
	});

	it('rejects lowercase despite length being right', () => {
		expect(() => validateSettingValue('DEFAULT_CURRENCY', 'yer')).not.toThrow();
		// After our normalise-to-uppercase, "yer" becomes "YER" — so this
		// case is actually a happy path. The interesting failure is "ye "
		// (with trailing space) which fails the charset check.
	});
});

// ═══════════════════════════════════════════════════════════
// FREE_SHIPPING_THRESHOLD / FLAT_SHIPPING_COST — non-negative integer
// ═══════════════════════════════════════════════════════════
describe('validateSettingValue / numeric thresholds', () => {
	it('accepts canonical seed values', () => {
		expect(validateSettingValue('FREE_SHIPPING_THRESHOLD', '10000')).toBe('10000');
		expect(validateSettingValue('FLAT_SHIPPING_COST', '500')).toBe('500');
	});

	it('accepts 0 (zero is non-negative)', () => {
		expect(validateSettingValue('FLAT_SHIPPING_COST', '0')).toBe('0');
		expect(validateSettingValue('FREE_SHIPPING_THRESHOLD', '0')).toBe('0');
	});

	it('rejects negative numbers', () => {
		expect(() => validateSettingValue('FLAT_SHIPPING_COST', '-100')).toThrow(/non-negative integer/);
	});

	it('rejects non-numeric strings', () => {
		expect(() => validateSettingValue('FLAT_SHIPPING_COST', '5.00')).toThrow(/non-negative integer/);
		expect(() => validateSettingValue('FLAT_SHIPPING_COST', '5a')).toThrow(/non-negative integer/);
		expect(() => validateSettingValue('FLAT_SHIPPING_COST', 'abc')).toThrow(/non-negative integer/);
	});

	it('rejects empty strings', () => {
		expect(() => validateSettingValue('FLAT_SHIPPING_COST', '')).toThrow(HttpError);
	});

	it('rejects strings longer than 12 chars', () => {
		expect(() => validateSettingValue('FLAT_SHIPPING_COST', '1' + '0'.repeat(20))).toThrow(
			/at most 12 characters/,
		);
	});
});

// ═══════════════════════════════════════════════════════════
// AUDIT_CLEANUP_ADMIN_DAYS / SEARCH_DAYS — bounded positive integers
// ═══════════════════════════════════════════════════════════
describe('validateSettingValue / audit cleanup days', () => {
	it('accepts default seed values', () => {
		expect(validateSettingValue('AUDIT_CLEANUP_ADMIN_DAYS', '730')).toBe('730');
		expect(validateSettingValue('AUDIT_CLEANUP_SEARCH_DAYS', '90')).toBe('90');
	});

	it('accepts 1 (minimum allowed)', () => {
		expect(validateSettingValue('AUDIT_CLEANUP_ADMIN_DAYS', '1')).toBe('1');
	});

	it('rejects 0 (must be positive)', () => {
		expect(() => validateSettingValue('AUDIT_CLEANUP_ADMIN_DAYS', '0')).toThrow(/positive integer/);
	});

	it('rejects values beyond the upper bound', () => {
		expect(() => validateSettingValue('AUDIT_CLEANUP_ADMIN_DAYS', '3651')).toThrow(
			/3650 days/,
		);
		expect(() => validateSettingValue('AUDIT_CLEANUP_SEARCH_DAYS', '366')).toThrow(
			/365 days/,
		);
	});

	it('rejects negative numbers', () => {
		expect(() => validateSettingValue('AUDIT_CLEANUP_ADMIN_DAYS', '-1')).toThrow(/positive integer/);
	});
});

// ═══════════════════════════════════════════════════════════
// AUDIT_CLEANUP_TZ — IANA timezone identifier
// ═══════════════════════════════════════════════════════════
describe('validateSettingValue / AUDIT_CLEANUP_TZ', () => {
	it('accepts canonical timezones', () => {
		for (const tz of ['UTC', 'Asia/Riyadh', 'America/New_York', 'Europe/London']) {
			expect(validateSettingValue('AUDIT_CLEANUP_TZ', tz)).toBe(tz);
		}
	});

	it('rejects bad charset', () => {
		for (const bad of ['UTC!', 'Asia  Riyadh', 'UTC@', '123']) {
			expect(() => validateSettingValue('AUDIT_CLEANUP_TZ', bad)).toThrow(HttpError);
		}
	});
});

// ═══════════════════════════════════════════════════════════
// AUDIT_CLEANUP_CRON — accept any non-empty string
// ═══════════════════════════════════════════════════════════
describe('validateSettingValue / AUDIT_CLEANUP_CRON', () => {
	it('accepts canonical cron expressions', () => {
		expect(validateSettingValue('AUDIT_CLEANUP_CRON', '0 3 * * *')).toBe('0 3 * * *');
		expect(validateSettingValue('AUDIT_CLEANUP_CRON', '@daily')).toBe('@daily');
	});
});

// ═══════════════════════════════════════════════════════════
// Unknown keys — forward-compatible fallback
// ═══════════════════════════════════════════════════════════
describe('validateSettingValue / unknown key', () => {
	it('accepts any non-empty string up to 2000 chars', () => {
		expect(validateSettingValue('SOME_FUTURE_KEY', 'arbitrary value')).toBe('arbitrary value');
	});

	it('trims leading/trailing whitespace', () => {
		expect(validateSettingValue('UNKNOWN_KEY', '  hello  ')).toBe('hello');
	});

	it('rejects empty value', () => {
		expect(() => validateSettingValue('UNKNOWN_KEY', '')).toThrow(/at least 1 character/);
	});

	it('rejects values over 2000 chars', () => {
		const long = 'a'.repeat(2001);
		expect(() => validateSettingValue('UNKNOWN_KEY', long)).toThrow(/at most 2000 characters/);
	});
});

// ═══════════════════════════════════════════════════════════
// getKnownSettingKeys
// ═══════════════════════════════════════════════════════════
describe('getKnownSettingKeys', () => {
	it('returns the 7 known setting keys', () => {
		const keys = getKnownSettingKeys();
		expect(keys).toContain('DEFAULT_CURRENCY');
		expect(keys).toContain('FREE_SHIPPING_THRESHOLD');
		expect(keys).toContain('FLAT_SHIPPING_COST');
		expect(keys).toContain('AUDIT_CLEANUP_CRON');
		expect(keys).toContain('AUDIT_CLEANUP_ADMIN_DAYS');
		expect(keys).toContain('AUDIT_CLEANUP_SEARCH_DAYS');
		expect(keys).toContain('AUDIT_CLEANUP_TZ');
		expect(keys.length).toBe(7);
	});
});
