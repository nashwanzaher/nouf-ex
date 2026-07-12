/**
 * Nouf-ex shared constants.
 */

export const SUPPORTED_LANGUAGES = ['ar', 'en', 'zh'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const USER_ROLES = ['customer', 'merchant', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = [
	'pending',
	'confirmed',
	'processing',
	'shipped',
	'delivered',
	'cancelled',
	'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
