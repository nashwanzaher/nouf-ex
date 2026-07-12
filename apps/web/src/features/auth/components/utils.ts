// ── Smart identifier detection ─────────────────────────────────────────────
// Detect whether the user typed an email or phone number so we can show
// the right placeholder/icon and route the request to the right server
// field. Matches @example.com for email and a wide range of phone formats
// including local (07xxxxx) and international (+967xxxxxxxxx).
export function detectIdentifier(value: string): 'email' | 'phone' | 'unknown' {
	const v = value.trim();
	if (!v) return 'unknown';
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email';
	if (/^[+\d][\d\s\-()]{5,}$/.test(v)) return 'phone';
	return 'unknown';
}
