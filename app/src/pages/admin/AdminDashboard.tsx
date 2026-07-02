/**
 * Admin Shell
 *
 * Sidebar + Outlet layout for /admin/*. The legacy version of this file
 * was a single-page SPA with 100% mock data and internal tab routing.
 * It was rewritten in 2026-07-02 to:
 *   1. Use real router <Link>s to the dedicated admin pages
 *      (/admin/users, /admin/stores, /admin/all-products, etc.)
 *   2. Render nested route content via <Outlet /> instead of internal
 *      `renderXxx()` functions fed by hard-coded arrays
 *   3. Use the t() / i18n keys exclusively (no inline label/labelEn props)
 *   4. Wire logout through the real auth context
 *
 * The default `/admin` URL now redirects to `/admin/overview` via the
 * index route declared in App.tsx.
 */
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	LayoutDashboard,
	Users,
	Store,
	Package,
	ShoppingBag,
	AlertTriangle,
	BarChart3,
	FileText,
	Settings,
	Menu,
	X,
	ChevronLeft,
	ChevronRight,
	Shield,
	LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AppContext';

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */
interface NavItem {
	to: string;
	labelKey: string;
	icon: React.ElementType;
}

const navItems: NavItem[] = [
	{ to: '/admin/overview', labelKey: 'admin.navOverview', icon: LayoutDashboard },
	{ to: '/admin/users', labelKey: 'admin.navUsers', icon: Users },
	{ to: '/admin/stores', labelKey: 'admin.navStores', icon: Store },
	{ to: '/admin/all-products', labelKey: 'admin.navProducts', icon: Package },
	{ to: '/admin/all-orders', labelKey: 'admin.navOrders', icon: ShoppingBag },
	{ to: '/admin/disputes', labelKey: 'admin.navDisputes', icon: AlertTriangle },
	{ to: '/admin/reports', labelKey: 'admin.navAnalytics', icon: BarChart3 },
	{ to: '/admin/audit-log', labelKey: 'admin.navAuditLog', icon: FileText },
	{ to: '/admin/settings', labelKey: 'admin.navSettings', icon: Settings },
];

export default function AdminDashboard() {
	const { t } = useTranslation();
	const location = useLocation();
	const { user, logout } = useAuth();
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);

	const sidebarW = collapsed ? 'w-[72px]' : 'w-[260px]';
	const isActive = (to: string) =>
		location.pathname === to ||
		(location.pathname.startsWith(to + '/') && to !== '/admin/overview');

	const sidebarInner = (
		<>
			{/* Header */}
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
								{t('seller.brandName', 'Nouf-ex')}
							</h1>
							<p className="text-white/50 text-[10px]">
								{t('admin.adminPanel', 'Admin Panel')}
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Nav */}
			<nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
				{navItems.map((item) => {
					const active = isActive(item.to);
					return (
						<Link
							key={item.to}
							to={item.to}
							onClick={() => setMobileOpen(false)}
							className={cn(
								'w-full flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 relative',
								active
									? 'text-white'
									: 'text-white/50 hover:text-white hover:bg-white/5',
							)}
							style={active ? { background: 'rgba(255,106,0,0.15)' } : {}}
							aria-current={active ? 'page' : undefined}
						>
							{active && (
								<span
									className="absolute end-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-s-full"
									style={{ background: '#FF6A00' }}
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

			{/* User card + logout */}
			<div className="p-3 border-t border-white/10">
				{!collapsed && (
					<div className="flex items-center gap-3 px-3 mb-3">
						<div
							className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
							style={{ background: '#FF6A00' }}
						>
							{(user?.name ?? user?.email ?? 'A').charAt(0).toUpperCase()}
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-white text-sm font-medium truncate">
								{user?.name ?? user?.email ?? t('admin.adminName')}
							</p>
							<p className="text-white/50 text-[10px]">
								{t('admin.adminRole', 'Super Admin')}
							</p>
						</div>
					</div>
				)}
				<button
					onClick={() => void logout()}
					aria-label={t('nav.logout', 'Logout')}
					className={cn(
						'flex items-center gap-3 rounded hover:bg-white/5 transition-colors text-red-400',
						collapsed
							? 'w-9 h-9 justify-center mx-auto'
							: 'px-3 py-2 w-full text-left',
					)}
				>
					<LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
					{!collapsed && (
						<span className="text-xs">{t('nav.logout', 'Logout')}</span>
					)}
				</button>
			</div>
		</>
	);

	return (
		<div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
			{/* Desktop sidebar */}
			<aside
				className={cn(
					'hidden lg:flex flex-col shrink-0 transition-all duration-300 relative',
					sidebarW,
				)}
				style={{ background: '#0F1620' }}
				aria-label={t('admin.adminPanel', 'Admin Panel')}
			>
				{sidebarInner}
				<button
					onClick={() => setCollapsed((v) => !v)}
					aria-label={collapsed ? t('common.expand', 'Expand') : t('common.collapse', 'Collapse')}
					className="absolute top-4 -end-3 translate-x-1/2 w-7 h-7 rounded-full items-center justify-center bg-white text-gray-700 shadow border border-gray-200 hover:bg-gray-50 hidden lg:flex"
				>
					{collapsed ? (
						<ChevronRight className="w-4 h-4" />
					) : (
						<ChevronLeft className="w-4 h-4" />
					)}
				</button>
			</aside>

			{/* Mobile sidebar (drawer) */}
			{mobileOpen && (
				<div className="lg:hidden fixed inset-0 z-40 flex">
					<button
						className="absolute inset-0 bg-black/50"
						aria-label={t('common.close', 'Close')}
						onClick={() => setMobileOpen(false)}
					/>
					<aside
						className="relative w-[260px] flex flex-col"
						style={{ background: '#0F1620' }}
					>
						<button
							className="absolute top-3 end-3 text-white/60 hover:text-white"
							aria-label={t('common.close', 'Close')}
							onClick={() => setMobileOpen(false)}
						>
							<X className="w-5 h-5" />
						</button>
						{sidebarInner}
					</aside>
				</div>
			)}

			{/* Main */}
			<main className="flex-1 min-w-0 overflow-x-auto">
				{/* Mobile top bar with menu trigger */}
				<div className="lg:hidden flex items-center gap-2 px-4 py-3 bg-white border-b">
					<button
						onClick={() => setMobileOpen(true)}
						aria-label={t('common.openMenu', 'Open menu')}
						className="p-2 rounded hover:bg-gray-100"
					>
						<Menu className="w-5 h-5" />
					</button>
					<h2 className="font-semibold">
						{t('admin.adminPanel', 'Admin Panel')}
					</h2>
				</div>
				<div className="p-4 lg:p-6">
					<Outlet />
				</div>
			</main>
		</div>
	);
}