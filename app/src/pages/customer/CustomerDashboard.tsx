import { useNotifications, useOrders, useWishlistItems } from '@/hooks/useApi';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    Bell,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Globe,
    Heart,
    Loader2,
    LogOut,
    MapPin,
    Menu,
    MessageSquare,
    Package,
    Search,
    Settings,
    ShoppingBag,
    Star,
    Truck,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import styles from './CustomerDashboard.module.css';

/* ------------------------------------------------------------------ */
/*  Sidebar items (production-ready: t() keys + fallbacks)            */
/* ------------------------------------------------------------------ */
type SidebarItem = { icon: typeof ShoppingBag; labelKey: string; path: string };
const sidebarNavItems: SidebarItem[] = [
	{ icon: ShoppingBag, labelKey: 'customer.orders', path: '/customer/orders' },
	{ icon: Heart, labelKey: 'customer.wishlist', path: '/customer/wishlist' },
	{ icon: MessageSquare, labelKey: 'customer.reviews', path: '/customer/reviews' },
	{ icon: MapPin, labelKey: 'customer.addresses', path: '/customer/addresses' },
	{ icon: Settings, labelKey: 'customer.settings', path: '/customer/notifications' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function OrderTimeline({ timeline }: { timeline: string[] }) {
	const { t } = useTranslation();
	const steps = ['ordered', 'processing', 'shipped', 'delivered'] as const;
	const currentIndex = timeline.length - 1;

	return (
		<div
			className="flex items-center gap-1 mt-2"
			role="list"
			aria-label={t('customer.timeline.label', 'Order progress')}
		>
			{steps.map((step, i) => {
				const completed = i <= currentIndex;
				const icons: Record<(typeof steps)[number], React.ReactNode> = {
					ordered: <Package className="w-3 h-3" aria-hidden="true" />,
					processing: <Clock className="w-3 h-3" aria-hidden="true" />,
					shipped: <Truck className="w-3 h-3" aria-hidden="true" />,
					delivered: <CheckCircle className="w-3 h-3" aria-hidden="true" />,
				};
				// A11Y-P2-05 (added 2026-07-02): each step has a screen-reader
				// name so assistive tech hears the step, not just "completed".
				// Pair the icon (aria-hidden) with a localized aria-label.
				const stepLabel = t(`customer.timeline.${step}`, step);
				return (
					<div
						key={step}
						role="listitem"
						className="flex items-center gap-1"
						aria-current={i === currentIndex ? 'step' : undefined}
						// A11Y-P2-05 follow-up (added 2026-07-03): the
						// step-level aria-label moved here from the inner
						// circle (which can't legally carry aria-label
						// without a valid role). The listitem now exposes
						// the full status to assistive tech.
						aria-label={`${stepLabel} — ${
							completed
								? t('customer.timeline.done', 'done')
								: t('customer.timeline.pending', 'pending')
						}`}
					>
						<div
							className={cn(
								'w-6 h-6 rounded-full flex items-center justify-center',
								completed ? styles.timelineStep : styles.timelineStepPending,
							)}
							// A11Y-P2-05 follow-up (added 2026-07-03): the inner
							// step circle is a decorative indicator; the
							// accessible name lives on the parent
							// <div role="listitem"> (aria-label below). Drop
							// the aria-label here to avoid the
							// `aria-prohibited-attr` axe violation (a
							// bare <div> cannot carry aria-label).
							aria-hidden="true"
						>
							{icons[step]}
						</div>
						{i < steps.length - 1 && (
							<div
								className={cn(
									'w-6 h-0.5',
									i < currentIndex
										? styles.timelineConnectorDone
										: styles.timelineConnector,
								)}
								aria-hidden="true"
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

const STATUS_COLORS: Record<string, string> = {
	pending: 'bg-[#FF9800] text-white',
	processing: 'bg-[#FF9800] text-white',
	confirmed: 'bg-[#1688C9] text-white',
	shipped: 'bg-[#1688C9] text-white',
	delivered: 'bg-[#4CAF50] text-white',
	cancelled: 'bg-[#F44336] text-white',
	refunded: 'bg-[#6B7280] text-white',
};

function StatusBadge({ status, label }: { status: string; label: string }) {
	const { t } = useTranslation();
	return (
		<span
			className={cn(
				'px-2 py-0.5 rounded text-[11px] font-semibold',
				STATUS_COLORS[status] || 'bg-gray-400 text-white',
			)}
			// A11Y-P2-06 (added 2026-07-02): the colour is the only signal
			// for status, which fails for colour-blind users. The visible
			// label IS the text content (color-blind users still see it),
			// and the role=status wrapper exposes the meaning to AT.
			role="status"
			aria-label={`${t('customer.status.label', 'Status')}: ${label}`}
		>
			{label}
		</span>
	);
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
	pending: { ar: 'قيد الانتظار', en: 'Pending' },
	confirmed: { ar: 'مؤكد', en: 'Confirmed' },
	processing: { ar: 'قيد التجهيز', en: 'Processing' },
	shipped: { ar: 'قيد الشحن', en: 'Shipped' },
	delivered: { ar: 'تم التوصيل', en: 'Delivered' },
	cancelled: { ar: 'ملغي', en: 'Cancelled' },
	refunded: { ar: 'مسترد', en: 'Refunded' },
};

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
function statusTimeline(status: string): string[] {
	// Map an order status to the timeline steps it has completed.
	switch (status) {
		case 'pending':
			return ['ordered'];
		case 'confirmed':
		case 'processing':
			return ['ordered', 'processing'];
		case 'shipped':
			return ['ordered', 'processing', 'shipped'];
		case 'delivered':
			return ['ordered', 'processing', 'shipped', 'delivered'];
		case 'cancelled':
		case 'refunded':
			return ['ordered'];
		default:
			return ['ordered'];
	}
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function CustomerDashboard() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const location = useLocation();
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);

	// Live data from the API. useOrders scopes by req.user.id on the
	// server, so any logged-in customer only sees their own orders.
	const { data: orders, loading: ordersLoading } = useOrders();
	const { data: wishlistData } = useWishlistItems();
	const { data: notifData } = useNotifications();
	const wishlistItems = useMemo(() => wishlistData ?? [], [wishlistData]);
	const notifications = useMemo(() => notifData ?? [], [notifData]);

	// Stats — derived from live data, not hardcoded.
	const stats = useMemo(
		() => [
			{
				icon: ShoppingBag,
				label: t('customer.stats.orders'),
				value: orders?.length ?? 0,
				color: '#FF6A00',
			},
			{
				icon: Heart,
				label: t('customer.stats.wishlist'),
				value: wishlistItems.length,
				color: '#F44336',
			},
			{
				icon: Star,
				label: t('customer.stats.reviews'),
				value: 0, // Reviews count comes from /api/reviews — kept at 0 here to avoid an extra request per dashboard load.
				color: '#FF9800',
			},
			{
				icon: Bell,
				label: t('customer.stats.notifications'),
				value: notifications.filter((n: { is_read: number }) => !n.is_read).length,
				color: '#1688C9',
			},
		],
		[t, orders, wishlistItems, notifications],
	);

	const isActive = (path: string) => {
		if (path === '/customer/orders' && location.pathname === '/customer') return true;
		return location.pathname === path;
	};

	const closeMobile = () => setMobileOpen(false);

	const sidebarW = collapsed ? 'w-[72px]' : 'w-[220px]';

	const renderSidebarContent = () => (
		<>
			<div className="h-16 flex items-center px-4 border-b border-white/10">
				{collapsed ? (
					<div
						className={`mx-auto w-9 h-9 rounded flex items-center justify-center ${styles.brandTile}`}
					>
						<span className="text-white font-bold text-sm">ن</span>
					</div>
				) : (
					<div className="flex items-center gap-3">
						<div
							className={`w-9 h-9 rounded flex items-center justify-center ${styles.brandTile}`}
						>
							<Globe className="w-5 h-5 text-white" strokeWidth={1.5} />
						</div>
						<span className="text-white font-bold text-sm">
							{t('seller.brandName', 'Nouf-ex')}
						</span>
					</div>
				)}
			</div>

			<nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
				{sidebarNavItems.map((item) => {
					const active = isActive(item.path);
					return (
						<Link
							key={item.path}
							to={item.path}
							onClick={closeMobile}
							className={cn(
								'flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 relative',
								active
									? `text-white ${styles.navLinkActive}`
									: 'text-white/50 hover:text-white hover:bg-white/5',
							)}
						>
							{active && (
								<span
									className={`absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full ${styles.navIndicator}`}
								/>
							)}
							<item.icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
							{!collapsed && (
								<span className="text-sm font-medium flex-1">
									{t(item.labelKey)}
								</span>
							)}
						</Link>
					);
				})}
			</nav>

			<div className="p-3 border-t border-white/10">
				{!collapsed ? (
					<button className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors w-full text-left">
						<LogOut
							className={`w-4 h-4 ${styles.iconDanger} shrink-0`}
							strokeWidth={1.5}
						/>
						<span className={`text-xs ${styles.iconDanger}`}>{t('nav.logout')}</span>
					</button>
				) : (
					<button
						title={t('nav.logout', 'Logout')}
						aria-label={t('nav.logout', 'Logout')}
						className="w-9 h-9 rounded hover:bg-white/5 flex items-center justify-center mx-auto"
					>
						<LogOut className={`w-4 h-4 ${styles.iconDanger}`} strokeWidth={1.5} />
					</button>
				)}
			</div>
		</>
	);

	return (
		<div className={`min-h-[100dvh] flex ${styles.page}`} dir={isRTL ? 'rtl' : 'ltr'}>
			{/* Desktop Sidebar */}
			<aside
				className={cn(
					'fixed top-0 bottom-0 z-40 hidden lg:flex flex-col transition-all duration-300',
					isRTL ? 'right-0' : 'left-0',
					sidebarW,
					styles.sidebar,
				)}
			>
				{renderSidebarContent()}
			</aside>

			{/* Mobile Sidebar */}
			{mobileOpen && (
				<div className="fixed inset-0 z-[60] lg:hidden">
					<div
						className="absolute inset-0 bg-black/60"
						onClick={() => setMobileOpen(false)}
					/>
					<div
						className={cn(
							'absolute top-0 h-full w-[260px] flex flex-col',
							isRTL ? 'right-0' : 'left-0',
							styles.sidebar,
						)}
					>
						<div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
							<div className="flex items-center gap-3">
								<div
									className={`w-9 h-9 rounded flex items-center justify-center ${styles.brandTile}`}
								>
									<Globe className="w-5 h-5 text-white" strokeWidth={1.5} />
								</div>
								<span className="text-white font-bold text-sm">
									{t('seller.brandName', 'Nouf-ex')}
								</span>
							</div>
							<button
								onClick={() => setMobileOpen(false)}
								title={t('common.close', 'Close')}
								aria-label={t('common.close', 'Close')}
								className="text-white/70"
							>
								<X className="w-5 h-5" />
							</button>
						</div>
						<nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
							{sidebarNavItems.map((item) => {
								const active = isActive(item.path);
								return (
									<Link
										key={item.path}
										to={item.path}
										className={cn(
											'flex items-center gap-3 px-3 py-3 rounded transition-all relative',
											active
												? `text-white ${styles.navLinkActive}`
												: 'text-white/50 hover:text-white hover:bg-white/5',
										)}
									>
										{active && (
											<span
												className={cn(
													'absolute top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full',
													isRTL ? 'right-0' : 'left-0',
													styles.navIndicator,
												)}
											/>
										)}
										<item.icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
										<span className="text-sm font-medium flex-1">
											{t(item.labelKey)}
										</span>
									</Link>
								);
							})}
						</nav>
					</div>
				</div>
			)}

			{/* Main */}
			<div
				className={cn(
					'flex-1 min-h-[100dvh] flex flex-col transition-all duration-300',
					isRTL ? 'lg:mr-[220px]' : 'lg:ml-[220px]',
					collapsed && (isRTL ? 'lg:mr-[72px]' : 'lg:ml-[72px]'),
				)}
			>
				{/* Top Bar */}
				<header className="h-16 bg-white shadow-sm sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
					<div className="flex items-center gap-3">
						<button
							onClick={() => setMobileOpen(true)}
							title={t('common.menu', 'Menu')}
							aria-label={t('common.menu', 'Menu')}
							className="lg:hidden w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100"
						>
							<Menu className={`w-5 h-5 ${styles.iconText}`} strokeWidth={1.5} />
						</button>
						<button
							onClick={() => setCollapsed(!collapsed)}
							// A11Y-P2-05 follow-up (added 2026-07-03): icon-only
							// toggle button needs an explicit accessible
							// name for axe (button-name rule).
							aria-label={collapsed ? t('common.expand', 'Expand sidebar') : t('common.collapse', 'Collapse sidebar')}
							className="hidden lg:flex w-9 h-9 items-center justify-center rounded hover:bg-gray-100 transition-colors"
						>
							{collapsed ? (
								<ChevronRight className={`w-4 h-4 ${styles.iconTextMuted}`} />
							) : (
								<ChevronLeft className={`w-4 h-4 ${styles.iconTextMuted}`} />
							)}
						</button>
						<h2 className={`font-bold text-base ${styles.iconText}`}>
							{t('customer.dashboard')}
						</h2>
					</div>

					<div className="flex items-center gap-2">
						<div
							className={`hidden md:flex items-center rounded px-3 py-2 w-48 ${styles.searchSurface}`}
						>
							<Search
								className={`w-4 h-4 ${styles.iconTextFaint}`}
								strokeWidth={1.5}
							/>
							<input
								type="text"
								placeholder={t('common.search')}
								className={`bg-transparent border-none outline-none text-sm w-full ml-2 ${styles.searchInput}`}
							/>
						</div>
						<button
							// A11Y-P2-05 follow-up (added 2026-07-03): icon-only
							// notification bell needs an explicit accessible
							// name for axe (button-name rule).
							aria-label={t('customer.notifications', 'Notifications')}
							className="relative w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
						>
							<Bell className={`w-5 h-5 ${styles.iconTextMuted}`} strokeWidth={1.5} />
							{notifications.filter((n: { is_read: number }) => !n.is_read).length >
								0 && (
								<span
									className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${styles.brandAvatar}`}
								>
									{
										notifications.filter((n: { is_read: number }) => !n.is_read)
											.length
									}
								</span>
							)}
						</button>
						<div
							className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${styles.brandAvatar}`}
						>
							{t('lang.' + i18n.language).charAt(0)}
						</div>
					</div>
				</header>

				{/* Content */}
				<main className="flex-1 p-4 lg:p-6">
					<div className="max-w-6xl mx-auto space-y-6">
						{/* Quick Stats */}
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
							{stats.map((stat, i) => (
								<div
									key={i}
									className="bg-white rounded p-4 shadow-sm flex items-center gap-4"
								>
									<div
										className={`w-12 h-12 rounded flex items-center justify-center ${styles.tile}`}
										style={
											{ '--tile-color': stat.color } as React.CSSProperties
										}
									>
										<stat.icon className="w-6 h-6" strokeWidth={1.5} />
									</div>
									<div>
										<p className={`text-xl font-bold ${styles.statValue}`}>
											{stat.value}
										</p>
										<p className={`text-xs ${styles.statLabel}`}>
											{stat.label}
										</p>
									</div>
								</div>
							))}
						</div>

						{/* Order Tracking */}
						<div className="bg-white rounded p-5 shadow-sm">
							<div className="flex items-center justify-between mb-4">
								<h3 className={`font-bold text-base ${styles.sectionTitle}`}>
									{t('customer.tracking')}
								</h3>
								<Link
									to="/customer/orders"
									className={`text-xs font-semibold hover:underline ${styles.linkOrange}`}
								>
									{t('common.viewAll')}
								</Link>
							</div>
							{ordersLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
								</div>
							) : !orders || orders.length === 0 ? (
								<p className={`text-sm text-center py-6 ${styles.mutedTextFaint}`}>
									{t('customer.noOrders')}
								</p>
							) : (
								<div className="space-y-4">
									{orders.slice(0, 3).map((order) => {
										const labels = STATUS_LABELS[order.status] ?? {
											ar: order.status,
											en: order.status,
										};
										return (
											<div
												key={order.id}
												className={`p-4 rounded border ${styles.orderCard}`}
											>
												<div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
													<div className="flex items-center gap-3">
														<div
															className={`w-12 h-12 rounded flex items-center justify-center ${styles.iconTileSoft}`}
														>
															<Package
																className={`w-6 h-6 ${styles.iconTileOrange}`}
																strokeWidth={1.5}
															/>
														</div>
														<div>
															<div className="flex items-center gap-2">
																<p
																	className={`text-sm font-semibold ${styles.iconText}`}
																>
																	#
																	{order.order_number ?? order.id}
																</p>
																<StatusBadge
																	status={order.status}
																	label={
																		isRTL
																			? labels.ar
																			: labels.en
																	}
																/>
															</div>
															<p
																className={`text-xs mt-0.5 ${styles.mutedText}`}
															>
																{order.created_at?.slice(0, 10) ??
																	''}{' '}
																·{' '}
																{(order as { items_count?: number })
																	.items_count ?? '–'}{' '}
																{t('common.items')}
															</p>
														</div>
													</div>
													<p
														className={`text-sm font-bold ${styles.priceOrange}`}
													>
														{formatMoneyCompact(
															Number(order.total ?? 0),
															{
																lang: i18n.language as
																	| 'ar'
																	| 'en'
																	| 'zh',
															},
														)}
													</p>
												</div>
												<OrderTimeline
													timeline={statusTimeline(order.status)}
												/>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Wishlist Grid */}
						<div className="bg-white rounded p-5 shadow-sm">
							<div className="flex items-center justify-between mb-4">
								<h3 className={`font-bold text-base ${styles.sectionTitle}`}>
									{t('customer.wishlist')}
								</h3>
								<Link
									to="/customer/wishlist"
									className={`text-xs font-semibold hover:underline ${styles.linkOrange}`}
								>
									{t('common.viewAll')}
								</Link>
							</div>
							{wishlistItems.length === 0 ? (
								<p className={`text-sm text-center py-6 ${styles.mutedTextFaint}`}>
									{t('customer.noWishlist')}
								</p>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
									{wishlistItems.slice(0, 4).map((item) => {
										// WishlistItem carries the localized name in one of
										// name_en / name_ar / name_zh. Pick the right one
										// for the current i18n.language. The product_id
										// is used as the key (NOT id — id is the wishlist row id).
										const wn = item as unknown as {
											product_id: number;
											price?: number;
											rating?: number;
											name_ar?: string;
											name_en?: string;
											name_zh?: string;
										};
										const wname = isRTL
											? (wn.name_ar ?? wn.name_en ?? wn.name_zh ?? '—')
											: (wn.name_en ?? wn.name_zh ?? wn.name_ar ?? '—');
										return (
											<div
												key={wn.product_id}
												className={`border rounded p-4 hover:shadow-md transition-shadow ${styles.wishlistCard}`}
											>
												<div
													className={`w-full h-28 rounded flex items-center justify-center mb-3 ${styles.wishlistImage}`}
												>
													<Heart
														className={`w-8 h-8 ${styles.iconDanger}`}
														strokeWidth={1.5}
													/>
												</div>
												<p
													className={`text-sm font-medium truncate ${styles.iconText}`}
												>
													{wname}
												</p>
												<div className="flex items-center gap-2 mt-1">
													<Star
														className={`w-3 h-3 ${styles.ratingStar}`}
														strokeWidth={1.5}
													/>
													<span className={`text-xs ${styles.mutedText}`}>
														{wn.rating ?? '–'}
													</span>
												</div>
												<p
													className={`text-sm font-bold mt-2 ${styles.priceOrange}`}
												>
													{formatMoneyCompact(wn.price ?? 0, {
														lang: i18n.language as 'ar' | 'en' | 'zh',
													})}
												</p>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Notifications */}
						<div className="bg-white rounded p-5 shadow-sm">
							<h3 className={`font-bold text-base mb-4 ${styles.sectionTitle}`}>
								{t('customer.recentNotifications')}
							</h3>
							{notifications.length === 0 ? (
								<p className={`text-sm text-center py-6 ${styles.mutedTextFaint}`}>
									{t('customer.noNotifications')}
								</p>
							) : (
								<div className="space-y-3">
									{notifications.slice(0, 5).map((n) => {
										const typeColor: Record<string, string> = {
											order: '#1688C9',
											refund: '#F44336',
											review: '#FF9800',
											promo: '#FF6A00',
											dispute: '#F44336',
											system: '#6B7280',
											message: '#1688C9',
										};
										return (
											<div
												key={n.id}
												className="flex items-start gap-3 p-3 rounded hover:bg-gray-50 transition-colors"
											>
												<div
													className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${styles.tile}`}
													style={
														{
															'--tile-color':
																typeColor[n.type] ?? '#6B7280',
														} as React.CSSProperties
													}
												>
													<Bell className="w-4 h-4" strokeWidth={1.5} />
												</div>
												<div className="flex-1">
													<p className={`text-xs ${styles.iconText}`}>
														{n.title}
													</p>
													{n.body && (
														<p
															className={`text-xs mt-0.5 ${styles.mutedTextFaint}`}
														>
															{n.body}
														</p>
													)}
													<p
														className={`text-[10px] mt-0.5 ${styles.mutedTextFaint}`}
													>
														{n.created_at?.slice(0, 10) ?? ''}
													</p>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
