import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LayoutDashboard,
	Users,
	Store,
	ShoppingBag,
	DollarSign,
	AlertTriangle,
	BarChart3,
	Settings,
	Search,
	Bell,
	LogOut,
	Menu,
	X,
	ChevronLeft,
	ChevronRight,
	Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */
interface NavItem {
	id: string;
	labelKey: string;
	label: string;
	labelEn: string;
	icon: React.ElementType;
	badge?: string;
}

const navItems: NavItem[] = [
	{ id: 'overview', labelKey: 'admin.navDashboard', label: 'لوحة التحكم', labelEn: 'Dashboard', icon: LayoutDashboard },
	{ id: 'users', labelKey: 'admin.navUsers', label: 'المستخدمون', labelEn: 'Users', icon: Users },
	{ id: 'sellers', labelKey: 'admin.navSellers', label: 'التجار', labelEn: 'Sellers', icon: Store, badge: '5 pending' },
	{ id: 'orders', labelKey: 'admin.navOrders', label: 'الطلبات', labelEn: 'Orders', icon: ShoppingBag },
	{
		id: 'disputes',
		labelKey: 'admin.navDisputes',
		label: 'النزاعات',
		labelEn: 'Disputes',
		icon: AlertTriangle,
		badge: '8 active',
	},
	{ id: 'analytics', labelKey: 'admin.navAnalytics', label: 'التقارير', labelEn: 'Reports', icon: BarChart3 },
	{ id: 'settings', labelKey: 'admin.navSettings', label: 'الإعدادات', labelEn: 'Settings', icon: Settings },
];

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
const statsCards = [
	{
		icon: Users,
		label: 'المستخدمين',
		labelEn: 'Users',
		value: '12,450',
		change: '+8%',
		positive: true,
		color: '#FF6A00',
	},
	{
		icon: Store,
		label: 'التجار',
		labelEn: 'Sellers',
		value: '3,820',
		change: '+12%',
		positive: true,
		color: '#1688C9',
	},
	{
		icon: ShoppingBag,
		label: 'الطلبات',
		labelEn: 'Orders',
		value: '45,230',
		change: '+15%',
		positive: true,
		color: '#4CAF50',
	},
	{
		icon: DollarSign,
		label: 'الإيرادات',
		labelEn: 'Revenue',
		value: '$2.4M',
		change: '+22%',
		positive: true,
		color: '#9C27B0',
	},
];

const usersTable = [
	{
		name: 'محمد العبدلي',
		nameEn: 'Mohammed Al-Abdali',
		email: 'mohammed@email.com',
		role: 'seller',
		roleLabel: 'تاجر',
		roleLabelEn: 'Seller',
		status: 'active',
		joinDate: '2025-01-15',
	},
	{
		name: 'فاطمة السالمي',
		nameEn: 'Fatima Al-Salmi',
		email: 'fatima@email.com',
		role: 'buyer',
		roleLabel: 'مشتري',
		roleLabelEn: 'Buyer',
		status: 'active',
		joinDate: '2025-02-20',
	},
	{
		name: 'خالد الحضرمي',
		nameEn: 'Khaled Al-Hadrami',
		email: 'khaled@email.com',
		role: 'seller',
		roleLabel: 'تاجر',
		roleLabelEn: 'Seller',
		status: 'pending',
		joinDate: '2025-06-10',
	},
	{
		name: 'سمية القحطاني',
		nameEn: 'Samiya Al-Qahtani',
		email: 'samiya@email.com',
		role: 'buyer',
		roleLabel: 'مشتري',
		roleLabelEn: 'Buyer',
		status: 'active',
		joinDate: '2025-03-05',
	},
	{
		name: 'عبدالله المرازي',
		nameEn: 'Abdullah Al-Marazi',
		email: 'abdullah@email.com',
		role: 'seller',
		roleLabel: 'تاجر',
		roleLabelEn: 'Seller',
		status: 'suspended',
		joinDate: '2024-11-20',
	},
];

const sellersTable = [
	{
		store: 'متجر الأصالة',
		storeEn: 'Al-Asalah Store',
		owner: 'أحمد الكبسي',
		ownerEn: 'Ahmed Al-Kabsi',
		products: 142,
		sales: '$45K',
		status: 'verified',
	},
	{
		store: 'إلكترونيات اليمن',
		storeEn: 'Yemen Electronics',
		owner: 'نبيل الصنعاني',
		ownerEn: 'Nabil Al-Sanani',
		products: 89,
		sales: '$28K',
		status: 'pending',
	},
	{
		store: 'أزياء الشرق',
		storeEn: 'Orient Fashion',
		owner: 'ليلى الحداد',
		ownerEn: 'Laila Al-Hadad',
		products: 234,
		sales: '$67K',
		status: 'verified',
	},
];

const ordersTable = [
	{
		id: '#ORD-4521',
		customer: 'محمد العبدلي',
		customerEn: 'Mohammed Al-Abdali',
		seller: 'متجر الأصالة',
		amount: '$450',
		status: 'completed',
	},
	{
		id: '#ORD-4520',
		customer: 'فاطمة السالمي',
		customerEn: 'Fatima Al-Salmi',
		seller: 'إلكترونيات اليمن',
		amount: '$1,280',
		status: 'processing',
	},
	{
		id: '#ORD-4519',
		customer: 'خالد الحضرمي',
		customerEn: 'Khaled Al-Hadrami',
		seller: 'أزياء الشرق',
		amount: '$345',
		status: 'shipped',
	},
	{
		id: '#ORD-4518',
		customer: 'سمية القحطاني',
		customerEn: 'Samiya Al-Qahtani',
		seller: 'متجر الأصالة',
		amount: '$890',
		status: 'completed',
	},
];

const disputesTable = [
	{
		id: '#DSP-128',
		parties: 'محمد vs متجر الأصالة',
		partiesEn: 'Mohammed vs Al-Asalah',
		reason: 'منتج تالف',
		reasonEn: 'Damaged product',
		status: 'open',
		date: '2025-06-14',
	},
	{
		id: '#DSP-127',
		parties: 'فاطمة vs إلكترونيات اليمن',
		partiesEn: 'Fatima vs Yemen Electronics',
		reason: 'تأخر في الشحن',
		reasonEn: 'Shipping delay',
		status: 'resolved',
		date: '2025-06-12',
	},
	{
		id: '#DSP-126',
		parties: 'خالد vs أزياء الشرق',
		partiesEn: 'Khaled vs Orient Fashion',
		reason: 'منتج مخالف',
		reasonEn: 'Wrong product',
		status: 'open',
		date: '2025-06-10',
	},
];

const revenueChart = [
	{ month: 'Jan', monthAr: 'يناير', revenue: 180 },
	{ month: 'Feb', monthAr: 'فبراير', revenue: 220 },
	{ month: 'Mar', monthAr: 'مارس', revenue: 195 },
	{ month: 'Apr', monthAr: 'أبريل', revenue: 310 },
	{ month: 'May', monthAr: 'مايو', revenue: 265 },
	{ month: 'Jun', monthAr: 'يونيو', revenue: 350 },
];

const maxRev = Math.max(...revenueChart.map((d) => d.revenue));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function UserStatusBadge({ status, label }: { status: string; label: string }) {
	const colors: Record<string, string> = {
		active: 'bg-green-50 text-green-600',
		pending: 'bg-yellow-50 text-yellow-600',
		suspended: 'bg-red-50 text-red-600',
		verified: 'bg-green-50 text-green-600',
		open: 'bg-red-50 text-red-600',
		resolved: 'bg-green-50 text-green-600',
		completed: 'bg-green-50 text-green-600',
		processing: 'bg-yellow-50 text-yellow-600',
		shipped: 'bg-blue-50 text-blue-600',
	};
	return (
		<span
			className={cn(
				'px-2 py-0.5 rounded text-[11px] font-semibold',
				colors[status] || 'bg-gray-50 text-gray-600',
			)}
		>
			{label}
		</span>
	);
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function AdminDashboard() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const [activePage, setActivePage] = useState('overview');
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);

	const sidebarW = collapsed ? 'w-[72px]' : 'w-[260px]';

	const renderSidebarContent = () => (
		<>
			<div className="h-16 flex items-center px-4 border-b border-white/10">
				{collapsed ? (
					<div
						className="mx-auto w-9 h-9 rounded flex items-center justify-center"
						style={{ background: '#FF6A00' }}
					>
						<Shield className="w-5 h-5 text-white" strokeWidth={1.5} />
					</div>
				) : (
					<div className="flex items-center gap-3">
						<div
							className="w-9 h-9 rounded flex items-center justify-center"
							style={{ background: '#FF6A00' }}
						>
							<Shield className="w-5 h-5 text-white" strokeWidth={1.5} />
						</div>
						<div>
							<h1 className="text-white font-bold text-sm leading-tight">
								{isRTL ? 'نوف إكس' : 'Nouf-ex'}
							</h1>
							<p className="text-white/50 text-[10px]">
								{isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
							</p>
						</div>
					</div>
				)}
			</div>

			<nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
				{navItems.map((item) => {
					const active = activePage === item.id;
					return (
						<button
							key={item.id}
							onClick={() => setActivePage(item.id)}
							className={cn(
								'w-full flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 relative text-left',
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
										{t(item.labelKey)}
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
						</button>
					);
				})}
			</nav>

			<div className="p-3 border-t border-white/10">
				{!collapsed ? (
					<div className="flex items-center gap-3 px-3 mb-3">
						<div
							className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
							style={{ background: '#FF6A00' }}
						>
							م
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-white text-sm font-medium truncate">
								{isRTL ? 'محمد العنسي' : 'Mohammed Al-Anasi'}
							</p>
							<p className="text-white/50 text-[10px]">Super Admin</p>
						</div>
					</div>
				) : (
					<div
						className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-2"
						style={{ background: '#FF6A00' }}
					>
						م
					</div>
				)}
				{!collapsed ? (
					<button className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors w-full text-left">
						<LogOut className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.5} />
						<span className="text-xs text-red-400">{t('nav.logout')}</span>
					</button>
				) : (
					<button
						title={t('nav.logout', 'Logout')}
						aria-label={t('nav.logout', 'Logout')}
						className="w-9 h-9 rounded hover:bg-white/5 flex items-center justify-center mx-auto"
					>
						<LogOut className="w-4 h-4 text-red-400" strokeWidth={1.5} />
					</button>
				)}
			</div>
		</>
	);

	const renderOverview = () => (
		<div className="space-y-6">
			{/* Stats */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{statsCards.map((stat, i) => (
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

			{/* Chart */}
			<div className="bg-white rounded p-5 shadow-sm">
				<h3 className="font-bold text-base mb-4" style={{ color: '#333' }}>
					{t('admin.platformRevenue', 'Platform Revenue')}
				</h3>
				<div className="flex items-end gap-4 h-48">
					{revenueChart.map((d, i) => (
						<div key={i} className="flex-1 flex flex-col items-center gap-2">
							<span
								className="text-[10px] font-semibold"
								style={{ color: '#FF6A00' }}
							>
								${d.revenue}K
							</span>
							<div
								className="w-full rounded-t transition-all duration-500"
								style={{
									height: `${(d.revenue / maxRev) * 100}px`,
									background: i === 5 ? '#FF6A00' : '#FFD4B3',
									minHeight: '8px',
								}}
							/>
							<span className="text-[10px]" style={{ color: '#999' }}>
								{isRTL ? d.monthAr : d.month}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Quick tables */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Recent Users */}
				<div className="bg-white rounded shadow-sm overflow-hidden">
					<div className="p-5 border-b" style={{ borderColor: '#F0F2F5' }}>
						<h3 className="font-bold text-base" style={{ color: '#333' }}>
							{t('admin.recentUsers', 'Recent Users')}
						</h3>
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
										{isRTL ? 'المستخدم' : 'User'}
									</th>
									<th
										className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
										style={{ color: '#999' }}
									>
										{isRTL ? 'الدور' : 'Role'}
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
								{usersTable.slice(0, 4).map((u, i) => (
									<tr
										key={i}
										className="hover:bg-gray-50 transition-colors"
										style={{ borderBottom: '1px solid #F0F2F5' }}
									>
										<td className={cn('py-3', isRTL ? 'pr-4' : 'pl-4')}>
											<div className="flex items-center gap-3">
												<div
													className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
													style={{ background: '#FF6A00' }}
												>
													{(isRTL ? u.name : u.nameEn).charAt(0)}
												</div>
												<div>
													<p
														className="text-xs font-semibold"
														style={{ color: '#333' }}
													>
														{isRTL ? u.name : u.nameEn}
													</p>
													<p
														className="text-[10px]"
														style={{ color: '#999' }}
													>
														{u.email}
													</p>
												</div>
											</div>
										</td>
										<td className="py-3 px-3 text-xs" style={{ color: '#666' }}>
											{isRTL ? u.roleLabel : u.roleLabelEn}
										</td>
										<td className={cn('py-3', isRTL ? 'pl-4' : 'pr-4')}>
											<UserStatusBadge
												status={u.status}
												label={
													u.status === 'active'
														? isRTL
															? 'نشط'
															: 'Active'
														: u.status === 'pending'
															? isRTL
																? 'معلق'
																: 'Pending'
															: isRTL
																? 'موقوف'
																: 'Suspended'
												}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{/* Recent Orders */}
				<div className="bg-white rounded shadow-sm overflow-hidden">
					<div className="p-5 border-b" style={{ borderColor: '#F0F2F5' }}>
						<h3 className="font-bold text-base" style={{ color: '#333' }}>
							{t('admin.recentOrders', 'Recent Orders')}
						</h3>
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
										{isRTL ? 'الطلب' : 'Order'}
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
								{ordersTable.map((o, i) => (
									<tr
										key={i}
										className="hover:bg-gray-50 transition-colors"
										style={{ borderBottom: '1px solid #F0F2F5' }}
									>
										<td className={cn('py-3', isRTL ? 'pr-4' : 'pl-4')}>
											<p
												className="text-xs font-mono"
												style={{ color: '#333' }}
											>
												{o.id}
											</p>
											<p className="text-[10px]" style={{ color: '#999' }}>
												{isRTL ? o.customer : o.customerEn}
											</p>
										</td>
										<td
											className="py-3 px-3 text-xs font-semibold"
											style={{ color: '#333' }}
										>
											{o.amount}
										</td>
										<td className={cn('py-3', isRTL ? 'pl-4' : 'pr-4')}>
											<UserStatusBadge
												status={o.status}
												label={
													o.status === 'completed'
														? isRTL
															? 'مكتمل'
															: 'Completed'
														: o.status === 'processing'
															? isRTL
																? 'قيد المعالجة'
																: 'Processing'
															: isRTL
																? 'تم الشحن'
																: 'Shipped'
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
		</div>
	);

	const renderUsers = () => (
		<div className="bg-white rounded shadow-sm overflow-hidden">
			<div
				className="p-5 border-b flex items-center justify-between"
				style={{ borderColor: '#F0F2F5' }}
			>
				<h3 className="font-bold text-base" style={{ color: '#333' }}>
					{isRTL ? 'المستخدمون' : 'Users'}
				</h3>
				<div
					className="flex items-center rounded px-3 py-1.5 w-48"
					style={{ background: '#F0F2F5' }}
				>
					<Search className="w-4 h-4" style={{ color: '#999' }} strokeWidth={1.5} />
					<input
						type="text"
						placeholder={isRTL ? 'بحث...' : 'Search...'}
						className="bg-transparent border-none outline-none text-xs w-full ml-2"
						style={{ color: '#333' }}
					/>
				</div>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
							<th
								className={cn(
									'pb-3 pt-3 text-[11px] font-semibold',
									isRTL ? 'pr-4 text-right' : 'pl-4 text-left',
								)}
								style={{ color: '#999' }}
							>
								{isRTL ? 'المستخدم' : 'User'}
							</th>
							<th
								className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
								style={{ color: '#999' }}
							>
								{isRTL ? 'الدور' : 'Role'}
							</th>
							<th
								className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left hidden md:table-cell"
								style={{ color: '#999' }}
							>
								{isRTL ? 'تاريخ الانضمام' : 'Join Date'}
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
						{usersTable.map((u, i) => (
							<tr
								key={i}
								className="hover:bg-gray-50 transition-colors"
								style={{ borderBottom: '1px solid #F0F2F5' }}
							>
								<td className={cn('py-3', isRTL ? 'pr-4' : 'pl-4')}>
									<div className="flex items-center gap-3">
										<div
											className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
											style={{ background: '#FF6A00' }}
										>
											{(isRTL ? u.name : u.nameEn).charAt(0)}
										</div>
										<div>
											<p
												className="text-xs font-semibold"
												style={{ color: '#333' }}
											>
												{isRTL ? u.name : u.nameEn}
											</p>
											<p className="text-[10px]" style={{ color: '#999' }}>
												{u.email}
											</p>
										</div>
									</div>
								</td>
								<td className="py-3 px-3 text-xs" style={{ color: '#666' }}>
									{isRTL ? u.roleLabel : u.roleLabelEn}
								</td>
								<td
									className="py-3 px-3 text-xs hidden md:table-cell"
									style={{ color: '#999' }}
								>
									{u.joinDate}
								</td>
								<td className={cn('py-3', isRTL ? 'pl-4' : 'pr-4')}>
									<UserStatusBadge
										status={u.status}
										label={
											u.status === 'active'
												? isRTL
													? 'نشط'
													: 'Active'
												: u.status === 'pending'
													? isRTL
														? 'معلق'
														: 'Pending'
													: isRTL
														? 'موقوف'
														: 'Suspended'
										}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);

	const renderSellers = () => (
		<div className="bg-white rounded shadow-sm overflow-hidden">
			<div className="p-5 border-b" style={{ borderColor: '#F0F2F5' }}>
				<h3 className="font-bold text-base" style={{ color: '#333' }}>
					{isRTL ? 'التجار' : 'Sellers'}
				</h3>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
							<th
								className={cn(
									'pb-3 pt-3 text-[11px] font-semibold',
									isRTL ? 'pr-4 text-right' : 'pl-4 text-left',
								)}
								style={{ color: '#999' }}
							>
								{isRTL ? 'المتجر' : 'Store'}
							</th>
							<th
								className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
								style={{ color: '#999' }}
							>
								{isRTL ? 'المنتجات' : 'Products'}
							</th>
							<th
								className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
								style={{ color: '#999' }}
							>
								{isRTL ? 'المبيعات' : 'Sales'}
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
						{sellersTable.map((s, i) => (
							<tr
								key={i}
								className="hover:bg-gray-50 transition-colors"
								style={{ borderBottom: '1px solid #F0F2F5' }}
							>
								<td className={cn('py-3', isRTL ? 'pr-4' : 'pl-4')}>
									<p className="text-xs font-semibold" style={{ color: '#333' }}>
										{isRTL ? s.store : s.storeEn}
									</p>
									<p className="text-[10px]" style={{ color: '#999' }}>
										{isRTL ? s.owner : s.ownerEn}
									</p>
								</td>
								<td className="py-3 px-3 text-xs" style={{ color: '#666' }}>
									{s.products}
								</td>
								<td
									className="py-3 px-3 text-xs font-semibold"
									style={{ color: '#FF6A00' }}
								>
									{s.sales}
								</td>
								<td className={cn('py-3', isRTL ? 'pl-4' : 'pr-4')}>
									<UserStatusBadge
										status={s.status}
										label={
											s.status === 'verified'
												? isRTL
													? 'موثق'
													: 'Verified'
												: isRTL
													? 'قيد المراجعة'
													: 'Pending'
										}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);

	const renderOrders = () => (
		<div className="bg-white rounded shadow-sm overflow-hidden">
			<div className="p-5 border-b" style={{ borderColor: '#F0F2F5' }}>
				<h3 className="font-bold text-base" style={{ color: '#333' }}>
					{isRTL ? 'الطلبات' : 'Orders'}
				</h3>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
							<th
								className={cn(
									'pb-3 pt-3 text-[11px] font-semibold',
									isRTL ? 'pr-4 text-right' : 'pl-4 text-left',
								)}
								style={{ color: '#999' }}
							>
								{isRTL ? 'الطلب' : 'Order'}
							</th>
							<th
								className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
								style={{ color: '#999' }}
							>
								{t('admin.tableSeller', 'Seller')}
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
						{ordersTable.map((o, i) => (
							<tr
								key={i}
								className="hover:bg-gray-50 transition-colors"
								style={{ borderBottom: '1px solid #F0F2F5' }}
							>
								<td className={cn('py-3', isRTL ? 'pr-4' : 'pl-4')}>
									<p className="text-xs font-mono" style={{ color: '#333' }}>
										{o.id}
									</p>
									<p className="text-[10px]" style={{ color: '#999' }}>
										{isRTL ? o.customer : o.customerEn}
									</p>
								</td>
								<td className="py-3 px-3 text-xs" style={{ color: '#666' }}>
									{o.seller}
								</td>
								<td
									className="py-3 px-3 text-xs font-semibold"
									style={{ color: '#333' }}
								>
									{o.amount}
								</td>
								<td className={cn('py-3', isRTL ? 'pl-4' : 'pr-4')}>
									<UserStatusBadge
										status={o.status}
										label={
											o.status === 'completed'
												? isRTL
													? 'مكتمل'
													: 'Completed'
												: o.status === 'processing'
													? isRTL
														? 'قيد المعالجة'
														: 'Processing'
													: isRTL
														? 'تم الشحن'
														: 'Shipped'
										}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);

	const renderDisputes = () => (
		<div className="bg-white rounded shadow-sm overflow-hidden">
			<div className="p-5 border-b" style={{ borderColor: '#F0F2F5' }}>
				<h3 className="font-bold text-base" style={{ color: '#333' }}>
					{t('admin.disputesTitle', 'Disputes')}
				</h3>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
							<th
								className={cn(
									'pb-3 pt-3 text-[11px] font-semibold',
									isRTL ? 'pr-4 text-right' : 'pl-4 text-left',
								)}
								style={{ color: '#999' }}
							>
								{t('admin.tableDispute', 'Dispute')}
							</th>
							<th
								className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left"
								style={{ color: '#999' }}
							>
								{t('admin.tableReason', 'Reason')}
							</th>
							<th
								className="pb-3 pt-3 px-3 text-[11px] font-semibold text-left hidden md:table-cell"
								style={{ color: '#999' }}
							>
								{isRTL ? 'التاريخ' : 'Date'}
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
						{disputesTable.map((d, i) => (
							<tr
								key={i}
								className="hover:bg-gray-50 transition-colors"
								style={{ borderBottom: '1px solid #F0F2F5' }}
							>
								<td className={cn('py-3', isRTL ? 'pr-4' : 'pl-4')}>
									<p className="text-xs font-mono" style={{ color: '#333' }}>
										{d.id}
									</p>
									<p className="text-[10px]" style={{ color: '#999' }}>
										{isRTL ? d.parties : d.partiesEn}
									</p>
								</td>
								<td className="py-3 px-3 text-xs" style={{ color: '#666' }}>
									{isRTL ? d.reason : d.reasonEn}
								</td>
								<td
									className="py-3 px-3 text-xs hidden md:table-cell"
									style={{ color: '#999' }}
								>
									{d.date}
								</td>
								<td className={cn('py-3', isRTL ? 'pl-4' : 'pr-4')}>
									<UserStatusBadge
										status={d.status}
										label={
											d.status === 'open'
												? isRTL
													? 'مفتوح'
													: 'Open'
												: isRTL
													? 'محلول'
													: 'Resolved'
										}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);

	const renderPage = () => {
		switch (activePage) {
			case 'overview':
				return renderOverview();
			case 'users':
				return renderUsers();
			case 'sellers':
				return renderSellers();
			case 'orders':
				return renderOrders();
			case 'disputes':
				return renderDisputes();
			case 'analytics':
				return (
					<div className="bg-white rounded shadow-sm p-8 text-center">
						<BarChart3
							className="w-16 h-16 mx-auto mb-4"
							style={{ color: '#E5E5E5' }}
							strokeWidth={1.5}
						/>
						<h3 className="font-bold text-lg mb-2" style={{ color: '#333' }}>
							{isRTL ? 'التقارير والتحليلات' : 'Reports & Analytics'}
						</h3>
						<p className="text-sm" style={{ color: '#999' }}>
							{isRTL ? 'قريباً' : 'Coming soon'}
						</p>
					</div>
				);
			case 'settings':
				return (
					<div className="bg-white rounded shadow-sm p-8 text-center">
						<Settings
							className="w-16 h-16 mx-auto mb-4"
							style={{ color: '#E5E5E5' }}
							strokeWidth={1.5}
						/>
						<h3 className="font-bold text-lg mb-2" style={{ color: '#333' }}>
							{isRTL ? 'الإعدادات' : 'Settings'}
						</h3>
						<p className="text-sm" style={{ color: '#999' }}>
							{isRTL ? 'قريباً' : 'Coming soon'}
						</p>
					</div>
				);
			default:
				return renderOverview();
		}
	};

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
									<Shield className="w-5 h-5 text-white" strokeWidth={1.5} />
								</div>
								<div>
									<h1 className="text-white font-bold text-sm">
										{isRTL ? 'نوف إكس' : 'Nouf-ex'}
									</h1>
									<p className="text-white/50 text-[10px]">
										{isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
									</p>
								</div>
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
							{navItems.map((item) => {
								const active = activePage === item.id;
								return (
									<button
										key={item.id}
										onClick={() => {
											setActivePage(item.id);
											setMobileOpen(false);
										}}
										className={cn(
											'w-full flex items-center gap-3 px-3 py-3 rounded transition-all text-left',
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
											{t(item.labelKey)}
										</span>
										{item.badge && (
											<span
												className="px-1.5 py-0.5 rounded text-[10px] font-bold"
												style={{ background: '#FF6A00', color: 'white' }}
											>
												{item.badge}
											</span>
										)}
									</button>
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
					isRTL ? 'lg:mr-[260px]' : 'lg:ml-[260px]',
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
							<Menu className="w-5 h-5" style={{ color: '#333' }} strokeWidth={1.5} />
						</button>
						<button
							onClick={() => setCollapsed(!collapsed)}
							title={
								collapsed
									? t('common.expand', 'Expand')
									: t('common.collapse', 'Collapse')
							}
							aria-label={
								collapsed
									? t('common.expand', 'Expand')
									: t('common.collapse', 'Collapse')
							}
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
								{t(navItems.find((n) => n.id === activePage)?.labelKey ?? '')}
							</h2>
						</div>
					</div>

					<div className="flex items-center gap-2">
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
						<button
							title={t('seller.notifications', 'Notifications')}
							aria-label={t('seller.notifications', 'Notifications')}
							className="relative w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
						>
							<Bell className="w-5 h-5" style={{ color: '#666' }} strokeWidth={1.5} />
							<span
								className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
								style={{ background: '#FF6A00' }}
							>
								3
							</span>
						</button>
						<div
							className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
							style={{ background: '#FF6A00' }}
						>
							م
						</div>
					</div>
				</header>

				{/* Content */}
				<main className="flex-1 p-4 lg:p-6">
					<div className="max-w-7xl mx-auto">{renderPage()}</div>
				</main>
			</div>
		</div>
	);
}
