import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
	LayoutDashboard,
	Package,
	ShoppingBag,
	BarChart3,
	MessageSquare,
	Settings,
	CreditCard,
	LogOut,
	ChevronLeft,
	ChevronRight,
	Search,
	Bell,
	Plus,
	Menu,
	X,
	Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
	icon: typeof LayoutDashboard;
	labelKey: string;
	path: string;
	badge?: string | null;
	badgeKey?: string;
	badgeParams?: Record<string, string | number>;
	badgeColor?: 'red';
};

type MobileTab = {
	icon: typeof LayoutDashboard;
	labelKey: string;
	path: string | null;
};

const navItems: NavItem[] = [
	{ icon: LayoutDashboard, labelKey: 'seller.dashboard', path: '/seller', badge: null },
	{
		icon: Package,
		labelKey: 'seller.products',
		path: '/seller/products',
		badgeKey: '342',
	},
	{
		icon: ShoppingBag,
		labelKey: 'seller.orders',
		path: '/seller/orders',
		badgeKey: '12',
		badgeColor: 'red',
	},
	{ icon: BarChart3, labelKey: 'seller.analytics', path: '/seller/analytics', badge: null },
	{
		icon: MessageSquare,
		labelKey: 'seller.reviews',
		path: '/seller/reviews',
		badgeKey: 'seller.newReviewsBadge',
		badgeParams: { count: 8 },
	},
	{
		icon: Settings,
		labelKey: 'seller.storeSettings',
		path: '/seller/settings',
		badge: null,
	},
	{
		icon: CreditCard,
		labelKey: 'seller.subscription',
		path: '/seller/subscription',
		badge: null,
	},
];

const mobileTabs: MobileTab[] = [
	{ icon: LayoutDashboard, labelKey: 'seller.home', path: '/seller' },
	{ icon: Package, labelKey: 'seller.products', path: '/seller/products' },
	{ icon: ShoppingBag, labelKey: 'seller.orders', path: '/seller/orders' },
	{ icon: MessageSquare, labelKey: 'seller.reviews', path: '/seller/reviews' },
	{ icon: Menu, labelKey: 'seller.more', path: null },
];

interface DashboardShellProps {
	children: ReactNode;
	title: string;
	breadcrumb?: string;
}

export default function DashboardShell({ children, title, breadcrumb }: DashboardShellProps) {
	const { t } = useTranslation();
	const location = useLocation();
	const [collapsed, setCollapsed] = useState(false);
	const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
	const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);

	const isActive = (path: string) => {
		if (path === '/seller') return location.pathname === '/seller';
		return location.pathname.startsWith(path);
	};

	const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

	return (
		<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
			{/* Desktop Sidebar */}
			<aside
				className={cn(
					'fixed top-0 bottom-0 right-0 z-40 bg-[#1A1612] border-l border-[rgba(212,168,83,0.1)] transition-all duration-300 hidden md:flex flex-col',
					sidebarWidth,
				)}
			>
				{/* Sidebar Header */}
				<div className="h-16 flex items-center justify-between px-4 border-b border-[rgba(255,255,255,0.06)]">
					{!collapsed && (
						<Link to="/" className="flex items-center gap-2">
							<img src="/noufex-logo.svg" alt="نوف-إكس" className="h-8" />
						</Link>
					)}
					{collapsed && (
						<Link to="/" className="mx-auto">
							<div className="w-8 h-8 rounded-lg bg-[#D4A853] flex items-center justify-center">
								<span className="text-[#1A1612] font-amiri font-bold text-sm">
									ن
								</span>
							</div>
						</Link>
					)}
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
						className="w-7 h-7 rounded-lg bg-[rgba(212,168,83,0.15)] hover:bg-[rgba(212,168,83,0.25)] flex items-center justify-center transition-colors"
					>
						{collapsed ? (
							<ChevronLeft className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
						) : (
							<ChevronRight className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
						)}
					</button>
				</div>

				{/* Navigation Menu */}
				<nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
					{navItems.map((item) => {
						const active = isActive(item.path);
						return (
							<Link
								key={item.path}
								to={item.path}
								onClick={() => {
									setMobileDrawerOpen(false);
									setMobileMoreOpen(false);
								}}
								className={cn(
									'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group',
									active
										? 'bg-[rgba(212,168,83,0.15)] text-[#D4A853]'
										: 'text-[#AAAAAA] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F5F5F0]',
								)}
							>
								{active && (
									<motion.div
										layoutId="activeIndicator"
										className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#D4A853] rounded-l-full"
										transition={{ type: 'spring', stiffness: 300, damping: 30 }}
									/>
								)}
								<item.icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
								{!collapsed && (
									<>
										<span className="text-sm font-cairo font-medium flex-1">
											{t(item.labelKey)}
										</span>
									{(item.badgeKey || item.badge) && (
										<span
											className={cn(
												'px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0',
												item.badgeColor === 'red'
													? 'bg-[#EF4444] text-white'
													: 'bg-[rgba(212,168,83,0.2)] text-[#D4A853]',
											)}
										>
											{item.badgeKey
												? t(item.badgeKey, item.badgeParams ?? {})
												: item.badge}
										</span>
									)}
									</>
								)}
							</Link>
						);
					})}
				</nav>

				{/* Sidebar Footer */}
				{!collapsed ? (
					<div className="p-3 border-t border-[rgba(255,255,255,0.06)] space-y-2">
						<Link
							to="/store/1"
							className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[rgba(255,255,255,0.06)] transition-colors"
						>
							<div className="w-8 h-8 rounded-full bg-[#D4A853] flex items-center justify-center shrink-0">
								<Store className="w-4 h-4 text-[#1A1612]" strokeWidth={1.5} />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-xs font-cairo font-semibold text-[#F5F5F0] truncate">
									{t('seller.storeNameDefault', 'Al-Asalah Store')}
								</p>
								<p className="text-[10px] text-[#AAAAAA]">
									{t('seller.viewStore', 'View Store')}
								</p>
							</div>
						</Link>
						<button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[rgba(255,255,255,0.06)] transition-colors w-full text-right">
							<LogOut className="w-4 h-4 text-[#EF4444] shrink-0" strokeWidth={1.5} />
							<span className="text-xs font-cairo text-[#EF4444]">
								{t('seller.logout', 'Logout')}
							</span>
						</button>
					</div>
				) : (
					<div className="p-2 border-t border-[rgba(255,255,255,0.06)] flex flex-col items-center gap-2">
						<div className="w-8 h-8 rounded-full bg-[#D4A853] flex items-center justify-center">
							<Store className="w-4 h-4 text-[#1A1612]" strokeWidth={1.5} />
						</div>
						<button
							title={t('seller.logout', 'Logout')}
							aria-label={t('seller.logout', 'Logout')}
							className="w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.06)] flex items-center justify-center"
						>
							<LogOut className="w-4 h-4 text-[#EF4444]" strokeWidth={1.5} />
						</button>
					</div>
				)}
			</aside>

			{/* Top Bar */}
			<header
				className={cn(
					'fixed top-0 left-0 h-16 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] z-30 flex items-center transition-all duration-300 hidden md:flex',
					collapsed ? 'right-[72px]' : 'right-[260px]',
				)}
			>
				<div className="w-full px-6 flex items-center justify-between">
					<div>
						<h1 className="text-lg font-amiri font-bold text-[#1A1612]">{title}</h1>
						{breadcrumb && (
							<p className="text-xs text-[#AAAAAA] font-cairo">{breadcrumb}</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						<button
							title={t('common.search', 'Search')}
							aria-label={t('common.search', 'Search')}
							className="w-9 h-9 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center transition-colors"
						>
							<Search
								className="w-[18px] h-[18px] text-[#6B6B6B]"
								strokeWidth={1.5}
							/>
						</button>
						<div className="relative">
							<button
								onClick={() => setNotificationsOpen(!notificationsOpen)}
								className="w-9 h-9 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center transition-colors relative"
							>
								<Bell
									className="w-[18px] h-[18px] text-[#6B6B6B]"
									strokeWidth={1.5}
								/>
								<span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-[#EF4444] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
									٣
								</span>
							</button>
							<AnimatePresence>
								{notificationsOpen && (
									<>
										<div
											className="fixed inset-0 z-40"
											onClick={() => setNotificationsOpen(false)}
										/>
										<motion.div
											initial={{ opacity: 0, y: -10, scale: 0.95 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: -10, scale: 0.95 }}
											transition={{ duration: 0.15 }}
											className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#F3EDE4] z-50 overflow-hidden"
										>
											<div className="p-4 border-b border-[#F3EDE4] flex items-center justify-between">
												<h3 className="font-cairo font-semibold text-sm text-[#111111]">
													{t('seller.notifications', 'Notifications')}
												</h3>
												<span className="text-[10px] text-[#D4A853] cursor-pointer">
													{t('seller.markAllRead', 'Mark all read')}
												</span>
											</div>
											<div className="max-h-72 overflow-y-auto">
												{[
													{
														text: 'طلب جديد #١٢٤٣',
														time: 'قبل ٥ دقائق',
														unread: true,
													},
													{
														text: 'تقييم جديد على منتجك',
														time: 'قبل ٢ ساعة',
														unread: true,
													},
													{
														text: 'تنبيه: المخزون منخفض',
														time: 'قبل ٤ ساعات',
														unread: true,
													},
													{
														text: 'تم تحديث حالة الطلب #١٢٤٠',
														time: 'أمس',
														unread: false,
													},
												].map((notif, i) => (
													<div
														key={i}
														className={cn(
															'p-3 border-b border-[#F3EDE4] hover:bg-[#F8F8F8] transition-colors cursor-pointer',
															notif.unread &&
																'bg-[rgba(212,168,83,0.05)]',
														)}
													>
														<div className="flex items-start gap-2">
															{notif.unread && (
																<span className="w-2 h-2 rounded-full bg-[#D4A853] mt-1.5 shrink-0" />
															)}
															<div>
																<p className="text-xs font-cairo text-[#111111]">
																	{notif.text}
																</p>
																<p className="text-[10px] text-[#AAAAAA] mt-0.5">
																	{notif.time}
																</p>
															</div>
														</div>
													</div>
												))}
											</div>
										</motion.div>
									</>
								)}
							</AnimatePresence>
						</div>
						<Link
							to="/seller/products"
							className="w-9 h-9 rounded-xl bg-[#D4A853] hover:bg-[#c49a48] flex items-center justify-center transition-colors"
						>
							<Plus className="w-[18px] h-[18px] text-[#1A1612]" strokeWidth={1.5} />
						</Link>
						<div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4A853] to-[#8B6914] flex items-center justify-center mr-1">
							<span className="text-white text-xs font-bold font-cairo">أ</span>
						</div>
					</div>
				</div>
			</header>

			{/* Mobile Top Bar */}
			<header className="fixed top-0 left-0 right-0 h-14 bg-white shadow-sm z-30 flex md:hidden items-center px-4 justify-between">
				<button
					onClick={() => setMobileDrawerOpen(true)}
					title={t('common.menu', 'Menu')}
					aria-label={t('common.menu', 'Menu')}
					className="w-9 h-9 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center"
				>
					<Menu className="w-5 h-5 text-[#111111]" strokeWidth={1.5} />
				</button>
				<h1 className="text-base font-amiri font-bold text-[#1A1612]">{title}</h1>
				<div className="flex items-center gap-1">
					<button
						title={t('seller.notifications', 'Notifications')}
						aria-label={t('seller.notifications', 'Notifications')}
						className="w-9 h-9 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center relative"
					>
						<Bell className="w-[18px] h-[18px] text-[#6B6B6B]" strokeWidth={1.5} />
						<span className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 bg-[#EF4444] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
							٣
						</span>
					</button>
					<div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4A853] to-[#8B6914] flex items-center justify-center">
						<span className="text-white text-[10px] font-bold font-cairo">أ</span>
					</div>
				</div>
			</header>

			{/* Mobile Sidebar Drawer */}
			<AnimatePresence>
				{mobileDrawerOpen && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="fixed inset-0 bg-black/40 z-50 md:hidden"
							onClick={() => setMobileDrawerOpen(false)}
						/>
						<motion.div
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ type: 'spring', damping: 25, stiffness: 200 }}
							className="fixed top-0 right-0 bottom-0 w-[280px] max-w-[85vw] bg-[#1A1612] z-50 md:hidden flex flex-col"
						>
							<div className="h-14 flex items-center justify-between px-4 border-b border-[rgba(255,255,255,0.06)]">
								<img src="/noufex-logo.svg" alt="نوف-إكس" className="h-8" />
								<button
									onClick={() => setMobileDrawerOpen(false)}
									title={t('common.close', 'Close')}
									aria-label={t('common.close', 'Close')}
									className="w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.06)] flex items-center justify-center"
								>
									<X className="w-5 h-5 text-[#AAAAAA]" strokeWidth={1.5} />
								</button>
							</div>
							<nav className="flex-1 py-4 px-3 space-y-1">
								{navItems.map((item) => {
									const active = isActive(item.path);
									return (
										<Link
											key={item.path}
											to={item.path}
											onClick={() => {
												setMobileDrawerOpen(false);
												setMobileMoreOpen(false);
											}}
											className={cn(
												'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
												active
													? 'bg-[rgba(212,168,83,0.15)] text-[#D4A853]'
													: 'text-[#AAAAAA] hover:bg-[rgba(255,255,255,0.06)]',
											)}
										>
											<item.icon className="w-5 h-5" strokeWidth={1.5} />
											<span className="text-sm font-cairo font-medium flex-1">
												{t(item.labelKey)}
											</span>
											{item.badge && (
												<span
													className={cn(
														'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
														item.badgeColor === 'red'
															? 'bg-[#EF4444] text-white'
															: 'bg-[rgba(212,168,83,0.2)] text-[#D4A853]',
													)}
												>
													{item.badgeKey
														? t(item.badgeKey, item.badgeParams ?? {})
														: item.badge}
												</span>
											)}
										</Link>
									);
								})}
							</nav>
							<div className="p-3 border-t border-[rgba(255,255,255,0.06)]">
								<button className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.06)] transition-colors w-full text-right">
									<LogOut className="w-4 h-4 text-[#EF4444]" strokeWidth={1.5} />
									<span className="text-sm font-cairo text-[#EF4444]">
										{t('seller.logout', 'Logout')}
									</span>
								</button>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			{/* Main Content */}
			<main
				className={cn(
					'pt-14 md:pt-16 pb-20 md:pb-6 px-4 md:px-6 min-h-[100dvh] transition-all duration-300',
					collapsed ? 'md:mr-[72px]' : 'md:mr-[260px]',
				)}
			>
				{children}
			</main>

			{/* Mobile Bottom Navigation */}
			<nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#F3EDE4] z-30 flex md:hidden items-center justify-around pb-safe">
				{mobileTabs.map((tab) => {
					const active = tab.path ? isActive(tab.path) : mobileMoreOpen;
					if (tab.labelKey === 'seller.more') {
						return (
							<button
								key={tab.labelKey}
								onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
								className={cn(
									'flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors',
									active ? 'text-[#D4A853]' : 'text-[#AAAAAA]',
								)}
							>
								<tab.icon className="w-5 h-5" strokeWidth={1.5} />
								<span className="text-[10px] font-cairo font-medium">
									{t(tab.labelKey)}
								</span>
							</button>
						);
					}
					return (
						<Link
							key={tab.path}
							to={tab.path!}
							className={cn(
								'flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors',
								active ? 'text-[#D4A853]' : 'text-[#AAAAAA]',
							)}
						>
							<tab.icon className="w-5 h-5" strokeWidth={1.5} />
							<span className="text-[10px] font-cairo font-medium">
								{t(tab.labelKey)}
							</span>
							{tab.path === '/seller/orders' && (
								<span className="absolute top-2 mr-4 w-2 h-2 rounded-full bg-[#EF4444]" />
							)}
						</Link>
					);
				})}
			</nav>

			{/* Mobile More Menu */}
			<AnimatePresence>
				{mobileMoreOpen && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="fixed inset-0 bg-black/30 z-40 md:hidden"
							onClick={() => setMobileMoreOpen(false)}
						/>
						<motion.div
							initial={{ y: '100%' }}
							animate={{ y: 0 }}
							exit={{ y: '100%' }}
							transition={{ type: 'spring', damping: 25, stiffness: 200 }}
							className="fixed bottom-16 left-4 right-4 bg-white rounded-2xl shadow-xl z-50 md:hidden p-4 space-y-1"
						>
							{navItems.slice(3).map((item) => (
								<Link
									key={item.path}
									to={item.path}
									onClick={() => {
										setMobileDrawerOpen(false);
										setMobileMoreOpen(false);
									}}
									className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#F8F8F8] transition-colors text-[#111111]"
								>
									<item.icon
										className="w-5 h-5 text-[#6B6B6B]"
										strokeWidth={1.5}
									/>
									<span className="text-sm font-cairo font-medium">
										{t(item.labelKey)}
									</span>
								</Link>
							))}
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
}
