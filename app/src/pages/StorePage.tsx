import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCategories, useStore } from '../hooks/useApi';
import {
	Star,
	MapPin,
	Package,
	MessageCircle,
	Award,
	BadgeCheck,
	TrendingUp,
	Clock,
	Globe,
	Phone,
	Heart,
	Share2,
	Search,
} from 'lucide-react';
import styles from './StorePage.module.css';

/**
 * Deterministic pseudo-random phone suffix derived from a store ID.
 * Replaces Math.random() during render — keeps the same shape across renders
 * while still varying per store, so React Compiler sees a pure expression.
 */
function storePhone(id: number | string | undefined): string {
	const n = typeof id === 'string' ? parseInt(id, 10) || 1 : (id ?? 1);
	const suffix = 1_000_000 + ((n * 7919) % 9_000_000);
	return `+967-${suffix}`;
}

export default function StorePage() {
	const { id } = useParams<{ id: string }>();
	const { t, i18n } = useTranslation();

	// API hook
	const numericId = Number(id);
	const { data: store, loading: storeLoading, error: storeError } = useStore(numericId);
	const { data: categories } = useCategories();

	const storeProducts = store?.products ?? [];
	const [activeTab, setActiveTab] = useState<'products' | 'profile' | 'markets'>('products');
	const [searchQuery, setSearchQuery] = useState('');
	const [catFilter, setCatFilter] = useState('all');
	const [sort, setSort] = useState<'default' | 'price-low' | 'price-high' | 'rating'>('default');

	const lang = i18n.language;
	const isRTL = lang === 'ar';

	const getName = (p: { name_ar: string; name_en: string; name_zh: string }) =>
		lang === 'en' ? p.name_en : lang === 'zh' ? p.name_zh : p.name_ar;
	const getStoreName = (s: {
		store_name: string;
		store_name_en: string;
		store_name_zh: string;
	}) => {
		return lang === 'en' ? s.store_name_en : lang === 'zh' ? s.store_name_zh : s.store_name;
	};

	// M9 fix: resolve category IDs to localized names so the filter chips read
	// "Electronics" instead of "Cat 5".
	const categoryNameById = useMemo(() => {
		const map = new Map<number, string>();
		(categories ?? []).forEach((c) => {
			const label =
				lang === 'en' ? c.name_en : lang === 'zh' ? (c.name_zh ?? c.name_en) : c.name_ar;
			map.set(c.id, label);
		});
		return map;
	}, [categories, lang]);
	const getCategoryName = (catId: number): string =>
		categoryNameById.get(catId) ?? t('store.categoryFallback', 'Category {id}', { id: catId });

	// Filter and sort products
	let displayProducts = [...storeProducts];
	if (searchQuery.trim()) {
		const q = searchQuery.toLowerCase();
		displayProducts = displayProducts.filter(
			(p) =>
				p.name_ar.toLowerCase().includes(q) ||
				p.name_en.toLowerCase().includes(q) ||
				p.name_zh.includes(q),
		);
	}
	if (catFilter !== 'all') {
		displayProducts = displayProducts.filter((p) => p.category_id === Number(catFilter));
	}
	if (sort === 'price-low') displayProducts.sort((a, b) => a.price - b.price);
	else if (sort === 'price-high') displayProducts.sort((a, b) => b.price - a.price);
	else if (sort === 'rating') displayProducts.sort((a, b) => b.rating - a.rating);

	// Loading state
	if (storeLoading) {
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
				<div className="w-10 h-10 border-3 border-[#FF6A00] border-t-transparent rounded-full animate-spin mb-4" />
				<p className="text-[#666]">{t('store.loading', 'Loading...')}</p>
			</div>
		);
	}

	// Error state
	if (storeError || !store) {
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
				<h2 className="text-xl font-bold text-[#333]">
					{t('store.notFound', 'Store not found')}
				</h2>
				<p className="text-sm text-[#999] mb-4 mt-2">{storeError || ''}</p>
				<Link
					to="/"
					className="px-6 py-2 bg-[#FF6A00] text-white rounded-lg font-semibold hover:bg-[#E55F00]"
				>
					{t('common.back')}
				</Link>
			</div>
		);
	}

	const trustIcons: Record<string, { color: string; bg: string; label: string }> = {
		verified: {
			color: 'text-[#1688C9]',
			bg: 'bg-[#E3F2FD]',
			label: t('store.badgeVerified', 'Verified'),
		},
		golden: {
			color: 'text-[#FF8F00]',
			bg: 'bg-[#FFF8E1]',
			label: t('store.badgeGold', 'Gold Supplier'),
		},
		diamond: {
			color: 'text-[#7C4DFF]',
			bg: 'bg-[#EDE7F6]',
			label: t('store.badgeDiamond', 'Diamond Supplier'),
		},
		'fast-shipping': {
			color: 'text-[#4CAF50]',
			bg: 'bg-[#E8F5E9]',
			label: t('store.badgeVerified', 'Verified'),
		},
		'easy-returns': {
			color: 'text-[#FF6A00]',
			bg: 'bg-[#FFF3E0]',
			label: t('store.badgeGold', 'Gold Supplier'),
		},
	};

	// Build trust badges from API data
	const storeBadges: string[] = [];
	if (store.is_verified === 1) storeBadges.push('verified');
	if (store.trust_level === 'gold') storeBadges.push('golden');
	if (store.trust_level === 'diamond') storeBadges.push('diamond');

	// Unique category IDs for this store's products
	const storeCategoryIds = Array.from(new Set(storeProducts.map((p) => p.category_id)));

	const yearsActive = store.since_year
		? new Date().getFullYear() - parseInt(store.since_year)
		: 0;

	return (
		<div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4" dir={isRTL ? 'rtl' : 'ltr'}>
			{/* ─── Store Banner ─── */}
			<div className="relative h-40 lg:h-56 rounded overflow-hidden mb-0">
				<img src={store.banner} alt="" className="w-full h-full object-cover" />
				<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
			</div>

			{/* ─── Store Header ─── */}
			<div className="relative bg-white rounded-b border border-t-0 border-[#E5E5E5] px-4 lg:px-6 pb-4 -mt-16 mx-0 lg:mx-4 relative z-10">
				<div className="flex flex-col lg:flex-row lg:items-end gap-4 pt-3">
					{/* Logo + Name */}
					<div className="flex items-end gap-4 flex-1">
						<img
							src={store.logo}
							alt={getStoreName(store)}
							className="w-20 h-20 lg:w-24 lg:h-24 rounded-full border-4 border-white shadow-lg object-cover -mt-10"
						/>
						<div className="pb-1">
							<h1 className="text-xl lg:text-2xl font-bold text-[#333]">
								{getStoreName(store)}
							</h1>
							<div className="flex items-center gap-3 mt-1 flex-wrap">
								<div className="flex items-center gap-1">
									<Star size={14} className="text-[#FF6A00] fill-[#FF6A00]" />
									<span className="text-sm font-bold text-[#333]">
										{store.rating}
									</span>
									<span className="text-xs text-[#999]">
										({store.review_count})
									</span>
								</div>
								<span className="text-xs text-[#999] flex items-center gap-1">
									<MapPin size={12} /> {store.location}
								</span>
								<span className="text-xs text-[#999] flex items-center gap-1">
									<Clock size={12} /> {yearsActive} {t('store.yearsUnit', 'yrs')}
								</span>
							</div>
							{/* Badges */}
							<div className="flex flex-wrap gap-1.5 mt-2">
								{storeBadges.map((badge) => (
									<span
										key={badge}
										className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${trustIcons[badge]?.bg || 'bg-gray-100'} ${trustIcons[badge]?.color || 'text-gray-700'}`}
									>
										{badge === 'golden' && <Award size={12} />}
										{badge === 'verified' && <BadgeCheck size={12} />}
										{badge === 'diamond' && <Award size={12} />}
										{trustIcons[badge]?.label || badge}
									</span>
								))}
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-2 pb-1">
						<button className="h-9 px-4 rounded bg-[#FF6A00] text-white font-bold text-sm hover:bg-[#E55F00] transition-colors flex items-center gap-1.5">
							<MessageCircle size={14} />
							{t('store.contactUs', 'Contact Us')}
						</button>
						<button className="h-9 px-4 rounded border border-[#E5E5E5] text-[#666] font-medium text-sm hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors flex items-center gap-1.5">
							<Heart size={14} />
							{t('store.follow', 'Follow')}
						</button>
						<button
							title={t('store.share', 'Share')}
							aria-label={t('store.share', 'Share')}
							className="h-9 px-3 rounded border border-[#E5E5E5] text-[#666] hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors"
						>
							<Share2 size={14} />
						</button>
					</div>
				</div>
			</div>

			{/* ─── Stats Bar ─── */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
				{[
					{
						icon: Package,
						label: t('store.stats.products', 'Products'),
						value: store.products_count ?? 0,
						color: 'text-[#FF6A00]',
					},
					{
						icon: TrendingUp,
						label: t('store.stats.transactions', 'Transactions'),
						value: `${((Number(store.sales_count) || 0) / 1000).toFixed(1)}K+`,
						color: 'text-[#4CAF50]',
					},
					{
						icon: Star,
						label: t('store.stats.responseRate', 'Response Rate'),
						value: `${store.response_rate ?? 98}%`,
						color: 'text-[#FF8F00]',
					},
					{
						icon: Clock,
						label: t('store.stats.onTimeDelivery', 'On-time Delivery'),
						value: `${store.on_time_delivery ?? 96}%`,
						color: 'text-[#1688C9]',
					},
				].map((stat, i) => (
					<div
						key={i}
						className="bg-white rounded border border-[#E5E5E5] p-4 flex items-center gap-3"
					>
						<div className="w-10 h-10 rounded-full bg-[#F7F8FA] flex items-center justify-center flex-shrink-0">
							<stat.icon size={18} className={stat.color} />
						</div>
						<div>
							<p className="font-bold text-lg text-[#333] leading-tight">
								{stat.value}
							</p>
							<p className="text-xs text-[#999]">{stat.label}</p>
						</div>
					</div>
				))}
			</div>

			{/* ─── Tabs ─── */}
			<div className="mt-6 bg-white rounded border border-[#E5E5E5]">
				<div className="flex border-b border-[#E5E5E5] overflow-auto">
					{[
						{
							key: 'products' as const,
							label: t('store.tabs.products', 'Products'),
							count: storeProducts.length,
						},
						{
							key: 'profile' as const,
							label: t('store.tabs.profile', 'Company Profile'),
						},
						{
							key: 'markets' as const,
							label: t('store.tabs.markets', 'Main Markets'),
						},
					].map((tab) => (
						<button
							key={tab.key}
							onClick={() => setActiveTab(tab.key)}
							className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent text-[#666] hover:text-[#333]'}`}
						>
							{tab.label}
							{tab.count !== undefined && (
								<span className="ml-1.5 text-xs bg-[#F7F8FA] text-[#999] px-1.5 py-0.5 rounded">
									{tab.count}
								</span>
							)}
						</button>
					))}
				</div>

				<div className="p-4 lg:p-6">
					{/* ─── Products Tab ─── */}
					{activeTab === 'products' && (
						<div>
							{/* Search + Filter within store */}
							<div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-[#E5E5E5]">
								<div className="relative flex-1 max-w-xs">
									<input
										type="text"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										placeholder={t(
											'store.searchPlaceholder',
											'Search in store...',
										)}
										className="w-full h-9 pl-9 pr-3 rounded border border-[#E5E5E5] bg-white text-sm text-[#333] focus:outline-none focus:border-[#FF6A00]"
									/>
									<Search
										size={14}
										className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"
									/>
								</div>
								<div className="flex gap-1.5 overflow-auto">
									<button
										onClick={() => setCatFilter('all')}
										aria-label={t('store.allCategories', 'All categories')}
										className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex-shrink-0 ${catFilter === 'all' ? 'bg-[#FF6A00] text-white' : 'bg-[#F7F8FA] text-[#666] hover:bg-[#FF6A00]/10'}`}
									>
										{t('common.all', 'All')}
									</button>
									{storeCategoryIds.map((catId) => (
										<button
											key={catId}
											onClick={() => setCatFilter(String(catId))}
											className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex-shrink-0 ${catFilter === String(catId) ? 'bg-[#FF6A00] text-white' : 'bg-[#F7F8FA] text-[#666] hover:bg-[#FF6A00]/10'}`}
										>
											{getCategoryName(catId)}
										</button>
									))}
								</div>
								<div className="ml-auto flex items-center gap-1">
									<span className="text-xs text-[#999]">
										{t('common.sortBy')}:
									</span>
									<select
										value={sort}
										onChange={(e) =>
											setSort(
												e.target.value as
													| 'default'
													| 'price-low'
													| 'price-high'
													| 'rating',
											)
										}
										aria-label={t('store.sortByLabel', 'Sort by')}
										className="h-8 px-2 rounded border border-[#E5E5E5] bg-white text-xs text-[#333] focus:outline-none"
									>
										<option value="default">
											{t('store.sortDefault', 'Default')}
										</option>
										<option value="price-low">
											{t('store.sortPriceLow', 'Price: Low')}
										</option>
										<option value="price-high">
											{t('store.sortPriceHigh', 'Price: High')}
										</option>
										<option value="rating">
											{t('store.sortRating', 'Rating')}
										</option>
									</select>
								</div>
							</div>

							{displayProducts.length === 0 ? (
								<div className="text-center py-12">
									<Package size={40} className="mx-auto text-[#DDD] mb-3" />
									<p className="text-[#999]">
										{t('store.emptyProducts', 'No products found')}
									</p>
								</div>
							) : (
								<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
									{displayProducts.map((p) => (
										<Link
											key={p.id}
											to={`/product/${p.id}`}
											className="bg-white rounded border border-[#E5E5E5] hover:shadow-md hover:border-[#FF6A00]/30 transition-all group overflow-hidden"
										>
											<div className="aspect-square bg-[#F7F8FA] overflow-hidden relative">
												<img
													src={p.main_image}
													alt={getName(p)}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform"
												/>
												{p.deal_discount > 0 && (
													<span className="absolute top-2 left-2 bg-[#FF6A00] text-white text-xs font-bold px-1.5 py-0.5 rounded">
														-{p.deal_discount}%
													</span>
												)}
											</div>
											<div className="p-3">
												<h3 className="text-sm text-[#333] line-clamp-2 group-hover:text-[#FF6A00] transition-colors">
													{getName(p)}
												</h3>
												<div className="flex items-baseline gap-1 mt-1">
													<span className="text-base font-bold text-[#FF6A00]">
														{p.price.toLocaleString()}
													</span>
													<span className="text-xs text-[#999]">
														{t('product.currency')}
													</span>
												</div>
												<div className="flex items-center gap-1 mt-1">
													<div className="flex items-center gap-0.5">
														<Star
															size={10}
															className="text-[#FF6A00] fill-[#FF6A00]"
														/>
														<span className="text-xs font-bold text-[#333]">
															{p.rating}
														</span>
													</div>
													<span className="text-xs text-[#999]">
														({p.review_count})
													</span>
													<span className="text-xs text-[#999] ml-auto">
														{p.sold_count}{' '}
														{t('product.soldSuffix', 'sold')}
													</span>
												</div>
											</div>
										</Link>
									))}
								</div>
							)}
						</div>
					)}

					{/* ─── Company Profile Tab ─── */}
					{activeTab === 'profile' && (
						<div className="grid md:grid-cols-2 gap-8">
							<div>
								<h3 className="text-base font-bold text-[#333] mb-4">
									{t('store.profileTitle', 'Company Information')}
								</h3>
								<div className="space-y-3">
									{[
										{
											icon: StoreIcon,
											label: t('store.companyName', 'Store Name'),
											value: getStoreName(store),
										},
										{
											icon: MapPin,
											label: t('store.location', 'Location'),
											value: store.location,
										},
										{
											icon: CalendarIcon,
											label: t('store.established', 'Established'),
											value: store.since_year,
										},
										{
											icon: Globe,
											label: t('store.website', 'Website'),
											value: 'www.nouf-ex.com/' + store.id,
										},
										{
											icon: Phone,
											label: t('store.phone', 'Phone'),
											value: storePhone(store.id),
										},
									].map((item, i) => (
										<div key={i} className="flex items-center gap-3 text-sm">
											<div className="w-8 h-8 rounded bg-[#F7F8FA] flex items-center justify-center flex-shrink-0">
												<item.icon size={14} className="text-[#FF6A00]" />
											</div>
											<div>
												<span className="text-[#999] block text-xs">
													{item.label}
												</span>
												<span className="text-[#333] font-medium">
													{item.value}
												</span>
											</div>
										</div>
									))}
								</div>
							</div>
							<div>
								<h3 className="text-base font-bold text-[#333] mb-4">
									{t('store.capabilities', 'Capabilities & Certifications')}
								</h3>
								<div className="space-y-3">
									{[
										t(
											'store.capShipping',
											'Shipping to 50+ countries worldwide',
										),
										t('store.capOem', 'OEM/ODM Manufacturing Available'),
										t('store.capSupport', '24/7 Technical Support Team'),
										t(
											'store.capQuality',
											'International Quality Certifications (ISO 9001)',
										),
										t('store.capAudit', 'Annual Factory Audits'),
									].map((cap, i) => (
										<div
											key={i}
											className="flex items-center gap-2 text-sm text-[#666]"
										>
											<BadgeCheck
												size={14}
												className="text-[#4CAF50] flex-shrink-0"
											/>
											<span>{cap}</span>
										</div>
									))}
								</div>
							</div>
						</div>
					)}

					{/* ─── Main Markets Tab ─── */}
					{activeTab === 'markets' && (
						<div>
							<h3 className="text-base font-bold text-[#333] mb-4">
								{t('store.marketsTitle', 'Main Export Markets')}
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
								{[
									{
										country: t('store.countrySaudi', 'Saudi Arabia'),
										pct: 35,
										flag: 'SA',
									},
									{
										country: t('store.countryUae', 'UAE'),
										pct: 25,
										flag: 'AE',
									},
									{
										country: t('store.countryKuwait', 'Kuwait'),
										pct: 15,
										flag: 'KW',
									},
									{
										country: t('store.countryQatar', 'Qatar'),
										pct: 10,
										flag: 'QA',
									},
									{
										country: t('store.countryUs', 'United States'),
										pct: 8,
										flag: 'US',
									},
									{
										country: t('store.countryUk', 'United Kingdom'),
										pct: 5,
										flag: 'UK',
									},
									{
										country: t('store.countryMalaysia', 'Malaysia'),
										pct: 2,
										flag: 'MY',
									},
								].map((m, i) => (
									<div
										key={i}
										className="bg-[#F7F8FA] rounded p-3 border border-[#E5E5E5]"
									>
										<div className="flex items-center gap-2 mb-2">
											<Globe size={14} className="text-[#FF6A00]" />
											<span className="text-sm font-medium text-[#333]">
												{m.country}
											</span>
										</div>
										<div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
											<div
												className={`h-full bg-[#FF6A00] rounded-full transition-all ${styles.exportBar}`}
												style={
													{
														'--export-pct': `${m.pct}%`,
													} as React.CSSProperties
												}
											/>
										</div>
										<span className="text-xs text-[#999] mt-1">{m.pct}%</span>
									</div>
								))}
							</div>
							<div className="mt-6 p-4 bg-[#F7F8FA] rounded border border-[#E5E5E5]">
								<h4 className="text-sm font-bold text-[#333] mb-2">
									{t('store.totalExport', 'Total Export Volume')}
								</h4>
								<p className="text-sm text-[#666]">
									{t(
										'store.totalExportDesc',
										`${getStoreName(store)} has exported products to over 25 countries worldwide, with ${((Number(store.sales_count) || 0) / 1000).toFixed(1)}K+ successful transactions.`,
									)}
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// Icon components
function StoreIcon({ size, className }: { size: number; className?: string }) {
	return (
		<svg
			width={size}
			height={size}
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			<polyline points="9 22 9 12 15 12 15 22" />
		</svg>
	);
}

function CalendarIcon({ size, className }: { size: number; className?: string }) {
	return (
		<svg
			width={size}
			height={size}
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
		</svg>
	);
}
