import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ShoppingBag,
	Heart,
	Star,
	MapPin,
	Bell,
	User,
	Menu,
	X,
	Wallet,
	Ticket,
	HelpCircle,
	LogOut,
	LayoutDashboard,
} from 'lucide-react';
import { useApp, useAuth } from '@/context/AppContext';

const mainNavItems = [
	{ icon: LayoutDashboard, labelKey: 'customer.dashboard', path: '/customer' },
	{ icon: ShoppingBag, labelKey: 'customer.orders', path: '/customer/orders' },
	{ icon: Heart, labelKey: 'customer.wishlist', path: '/customer/wishlist' },
	{ icon: Star, labelKey: 'customer.reviews', path: '/customer/reviews' },
	{ icon: MapPin, labelKey: 'customer.addresses', path: '/customer/addresses' },
	{ icon: Bell, labelKey: 'customer.notifications', path: '/customer/notifications' },
];

const accountNavItems = [
	{ icon: User, labelKey: 'customer.profile', path: '/customer/profile' },
	{ icon: Wallet, labelKey: 'customer.myWallet', path: '/customer/wallet' },
	{ icon: Ticket, labelKey: 'customer.myCoupons', path: '/customer/coupons' },
	{ icon: HelpCircle, labelKey: 'customer.help', path: '/customer/help' },
];

export default function CustomerSidebar() {
	const location = useLocation();
	const [mobileOpen, setMobileOpen] = useState(false);
	const { state } = useApp();
	const { logout } = useAuth();
	const { t, i18n } = useTranslation();
	const user = state.user;
	const isRTL = i18n.language === 'ar';
	const sidebarSide = isRTL ? 'right-0' : 'left-0';

	const isActive = (path: string) => {
		if (path === '/customer/orders' && location.pathname === '/customer') return true;
		if (path === '/customer' && location.pathname === '/customer') return true;
		return location.pathname === path;
	};

	const renderNavLink = (item: { icon: typeof ShoppingBag; labelKey: string; path: string }) => {
		const active = isActive(item.path);
		const label = t(item.labelKey);
		return (
			<Link
				key={item.path}
				to={item.path}
				onClick={() => setMobileOpen(false)}
				className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
					active
						? 'bg-[#D4A853]/15 text-[#D4A853]'
						: 'text-white/60 hover:bg-white/5 hover:text-white'
				}`}
			>
				{active && (
					<span
						className={`absolute top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[#D4A853] ${
							isRTL ? 'right-0' : 'left-0'
						}`}
					/>
				)}
				<item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
				<span className="flex-1 truncate">{label}</span>
			</Link>
		);
	};

	const sidebarContent = (
		<div className="flex flex-col h-full bg-[#1A1612]">
			{/* Brand */}
			<div className="px-5 pt-5 pb-4 border-b border-white/10">
				<Link to="/" className="flex items-center gap-2 group">
					<img
						src="/noufex-logo.svg"
						alt="Nouf-ex"
						className="h-8 transition-transform group-hover:scale-105"
					/>
					<span className="text-[#D4A853] font-bold text-xs tracking-wider">CENTER</span>
				</Link>
			</div>

			{/* User card */}
			<div className="px-4 py-4 border-b border-white/10">
				<Link
					to="/customer/profile"
					onClick={() => setMobileOpen(false)}
					className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-white/5 transition-colors"
				>
					<div className="relative shrink-0">
						{user?.avatar ? (
							<img
								src={user.avatar}
								alt={user.name ?? 'user'}
								className="w-10 h-10 rounded-full object-cover ring-2 ring-[#D4A853]/40"
							/>
						) : (
							<div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4A853] to-[#8B6F2F] flex items-center justify-center text-white font-bold text-sm">
								{(user?.name ?? t('customer.guest', 'G')).charAt(0).toUpperCase()}
							</div>
						)}
						<span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10B981] ring-2 ring-[#1A1612]" />
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-white font-semibold text-sm truncate">
							{user?.name ?? t('customer.guest', 'ضيف')}
						</p>
						<p className="text-white/50 text-xs truncate">
							{user?.email ?? t('customer.profile', 'Profile')}
						</p>
					</div>
				</Link>
			</div>

			{/* Main nav */}
			<nav className="flex-1 px-3 py-3 overflow-y-auto">
				<p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
					{t('customer.greeting', 'Account')}
				</p>
				<div className="space-y-0.5 mb-4">
					{mainNavItems.map(renderNavLink)}
				</div>

				<p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
					{t('customer.settings', 'Settings')}
				</p>
				<div className="space-y-0.5">{accountNavItems.map(renderNavLink)}</div>
			</nav>

			{/* Footer */}
			<div className="px-3 py-3 border-t border-white/10 space-y-0.5">
				<Link
					to="/"
					onClick={() => setMobileOpen(false)}
					className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-white/50 hover:bg-white/5 hover:text-white text-sm transition-colors"
				>
					<span className="text-base">←</span>
					<span>{t('customer.backToHome', 'Back to home')}</span>
				</Link>
				<button
					onClick={() => {
						logout();
						setMobileOpen(false);
					}}
					className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[#EF4444]/80 hover:bg-[#EF4444]/10 hover:text-[#EF4444] text-sm transition-colors"
				>
					<LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
					<span>{t('nav.logout', 'Logout')}</span>
				</button>
			</div>
		</div>
	);

	return (
		<>
			{/* Mobile menu button */}
			<button
				onClick={() => setMobileOpen(true)}
				className={`md:hidden fixed top-20 ${isRTL ? 'right-4' : 'left-4'} z-40 w-10 h-10 bg-[#1A1612] rounded-full flex items-center justify-center shadow-lg hover:bg-[#2A2420] transition-colors`}
				aria-label={t('common.menu', 'Menu')}
			>
				<Menu className="w-5 h-5 text-white" strokeWidth={1.5} />
			</button>

			{/* Mobile overlay */}
			{mobileOpen && (
				<div className="md:hidden fixed inset-0 z-50">
					<div
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setMobileOpen(false)}
					/>
					<div
						className={`absolute top-0 h-full w-72 bg-[#1A1612] shadow-2xl ${sidebarSide}`}
					>
						<button
							onClick={() => setMobileOpen(false)}
							className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors`}
							aria-label={t('common.close', 'Close')}
						>
							<X className="w-4 h-4 text-white" strokeWidth={1.5} />
						</button>
						{sidebarContent}
					</div>
				</div>
			)}

			{/* Desktop sidebar */}
			<aside
				className={`hidden md:block fixed top-0 bottom-0 w-60 z-40 overflow-hidden ${sidebarSide}`}
			>
				{sidebarContent}
			</aside>
		</>
	);
}
