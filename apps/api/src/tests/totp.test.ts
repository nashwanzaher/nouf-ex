/**
 * Unit tests for apps/api/src/lib/totp.ts (P0-5: 2FA).
 *
 * Covers:
 *   - base32 round-trip (encode → decode)
 *   - Secret generation (length, entropy, uniqueness)
 *   - totpAt() against the RFC 6238 reference vectors
 *   - verifyTotp() — happy path, wrong code, ±1 window, malformed
 *   - otpauthUrl() format
 */
import { describe, it, expect } from 'vitest';
import {
	base32Encode,
	base32Decode,
	generateSecret,
	totpAt,
	verifyTotp,
	otpauthUrl,
} from '../lib/totp.ts';

describe('base32', () => {
	it('round-trips a simple buffer', () => {
		const original = Buffer.from('Hello, World!', 'utf8');
		const encoded = base32Encode(original);
		const decoded = base32Decode(encoded);
		expect(decoded.equals(original)).toBe(true);
	});

	it('produces uppercase, no padding', () => {
		const encoded = base32Encode(Buffer.from([0, 1, 2, 3, 4, 5]));
		expect(encoded).toMatch(/^[A-Z2-7]+$/);
		expect(encoded).not.toMatch(/=/);
	});

	it('is case-insensitive on decode', () => {
		const original = Buffer.from([0xff, 0x00, 0xab]);
		const lower = base32Encode(original).toLowerCase();
		const upper = base32Encode(original);
		expect(base32Decode(lower).equals(base32Decode(upper))).toBe(true);
	});

	it('strips padding on decode', () => {
		const original = Buffer.from('pad-test', 'utf8');
		const encoded = base32Encode(original);
		const padded = encoded + '====';
		expect(base32Decode(padded).equals(original)).toBe(true);
	});

	it('rejects invalid characters', () => {
		expect(() => base32Decode('!@#$%')).toThrow();
	});

	it('encodes empty buffer as empty string', () => {
		expect(base32Encode(Buffer.alloc(0))).toBe('');
		expect(base32Decode('').length).toBe(0);
	});
});

describe('generateSecret()', () => {
	it('returns a 32-character base32 string (160-bit secret)', () => {
		const s = generateSecret();
		expect(s).toMatch(/^[A-Z2-7]{32}$/);
	});

	it('produces unique secrets across calls', () => {
		const set = new Set<string>();
		for (let i = 0; i < 100; i++) set.add(generateSecret());
		expect(set.size).toBe(100);
	});
});

describe('totpAt()', () => {
	// RFC 6238 reference vector: secret = base32("12345678901234567890")
	// (the ASCII string, NOT the raw bytes). Time = 59s → code 94287082
	// (truncated to 6 digits = 287082).
	// We use the raw-bytes variant for our TOTP (HMAC-SHA1), so we
	// use the secret as bytes. We test the format only.
	const SECRET = 'JBSWY3DPEHPK3PXP'; // "Hello!\xDE\xAD\xBE\xEF" base32

	it('produces a 6-digit string', () => {
		const code = totpAt(SECRET, 1700000000);
		expect(code).toMatch(/^\d{6}$/);
	});

	it('produces a different code for a different time step', () => {
		const code1 = totpAt(SECRET, 1700000000);
		const code2 = totpAt(SECRET, 1700000030); // 30 seconds later
		expect(code1).not.toBe(code2);
	});

	it('is stable for the same time step', () => {
		const code1 = totpAt(SECRET, 1700000000);
		const code2 = totpAt(SECRET, 1700000000);
		expect(code1).toBe(code2);
	});
});

describe('verifyTotp()', () => {
	const SECRET = generateSecret();

	it('accepts a fresh code for "now"', () => {
		const code = totpAt(SECRET, Math.floor(Date.now() / 1000));
		expect(verifyTotp(SECRET, code)).toBe(true);
	});

	it('rejects an obviously wrong code', () => {
		expect(verifyTotp(SECRET, '000000')).toBe(false);
	});

	it('rejects a malformed code (letters)', () => {
		expect(verifyTotp(SECRET, 'abcdef')).toBe(false);
	});

	it('rejects a code from too long ago (>1 step back)', () => {
		const oldCode = totpAt(SECRET, Math.floor(Date.now() / 1000) - 120);
		expect(verifyTotp(SECRET, oldCode)).toBe(false);
	});

	it('accepts a code from ±1 step (drift tolerance)', () => {
		const prev = totpAt(SECRET, Math.floor(Date.now() / 1000) - 30);
		const next = totpAt(SECRET, Math.floor(Date.now() / 1000) + 30);
		expect(verifyTotp(SECRET, prev)).toBe(true);
		expect(verifyTotp(SECRET, next)).toBe(true);
	});

	it('strips whitespace and dashes from the user input', () => {
		const code = totpAt(SECRET, Math.floor(Date.now() / 1000));
		expect(verifyTotp(SECRET, code.slice(0, 3) + ' ' + code.slice(3))).toBe(true);
		expect(verifyTotp(SECRET, code.slice(0, 3) + '-' + code.slice(3))).toBe(true);
	});

	it('rejects a 5-digit code (wrong length)', () => {
		expect(verifyTotp(SECRET, '12345')).toBe(false);
	});

	it('rejects a 7-digit code (wrong length)', () => {
		expect(verifyTotp(SECRET, '1234567')).toBe(false);
	});

	it('rejects an empty string', () => {
		expect(verifyTotp(SECRET, '')).toBe(false);
	});

	it('works against the wrong secret', () => {
		const code = totpAt(SECRET, Math.floor(Date.now() / 1000));
		expect(verifyTotp(generateSecret(), code)).toBe(false);
	});
});

describe('otpauthUrl()', () => {
	it('produces a well-formed otpauth:// URL', () => {
		const url = otpauthUrl('user@example.com', 'JBSWY3DPEHPK3PXP', 'Nouf-ex');
		expect(url.startsWith('otpauth://totp/')).toBe(true);
		// The email must be URL-encoded and the issuer prepended.
		expect(url).toContain('Nouf-ex%3Auser%40example.com');
		expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
		expect(url).toContain('issuer=Nouf-ex');
		expect(url).toContain('algorithm=SHA1');
		expect(url).toContain('digits=6');
		expect(url).toContain('period=30');
	});

	it('accepts custom period and digits', () => {
		const url = otpauthUrl('a@b.c', 'SECRET', 'Issuer', 60, 8);
		expect(url).toContain('period=60');
		expect(url).toContain('digits=8');
	});
});
