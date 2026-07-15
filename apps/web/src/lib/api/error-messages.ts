/**
 * Nouf-ex Frontend — localized error messages
 *
 * Maps each `ErrorCode` to a user-facing message in 3 languages
 * (ar / en / zh). Use `getErrorMessage(code, lang)` to retrieve, or
 * `formatApiError(err, lang)` to format any thrown error.
 *
 * **Why a frontend mirror?** The server returns `code` only (see
 * `apps/api/src/lib/error-codes.ts`); it intentionally does NOT localize
 * messages because the SPA already has full i18n support. By
 * keeping the translations on the frontend we avoid a round-trip
 * to the server for every error.
 *
 * **Sync rule:** any new code in `ErrorCodes` must add a row here for
 * each language. The `defaultErrorMessage` fallback covers future
 * codes until translations are added (forwards-compat with R-15 §50
 * invariant).
 *
 * Closes R-15 Frontend Follow-up §51 by giving components a single
 * import for "show this error to the user in their language".
 */

import type { ErrorCode } from './error-codes';
import { ErrorCodes, isErrorCode } from './error-codes';
import { readStoredLang } from './lang-storage';

export type SupportedLang = 'ar' | 'en' | 'zh';

type ErrorMessageCatalog = Record<ErrorCode, Record<SupportedLang, string>>;

/**
 * Canonical error message catalog. 18 codes × 3 languages = 54 strings.
 * Add a row here for every new `ErrorCodes` entry.
 */
const MESSAGES: ErrorMessageCatalog = {
	[ErrorCodes.VALIDATION_ERROR]: {
		ar: 'البيانات المدخلة غير صحيحة. يرجى التحقق والمحاولة مرة أخرى.',
		en: 'The data you entered is invalid. Please check and try again.',
		zh: '您输入的数据无效。请检查后重试。',
	},
	[ErrorCodes.UNAUTHORIZED]: {
		ar: 'يجب تسجيل الدخول للمتابعة.',
		en: 'Please sign in to continue.',
		zh: '请登录后继续。',
	},
	[ErrorCodes.FORBIDDEN]: {
		ar: 'ليس لديك صلاحية للقيام بهذا الإجراء.',
		en: "You don't have permission to perform this action.",
		zh: '您没有执行此操作的权限。',
	},
	[ErrorCodes.NOT_FOUND]: {
		ar: 'العنصر المطلوب غير موجود.',
		en: 'The requested item was not found.',
		zh: '未找到请求的项目。',
	},
	[ErrorCodes.CONFLICT]: {
		ar: 'هذه العملية تتعارض مع الحالة الحالية.',
		en: 'This operation conflicts with the current state.',
		zh: '此操作与当前状态冲突。',
	},
	[ErrorCodes.DUPLICATE]: {
		ar: 'هذا العنصر موجود بالفعل.',
		en: 'This item already exists.',
		zh: '此项目已存在。',
	},
	[ErrorCodes.PAYLOAD_TOO_LARGE]: {
		ar: 'حجم البيانات كبير جداً.',
		en: 'The request data is too large.',
		zh: '请求数据过大。',
	},
	[ErrorCodes.UNPROCESSABLE_ENTITY]: {
		ar: 'الطلب صحيح شكلياً لكنه غير مقبول منطقياً.',
		en: 'The request was well-formed but cannot be processed.',
		zh: '请求格式正确但无法处理。',
	},
	[ErrorCodes.RATE_LIMITED]: {
		ar: 'تجاوزت الحد المسموح من المحاولات. يرجى الانتظار قليلاً.',
		en: 'Too many attempts. Please wait a moment.',
		zh: '尝试次数过多。请稍候。',
	},
	[ErrorCodes.INTERNAL_ERROR]: {
		ar: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
		en: 'An unexpected error occurred. Please try again.',
		zh: '发生意外错误。请重试。',
	},
	[ErrorCodes.DATABASE_ERROR]: {
		ar: 'حدث خطأ في قاعدة البيانات. يرجى المحاولة لاحقاً.',
		en: 'A database error occurred. Please try again later.',
		zh: '数据库出错。请稍后再试。',
	},
	[ErrorCodes.SERVICE_UNAVAILABLE]: {
		ar: 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة بعد قليل.',
		en: 'The service is temporarily unavailable. Please try again shortly.',
		zh: '服务暂时不可用。请稍后再试。',
	},
	[ErrorCodes.INSERT_FAILED]: {
		ar: 'تعذّر إنشاء العنصر. يرجى المحاولة مرة أخرى.',
		en: 'Could not create the item. Please try again.',
		zh: '无法创建该项目。请重试。',
	},
	[ErrorCodes.UPDATE_FAILED]: {
		ar: 'تعذّر تحديث العنصر. يرجى المحاولة مرة أخرى.',
		en: 'Could not update the item. Please try again.',
		zh: '无法更新该项目。请重试。',
	},
	[ErrorCodes.DELETE_FAILED]: {
		ar: 'تعذّر حذف العنصر. يرجى المحاولة مرة أخرى.',
		en: 'Could not delete the item. Please try again.',
		zh: '无法删除该项目。请重试。',
	},
	[ErrorCodes.ALREADY_ENABLED]: {
		ar: 'هذه الميزة مفعّلة بالفعل.',
		en: 'This feature is already enabled.',
		zh: '此功能已启用。',
	},
	[ErrorCodes.NOT_ENABLED]: {
		ar: 'هذه الميزة غير مفعّلة.',
		en: 'This feature is not enabled.',
		zh: '此功能未启用。',
	},
	[ErrorCodes.PARTIAL_INVALID]: {
		ar: 'رمز التحقق المؤقت غير صالح أو منتهي الصلاحية.',
		en: 'The 2FA partial token is invalid or expired.',
		zh: '两步验证临时令牌无效或已过期。',
	},
};

/**
 * Generic fallback when the error code is unknown (e.g. the server
 * ships a new code the frontend hasn't seen yet — see §50 invariant
 * test `forward-compat with new codes`).
 */
const DEFAULT_FALLBACK: Record<SupportedLang, string> = {
	ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
	en: 'Something went wrong. Please try again.',
	zh: '出错了。请重试。',
};

/**
 * Get the user-facing message for an error code in a given language.
 *
 * - If `code` is a known `ErrorCode` → returns the localized message.
 * - If `code` is an unknown string → returns `DEFAULT_FALLBACK[lang]`
 *   (forwards-compat: server can ship new codes without breaking the
 *   frontend).
 * - If `code` is null/undefined → returns `DEFAULT_FALLBACK[lang]`.
 */
export function getErrorMessage(code: string | undefined, lang: SupportedLang): string {
	if (code && isErrorCode(code)) {
		return MESSAGES[code][lang];
	}
	return DEFAULT_FALLBACK[lang];
}

/**
 * Read the user's stored language (via `lang-storage.ts`) and normalise
 * to one of the three supported values. Indirected through the
 * `lang-storage` module so tests can stub the read without depending on
 * DOM internals (happy-dom's localStorage does NOT proxy through
 * `Storage.prototype`).
 *
 * Falls back to `'ar'` (the app's `fallbackLng` per `src/i18n/index.ts:11`).
 */
export function detectLang(): SupportedLang {
	const v = readStoredLang();
	return v === 'ar' || v === 'en' || v === 'zh' ? v : 'ar';
}

/**
 * One-shot helper: format any thrown error as a user-facing string
 * in the active language. Uses `err.code` first; falls back to
 * `err.message` if the code is missing/unknown (so legacy server
 * responses that didn't carry `code` still produce a reasonable
 * message — just not localized).
 *
 * Usage:
 *   try { await doSomething(); }
 *   catch (err) { toast.error(formatApiError(err)); }
 */
export function formatApiError(err: unknown, lang?: SupportedLang): string {
	const effectiveLang = lang ?? detectLang();
	// Type guard first to access `code` safely.
	if (
		err &&
		typeof err === 'object' &&
		'code' in err &&
		typeof (err as { code: unknown }).code === 'string'
	) {
		const code = (err as { code: string }).code;
		// Prefer the localized message for known codes; fall back to the
		// server's `message` for unknown codes so users still see
		// something useful (the server might have included details).
		if (isErrorCode(code)) {
			return MESSAGES[code][effectiveLang];
		}
	}
	// Fallback to the server's message (or the JS error message) for
	// unknown codes / non-ApiError throws.
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === 'string') return err;
	return DEFAULT_FALLBACK[effectiveLang];
}
