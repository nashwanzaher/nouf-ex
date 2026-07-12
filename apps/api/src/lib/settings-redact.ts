/**
 * Settings redaction helpers (added 2026-07-12 — P0 security).
 *
 * The generic `redactSensitive()` redaction walks JSON by KEY name and
 * only masks values for a fixed allow-list of sensitive keys (password,
 * token, …). That's fine for the user / store / order entities where
 * the SENSITIVE field has a sensitive KEY name.
 *
 * Settings are different: the KEY is the setting name
 * (e.g. `DEFAULT_CURRENCY`, `SUPPORT_EMAIL_PASSWORD`) and the VALUE is
 * what's stored. If we naively `writeAuditLog({ key: 'SUPPORT_EMAIL_PASSWORD',
 * new_values: { value: 'hunter2' } })`, `redactSensitive` will see that
 * the JSONB key is `value` — not `password` — and persist the raw
 * secret to `admin_audit_log`.
 *
 * The helpers below apply the setting-aware redaction BEFORE the audit
 * row is persisted. They also redact the same value for the dead-letter
 * JSONL file (`audit-dlq-*.jsonl`) so secrets never touch disk in
 * cleartext.
 *
 * Reuse: imported by `routes/admin-extras.ts` when writing the
 * `set_setting` audit row and by any future per-setting mutation
 * handler.
 */

import type { Request } from 'express';
import { db, log } from './shared.ts';

/**
 * Setting keys whose VALUE must never be written to the audit log in
 * plaintext. Matched case-insensitive as a substring so
 * `STRIPE_SECRET_KEY`, `SMTP_PASSWORD`, `GOOGLE_API_KEY`, etc. are
 * all caught without an explicit allow-list per provider.
 *
 * Pattern semantics (all case-insensitive, all substring matches):
 *   - contains `password`        → password (e.g. `SMTP_PASSWORD`)
 *   - contains `secret`          → secret  (e.g. `STRIPE_SECRET_KEY`,
 *                                            `JWT_SECRET`,
 *                                            `SESSION_SECRET`)
 *   - contains `token`           → token   (e.g. `GITHUB_TOKEN`,
 *                                            `SLACK_BOT_TOKEN`)
 *   - contains `api_key` / `apikey` → api key
 *                                            (e.g. `GOOGLE_API_KEY`,
 *                                             `STRIPE_APIKEY`)
 *   - contains `private_key`     → private key
 *
 * Exception: a bare `token` substring would catch legitimate
 * non-secret tokens like `CSRF_TOKEN` if a future admin page exposed
 * one as a setting. Today no such setting exists; if one is added,
 * the maintainer should add it to `ALLOWED_KEY_OVERRIDES` below.
 *
 * `DEFAULT_CURRENCY`, `FLAT_SHIPPING_COST`, `FREE_SHIPPING_THRESHOLD`
 * etc. are NOT matched and pass through unchanged.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
	/password/i,
	/secret/i,
	/token/i,
	/api_?key/i,
	/private_?key/i,
];

/** Per-setting allow-list for keys that LOOK sensitive but aren't.
 *  Add a key here only after auditing the audit log to confirm it
 *  genuinely never holds a credential. */
const ALLOWED_KEY_OVERRIDES: ReadonlySet<string> = new Set<string>([
	// CSRF token if we ever expose it as a setting
	// 'CSRF_TOKEN',
]);

/** True if a setting's value should never be persisted to the audit
 *  log in cleartext. */
export function isSensitiveSettingKey(key: string): boolean {
	if (ALLOWED_KEY_OVERRIDES.has(key)) return false;
	return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

/** Display placeholder for a masked value. */
export const SETTING_REDACTED = '[REDACTED]';

/**
 * Compute the audit-safe representation of a setting's NEW value.
 *
 *   - If the key is sensitive → `[REDACTED]`
 *   - Otherwise              → the literal value
 */
export function redactSettingValue(
	key: string,
	value: string,
): string {
	if (isSensitiveSettingKey(key)) return SETTING_REDACTED;
	return value;
}

/**
 * Compute the audit-safe representation of a setting's OLD → NEW
 * delta. If the value didn't actually change, record `[unchanged]`
 * to keep the audit log compact and reduce noise.
 *
 *   - sensitive key, unchanged  → `[unchanged]`
 *   - sensitive key, changed    → `[REDACTED]`
 *   - non-sensitive key, unchanged → `[unchanged]`
 *   - non-sensitive key, changed   → the new value (string)
 */
export function diffSettingValue(
	key: string,
	oldValue: string | null,
	newValue: string,
): { old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null } {
	const sensitive = isSensitiveSettingKey(key);
	const oldChanged = oldValue !== null && oldValue !== newValue;
	if (!oldChanged && oldValue === newValue) {
		// No-op update. Log a tiny "[unchanged]" marker so an operator
		// can still see this admin touched this setting (and at what
		// time) without re-writing the same value.
		return {
			old_values: null,
			new_values: { value: '[unchanged]' },
		};
	}
	if (sensitive) {
		return {
			old_values: oldValue !== null ? { value: SETTING_REDACTED } : null,
			new_values: { value: SETTING_REDACTED },
		};
	}
	return {
		old_values: oldValue !== null ? { value: oldValue } : null,
		new_values: { value: newValue },
	};
}

/**
 * Read the current value of a setting directly from the DB, bypassing
 * the in-memory cache. Used by `set_setting` so we can include the
 * accurate old_value in the audit row even after a process restart
 * (where the cache might still hold a stale value).
 */
export async function readSettingDirect(
	key: string,
): Promise<string | null> {
	const row = (await db
		.prepare('SELECT value FROM app_settings WHERE key = $1')
		.get(key)) as { value: string } | undefined;
	return row?.value ?? null;
}

/** Convenience wrapper for the broadcast notification call — uses the
 *  `settings_audit` action label. Writes the audit row via the
 *  standard pipeline. */
export async function writeSettingAudit(
	req: Request,
	key: string,
	oldValue: string | null,
	newValue: string,
): Promise<void> {
	const { old_values, new_values } = diffSettingValue(key, oldValue, newValue);
	const { writeAuditLog } = await import('./audit.ts');
	await writeAuditLog(req, 'set_setting', 'setting', key, old_values, new_values);
	log.info({
		msg: 'setting_audit_redacted',
		key,
		sensitive: isSensitiveSettingKey(key),
	});
}
