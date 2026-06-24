import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	LayoutDashboard,
	Package,
	ShoppingBag,
	MessageSquare,
	BarChart3,
	Megaphone,
	Settings,
	Search,
	Bell,
	LogOut,
	Menu,
	X,
	ChevronLeft,
	ChevronRight,
	DollarSign,
	Users,
	TrendingUp,
	ArrowLeft,
	Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Sidebar nav items                                                  */
/* ------------------------------------------------------------------ */
const sidebarNavItems = [
	{ icon: LayoutDashboard, label: 'لوحة المعلومات', labelEn: 'Dashboard', path: '/seller' },
	{
		icon: Package,
		label: 'المنتجات',
		labelEn: 'Products',
		path: '/seller/products',
		badge: '342',
	},
	{ icon: ShoppingBag, label: 'الطلبات', labelEn: 'Orders', path: '/seller/orders', badge: '12' },
	{
		icon: MessageSquare,
		label: 'الرسائل',
		labelEn: 'Messages',
		path: '/seller/reviews',
		badge: '8',
	},
	{ icon: BarChart3, label: 'التحليلات', labelEn: 'Analytics', path: '/seller/analytics' },
	{ icon: Megaphone, label: 'التسويق', labelEn: 'Marketing', path: '/seller/settings' },
	{ icon: Settings, label: 'الإعدادات', labelEn: 'Settings', path: '/seller/subscription' },
];

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const statsData = [
	{
		icon: DollarSign,
		label: 'الإيرادات',
		labelEn: 'Revenue',
		value: '$24,500',
		change: '+18%',
		positive: true,
		color: '#FF6A00',
	},
	{
		icon: ShoppingBag,
		label: 'الطلبات',
		labelEn: 'Orders',
		value: '124',
		change: '+8',
		positive: true,
		color: '#1688C9',
	},
	{
		icon: Users,
		label: 'الزوار',
		labelEn: 'Visitors',
		value: '8,420',
		change: '+12%',
		positive: true,
		color: '#4CAF50',
	},
	{
		icon: TrendingUp,
		label: 'التحويل',
		labelEn: 'Conversion',
		value: '3.2%',
		change: '-0.4%',
		positive: false,
		color: '#9C27B0',
	},
];

const recentOrders = [
	{
		id: '#1243',
		customer: 'محمد العبدلي',
		customerEn: 'Mohammed Al-Abdali',
		date: '2025-06-15',
		amount: '$450',
		status: 'new',
		statusLabel: 'جديد',
		statusLabelEn: 'New',
	},
	{
		id: '#1242',
		customer: 'فاطمة السالمي',
		customerEn: 'Fatima Al-Salmi',
		date: '2025-06-15',
		amount: '$1,280',
		status: 'processing',
		statusLabel: 'قيد المعالجة',
		statusLabelEn: 'Processing',
	},
	{
		id: '#1241',
		customer: 'خالد الحضرمي',
		customerEn: 'Khaled Al-Hadrami',
		date: '2025-06-14',
		amount: '$345',
		status: 'shipped',
		statusLabel: 'تم الشحن',
		statusLabelEn: 'Shipped',
	},
	{
		id: '#1240',
		customer: 'سمية القحطاني',
		customerEn: 'Samiya Al-Qahtani',
		date: '2025-06-14',
		amount: '$890',
		status: 'delivered',
		statusLabel: 'مكتمل',
		statusLabelEn: 'Delivered',
	},
	{
		id: '#1239',
		customer: 'عبدالله المرازي',
		customerEn: 'Abdullah Al-Marazi',
		date: '2025-06-13',
		amount: '$150',
		status: 'cancelled',
		statusLabel: 'ملغي',
		statusLabelEn: 'Cancelled',
	},
];

const chartData = [
	{ day: 'Sat', dayAr: 'السبت', revenue: 1800 },
	{ day: 'Sun', dayAr: 'الأحد', revenue: 2200 },
	{ day: 'Mon', dayAr: 'الإثنين', revenue: 1950 },
	{ day: 'Tue', dayAr: 'الثلاثاء', revenue: 3100 },
	{ day: 'Wed', dayAr: 'الأربعاء', revenue: 2650 },
	{ day: 'Thu', dayAr: 'الخميس', revenue: 3500 },
	{ day: 'Fri', dayAr: 'الجمعة', revenue: 3300 },
];

const maxRevenue = Math.max(...chartData.map((d) => d.revenue));

const notifications = [
	{ text: 'طلب جديد #1243', textEn: 'New order #1243', time: '5 min ago', unread: true },
	{
		text: 'تقييم جديد على منتجك',
		textEn: 'New review on your product',
		time: '2 hours ago',
		unread: true,
	},
	{ text: 'تنبيه: المخزون منخفض', textEn: 'Alert: Low stock', time: '4 hours ago', unread: true },
	{
		text: 'تم تحديث حالة الطلب #1240',
		textEn: 'Order #1240 status updated',
		time: 'Yesterday',
		unread: false,
	},
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function StatusBadge({ status, label }: { status: string; label: string }) {
	const colors: Record<string, string> = {
		new: 'bg-[#1688C9] text-white',
		processing: 'bg-[#FF9800] text-white',
		shipped: 'bg-[#4CAF50] text-white',
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
export default function SellerDashboard() {
	const { i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const location = useLocation();
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [notifOpen, setNotifOpen] = useState(false);

	const isActive = (path: string) => {
		if (path === '/seller') return location.pathname === '/seller';
		return location.pathname.startsWith(path);
	};

	const closeMobile = () => setMobileOpen(false);

	const sidebarW = collapsed ? 'w-[72px]' : 'w-[240px]';

	const renderSidebarContent = () => (
		<>
			{/* Logo */}
			<div className="h-16 flex items-center px-4 border-b border-white/10">
				{collapsed ? (
					<div
						className="mx-auto w-9 h-9 rounded flex items-center justify-center"
						style={{ background: '#FF6A00' }}
					>
						<span className="text-white font-bold text-sm">ن</span>
					</div>
				) : (
					<div className="flex items-center gap-3">
						<div
							className="w-9 h-9 rounded flex items-center justify-center"
							style={{ background: '#FF6A00' }}
						>
							<Globe className="w-5 h-5 text-white" strokeWidth={1.5} />
						</div>
						<div>
							<h1 className="text-white font-bold text-sm leading-tight">
								{isRTL ? 'نوف إكس' : 'Nouf-ex'}
							</h1>
							<p className="text-white/50 text-[10px]">
								{isRTL ? 'لوحة التاجر' : 'Seller Panel'}
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Nav */}
			<nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
				{sidebarNavItems.map((item) => {
					const active = isActive(item.path);
					return (
						<Link
							key={item.path}
							to={item.path}
							onClick={closeMobile}
							className={cn(
								'flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 relative group',
								active
									? 'text-white'
									: 'text-white/50 hover:text-white hover:bg-white/5',
							)}
							style={active ? { background: 'rgba(255,106,0,0.15)' } : {}}
						>
							{active && (
								<span
									className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full"
									style={{ background: '#FF6A00' }}
								/>
							)}
							<item.icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
							{!collapsed && (
								<>
									<span className="text-sm font-medium flex-1">
										{isRTL ? item.label : item.labelEn}
									</span>
									{item.badge && (
										<span
											className="px-1.5 py-0.5 rounded text-[10px] font-bold"
											style={{ background: '#FF6A00', color: 'white' }}
										>
											{item.badge}
										</span>
									)}
								</>
							)}
						</Link>
					);
				})}
			</nav>

			{/* Footer */}
			<div className="p-3 border-t border-white/10">
				{!collapsed ? (
					<button className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors w-full text-left">
						<LogOut className="w-4 h-4 text-[#F44336] shrink-0" strokeWidth={1.5} />
						<span className="text-xs text-[#F44336]">
							{isRTL ? 'تسجيل الخروج' : 'Logout'}
						</span>
					</button>
				) : (
					<button className="w-9 h-9 rounded hover:bg-white/5 flex items-center justify-center mx-auto">
						<LogOut className="w-4 h-4 text-[#F44336]" strokeWidth={1.5} />
					</button>
				)}
			</div>
		</>
	);

	return (
		<div
			className="min-h-[100dvh] flex"
			style={{ background: '#F0F2F5' }}
			dir={isRTL ? 'rtl' : 'ltr'}
		>
			{/* Desktop Sidebar */}
			<aside
				className={cn(
					'fixed top-0 bottom-0 z-40 hidden lg:flex flex-col transition-all duration-300',
					isRTL ? 'right-0' : 'left-0',
					sidebarW,
				)}
				style={{ background: '#001529' }}
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
						)}
						style={{ background: '#001529' }}
					>
						<div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
							<div className="flex items-center gap-3">
								<div
									className="w-9 h-9 rounded flex items-center justify-center"
									style={{ background: '#FF6A00' }}
								>
									<Globe className="w-5 h-5 text-white" strokeWidth={1.5} />
								</div>
								<div>
									<h1 className="text-white font-bold text-sm">
										{isRTL ? 'نوف إكس' : 'Nouf-ex'}
									</h1>
									<p className="text-white/50 text-[10px]">
										{isRTL ? 'لوحة التاجر' : 'Seller Panel'}
									</p>
								</div>
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
											'flex items-center gap-3 px-3 py-3 rounded transition-all',
											active
												? 'text-white'
												: 'text-white/50 hover:text-white hover:bg-white/5',
										)}
										style={active ? { background: 'rgba(255,106,0,0.15)' } : {}}
									>
										{active && (
											<span
												className={cn(
													'absolute top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full',
													isRTL ? 'right-0' : 'left-0',
												)}
												style={{ background: '#FF6A00' }}
											/>
										)}
										<item.icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
										<span className="text-sm font-medium flex-1">
											{isRTL ? item.label : item.labelEn}
										</span>
										{item.badge && (
											<span
												className="px-1.5 py-0.5 rounded text-[10px] font-bold"
												style={{ background: '#FF6A00', color: 'white' }}
											>
												{item.badge}
											</span>
										)}
									</Link>
								);
							})}
						</nav>
					</div>
				</div>
			)}

			{/* Main Content */}
			<div
				className={cn(
					'flex-1 min-h-[100dvh] flex flex-col transition-all duration-300',
					isRTL ? 'lg:mr-[240px]' : 'lg:ml-[240px]',
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
							<Menu className="w-5 h-5" style={{ color: '#333' }} strokeWidth={1.5} />
						</button>
						<button
							onClick={() => setCollapsed(!collapsed)}
							className="hidden lg:flex w-9 h-9 items-center justify-center rounded hover:bg-gray-100 transition-colors"
						>
							{collapsed ? (
								<ChevronRight className="w-4 h-4" style={{ color: '#666' }} />
							) : (
								<ChevronLeft className="w-4 h-4" style={{ color: '#666' }} />
							)}
						</button>
						<div>
							<h2 className="font-bold text-base" style={{ color: '#333' }}>
								{isRTL ? 'لوحة المعلومات' : 'Dashboard'}
							</h2>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* Search */}
						<div
							className="hidden md:flex items-center rounded px-3 py-2 w-56"
							style={{ background: '#F0F2F5' }}
						>
							<Search
								className="w-4 h-4"
								style={{ color: '#999' }}
								strokeWidth={1.5}
							/>
							<input
								type="text"
								placeholder={isRTL ? 'بحث...' : 'Search...'}
								className="bg-transparent border-none outline-none text-sm w-full ml-2"
								style={{ color: '#333' }}
							/>
						</div>

						{/* Notifications */}
						<div className="relative">
							<button
								onClick={() => setNotifOpen(!notifOpen)}
								className="relative w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
							>
								<Bell
									className="w-5 h-5"
									style={{ color: '#666' }}
									strokeWidth={1.5}
								/>
								<span
									className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
									style={{ background: '#FF6A00' }}
								>
									3
								</span>
							</button>
							{notifOpen && (
								<>
									<div
										className="fixed inset-0 z-40"
										onClick={() => setNotifOpen(false)}
									/>
									<div
										className={cn(
											'absolute top-full mt-2 w-80 bg-white rounded shadow-lg border z-50 overflow-hidden',
											isRTL ? 'left-0' : 'right-0',
										)}
										style={{ borderColor: '#E5E5E5' }}
									>
										<div
											className="p-3 border-b flex items-center justify-between"
											style={{ borderColor: '#E5E5E5' }}
										>
											<h3
												className="font-semibold text-sm"
												style={{ color: '#333' }}
											>
												{isRTL ? 'الإشعارات' : 'Notifications'}
											</h3>
											<span
												className="text-[10px] cursor-pointer"
												style={{ color: '#FF6A00' }}
											>
												{isRTL ? 'تحديد الكل' : 'Mark all read'}
											</span>
										</div>
										<div className="max-h-64 overflow-y-auto">
											{notifications.map((n, i) => (
												<div
													key={i}
													className="p-3 border-b hover:bg-gray-50 transition-colors cursor-pointer"
													style={{
														borderColor: '#F0F2F5',
														background: n.unread
															? '#FFF5EB'
															: 'transparent',
													}}
												>
													<div className="flex items-start gap-2">
														{n.unread && (
															<span
																className="w-2 h-2 rounded-full mt-1 shrink-0"
																style={{ background: '#FF6A00' }}
															/>
														)}
														<div>
															<p
																className="text-xs"
																style={{ color: '#333' }}
															>
																{isRTL ? n.text : n.textEn}
															</p>
															<p
																className="text-[10px] mt-0.5"
																style={{ color: '#999' }}
															>
																{n.time}
															</p>
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
								</>
							)}
						</div>

						{/* Profile */}
						<div
							className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
							style={{ background: '#FF6A00' }}
						>
							أ
						</div>
					</div>
				</header>

				{/* Dashboard Content */}
				<main className="flex-1 p-4 lg:p-6">
					<div className="max-w-7xl mx-auto space-y-6">
						{/* Stats Cards */}
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
							{statsData.map((stat, i) => (
								<div key={i} className="bg-white rounded p-5 shadow-sm">
									<div className="flex items-start justify-between mb-3">
										<div
											className="w-10 h-10 rounded flex items-center justify-center"
											style={{ background: `${stat.color}15` }}
										>
											<stat.icon
												className="w-5 h-5"
												style={{ color: stat.color }}
												strokeWidth={1.5}
											/>
										</div>
										<span
											className={cn(
												'text-[11px] font-semibold px-1.5 py-0.5 rounded',
												stat.positive
													? 'bg-green-50 text-green-600'
													: 'bg-red-50 text-red-600',
											)}
										>
											{stat.change}
										</span>
									</div>
									<p className="text-xs mb-1" style={{ color: '#666' }}>
										{isRTL ? stat.label : stat.labelEn}
									</p>
									<p className="text-xl font-bold" style={{ color: '#333' }}>
										{stat.value}
									</p>
								</div>
							))}
						</div>

						{/* Charts + Notifications Row */}
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Bar Chart */}
							<div className="lg:col-span-2 bg-white rounded p-5 shadow-sm">
								<div className="flex items-center justify-between mb-4">
									<h3 className="font-bold text-base" style={{ color: '#333' }}>
										{isRTL ? 'أداء المنتجات' : 'Product Performance'}
									</h3>
									<div
										className="flex items-center gap-1 rounded p-1"
										style={{ background: '#F0F2F5' }}
									>
										{['week', 'month', 'year'].map((p) => (
											<button
												key={p}
												className="px-3 py-1 rounded text-xs font-semibold transition-all"
												style={{
													background:
														p === 'week' ? '#FF6A00' : 'transparent',
													color: p === 'week' ? 'white' : '#666',
												}}
											>
												{p === 'week'
													? isRTL
														? 'أسبوع'
														: 'Week'
													: p === 'month'
														? isRTL
															? 'شهر'
															: 'Month'
														: isRTL
															? 'سنة'
															: 'Year'}
											</button>
										))}
									</div>
								</div>
								<div className="flex items-end gap-3 h-48">
									{chartData.map((d, i) => (
										<div
											key={i}
											className="flex-1 flex flex-col items-center gap-2"
										>
											<div className="w-full flex flex-col items-center">
												<span
													className="text-[10px] font-semibold mb-1"
													style={{ color: '#FF6A00' }}
												>
													${d.revenue}
												</span>
												<div
													className="w-full rounded-t transition-all duration-500"
													style={{
														height: `${(d.revenue / maxRevenue) * 120}px`,
														background: i === 5 ? '#FF6A00' : '#FFD4B3',
														minHeight: '8px',
													}}
												/>
											</div>
											<span className="text-[10px]" style={{ color: '#999' }}>
												{isRTL ? d.dayAr : d.day}
											</span>
										</div>
									))}
								</div>
							</div>

							{/* Notifications List */}
							<div className="bg-white rounded p-5 shadow-sm">
								<h3 className="font-bold text-base mb-4" style={{ color: '#333' }}>
									{isRTL ? 'الإشعارات' : 'Notifications'}
								</h3>
								<div className="space-y-3">
									{notifications.map((n, i) => (
										<div
											key={i}
											className="flex items-start gap-3 p-3 rounded transition-colors hover:bg-gray-50"
											style={{
												background: n.unread ? '#FFF5EB' : 'transparent',
											}}
										>
											<div
												className="w-2 h-2 rounded-full mt-1.5 shrink-0"
												style={{
													background: n.unread ? '#FF6A00' : '#E5E5E5',
												}}
											/>
											<div className="flex-1">
												<p className="text-xs" style={{ color: '#333' }}>
													{isRTL ? n.text : n.textEn}
												</p>
												<p
													className="text-[10px] mt-0.5"
													style={{ color: '#999' }}
												>
													{n.time}
												</p>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Recent Orders Table */}
						<div className="bg-white rounded shadow-sm overflow-hidden">
							<div
								className="p-5 border-b flex items-center justify-between"
								style={{ borderColor: '#F0F2F5' }}
							>
								<h3 className="font-bold text-base" style={{ color: '#333' }}>
									{isRTL ? 'أحدث الطلبات' : 'Recent Orders'}
								</h3>
								<Link
									to="/seller/orders"
									className="flex items-center gap-1 text-xs font-semibold hover:underline"
									style={{ color: '#FF6A00' }}
								>
									{isRTL ? 'عرض الكل' : 'View All'}
									<ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
								</Link>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr style={{ borderBottom: '1px solid #F0F2F5' }}>
											<th
												className={cn(
													'pb-3 pt-3 text-[11px] font-semibold',
													isRTL ? 'pr-4 text-right' : 'pl-4 text-left',
												)}
												style={{ color: '#999' }}
											>
												{isRTL ? 'رقم الطلب' : 'Order #'}
											</th>
											<th
												className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
												style={{ color: '#999' }}
											>
												{isRTL ? 'العميل' : 'Customer'}
											</th>
											<th
												className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left hidden md:table-cell"
												style={{ color: '#999' }}
											>
												{isRTL ? 'التاريخ' : 'Date'}
											</th>
											<th
												className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
												style={{ color: '#999' }}
											>
												{isRTL ? 'المبلغ' : 'Amount'}
											</th>
											<th
												className={cn(
													'pb-3 pt-3 text-[11px] font-semibold',
													isRTL ? 'pl-4 text-left' : 'pr-4 text-right',
												)}
												style={{ color: '#999' }}
											>
												{isRTL ? 'الحالة' : 'Status'}
											</th>
										</tr>
									</thead>
									<tbody>
										{recentOrders.map((order, i) => (
											<tr
												key={i}
												className="hover:bg-gray-50 transition-colors"
												style={{ borderBottom: '1px solid #F0F2F5' }}
											>
												<td
													className={cn(
														'py-3 text-xs font-mono',
														isRTL ? 'pr-4' : 'pl-4',
													)}
													style={{ color: '#333' }}
												>
													{order.id}
												</td>
												<td
													className="py-3 px-3 text-xs"
													style={{ color: '#333' }}
												>
													{isRTL ? order.customer : order.customerEn}
												</td>
												<td
													className="py-3 px-3 text-xs hidden md:table-cell"
													style={{ color: '#666' }}
												>
													{order.date}
												</td>
												<td
													className="py-3 px-3 text-xs font-semibold"
													style={{ color: '#333' }}
												>
													{order.amount}
												</td>
												<td
													className={cn(
														'py-3',
														isRTL
															? 'pl-4 text-left'
															: 'pr-4 text-right',
													)}
												>
													<StatusBadge
														status={order.status}
														label={
															isRTL
																? order.statusLabel
																: order.statusLabelEn
														}
													/>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
