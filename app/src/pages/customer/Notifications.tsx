import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	Bell,
	ShoppingBag,
	Tag,
	Star,
	Info,
	CheckCheck,
	ChevronLeft,
	MessageSquare,
	AlertTriangle,
	Undo2,
	RefreshCw,
	AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductGridSkeleton } from '@/components/Skeletons';
import { useApp } from '@/context/AppContext';
import { useNotifications } from '@/hooks/useApi';
import { markNotificationAsRead } from '@/lib/api';
import CustomerSidebar from './CustomerSidebar';

/**
 * P1-7 — Real notifications.
 *
 * Replaced the hardcoded mock list with the live
 * `/api/notifications/:userId` endpoint. The backend handler:
 *   - Requires authentication (anonymous → 401, swallowed here).
 *   - Derives the user from `req.user.id` (the URL param is ignored).
 *   - Returns the latest 50 notifications for the authenticated user.
 *
 * The notification types allowed by the schema are:
 *   'order' | 'message' | 'review' | 'promo' | 'system' | 'dispute' | 'refund'
 * — see `database/schema.sql` (CHECK constraint). All seven are handled
 * in `typeConfig` below.
 */

// ─── Local UI shape ──────────────────────────────────────────
// Mirrors the backend row but is reshaped for display:
//   - `body`            → `message`
//   - `is_read` (0/1)   → `read` (boolean)
//   - `created_at`      → `time` (formatted relative string)
//   - `data` (JSONB)    → `link` (extracted if present)
type NotificationType = 'order' | 'message' | 'review' | 'promo' | 'system' | 'dispute' | 'refund';

interface NotificationView {
	id: number;
	type: NotificationType;
	title: string;
	message: string;
	time: string;
	read: boolean;
	link?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Format an ISO timestamp as a short relative-time string using i18n.
 * Uses translation keys for proper localization across all supported languages.
 */
function formatRelativeTime(iso: string, t: (key: string, fallback: string, options?: Record<string, unknown>) => string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return '';
	const diffMs = Date.now() - then;
	if (diffMs < 0) return t('time.now', 'الآن');

	const mins = Math.floor(diffMs / 60_000);
	if (mins < 1) return t('time.now', 'الآن');
	if (mins < 60) return t('time.minutesAgo', 'منذ {{count}} دقيقة', { count: mins });

	const hours = Math.floor(mins / 60);
	if (hours < 24) return t('time.hoursAgo', 'منذ {{count}} ساعة', { count: hours });

	const days = Math.floor(hours / 24);
	if (days < 7) return t('time.daysAgo', 'منذ {{count}} يوم', { count: days });

	const weeks = Math.floor(days / 7);
	if (weeks < 5) return t('time.weeksAgo', 'منذ {{count}} أسبوع', { count: weeks });

	const months = Math.floor(days / 30);
	if (months < 12) return t('time.monthsAgo', 'منذ {{count}} شهر', { count: months });

	const years = Math.floor(days / 365);
	return t('time.yearsAgo', 'منذ {{count}} سنة', { count: years });
}

/**
 * Map a backend notification row to the UI shape. Coerces types,
 * extracts an optional `link` from the `data` JSONB payload, and
 * falls back to `'system'` for any unexpected type so we always
 * render an icon.
 */
function mapNotification(row: {
	id: number;
	type: string;
	title: string;
	body: string | null;
	data: string | unknown;
	is_read: number | boolean;
	created_at: string;
}, t: (key: string, fallback: string, options?: Record<string, unknown>) => string): NotificationView {
	const allowed: NotificationType[] = [
		'order',
		'message',
		'review',
		'promo',
		'system',
		'dispute',
		'refund',
	];
	const type: NotificationType = (allowed as string[]).includes(row.type)
		? (row.type as NotificationType)
		: 'system';

	let link: string | undefined;
	const raw = row.data;
	if (typeof raw === 'string' && raw.length > 0) {
		try {
			const parsed = JSON.parse(raw) as { link?: unknown };
			if (typeof parsed.link === 'string') link = parsed.link;
		} catch {
			/* ignore malformed JSON; link stays undefined */
		}
	} else if (raw && typeof raw === 'object' && 'link' in raw) {
		const parsed = raw as { link?: unknown };
		if (typeof parsed.link === 'string') link = parsed.link;
	}

	return {
		id: row.id,
		type,
		title: row.title,
		message: row.body ?? '',
		time: formatRelativeTime(row.created_at, t),
		read: Boolean(row.is_read),
		link,
	};
}

// ─── Static UI bits ─────────────────────────────────────────

const typeConfig: Record<
	NotificationType,
	{ icon: typeof ShoppingBag; color: string; bg: string }
> = {
	order: { icon: ShoppingBag, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10' },
	promo: { icon: Tag, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
	review: { icon: Star, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
	system: { icon: Info, color: 'text-[#6B6B6B]', bg: 'bg-[#6B6B6B]/10' },
	message: { icon: MessageSquare, color: 'text-[#0EA5E9]', bg: 'bg-[#0EA5E9]/10' },
	dispute: { icon: AlertTriangle, color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10' },
	refund: { icon: Undo2, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10' },
};

const filterTabs = [
	{ key: 'all', labelKey: 'notifications.filterAll', label: 'الكل' },
	{ key: 'unread', labelKey: 'notifications.filterUnread', label: 'غير مقروء' },
	{ key: 'order', labelKey: 'notifications.filterOrders', label: 'طلبات' },
	{ key: 'promo', labelKey: 'notifications.filterPromos', label: 'عروض' },
] as const;

type FilterKey = (typeof filterTabs)[number]['key'];

// ─── Component ──────────────────────────────────────────────

export default function Notifications() {
	const { state } = useApp();
	const { t, i18n } = useTranslation();
	const isAuthenticated = Boolean(state.user);
	const isRTL = i18n.language === 'ar';

	const { data, loading, error, refetch } = useNotifications();

	const notifications: NotificationView[] = useMemo(
		() => (data ?? []).map((row) => mapNotification(row, t)),
		[data, t],
	);

	const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
	const [marking, setMarking] = useState(false);

	const markAsRead = useCallback(
		async (id: number) => {
			try {
				await markNotificationAsRead(id);
				// Refetch in the background; failure here doesn't block the UI.
				refetch();
			} catch {
				/* swallow — the next refetch will reconcile the state */
			}
		},
		[refetch],
	);

	const markAllRead = useCallback(async () => {
		const unread = notifications.filter((n) => !n.read);
		if (unread.length === 0) return;
		setMarking(true);
		try {
			await Promise.all(
				unread.map((n) => markNotificationAsRead(n.id).catch(() => undefined)),
			);
			refetch();
		} finally {
			setMarking(false);
		}
	}, [notifications, refetch]);

	const filtered = notifications.filter((n) => {
		if (activeFilter === 'all') return true;
		if (activeFilter === 'unread') return !n.read;
		return n.type === activeFilter;
	});

	const unreadCount = notifications.filter((n) => !n.read).length;

	// ── Not signed in ─────────────────────────────────────────
	if (!isAuthenticated) {
		return (
			<div className="min-h-[100dvh] bg-[#F8F8F8]" dir={isRTL ? 'rtl' : 'ltr'}>
				<CustomerSidebar />
				<div className="md:mr-60 min-h-[100dvh] flex items-center justify-center p-6">
					<div className="bg-white rounded-2xl p-12 text-center shadow-sm max-w-md w-full">
						<Bell className="w-16 h-16 text-[#AAAAAA] mx-auto mb-4" strokeWidth={1} />
						<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
							{t('notifications.loginRequired', 'يرجى تسجيل الدخول')}
						</h3>
						<p className="text-[#6B6B6B] font-cairo text-sm mb-6">
							{t('notifications.loginMessage', 'سجّل دخولك لعرض إشعاراتك ومتابعة آخر التحديثات.')}
						</p>
						<Button
							asChild
							className="bg-[#D4A853] hover:bg-[#c49a48] text-[#1A1612] rounded-xl font-cairo"
						>
							<Link to="/auth/login">{t('auth.login', 'تسجيل الدخول')}</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// ── Initial loading ───────────────────────────────────────
	if (loading && notifications.length === 0) {
		return (
			<div className="min-h-[100dvh] bg-[#F8F8F8]" dir={isRTL ? 'rtl' : 'ltr'}>
				<CustomerSidebar />
				<div className="md:mr-60 min-h-[100dvh]">
					<div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30">
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">{t('notifications.title', 'الإشعارات')}</h1>
						<p className="text-sm text-[#6B6B6B] font-cairo mt-1">{t('common.loading', 'جاري التحميل…')}</p>
					</div>
					<div className="p-6 max-w-3xl mx-auto">
						<ProductGridSkeleton count={4} />
					</div>
				</div>
			</div>
		);
	}

	// ── Error state (with retry) ──────────────────────────────
	if (error && notifications.length === 0) {
		return (
			<div className="min-h-[100dvh] bg-[#F8F8F8]" dir={isRTL ? 'rtl' : 'ltr'}>
				<CustomerSidebar />
				<div className="md:mr-60 min-h-[100dvh] flex items-center justify-center p-6">
					<div className="bg-white rounded-2xl p-12 text-center shadow-sm max-w-md w-full">
						<AlertCircle
							className="w-16 h-16 text-[#EF4444] mx-auto mb-4"
							strokeWidth={1}
						/>
						<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
							{t('notifications.loadError', 'تعذّر تحميل الإشعارات')}
						</h3>
						<p className="text-[#6B6B6B] font-cairo text-sm mb-6">{error}</p>
						<Button
							onClick={refetch}
							className="bg-[#D4A853] hover:bg-[#c49a48] text-[#1A1612] rounded-xl font-cairo"
						>
							<RefreshCw className="w-4 h-4 ml-1" />
							{t('common.retry', 'إعادة المحاولة')}
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// ── Main render ──────────────────────────────────────────
	return (
		<div className="min-h-[100dvh] bg-[#F8F8F8]" dir={isRTL ? 'rtl' : 'ltr'}>
			<CustomerSidebar />

			<div className="md:mr-60 min-h-[100dvh]">
				<div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30 flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">{t('notifications.title', 'الإشعارات')}</h1>
						<p className="text-sm text-[#6B6B6B] font-cairo mt-1">
							{unreadCount > 0
								? t('notifications.newCount', 'لديك {{count}} إشعارات جديدة', { count: unreadCount })
								: t('notifications.noNew', 'لا توجد إشعارات جديدة')}
						</p>
					</div>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							onClick={markAllRead}
							disabled={marking}
							className="font-cairo text-sm text-[#D4A853] hover:text-[#c49a48] hover:bg-[#F3EDE4] rounded-xl disabled:opacity-50"
						>
							<CheckCheck className="w-4 h-4 ml-1" strokeWidth={1.5} />
							{marking ? t('common.updating', 'جارٍ التحديث…') : t('notifications.markAllRead', 'تعيين الكل كمقروء')}
						</Button>
					)}
				</div>

				<div className="p-6 max-w-3xl mx-auto space-y-4">
					{/* Filter tabs */}
					<div className="flex gap-2 overflow-x-auto pb-2">
						{filterTabs.map((f) => (
							<button
								key={f.key}
								onClick={() => setActiveFilter(f.key)}
								className={`px-4 py-2 rounded-full text-sm font-cairo font-medium whitespace-nowrap transition-colors ${
									activeFilter === f.key
										? 'bg-[#D4A853] text-[#1A1612]'
										: 'bg-white text-[#6B6B6B] hover:bg-[#F3EDE4]'
								}`}
							>
								{f.key === 'all' && `${t(f.labelKey, f.label)} (${notifications.length})`}
								{f.key === 'unread' && `${t(f.labelKey, f.label)} (${unreadCount})`}
								{f.key === 'order' && t(f.labelKey, f.label)}
								{f.key === 'promo' && t(f.labelKey, f.label)}
							</button>
						))}
					</div>

					{/* Notifications list */}
					{filtered.length === 0 ? (
						<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
							<Bell
								className="w-16 h-16 text-[#AAAAAA] mx-auto mb-4"
								strokeWidth={1}
							/>
							<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
								{t('notifications.empty', 'لا إشعارات جديدة')}
							</h3>
							<p className="text-[#6B6B6B] font-cairo text-sm">
								{t('notifications.emptyMessage', 'ستظهر إشعاراتك الجديدة هنا')}
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{filtered.map((n) => {
								const config = typeConfig[n.type];
								const Icon = config.icon;
								const inner = (
									<>
										<div
											className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}
										>
											<Icon
												className={`w-5 h-5 ${config.color}`}
												strokeWidth={1.5}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<p
													className={`font-cairo text-sm ${!n.read ? 'font-semibold' : 'font-medium'} text-[#111111]`}
												>
													{n.title}
												</p>
												{!n.read && (
													<span className="w-2 h-2 bg-[#D4A853] rounded-full shrink-0" />
												)}
											</div>
											{n.message && (
												<p className="text-xs text-[#6B6B6B] font-cairo leading-relaxed line-clamp-2">
													{n.message}
												</p>
											)}
											<p className="text-[10px] text-[#AAAAAA] font-cairo mt-2">
												{n.time}
											</p>
										</div>
										<ChevronLeft
											className="w-4 h-4 text-[#AAAAAA] shrink-0 self-center"
											strokeWidth={1.5}
										/>
									</>
								);
								// Wrap the card in a Link if the notification carries
								// an explicit `link` (extracted from `data.link`),
								// otherwise render a button that only marks it read.
								const baseClass = `bg-white rounded-xl p-4 flex items-start gap-4 transition-all hover:shadow-sm ${
									!n.read ? 'border-l-3 border-l-[#D4A853] bg-[#F3EDE4]/30' : ''
								}`;
								if (n.link) {
									return (
										<Link
											key={n.id}
											to={n.link}
											onClick={() => {
												if (!n.read) void markAsRead(n.id);
											}}
											className={`${baseClass} cursor-pointer`}
										>
											{inner}
										</Link>
									);
								}
								return (
									<button
										key={n.id}
										type="button"
										onClick={() => {
											if (!n.read) void markAsRead(n.id);
										}}
										className={`${baseClass} cursor-pointer w-full text-right`}
									>
										{inner}
									</button>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
