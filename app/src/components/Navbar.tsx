import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import { useCategories } from '../hooks/useApi';
import type { Category } from '../hooks/useApi';
import {
	Search,
	ShoppingCart,
	User,
	Menu,
	X,
	ChevronDown,
	ShieldCheck,
	BadgeCheck,
	Globe,
	Camera,
} from 'lucide-react';

export default function Navbar() {
	const { t, i18n } = useTranslation();
	const { state, dispatch } = useApp();
	const { cartCount } = useCart();
	const navigate = useNavigate();
	const [searchQ, setSearchQ] = useState('');
	const [mobileOpen, setMobileOpen] = useState(false);
	const [catDropdownOpen, setCatDropdownOpen] = useState(false);
	const [searchCat, setSearchCat] = useState('all');
	const _isRTL = i18n.language === 'ar';
	// C8 fix: declare all useState hooks BEFORE any useEffect. Rules of Hooks require consistent order.
	const [userOpen, setUserOpen] = useState(false);
	const userRef = useRef<HTMLDivElement>(null);
	const catRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
			if (catRef.current && !catRef.current.contains(e.target as Node))
				setCatDropdownOpen(false);
		}
		document.addEventListener('mousedown', handleClick);
		return () => document.removeEventListener('mousedown', handleClick);
	}, []);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchQ.trim()) {
			navigate(
				`/search?q=${encodeURIComponent(searchQ.trim())}${searchCat !== 'all' ? `&cat=${searchCat}` : ''}`,
			);
			setSearchQ('');
			setMobileOpen(false);
		}
	};

	const changeLang = (lng: string) => {
		i18n.changeLanguage(lng);
		dispatch({ type: 'SET_LANG', payload: lng as 'ar' | 'en' | 'zh' });
	};

	const { data: apiCategories } = useCategories();
	const categories = apiCategories ?? [];

	const getCatName = (c: Category) =>
		i18n.language === 'en' ? c.name_en : i18n.language === 'zh' ? c.name_zh : c.name_ar;

	return (
		<header className="sticky top-0 z-50 bg-white border-b border-aliBorder shadow-sm">
			{/* Top Bar */}
			<div className="bg-aliSurface border-b border-aliBorder">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6 flex items-center justify-between h-9 text-xs">
					<div className="flex items-center gap-4">
						<Link
							to="/"
							className="font-bold text-aliText hover:text-aliOrange transition-colors flex items-center gap-1"
						>
							<span className="text-aliOrange font-extrabold text-sm">Nouf-ex</span>
						</Link>
						<span className="text-aliBorder hidden sm:inline">|</span>
						<div className="hidden sm:flex items-center gap-3 text-aliTextMute">
							<button className="hover:text-aliOrange transition-colors">
								{t('nav.categories')}
							</button>
							<button className="hover:text-aliOrange transition-colors flex items-center gap-1">
								<BadgeCheck size={12} /> {t('nav.verified', 'Verified')}
							</button>
							<button className="hover:text-aliOrange transition-colors flex items-center gap-1">
								<ShieldCheck size={12} />{' '}
								{t('nav.tradeAssurance', 'Trade Assurance')}
							</button>
						</div>
					</div>
					<div className="flex items-center gap-3 text-aliTextMute">
						<span className="hidden md:inline">
							{t('nav.topBar', 'Nouf-ex — Yemen & Middle East Marketplace')}
						</span>
					</div>
				</div>
			</div>

			{/* Main Header */}
			<div className="max-w-[1400px] mx-auto px-4 lg:px-6">
				<div className="flex items-center gap-3 h-16">
					{/* Mobile menu */}
					<button
						onClick={() => setMobileOpen(!mobileOpen)}
						className="lg:hidden p-2 rounded-lg hover:bg-aliSurface transition-colors text-aliText"
					>
						{mobileOpen ? <X size={22} /> : <Menu size={22} />}
					</button>

					{/* Logo */}
					<Link to="/" className="flex items-center shrink-0 gap-1">
						<span className="text-2xl font-extrabold text-aliOrange tracking-tight">
							Nouf-ex
						</span>
					</Link>

					{/* Search Bar - Desktop */}
					<form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl mx-4">
						<div className="flex w-full h-11 rounded-3xl border-2 border-aliOrange overflow-hidden bg-white focus-within:shadow-md transition-shadow">
							{/* Category dropdown */}
							<div ref={catRef} className="relative shrink-0">
								<button
									type="button"
									onClick={() => setCatDropdownOpen(!catDropdownOpen)}
									className="h-full px-3 flex items-center gap-1 text-sm text-aliTextSec hover:bg-aliSurface border-r border-aliBorder transition-colors"
								>
									<span className="truncate max-w-[80px]">
										{searchCat === 'all'
											? t('nav.allCategories', 'All Categories')
											: getCatName(
													categories.find(
														(c) => String(c.id) === searchCat,
													)!,
												)}
									</span>
									<ChevronDown size={14} />
								</button>
								{catDropdownOpen && (
									<div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-aliBorder py-1 z-50">
										<button
											type="button"
											onClick={() => {
												setSearchCat('all');
												setCatDropdownOpen(false);
											}}
											className={`w-full text-left px-3 py-2 text-sm hover:bg-aliSurface transition-colors ${searchCat === 'all' ? 'text-aliOrange font-semibold' : 'text-aliText'}`}
										>
											{t('nav.allCategories', 'All Categories')}
										</button>
										{categories.map((cat) => (
											<button
												key={cat.id}
												type="button"
												onClick={() => {
													setSearchCat(String(cat.id));
													setCatDropdownOpen(false);
												}}
												className={`w-full text-left px-3 py-2 text-sm hover:bg-aliSurface transition-colors ${searchCat === String(cat.id) ? 'text-aliOrange font-semibold' : 'text-aliText'}`}
											>
												{getCatName(cat)}
											</button>
										))}
									</div>
								)}
							</div>
							{/* Search input */}
							<input
								type="text"
								value={searchQ}
								onChange={(e) => setSearchQ(e.target.value)}
								placeholder={t('nav.searchPlaceholder', 'Search products...')}
								className="flex-1 h-full px-3 text-sm text-aliText placeholder-aliTextMute outline-none bg-transparent"
								dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
							/>
							{/* Image search */}
							<button
								type="button"
								title={t('nav.imageSearch', 'Search by image')}
								aria-label={t('nav.imageSearch', 'Search by image')}
								className="h-full px-2 text-aliTextMute hover:text-aliOrange transition-colors"
							>
								<Camera size={18} />
							</button>
							{/* Search button */}
							<button
								type="submit"
								className="h-full px-6 bg-aliOrange text-white font-semibold text-sm hover:bg-aliOrangeHover transition-colors flex items-center gap-1"
							>
								<Search size={16} />
								<span className="hidden lg:inline">{t('nav.search')}</span>
							</button>
						</div>
					</form>

					{/* Right Actions */}
					<div className="flex items-center gap-1 sm:gap-2 ml-auto">
						{/* Language Switcher */}
						<div className="hidden sm:flex items-center bg-aliSurface rounded-lg p-0.5 border border-aliBorder">
							{(['ar', 'en', 'zh'] as const).map((code) => (
								<button
									key={code}
									onClick={() => changeLang(code)}
									className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${i18n.language === code ? 'bg-aliOrange text-white shadow' : 'text-aliTextMute hover:text-aliText'}`}
								>
									{code === 'ar' ? 'العربية' : code === 'en' ? 'EN' : '中文'}
								</button>
							))}
						</div>

						{/* Cart */}
						<Link
							to="/checkout"
							className="relative p-2 rounded-lg hover:bg-aliSurface transition-colors text-aliText"
							aria-label={t('nav.cartLabel', 'Cart')}
						>
							<ShoppingCart size={20} />
							{cartCount > 0 && (
								<span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-aliOrange text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
									{cartCount > 99 ? '99+' : cartCount}
								</span>
							)}
						</Link>

						{/* User */}
						<div ref={userRef} className="relative">
							<button
								onClick={() => setUserOpen(!userOpen)}
								className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-aliSurface transition-colors text-aliText"
							>
								<User size={18} />
								<span className="hidden lg:inline text-xs font-medium max-w-[80px] truncate">
									{state.user ? state.user.name : t('nav.login')}
								</span>
								<ChevronDown
									size={14}
									className="hidden lg:block text-aliTextMute"
								/>
							</button>
							{userOpen && (
								<div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-aliBorder py-2 z-50">
									{!state.user ? (
										<>
											<Link
												to="/auth/login"
												onClick={() => setUserOpen(false)}
												className="flex items-center gap-2 px-4 py-2.5 text-sm text-aliText hover:bg-aliSurface transition-colors"
											>
												<User size={14} className="text-aliOrange" />{' '}
												{t('nav.login')}
											</Link>
											<Link
												to="/auth/register"
												onClick={() => setUserOpen(false)}
												className="flex items-center gap-2 px-4 py-2.5 text-sm text-aliText hover:bg-aliSurface transition-colors"
											>
												<User size={14} className="text-aliOrange" />{' '}
												{t('nav.register')}
											</Link>
										</>
									) : (
										<>
											<div className="px-4 py-2 border-b border-aliBorder">
												<p className="font-bold text-sm text-aliText">
													{state.user.name}
												</p>
											</div>
											<Link
												to="/customer"
												onClick={() => setUserOpen(false)}
												className="flex items-center gap-2 px-4 py-2 text-sm text-aliText hover:bg-aliSurface"
											>
												<ShoppingCart
													size={14}
													className="text-aliOrange"
												/>{' '}
												{t('nav.customerDashboard')}
											</Link>
											<button
												onClick={() => {
													dispatch({ type: 'SET_USER', payload: null });
													setUserOpen(false);
												}}
												className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 w-full text-left"
											>
												<User size={14} /> {t('nav.logout')}
											</button>
										</>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Secondary Nav */}
			<div className="hidden lg:block border-t border-aliBorder bg-white">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6 flex items-center gap-6 h-10 text-sm">
					<div ref={catRef} className="relative">
						<button
							onClick={() => setCatDropdownOpen(!catDropdownOpen)}
							className="flex items-center gap-1.5 font-semibold text-aliText hover:text-aliOrange transition-colors h-full"
						>
							<Menu size={16} />
							{t('nav.categories')}
							<ChevronDown size={14} />
						</button>
						{catDropdownOpen && (
							<div className="absolute top-full left-0 mt-0 w-56 bg-white rounded-b-lg shadow-lg border border-t-0 border-aliBorder py-1 z-50">
								{categories.map((cat) => (
									<Link
										key={cat.id}
										to="/categories"
										onClick={() => setCatDropdownOpen(false)}
										className="flex items-center justify-between px-4 py-2.5 text-sm text-aliText hover:bg-aliSurface hover:text-aliOrange transition-colors"
									>
										<span>{getCatName(cat)}</span>
										<ChevronDown
											size={12}
											className="text-aliTextMute -rotate-90"
										/>
									</Link>
								))}
							</div>
						)}
					</div>
					<Link to="/" className="text-aliOrange font-semibold hover:underline">
						AI Mode
					</Link>
					<Link
						to="/search"
						className="text-aliText hover:text-aliOrange transition-colors"
					>
						{t('nav.products')}
					</Link>
					<Link
						to="/categories"
						className="text-aliText hover:text-aliOrange transition-colors flex items-center gap-1"
					>
						Manufacturers <BadgeCheck size={14} className="text-aliOrange" />
					</Link>
					<Link
						to="/deals"
						className="text-aliText hover:text-aliOrange transition-colors flex items-center gap-1"
					>
						<Globe size={14} /> Global Supply
					</Link>
				</div>
			</div>

			{/* Mobile Menu */}
			{mobileOpen && (
				<div className="lg:hidden border-t border-aliBorder bg-white">
					<div className="p-4 space-y-3">
						{/* Mobile search */}
						<form onSubmit={handleSearch} className="flex gap-2">
							<div className="relative flex-1">
								<input
									type="text"
									value={searchQ}
									onChange={(e) => setSearchQ(e.target.value)}
									placeholder={t('common.search') + '...'}
									className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-aliOrange text-aliText placeholder-aliTextMute outline-none bg-white"
								/>
								<Search
									className="absolute left-3 top-1/2 -translate-y-1/2 text-aliTextMute"
									size={18}
								/>
							</div>
							<button
								type="submit"
								className="h-11 px-4 bg-aliOrange text-white rounded-xl font-semibold"
							>
								{t('nav.search')}
							</button>
						</form>

						<div className="flex flex-col gap-1">
							{categories.map((cat) => (
								<Link
									key={cat.id}
									to="/categories"
									onClick={() => setMobileOpen(false)}
									className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-aliText hover:bg-aliSurface transition-colors"
								>
									<span className="text-sm font-medium">{getCatName(cat)}</span>
								</Link>
							))}
						</div>
						<div className="border-t border-aliBorder pt-3 space-y-1">
							<Link
								to="/"
								onClick={() => setMobileOpen(false)}
								className="flex items-center gap-2 px-3 py-2 text-aliText hover:bg-aliSurface rounded-lg"
							>
								<Globe size={16} /> AI Mode
							</Link>
							<Link
								to="/search"
								onClick={() => setMobileOpen(false)}
								className="flex items-center gap-2 px-3 py-2 text-aliText hover:bg-aliSurface rounded-lg"
							>
								<Search size={16} /> {t('nav.products')}
							</Link>
							<Link
								to="/deals"
								onClick={() => setMobileOpen(false)}
								className="flex items-center gap-2 px-3 py-2 text-aliText hover:bg-aliSurface rounded-lg"
							>
								<BadgeCheck size={16} /> {t('nav.deals')}
							</Link>
						</div>

						{/* Mobile Language Switcher */}
						<div className="flex items-center gap-2 border-t border-aliBorder pt-3">
							<span className="text-sm text-aliTextMute">Language:</span>
							{(['ar', 'en', 'zh'] as const).map((code) => (
								<button
									key={code}
									onClick={() => changeLang(code)}
									className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${i18n.language === code ? 'bg-aliOrange text-white' : 'bg-aliSurface text-aliTextMute'}`}
								>
									{code === 'ar' ? 'العربية' : code === 'en' ? 'English' : '中文'}
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</header>
	);
}
