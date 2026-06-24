import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ShoppingBag,
	Heart,
	MessageSquare,
	MapPin,
	Settings,
	Search,
	Bell,
	LogOut,
	Menu,
	X,
	ChevronLeft,
	ChevronRight,
	Package,
	Clock,
	CheckCircle,
	Truck,
	Star,
	Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './CustomerDashboard.module.css';

/* ------------------------------------------------------------------ */
/*  Sidebar items                                                      */
/* ------------------------------------------------------------------ */
const sidebarNavItems = [
	{ icon: ShoppingBag, label: 'طلباتي', labelEn: 'My Orders', path: '/customer/orders' },
	{ icon: Heart, label: 'المفضلة', labelEn: 'Wishlist', path: '/customer/wishlist' },
	{ icon: MessageSquare, label: 'الرسائل', labelEn: 'Messages', path: '/customer/reviews' },
	{ icon: MapPin, label: 'العناوين', labelEn: 'Addresses', path: '/customer/addresses' },
	{ icon: Settings, label: 'الإعدادات', labelEn: 'Settings', path: '/customer/notifications' },
];

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const recentOrders = [
	{
		id: 'NOUF-1234',
		date: '2025-06-20',
		dateAr: '٢٠ يونيو ٢٠٢٥',
		status: 'delivered',
		statusLabel: 'تم التوصيل',
		statusLabelEn: 'Delivered',
		total: '$250',
		items: 3,
		timeline: ['ordered', 'processing', 'shipped', 'delivered'],
	},
	{
		id: 'NOUF-1235',
		date: '2025-06-18',
		dateAr: '١٨ يونيو ٢٠٢٥',
		status: 'shipped',
		statusLabel: 'قيد الشحن',
		statusLabelEn: 'Shipped',
		total: '$180',
		items: 2,
		timeline: ['ordered', 'processing', 'shipped'],
	},
	{
		id: 'NOUF-1236',
		date: '2025-06-15',
		dateAr: '١٥ يونيو ٢٠٢٥',
		status: 'processing',
		statusLabel: 'قيد الانتظار',
		statusLabelEn: 'Processing',
		total: '$95',
		items: 1,
		timeline: ['ordered', 'processing'],
	},
];

const wishlistItems = [
	{
		id: 1,
		name: 'سماعات لاسلكية فاخرة',
		nameEn: 'Premium Wireless Earbuds',
		price: '$45',
		rating: 4.8,
		sold: 1200,
	},
	{
		id: 2,
		name: 'ساعة ذكية رياضية',
		nameEn: 'Smart Sports Watch',
		price: '$78',
		rating: 4.5,
		sold: 850,
	},
	{
		id: 3,
		name: 'حقيبة جلدية يدوية',
		nameEn: 'Handmade Leather Bag',
		price: '$120',
		rating: 4.9,
		sold: 340,
	},
	{
		id: 4,
		name: 'نظارة شمسية بولارايزد',
		nameEn: 'Polarized Sunglasses',
		price: '$35',
		rating: 4.3,
		sold: 2100,
	},
];

const notifications = [
	{
		text: 'تم شحن طلبك #NOUF-1235',
		textEn: 'Your order #NOUF-1235 has been shipped',
		time: '2 hours ago',
		icon: Truck,
		color: '#1688C9',
	},
	{
		text: 'تم توصيل طلبك #NOUF-1234',
		textEn: 'Your order #NOUF-1234 has been delivered',
		time: 'Yesterday',
		icon: CheckCircle,
		color: '#4CAF50',
	},
	{
		text: 'تخفيض 20% على الساعات الذكية',
		textEn: '20% off smart watches',
		time: '2 days ago',
		icon: Star,
		color: '#FF6A00',
	},
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function OrderTimeline({ timeline }: { timeline: string[]; isRTL: boolean }) {
	const steps = ['ordered', 'processing', 'shipped', 'delivered'];
	const currentIndex = timeline.length - 1;

	return (
		<div className="flex items-center gap-1 mt-2">
			{steps.map((step, i) => {
				const completed = i <= currentIndex;
				const icons: Record<string, React.ReactNode> = {
					ordered: <Package className="w-3 h-3" />,
					processing: <Clock className="w-3 h-3" />,
					shipped: <Truck className="w-3 h-3" />,
					delivered: <CheckCircle className="w-3 h-3" />,
				};
				return (
					<div key={step} className="flex items-center gap-1">
						<div
							className={cn(
								'w-6 h-6 rounded-full flex items-center justify-center',
								completed ? styles.timelineStep : styles.timelineStepPending,
							)}
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
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

function StatusBadge({ status, label }: { status: string; label: string }) {
	const colors: Record<string, string> = {
		processing: 'bg-[#FF9800] text-white',
		shipped: 'bg-[#1688C9] text-white',
		delivered: 'bg-[#4CAF50] text-white',
		cancelled: 'bg-[#F44336] text-white',
	};
	return (
		<span
			className={cn(
				'px-2 py-0.5 rounded text-[11px] font-semibold',
				colors[status] || 'bg-gray-400 text-white',
			)}
		>
			{label}
		</span>
	);
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
							{isRTL ? 'نوف إكس' : 'Nouf-ex'}
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
									{isRTL ? item.label : item.labelEn}
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
					<button className="w-9 h-9 rounded hover:bg-white/5 flex items-center justify-center mx-auto">
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
									{isRTL ? 'نوف إكس' : 'Nouf-ex'}
								</span>
							</div>
							<button onClick={() => setMobileOpen(false)} className="text-white/70">
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
											{isRTL ? item.label : item.labelEn}
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
							className="lg:hidden w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100"
						>
							<Menu className={`w-5 h-5 ${styles.iconText}`} strokeWidth={1.5} />
						</button>
						<button
							onClick={() => setCollapsed(!collapsed)}
							className="hidden lg:flex w-9 h-9 items-center justify-center rounded hover:bg-gray-100 transition-colors"
						>
							{collapsed ? (
								<ChevronRight className={`w-4 h-4 ${styles.iconTextMuted}`} />
							) : (
								<ChevronLeft className={`w-4 h-4 ${styles.iconTextMuted}`} />
							)}
						</button>
						<h2 className={`font-bold text-base ${styles.iconText}`}>
							{isRTL ? 'لوحة العميل' : 'Customer Dashboard'}
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
								placeholder={isRTL ? 'بحث...' : 'Search...'}
								className={`bg-transparent border-none outline-none text-sm w-full ml-2 ${styles.searchInput}`}
							/>
						</div>
						<button className="relative w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
							<Bell className={`w-5 h-5 ${styles.iconTextMuted}`} strokeWidth={1.5} />
							<span
								className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${styles.brandAvatar}`}
							>
								2
							</span>
						</button>
						<div
							className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${styles.brandAvatar}`}
						>
							أ
						</div>
					</div>
				</header>

				{/* Content */}
				<main className="flex-1 p-4 lg:p-6">
					<div className="max-w-6xl mx-auto space-y-6">
						{/* Quick Stats */}
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
							{[
								{
									icon: ShoppingBag,
									label: isRTL ? 'الطلبات' : 'Orders',
									value: '12',
									color: '#FF6A00',
								},
								{
									icon: Heart,
									label: isRTL ? 'المفضلة' : 'Wishlist',
									value: '24',
									color: '#F44336',
								},
								{
									icon: Star,
									label: isRTL ? 'التقييمات' : 'Reviews',
									value: '8',
									color: '#FF9800',
								},
								{
									icon: Bell,
									label: isRTL ? 'الإشعارات' : 'Notifications',
									value: '3',
									color: '#1688C9',
								},
							].map((stat, i) => (
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
									{isRTL ? 'تتبع الطلبات' : 'Order Tracking'}
								</h3>
								<Link
									to="/customer/orders"
									className={`text-xs font-semibold hover:underline ${styles.linkOrange}`}
								>
									{isRTL ? 'عرض الكل' : 'View All'}
								</Link>
							</div>
							<div className="space-y-4">
								{recentOrders.map((order) => (
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
															#{order.id}
														</p>
														<StatusBadge
															status={order.status}
															label={
																isRTL
																	? order.statusLabel
																	: order.statusLabelEn
															}
														/>
													</div>
													<p
														className={`text-xs mt-0.5 ${styles.mutedText}`}
													>
														{isRTL ? order.dateAr : order.date} ·{' '}
														{order.items} {isRTL ? 'منتجات' : 'items'}
													</p>
												</div>
											</div>
											<p
												className={`text-sm font-bold ${styles.priceOrange}`}
											>
												{order.total}
											</p>
										</div>
										<OrderTimeline timeline={order.timeline} isRTL={isRTL} />
									</div>
								))}
							</div>
						</div>

						{/* Wishlist Grid */}
						<div className="bg-white rounded p-5 shadow-sm">
							<div className="flex items-center justify-between mb-4">
								<h3 className={`font-bold text-base ${styles.sectionTitle}`}>
									{isRTL ? 'المفضلة' : 'Wishlist'}
								</h3>
								<Link
									to="/customer/wishlist"
									className={`text-xs font-semibold hover:underline ${styles.linkOrange}`}
								>
									{isRTL ? 'عرض الكل' : 'View All'}
								</Link>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
								{wishlistItems.map((item) => (
									<div
										key={item.id}
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
											{isRTL ? item.name : item.nameEn}
										</p>
										<div className="flex items-center gap-2 mt-1">
											<Star
												className={`w-3 h-3 ${styles.ratingStar}`}
												strokeWidth={1.5}
											/>
											<span className={`text-xs ${styles.mutedText}`}>
												{item.rating}
											</span>
											<span className={`text-xs ${styles.mutedTextFaint}`}>
												({item.sold} {isRTL ? 'مباع' : 'sold'})
											</span>
										</div>
										<p
											className={`text-sm font-bold mt-2 ${styles.priceOrange}`}
										>
											{item.price}
										</p>
									</div>
								))}
							</div>
						</div>

						{/* Notifications */}
						<div className="bg-white rounded p-5 shadow-sm">
							<h3 className={`font-bold text-base mb-4 ${styles.sectionTitle}`}>
								{isRTL ? 'آخر الإشعارات' : 'Recent Notifications'}
							</h3>
							<div className="space-y-3">
								{notifications.map((n, i) => (
									<div
										key={i}
										className="flex items-start gap-3 p-3 rounded hover:bg-gray-50 transition-colors"
									>
										<div
											className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${styles.tile}`}
											style={
												{ '--tile-color': n.color } as React.CSSProperties
											}
										>
											<n.icon className="w-4 h-4" strokeWidth={1.5} />
										</div>
										<div className="flex-1">
											<p className={`text-xs ${styles.iconText}`}>
												{isRTL ? n.text : n.textEn}
											</p>
											<p
												className={`text-[10px] mt-0.5 ${styles.mutedTextFaint}`}
											>
												{n.time}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
