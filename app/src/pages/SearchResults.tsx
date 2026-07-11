import {
	CheckSquare,
	ChevronDown,
	Filter,
	Grid3X3,
	List,
	MessageCircle,
	Search,
	Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import type { Product, Category } from '../hooks/useApi';
import { useProducts, useCategories } from '../hooks/useApi';

const sortToApi = (sort: string): 'price_asc' | 'price_desc' | 'popular' | undefined => {
	switch (sort) {
		case 'price-low':
			return 'price_asc';
		case 'price-high':
			return 'price_desc';
		case 'rating':
			return 'popular';
		default:
			return undefined;
	}
};

const getProductName = (p: Product, lang: string) =>
	lang === 'en' ? p.name_en : lang === 'zh' ? p.name_zh : p.name_ar;

/* ─── Skeleton placeholder components ─── */

function GridSkeleton({ count = 10 }: { count?: number }) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className="bg-white rounded border border-[#E5E5E5] overflow-hidden flex flex-col animate-pulse"
				>
					<div className="aspect-square bg-[#F0F0F0]" />
					<div className="p-3 flex-1 flex flex-col gap-2">
						<div className="h-3 bg-[#F0F0F0] rounded w-full" />
						<div className="h-3 bg-[#F0F0F0] rounded w-3/4" />
						<div className="h-4 bg-[#F0F0F0] rounded w-1/2 mt-1" />
						<div className="h-3 bg-[#F0F0F0] rounded w-2/3" />
						<div className="h-6 bg-[#F0F0F0] rounded w-full mt-2" />
					</div>
				</div>
			))}
		</div>
	);
}

function ListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<div className="space-y-3">
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className="bg-white rounded border border-[#E5E5E5] overflow-hidden flex flex-col sm:flex-row animate-pulse"
				>
					<div className="aspect-square sm:w-48 sm:aspect-auto sm:h-full bg-[#F0F0F0] flex-shrink-0" />
					<div className="p-4 flex-1 flex flex-col sm:flex-row gap-4">
						<div className="flex-1 space-y-2">
							<div className="h-4 bg-[#F0F0F0] rounded w-3/4" />
							<div className="h-3 bg-[#F0F0F0] rounded w-1/2" />
							<div className="h-3 bg-[#F0F0F0] rounded w-2/3" />
						</div>
						<div className="sm:w-32 space-y-2">
							<div className="h-5 bg-[#F0F0F0] rounded w-24" />
							<div className="h-8 bg-[#F0F0F0] rounded w-full" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

export default function SearchResults() {
	const [searchParams, setSearchParams] = useSearchParams();
	const initialQ = searchParams.get('q') || '';
	const { t, i18n } = useTranslation();
	const [query, setQuery] = useState(initialQ);
	const [sort, setSort] = useState<'relevance' | 'price-low' | 'price-high' | 'rating'>(
		'relevance',
	);
	const [catFilter, setCatFilter] = useState<string>('all');
	const [priceRange, setPriceRange] = useState<string>('all');
	const [showFilters, setShowFilters] = useState(false);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const [compareList, setCompareList] = useState<number[]>([]);
	// M10 fix: pagination state.
	const [currentPage, setCurrentPage] = useState(1);
	const PAGE_SIZE = 20;
	const pageSize = PAGE_SIZE;

	const lang = i18n.language;
	const isRTL = lang === 'ar';

	/* Derive API sort value */
	const apiSort = sortToApi(sort);

	/* Parse price range */
	const priceFilter = useMemo(() => {
		if (priceRange === 'all') return {} as { minPrice?: number; maxPrice?: number };
		const [min, max] = priceRange.split('-').map(Number);
		return max ? { minPrice: min, maxPrice: max } : { minPrice: min };
	}, [priceRange]);

	/* Fetch products from API */
	const { data, loading, error } = useProducts({
		search: query || undefined,
		category: catFilter !== 'all' ? catFilter : undefined,
		...priceFilter,
		sort: apiSort,
		limit: pageSize,
		offset: (currentPage - 1) * pageSize,
	});
	const { data: apiCategories } = useCategories();

	/* Stabilize the results reference so downstream memos don't rebuild every render. */
	const results: Product[] = useMemo<Product[]>(() => data?.products ?? [], [data]);

	/* Build a category lookup map from the categories API. */
	const categoryMap = useMemo(() => {
		const map = new Map<number, Category>();
		apiCategories?.forEach((c) => map.set(c.id, c));
		return map;
	}, [apiCategories]);

	/* Sync query state from URL when the URL changes.
	 * This is the official React "adjust state during render" pattern.
	 * https://react.dev/reference/react/useState#storing-information-from-previous-renders
	 */
	const [prevQuerySnapshot, setPrevQuerySnapshot] = useState(searchParams.get('q') || '');
	if (prevQuerySnapshot !== (searchParams.get('q') || '')) {
		setPrevQuerySnapshot(searchParams.get('q') || '');
		setQuery(searchParams.get('q') || '');
	}

	/* Build category list from results. */
	const cats = useMemo(() => {
		const uniqueCats = Array.from(new Set(results.map((p) => p.category_id).filter(Boolean)));
		return ['all', ...uniqueCats.map(String)];
	}, [results]);

	const priceRanges = [
		{ key: 'all', label: t('search.ui.priceRangeAll', 'All') },
		{ key: '0-5000', label: '0 - 5,000' },
		{ key: '5000-20000', label: '5,000 - 20,000' },
		{ key: '20000-50000', label: '20,000 - 50,000' },
		{ key: '50000-', label: '50,000+' },
	];
	const sortOptions = [
		{ key: 'relevance', label: t('search.ui.sortRelevance', 'Best Match') },
		{ key: 'price-low', label: t('search.ui.sortPriceLow', 'Price: Low to High') },
		{ key: 'price-high', label: t('search.ui.sortPriceHigh', 'Price: High to Low') },
		{ key: 'rating', label: t('search.ui.sortRating', 'Highest Rated') },
	];

	const toggleCompare = (id: number) => {
		setCompareList((prev) =>
			prev.includes(id)
				? prev.filter((x) => x !== id)
				: prev.length < 4
					? [...prev, id]
					: prev,
		);
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchParams({ q: query });
	};

	return (
		<div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6" dir={isRTL ? 'rtl' : 'ltr'}>
			{/* ─── Search Header ─── */}
			<form onSubmit={handleSearch} className="mb-6">
				<div className="flex items-center gap-2 max-w-2xl">
					<div className="flex-1 relative">
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t('search.ui.placeholder', 'Search for products...')}
							className="w-full h-11 pl-10 pr-4 rounded border border-[#E5E5E5] bg-white text-sm text-[#333] focus:outline-none focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00]"
						/>
						<Search
							size={16}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"
						/>
					</div>
					<button
						type="submit"
						className="h-11 px-6 bg-[#FF6A00] text-white rounded font-bold text-sm hover:bg-[#E55F00] transition-colors"
					>
						{t('common.search')}
					</button>
				</div>
			</form>

			{/* ─── Results Count ─── */}
			<div className="mb-4">
				<h1 className="text-lg font-bold text-[#333]">
					{loading
						? '...'
						: t(
								results.length === 1
									? 'search.ui.resultsCount'
									: 'search.ui.resultsCountPlural',
								'{count} products',
								{ count: results.length },
							)}{' '}
					{t('search.ui.resultsFor', 'for')}{' '}
					<span className="text-[#FF6A00]">
						"{initialQ || t('search.ui.allProductsFallback', 'All Products')}"
					</span>
				</h1>
			</div>

			{/* ─── Filter Bar ─── */}
			<div className="bg-white rounded border border-[#E5E5E5] mb-4">
				<div className="flex flex-wrap items-center gap-2 p-3">
					<button
						onClick={() => setShowFilters(!showFilters)}
						className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E5E5] rounded text-sm text-[#666] hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors"
					>
						<Filter size={14} />
						<span>{t('search.ui.filters', 'Filters')}</span>
					</button>

					{/* Category filter */}
					<div className="relative group">
						<select
							value={catFilter}
							onChange={(e) => setCatFilter(e.target.value)}
							aria-label={t('search.ui.categoryLabel', 'Category')}
							className="h-8 pl-3 pr-8 rounded border border-[#E5E5E5] bg-white text-sm text-[#333] focus:outline-none focus:border-[#FF6A00] appearance-none cursor-pointer hover:border-[#FF6A00]/50"
						>
							<option value="all">
								{t('search.ui.allCategories', 'All Categories')}
							</option>
							{cats
								.filter((c) => c !== 'all')
								.map((cat) => {
									const catObj = categoryMap.get(Number(cat));
									const name = catObj
										? (lang === 'en' ? catObj.name_en : lang === 'zh' ? catObj.name_zh : catObj.name_ar)
										: cat;
									return (
										<option key={cat} value={cat}>
											{name}
										</option>
									);
								})}
						</select>
						<ChevronDown
							size={12}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none"
						/>
					</div>

					{/* Price filter */}
					<div className="relative group">
						<select
							value={priceRange}
							onChange={(e) => setPriceRange(e.target.value)}
							aria-label={t('search.ui.priceLabel', 'Price')}
							className="h-8 pl-3 pr-8 rounded border border-[#E5E5E5] bg-white text-sm text-[#333] focus:outline-none focus:border-[#FF6A00] appearance-none cursor-pointer hover:border-[#FF6A00]/50"
						>
							{priceRanges.map((pr) => (
								<option key={pr.key} value={pr.key}>
									{pr.label}
								</option>
							))}
						</select>
						<ChevronDown
							size={12}
							className={`absolute top-1/2 -translate-y-1/2 text-[#999] pointer-events-none ${isRTL ? 'left-2' : 'right-2'}`}
						/>
					</div>

					{/* View toggle */}
					<div className="ml-auto flex items-center gap-2">
						<span className="text-sm text-[#999]">{t('common.sortBy')}:</span>
						<div className="relative">
							<select
								value={sort}
								onChange={(e) => setSort(e.target.value as typeof sort)}
								aria-label={t('search.ui.sortLabel', 'Sort')}
								className="h-8 pl-3 pr-8 rounded border border-[#E5E5E5] bg-white text-sm text-[#333] focus:outline-none focus:border-[#FF6A00] appearance-none cursor-pointer"
							>
								{sortOptions.map((so) => (
									<option key={so.key} value={so.key}>
										{so.label}
									</option>
								))}
						</select>
						<ChevronDown
							size={12}
							className={`absolute top-1/2 -translate-y-1/2 text-[#999] pointer-events-none ${isRTL ? 'left-2' : 'right-2'}`}
						/>
						</div>
						<div className="flex border border-[#E5E5E5] rounded overflow-hidden ml-2">
							<button
								onClick={() => setViewMode('grid')}
								title={t('search.ui.viewGrid', 'Grid view')}
								aria-label={t('search.ui.viewGrid', 'Grid view')}
								className={`p-1.5 ${viewMode === 'grid' ? 'bg-[#FF6A00] text-white' : 'bg-white text-[#666] hover:text-[#FF6A00]'}`}
							>
								<Grid3X3 size={16} />
							</button>
							<button
								onClick={() => setViewMode('list')}
								title={t('search.ui.viewList', 'List view')}
								aria-label={t('search.ui.viewList', 'List view')}
								className={`p-1.5 ${viewMode === 'list' ? 'bg-[#FF6A00] text-white' : 'bg-white text-[#666] hover:text-[#FF6A00]'}`}
							>
								<List size={16} />
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* ─── Error State ─── */}
			{error && (
				<div className="text-center py-16 bg-white rounded border border-red-200 mb-4">
					<p className="text-red-500 font-medium mb-2">
						{t('search.ui.errorTitle', 'Error loading products')}
					</p>
					<p className="text-[#999] text-sm">{error}</p>
				</div>
			)}

			{/* ─── Loading State ─── */}
			{loading && !error && (viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />)}

			{/* ─── Results Grid ─── */}
			{!loading &&
				!error &&
				(results.length === 0 ? (
					<div className="text-center py-16 bg-white rounded border border-[#E5E5E5]">
						<Search size={48} className="mx-auto text-[#DDD] mb-4" />
						<h2 className="text-lg font-bold text-[#333] mb-2">
							{t('common.noResults')}
						</h2>
						<p className="text-[#999]">
							{t(
								'search.ui.emptyMessage',
								'Try different keywords or browse categories',
							)}
						</p>
					</div>
				) : (
					<>
						{viewMode === 'grid' ? (
							<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
								{results.map((p) => (
									<div
										key={p.id}
										className="bg-white rounded border border-[#E5E5E5] hover:shadow-md hover:border-[#FF6A00]/30 transition-all group overflow-hidden flex flex-col"
									>
										{/* Image */}
										<Link to={`/product/${p.id}`} className="block">
											<div className="aspect-square bg-[#F7F8FA] overflow-hidden relative">
												<img
													src={p.main_image || '/images/placeholder.svg'}
													alt={getProductName(p, lang)}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform"
												/>
												{p.deal_discount > 0 && (
													<span className="absolute top-2 left-2 bg-[#FF6A00] text-white text-xs font-bold px-1.5 py-0.5 rounded">
														-{p.deal_discount}%
													</span>
												)}
												{p.badges?.includes('bestseller') && (
													<span className="absolute bottom-2 left-2 bg-[#FF6A00] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
														{t('search.ui.bestseller', 'BESTSELLER')}
													</span>
												)}
											</div>
										</Link>
										{/* Content */}
										<div className="p-3 flex-1 flex flex-col">
											<Link to={`/product/${p.id}`}>
												<h3 className="text-sm text-[#333] line-clamp-2 group-hover:text-[#FF6A00] transition-colors">
													{getProductName(p, lang)}
												</h3>
											</Link>
											{/* Price */}
											<div className="mt-1.5 flex items-baseline gap-1">
												<span className="text-base font-bold text-[#FF6A00]">
													{p.price.toLocaleString()}
												</span>
												{p.original_price > p.price && (
													<span className="text-xs text-[#999] line-through">
														{p.original_price.toLocaleString()}
													</span>
												)}
											</div>
											<span className="text-xs text-[#999]">
												{t('product.currency')}
											</span>
											{/* MOQ + Sold */}
											<div className="flex items-center gap-1 mt-1 text-xs text-[#999]">
												<span>MOQ: {p.moq ?? 10}</span>
												<span>|</span>
												<span>
													{p.sold_count}{' '}
													{t('search.ui.soldSuffix', 'sold')}
												</span>
											</div>
											{/* Rating */}
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
											</div>
											{/* Actions */}
											<div className="mt-2 pt-2 border-t border-[#E5E5E5] flex gap-1.5">
												<button className="flex-1 h-7 rounded border border-[#FF6A00] text-[#FF6A00] text-xs font-medium hover:bg-[#FFF8F3] transition-colors flex items-center justify-center gap-1">
													<MessageCircle size={12} />
													{t('search.ui.contact', 'Contact')}
												</button>
												<button
													onClick={() => toggleCompare(p.id)}
													title={
														compareList.includes(p.id)
															? t(
																	'search.ui.compareRemove',
																	'Remove from compare',
																)
															: t(
																	'search.ui.compareAdd',
																	'Add to compare',
																)
													}
													aria-label={
														compareList.includes(p.id)
															? t(
																	'search.ui.compareRemove',
																	'Remove from compare',
																)
															: t(
																	'search.ui.compareAdd',
																	'Add to compare',
																)
													}
													className={`h-7 px-2 rounded border text-xs font-medium transition-colors flex items-center gap-1 ${compareList.includes(p.id) ? 'border-[#FF6A00] text-[#FF6A00] bg-[#FFF8F3]' : 'border-[#E5E5E5] text-[#999] hover:border-[#FF6A00]'}`}
												>
													<CheckSquare size={12} />
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							/* List View */
							<div className="space-y-3">
								{results.map((p) => (
									<div
										key={p.id}
										className="bg-white rounded border border-[#E5E5E5] hover:shadow-md hover:border-[#FF6A00]/30 transition-all group overflow-hidden flex flex-col sm:flex-row"
									>
										{/* Image */}
										<Link
											to={`/product/${p.id}`}
											className="block sm:w-48 flex-shrink-0"
										>
											<div className="aspect-square sm:aspect-auto sm:h-full bg-[#F7F8FA] overflow-hidden relative">
												<img
													src={p.main_image || '/images/placeholder.svg'}
													alt={getProductName(p, lang)}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform"
												/>
												{p.deal_discount > 0 && (
													<span className="absolute top-2 left-2 bg-[#FF6A00] text-white text-xs font-bold px-1.5 py-0.5 rounded">
														-{p.deal_discount}%
													</span>
												)}
											</div>
										</Link>
										{/* Content */}
										<div className="p-4 flex-1 flex flex-col sm:flex-row gap-4">
											<div className="flex-1">
												<Link to={`/product/${p.id}`}>
													<h3 className="text-base font-medium text-[#333] group-hover:text-[#FF6A00] transition-colors">
														{getProductName(p, lang)}
													</h3>
												</Link>
												<div className="flex items-center gap-2 mt-1">
													<div className="flex items-center gap-0.5">
														{[1, 2, 3, 4, 5].map((s) => (
															<Star
																key={s}
																size={12}
																className={
																	s <= Math.round(p.rating)
																		? 'text-[#FF6A00] fill-[#FF6A00]'
																		: 'text-[#DDD]'
																}
															/>
														))}
													</div>
													<span className="text-xs text-[#999]">
														({p.review_count})
													</span>
													<span className="text-xs text-[#999]">|</span>
													<span className="text-xs text-[#999]">
														{p.sold_count}{' '}
														{t('search.ui.soldSuffix', 'sold')}
													</span>
												</div>
												<div className="flex flex-wrap gap-2 mt-2">
													{p.features?.slice(0, 3).map((f, i) => (
														<span
															key={i}
															className="text-xs bg-[#F7F8FA] text-[#666] px-2 py-0.5 rounded"
														>
															{f}
														</span>
													))}
												</div>
											</div>
											<div className="sm:text-right flex sm:flex-col items-end justify-between sm:justify-start gap-2">
												<div>
													<span className="text-lg font-bold text-[#FF6A00]">
														{p.price.toLocaleString()}
													</span>
													<span className="text-xs text-[#999] ml-1">
														{t('product.currency')}
													</span>
													<div className="text-xs text-[#999]">
														MOQ: {p.moq ?? 10}
													</div>
												</div>
												<div className="flex gap-1.5">
													<button className="h-8 px-3 rounded border border-[#FF6A00] text-[#FF6A00] text-xs font-medium hover:bg-[#FFF8F3] transition-colors flex items-center gap-1">
														<MessageCircle size={12} />
														{t('search.ui.contact', 'Contact')}
													</button>
													<button
														onClick={() => toggleCompare(p.id)}
														title={
															compareList.includes(p.id)
																? t(
																		'search.ui.compareRemove',
																		'Remove from compare',
																	)
																: t(
																		'search.ui.compareAdd',
																		'Add to compare',
																	)
														}
														aria-label={
															compareList.includes(p.id)
																? t(
																		'search.ui.compareRemove',
																		'Remove from compare',
																	)
																: t(
																		'search.ui.compareAdd',
																		'Add to compare',
																	)
														}
														className={`h-8 px-2 rounded border text-xs font-medium transition-colors ${compareList.includes(p.id) ? 'border-[#FF6A00] text-[#FF6A00] bg-[#FFF8F3]' : 'border-[#E5E5E5] text-[#999]'}`}
													>
														<CheckSquare size={14} />
													</button>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</>
				))}

			{/* M10 fix: dynamic pagination derived from products.length (fallback) or API total */}
			{results.length > 0 && !loading && (
				<div className="flex items-center justify-center gap-1.5 mt-8">
					<button
						disabled={currentPage <= 1}
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						className="h-9 px-3 rounded border border-[#E5E5E5] text-sm text-[#666] hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors disabled:opacity-50"
					>
						{t('search.ui.prev', 'Prev')}
					</button>
					{(() => {
						const totalCount: number =
							(data && (data as { total?: number }).total) ?? results.length;
						const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
						const pages: number[] = [];
						const winStart = Math.max(1, currentPage - 2);
						const winEnd = Math.min(totalPages, winStart + 4);
						for (let p = Math.max(1, winEnd - 4); p <= winEnd; p++) pages.push(p);
						return pages.map((page) => (
							<button
								key={page}
								onClick={() => setCurrentPage(page)}
								className={`h-9 w-9 rounded text-sm font-medium transition-colors ${page === currentPage ? 'bg-[#FF6A00] text-white' : 'border border-[#E5E5E5] text-[#666] hover:border-[#FF6A00] hover:text-[#FF6A00]'}`}
							>
								{page}
							</button>
						));
					})()}
					<button
						disabled={
							currentPage >=
							Math.max(
								1,
								Math.ceil(
									((data && (data as { total?: number }).total) ??
										results.length) / pageSize,
								),
							)
						}
						onClick={() => setCurrentPage((p) => p + 1)}
						className="h-9 px-3 rounded border border-[#E5E5E5] text-sm text-[#666] hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors disabled:opacity-50"
					>
						{t('search.ui.next', 'Next')}
					</button>
				</div>
			)}
		</div>
	);
}
