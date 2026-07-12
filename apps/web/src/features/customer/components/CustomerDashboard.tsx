import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ArrowRight,
	Bell,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	Heart,
	HelpCircle,
	Loader2,
	LogOut,
	MapPin,
	Menu,
	Package,
	Search,
	Settings,
	ShoppingBag,
	ShoppingCart,
	Star,
	Ticket,
	TrendingUp,
	Truck,
	User as UserIcon,
	Wallet,
	X,
} from 'lucide-react';
import { useApp, useAuth } from '@/context/AppContext';
import {
	useOrders,
	useNotifications,
	useServerWishlist,
} from '@/hooks/useApi';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import styles from './CustomerDashboard.module.css';

type StatusLane = 'pending' | 'confirmed' | 'shipped' | 'delivered';

const STATUS_LABELS_AR: Record<string, string> = {
	pending: 'بانتظار الدفع',
	confirmed: 'بانتظار الشحن',
	processing: 'قيد التجهيز',
	shipped: 'قيد الشحن',
	delivered: 'تم التوصيل',
	cancelled: 'ملغي',
	refunded: 'مسترد',
};

const STATUS_LABELS_EN: Record<string, string> = {
	pending: 'Awaiting Payment',
	confirmed: 'Awaiting Shipment',
	processing: 'Processing',
	shipped: 'Shipped',
	delivered: 'Delivered',
	cancelled: 'Cancelled',
	refunded: 'Refunded',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
	pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
	confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
	processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
	shipped: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
	delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
	cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
	refunded: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
};

function StatusBadge({ status, isRTL }: { status: string; isRTL: boolean }) {
	const colors = STATUS_COLORS[status] ?? STATUS_COLORS.cancelled;
	const label = isRTL
		? (STATUS_LABELS_AR[status] ?? status)
		: (STATUS_LABELS_EN[status] ?? status);
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
				colors.bg,
				colors.text,
			)}
		>
			<span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
			{label}
		</span>
	);
}

const ORDER_STEPS = ['ordered', 'processing', 'shipped', 'delivered'] as const;

function statusTimeline(status: string): number {
	switch (status) {
		case 'pending':
		case 'confirmed':
			return 1;
		case 'processing':
			return 2;
		case 'shipped':
			return 3;
		case 'delivered':
			return 4;
		default:
			return 0;
	}
}

function OrderTimeline({ status }: { status: string }) {
	const { t } = useTranslation();
	const currentStep = statusTimeline(status);
	return (
		<div className="flex items-center gap-1.5 mt-3" role="list">
			{ORDER_STEPS.map((step, i) => {
				const completed = i < currentStep;
				const active = i === currentStep - 1;
				return (
					<div key={step} className="flex items-center gap-1.5 flex-1">
						<div
							className={cn(
								'flex-1 h-1 rounded-full transition-colors',
								completed || active ? 'bg-[#D4A853]' : 'bg-gray-200',
							)}
						/>
						<span
							className={cn(
								'text-[10px] font-medium shrink-0',
								completed || active ? 'text-[#D4A853]' : 'text-gray-400',
							)}
						>
							{t(`customer.timeline.${step}`)}
						</span>
					</div>
				);
			})}
		</div>
	);
}

export default function CustomerDashboard() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const { state } = useApp();
	const { logout } = useAuth();
	const isRTL = i18n.language === 'ar';
	const [searchQuery, setSearchQuery] = useState('');
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const user = state.user;
	const userId: number | null = user?.id ? Number(user.id) : null;

	const { data: orders, loading: ordersLoading } = useOrders();
	const { data: wishlistData } = useServerWishlist(userId);
	const { data: notifData } = useNotifications();
	const wishlist = useMemo(() => wishlistData ?? [], [wishlistData]);
	const notifications = useMemo(() => notifData ?? [], [notifData]);

	const statusCounts = useMemo(() => {
		const counts = { pending: 0, confirmed: 0, shipped: 0, delivered: 0 };
		(orders ?? []).forEach((o) => {
			if (o.status in counts) counts[o.status as StatusLane]++;
		});
		return counts;
	}, [orders]);

	const recentOrders = useMemo(() => (orders ?? []).slice(0, 4), [orders]);
	const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);
	const recentWishlist = useMemo(() => wishlist.slice(0, 4), [wishlist]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		const q = searchQuery.trim();
		if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
	};

	const greetingKey = user?.name
		? 'customer.greeting'
		: 'customer.greetingGuest';
	const greeting = user?.name
		? t(greetingKey, { name: user.name })
		: t(greetingKey);

	return (
		<div className={`min-h-[100dvh] bg-[#FAFAF7] ${styles.page}`} dir={isRTL ? 'rtl' : 'ltr'}>
			{/* ═══════ TOP BAR ═══════ */}
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<button
						onClick={() => setMobileMenuOpen(true)}
						className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
						aria-label={t('common.menu')}
					>
						<Menu className="w-5 h-5 text-gray-700" />
					</button>
					<Link to="/customer" className="flex items-center gap-2">
						<span className="text-xl font-extrabold text-[#D4A853]">Nouf-ex</span>
						<span className="hidden sm:inline text-xs font-semibold text-gray-400 tracking-wider">
							CENTER
						</span>
					</Link>

					<form
						onSubmit={handleSearch}
						className="hidden md:flex flex-1 max-w-xl mx-4"
					>
						<div className="flex w-full h-10 rounded-full border border-gray-300 bg-white focus-within:border-[#D4A853] focus-within:shadow-sm transition-all overflow-hidden">
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={t('common.search') + '...'}
								className="flex-1 px-4 text-sm bg-transparent outline-none placeholder-gray-400"
								dir={isRTL ? 'rtl' : 'ltr'}
							/>
							<button
								type="submit"
								className="px-4 bg-[#D4A853] text-white hover:bg-[#B8923F] transition-colors"
								aria-label={t('common.search')}
							>
								<Search size={16} />
							</button>
						</div>
					</form>

					<div className="flex items-center gap-1 ms-auto">
						<Link
							to="/checkout"
							className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-700"
							aria-label={t('customer.shoppingCart')}
						>
							<ShoppingCart size={18} />
						</Link>
						<Link
							to="/customer/notifications"
							className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-700"
							aria-label={t('customer.notifications')}
						>
							<Bell size={18} />
							{notifications.filter((n: { is_read: number }) => !n.is_read).length > 0 && (
								<span className="absolute top-1 end-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
									{notifications.filter((n: { is_read: number }) => !n.is_read).length}
								</span>
							)}
						</Link>
						<Link
							to="/customer/profile"
							className="hidden sm:flex items-center gap-2 ms-1 ps-2 pe-3 h-9 rounded-full hover:bg-gray-100 transition-colors"
						>
							{user?.avatar ? (
								<img
									src={user.avatar}
									alt={user.name}
									className="w-7 h-7 rounded-full object-cover ring-2 ring-[#D4A853]/30"
								/>
							) : (
								<div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#D4A853] to-[#8B6F2F] flex items-center justify-center text-white font-bold text-xs">
									{(user?.name ?? '?').charAt(0).toUpperCase()}
								</div>
							)}
							<span className="text-xs font-semibold text-gray-700 max-w-[100px] truncate">
								{user?.name ?? t('customer.guest')}
							</span>
						</Link>
					</div>
				</div>

				{/* Breadcrumb */}
				<div className="border-t border-gray-100">
					<div className="max-w-7xl mx-auto px-4 lg:px-6 h-9 flex items-center text-xs text-gray-500">
						<Link to="/" className="hover:text-[#D4A853]">
							{t('customer.marketplace', 'Nouf-ex Marketplace')}
						</Link>
						<ChevronRight className={`w-3 h-3 mx-1.5 ${isRTL ? 'rotate-180' : ''}`} />
						<span className="text-gray-700 font-semibold">
							{t('customer.dashboard')}
						</span>
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				{/* ═══════ HERO GREETING ═══════ */}
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
						<div className="absolute -bottom-12 -start-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex flex-wrap items-center justify-between gap-4">
						<div>
							<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
								{t('customer.dashboard')}
							</p>
							<h1 className="text-2xl lg:text-3xl font-bold mt-1">{greeting}</h1>
							<p className="text-sm text-white/60 mt-1">
								{orders?.length ?? 0} {t('customer.stats.orders', 'orders')}
								{user?.email && ` · ${user.email}`}
							</p>
						</div>
						<div className="flex gap-2">
							<Link
								to="/customer/profile"
								className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition-colors flex items-center gap-2"
							>
								<UserIcon size={14} />
								{t('customer.profile')}
							</Link>
							<Link
								to="/customer/wishlist"
								className="px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-sm font-bold transition-colors flex items-center gap-2"
							>
								<Heart size={14} />
								{t('customer.wishlist')}
							</Link>
						</div>
					</div>
				</div>

				{/* ═══════ STATUS LANES (Amazon/Taobao-style buckets) ═══════ */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
					{(
						[
							{
								key: 'pending',
								icon: CreditCard,
								labelKey: 'customer.awaitingPayment',
								color: 'text-amber-600 bg-amber-50',
								count: statusCounts.pending,
							},
							{
								key: 'confirmed',
								icon: Package,
								labelKey: 'customer.awaitingShipment',
								color: 'text-blue-600 bg-blue-50',
								count: statusCounts.confirmed,
							},
							{
								key: 'shipped',
								icon: Truck,
								labelKey: 'customer.outForDelivery',
								color: 'text-indigo-600 bg-indigo-50',
								count: statusCounts.shipped,
							},
							{
								key: 'delivered',
								icon: Star,
								labelKey: 'customer.awaitingReview',
								color: 'text-emerald-600 bg-emerald-50',
								count: statusCounts.delivered,
							},
						] as const
					).map((lane) => (
						<Link
							key={lane.key}
							to={`/customer/orders?status=${lane.key}`}
							className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-[#D4A853]/40 transition-all group"
						>
							<div className="flex items-start justify-between mb-3">
								<div
									className={cn(
										'w-10 h-10 rounded-lg flex items-center justify-center',
										lane.color,
									)}
								>
									<lane.icon size={18} />
								</div>
								{lane.count > 0 && (
									<span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
										{lane.count}
									</span>
								)}
							</div>
							<p className="text-2xl font-extrabold text-gray-900">{lane.count}</p>
							<p className="text-xs text-gray-500 mt-0.5 font-medium">
								{t(lane.labelKey)}
							</p>
						</Link>
					))}
				</div>

				{/* ═══════ QUICK ACTIONS ═══════ */}
				<div className="grid grid-cols-3 md:grid-cols-6 gap-2">
					{(
						[
							{ icon: ShoppingBag, label: 'customer.orders', path: '/customer/orders', color: 'bg-orange-50 text-orange-600' },
							{ icon: Heart, label: 'customer.wishlist', path: '/customer/wishlist', color: 'bg-pink-50 text-pink-600' },
							{ icon: MapPin, label: 'customer.addresses', path: '/customer/addresses', color: 'bg-emerald-50 text-emerald-600' },
							{ icon: Wallet, label: 'customer.myWallet', path: '/customer/wallet', color: 'bg-purple-50 text-purple-600' },
							{ icon: Ticket, label: 'customer.myCoupons', path: '/customer/coupons', color: 'bg-yellow-50 text-yellow-700' },
							{ icon: Settings, label: 'customer.profile', path: '/customer/profile', color: 'bg-gray-100 text-gray-600' },
						] as const
					).map((q) => (
						<Link
							key={q.path}
							to={q.path}
							className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-[#D4A853]/40 transition-all"
						>
							<div
								className={cn(
									'w-10 h-10 rounded-lg flex items-center justify-center',
									q.color,
								)}
							>
								<q.icon size={18} />
							</div>
							<span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">
								{t(q.label)}
							</span>
						</Link>
					))}
				</div>

				{/* ═══════ RECENT ORDERS ═══════ */}
				<section>
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<ShoppingBag size={18} className="text-[#D4A853]" />
							<h2 className="text-base font-bold text-gray-900">
								{t('customer.recentActivity')}
							</h2>
						</div>
						<Link
							to="/customer/orders"
							className="text-xs font-bold text-[#D4A853] hover:text-[#B8923F] flex items-center gap-1"
						>
							{t('common.viewAll')}
							<ChevronLeft className={cn('w-3 h-3', isRTL ? 'rotate-180' : '')} />
						</Link>
					</div>

					{ordersLoading ? (
						<div className="bg-white rounded-xl border border-gray-200 p-12 flex items-center justify-center">
							<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
						</div>
					) : recentOrders.length === 0 ? (
						<div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
							<div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4">
								<Package size={24} className="text-gray-400" />
							</div>
							<p className="text-sm font-semibold text-gray-700">
								{t('customer.noOrders')}
							</p>
							<Link
								to="/"
								className="inline-block mt-4 px-5 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold transition-colors"
							>
								{t('customer.marketplace')}
							</Link>
						</div>
					) : (
						<div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
							{recentOrders.map((order) => (
								<Link
									key={order.id}
									to={`/customer/orders/${order.id}`}
									className="block p-4 lg:p-5 hover:bg-gray-50 transition-colors group"
								>
									<div className="flex flex-wrap items-start justify-between gap-3 mb-3">
										<div>
											<p className="text-xs text-gray-500">
												{t('customer.orderNumber')}{' '}
												<span className="font-bold text-gray-900">
													#{order.order_number ?? order.id}
												</span>
											</p>
											<p className="text-[10px] text-gray-400 mt-0.5">
												{order.created_at?.slice(0, 10)}
												{order.store_name && ` · ${order.store_name}`}
											</p>
										</div>
										<StatusBadge status={order.status} isRTL={isRTL} />
									</div>

									<OrderTimeline status={order.status} />

									<div className="flex items-center justify-between mt-3">
										<p className="text-base font-extrabold text-gray-900">
											{formatMoneyCompact(Number(order.total ?? 0), {
												lang: i18n.language as 'ar' | 'en' | 'zh',
											})}
										</p>
										<div className="flex items-center gap-2">
											{(order.status === 'shipped' ||
												order.status === 'processing' ||
												order.status === 'confirmed') && (
												<span className="text-[10px] font-bold uppercase tracking-wider text-[#D4A853] px-2 py-1 rounded-full bg-[#D4A853]/10">
													{t('customer.trackOrder')}
												</span>
											)}
											<ChevronLeft
												className={cn(
													'w-4 h-4 text-gray-400 group-hover:text-[#D4A853] transition-colors',
													isRTL ? 'rotate-180' : '',
												)}
											/>
										</div>
									</div>
								</Link>
							))}
						</div>
					)}
				</section>

				<div className="grid lg:grid-cols-2 gap-6">
					{/* ═══════ WISHLIST PREVIEW ═══════ */}
					<section>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<Heart size={18} className="text-pink-500" />
								<h2 className="text-base font-bold text-gray-900">
									{t('customer.wishlist')}
								</h2>
								{wishlist.length > 0 && (
									<span className="text-xs text-gray-500 font-semibold">
										({wishlist.length})
									</span>
								)}
							</div>
							<Link
								to="/customer/wishlist"
								className="text-xs font-bold text-[#D4A853] hover:text-[#B8923F] flex items-center gap-1"
							>
								{t('common.viewAll')}
								<ChevronLeft className={cn('w-3 h-3', isRTL ? 'rotate-180' : '')} />
							</Link>
						</div>

						{recentWishlist.length === 0 ? (
							<div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
								<div className="w-14 h-14 rounded-full bg-pink-50 mx-auto flex items-center justify-center mb-3">
									<Heart size={20} className="text-pink-400" />
								</div>
								<p className="text-sm font-semibold text-gray-700">
									{t('customer.noWishlist')}
								</p>
								<Link
									to="/"
									className="inline-block mt-3 text-xs font-bold text-[#D4A853] hover:text-[#B8923F]"
								>
									{t('customer.marketplace')}
								</Link>
							</div>
						) : (
							<div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
								{recentWishlist.map((item) => {
									const wn = item as unknown as {
										product_id: number;
										price?: number;
										original_price?: number;
										rating?: number;
										name_ar?: string;
										name_en?: string;
										name_zh?: string;
										main_image?: string;
									};
									const wname = isRTL
										? (wn.name_ar ?? wn.name_en ?? wn.name_zh ?? '—')
										: (wn.name_en ?? wn.name_zh ?? wn.name_ar ?? '—');
									const hasDiscount =
										wn.original_price && wn.original_price > (wn.price ?? 0);
									return (
										<Link
											key={wn.product_id}
											to={`/products/${wn.product_id}`}
											className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
										>
											{wn.main_image ? (
												<img
													src={wn.main_image}
													alt={wname}
													className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0"
												/>
											) : (
												<div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
													<Package size={18} className="text-gray-400" />
												</div>
											)}
											<div className="flex-1 min-w-0">
												<p className="text-sm font-semibold text-gray-900 truncate">
													{wname}
												</p>
												<div className="flex items-center gap-2 mt-1">
													{hasDiscount && (
														<span className="text-[10px] line-through text-gray-400">
															{formatMoneyCompact(wn.original_price!, {
																lang: i18n.language as
																	| 'ar'
																	| 'en'
																	| 'zh',
															})}
														</span>
													)}
													<span className="text-sm font-extrabold text-[#D4A853]">
														{formatMoneyCompact(wn.price ?? 0, {
															lang: i18n.language as 'ar' | 'en' | 'zh',
														})}
													</span>
												</div>
											</div>
											{hasDiscount && (
												<span className="px-2 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
													-
													{Math.round(
														((wn.original_price! - (wn.price ?? 0)) /
															wn.original_price!) *
															100,
													)}
													%
												</span>
											)}
										</Link>
									);
								})}
							</div>
						)}
					</section>

					{/* ═══════ NOTIFICATIONS PREVIEW ═══════ */}
					<section>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<Bell size={18} className="text-[#D4A853]" />
								<h2 className="text-base font-bold text-gray-900">
									{t('customer.recentNotifications')}
								</h2>
								{notifications.filter((n: { is_read: number }) => !n.is_read)
									.length > 0 && (
									<span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
										{
											notifications.filter((n: { is_read: number }) => !n.is_read)
												.length
										}
									</span>
								)}
							</div>
							<Link
								to="/customer/notifications"
								className="text-xs font-bold text-[#D4A853] hover:text-[#B8923F] flex items-center gap-1"
							>
								{t('common.viewAll')}
								<ChevronLeft className={cn('w-3 h-3', isRTL ? 'rotate-180' : '')} />
							</Link>
						</div>

						{recentNotifications.length === 0 ? (
							<div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
								<div className="w-14 h-14 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-3">
									<Bell size={20} className="text-gray-400" />
								</div>
								<p className="text-sm font-semibold text-gray-700">
									{t('customer.noNotifications')}
								</p>
							</div>
						) : (
							<div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
								{recentNotifications.map((n) => {
									const typeColor: Record<string, string> = {
										order: 'bg-blue-500',
										refund: 'bg-red-500',
										review: 'bg-amber-500',
										promo: 'bg-[#D4A853]',
										dispute: 'bg-red-600',
										system: 'bg-gray-500',
										message: 'bg-indigo-500',
									};
									return (
										<Link
											key={n.id}
											to="/customer/notifications"
											className={cn(
												'flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors',
												!n.is_read && 'bg-[#FFF8E8]',
											)}
										>
											<div
												className={cn(
													'w-2 h-2 rounded-full mt-2 shrink-0',
													typeColor[n.type] ?? 'bg-gray-400',
												)}
											/>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-semibold text-gray-900 truncate">
													{n.title}
												</p>
												{n.body && (
													<p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
														{n.body}
													</p>
												)}
												<p className="text-[10px] text-gray-400 mt-1">
													{n.created_at?.slice(0, 10)}
												</p>
											</div>
											{!n.is_read && (
												<span className="w-2 h-2 rounded-full bg-[#D4A853] mt-2 shrink-0" />
											)}
										</Link>
									);
								})}
							</div>
						)}
					</section>
				</div>

				{/* ═══════ PROFILE COMPLETION CARD ═══════ */}
				<section>
					<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] to-[#2A2420] text-white p-6 relative overflow-hidden">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="flex items-center gap-3">
								<div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
									<TrendingUp size={20} className="text-[#D4A853]" />
								</div>
								<div>
									<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
										{t('customer.profileCompletion')}
									</p>
									<p className="text-sm text-white/80 mt-0.5">
										{t('customer.completeProfile')}
									</p>
								</div>
							</div>
							<Link
								to="/customer/profile"
								className="px-5 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-sm font-bold transition-colors flex items-center gap-2"
							>
								{t('common.edit')}
								<ArrowRight size={14} className={isRTL ? 'rotate-180' : ''} />
							</Link>
						</div>
					</div>
				</section>
			</div>

			{/* Mobile menu drawer */}
			{mobileMenuOpen && (
				<div className="lg:hidden fixed inset-0 z-50">
					<div
						className="absolute inset-0 bg-black/60"
						onClick={() => setMobileMenuOpen(false)}
					/>
					<div
						className={cn(
							'absolute top-0 h-full w-72 bg-white shadow-2xl overflow-y-auto',
							isRTL ? 'right-0' : 'left-0',
						)}
					>
						<div className="p-4 border-b border-gray-200 flex items-center justify-between">
							<span className="font-bold text-lg">{t('customer.dashboard')}</span>
							<button
								onClick={() => setMobileMenuOpen(false)}
								className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
								aria-label={t('common.close')}
							>
								<X size={16} />
							</button>
						</div>
						<nav className="p-4 space-y-1">
							{[
								{ icon: ShoppingBag, label: 'customer.orders', path: '/customer/orders' },
								{ icon: Heart, label: 'customer.wishlist', path: '/customer/wishlist' },
								{ icon: Star, label: 'customer.reviews', path: '/customer/reviews' },
								{ icon: MapPin, label: 'customer.addresses', path: '/customer/addresses' },
								{ icon: Bell, label: 'customer.notifications', path: '/customer/notifications' },
								{ icon: UserIcon, label: 'customer.profile', path: '/customer/profile' },
								{ icon: HelpCircle, label: 'customer.help', path: '/customer/help' },
							].map((item) => (
								<Link
									key={item.path}
									to={item.path}
									onClick={() => setMobileMenuOpen(false)}
									className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
								>
									<item.icon size={18} className="text-gray-500" />
									<span>{t(item.label)}</span>
								</Link>
							))}
							<button
								onClick={() => {
									logout();
									setMobileMenuOpen(false);
								}}
								className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 text-sm font-medium text-red-600"
							>
								<LogOut size={18} />
								<span>{t('nav.logout')}</span>
							</button>
						</nav>
					</div>
				</div>
			)}
		</div>
	);
}
