import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { useCategories, useProducts } from '../hooks/useApi';
import type { Category } from '../hooks/useApi';
import {
	ChevronRight,
	ChevronDown,
	Search,
	Filter,
	ShoppingCart,
	Star,
	SlidersHorizontal,
} from 'lucide-react';

/* ─── Helpers ─── */

const getCatName = (c: Category, lang: string) =>
	lang === 'en' ? c.name_en : lang === 'zh' ? c.name_zh : c.name_ar;

const getProductName = (p: { name_ar: string; name_en: string; name_zh: string }, lang: string) =>
	lang === 'en' ? p.name_en : lang === 'zh' ? p.name_zh : p.name_ar;

/** Build a tree from flat API categories */
function buildCategoryTree(cats: Category[]): { parent: Category; children: Category[] }[] {
	const parents = cats
		.filter((c) => c.parent_id === null)
		.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
	return parents.map((parent) => ({
		parent,
		children: cats
			.filter((c) => c.parent_id === parent.id)
			.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
	}));
}

/* ─── Skeleton components ─── */

function CategorySidebarSkeleton() {
	return (
		<div className="animate-pulse">
			<div className="h-10 bg-[#F0F0F0] rounded-t-xl mb-2" />
			{Array.from({ length: 6 }).map((_, i) => (
				<div key={i} className="h-9 bg-[#F0F0F0] rounded-lg mb-1 mx-2" />
			))}
		</div>
	);
}

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className="bg-white rounded-lg border border-[#E5E5E5] overflow-hidden animate-pulse"
				>
					<div className="aspect-square bg-[#F0F0F0]" />
					<div className="p-2.5 space-y-2">
						<div className="h-3 bg-[#F0F0F0] rounded w-full" />
						<div className="h-3 bg-[#F0F0F0] rounded w-3/4" />
						<div className="h-4 bg-[#F0F0F0] rounded w-1/2" />
						<div className="h-6 bg-[#F0F0F0] rounded w-full" />
					</div>
				</div>
			))}
		</div>
	);
}

/* ─── Main component ─── */

export default function CategoriesPage() {
	/* ── hooks setup ──────────────────────────────────── */
	const { t, i18n } = useTranslation();
	const { dispatch } = useCart();
	const lang = i18n.language;

	/* ── state ────────────────────────────────────────── */
	const [activeCatSlug, setActiveCatSlug] = useState<string | null>(null);
	const [activeSubSlug, setActiveSubSlug] = useState<string | null>(null);
	const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000]);
	const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'sold' | 'rating'>('sold');
	const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

	/* ── effects: API data ────────────────────────────── */
	const { data: catData, loading: catLoading } = useCategories();
	// Stabilise the fallback `[]` so downstream memos don't rebuild every render.
	const allCategories = useMemo<Category[]>(() => catData ?? [], [catData]);

	const filterSlug = activeSubSlug ?? activeCatSlug ?? undefined;

	const apiSort = useMemo(() => {
		switch (sortBy) {
			case 'price-asc':
				return 'price_asc' as const;
			case 'price-desc':
				return 'price_desc' as const;
			case 'sold':
				return 'popular' as const;
			case 'rating':
				return 'popular' as const;
			default:
				return undefined;
		}
	}, [sortBy]);

	const { data: prodData, loading: prodLoading } = useProducts({
		category: filterSlug,
		limit: 100,
		sort: apiSort,
	});

	/* ── effects: derived data ────────────────────────── */
	const tree = useMemo(() => buildCategoryTree(allCategories), [allCategories]);

	const apiProducts = prodData?.products ?? [];

	// Client-side price filter
	const filtered = apiProducts.filter(
		(p) => p.price >= priceRange[0] && p.price <= priceRange[1],
	);

	// Client-side sort (refine API results)
	const sorted = useMemo(() => {
		const arr = [...filtered];
		switch (sortBy) {
			case 'price-asc':
				return arr.sort((a, b) => a.price - b.price);
			case 'price-desc':
				return arr.sort((a, b) => b.price - a.price);
			case 'sold':
				return arr.sort((a, b) => (b.sold_count ?? 0) - (a.sold_count ?? 0));
			case 'rating':
				return arr.sort((a, b) => b.rating - a.rating);
			default:
				return arr;
		}
	}, [filtered, sortBy]);

	const activeParent = allCategories.find((c) => c.slug === activeCatSlug);

	// L6 fix: only top-level categories contribute to the total. The previous code summed
	// every row, which double-counted products that already lived under a parent.
	const totalProductCount = useMemo(
		() =>
			allCategories
				.filter((c) => c.parent_id == null)
				.reduce((sum, c) => sum + (c.product_count ?? 0), 0),
		[allCategories],
	);

	const breadcrumb = [
		{ label: t('nav.home', 'Home'), href: '/' },
		{
			label: t('categories.ui.sidebarHeading', 'Categories'),
			href: '/categories',
		},
		...(activeParent ? [{ label: getCatName(activeParent, lang), href: '#' }] : []),
	];

	/* ── handlers ─────────────────────────────────────── */
	const addToCart = (p: (typeof apiProducts)[0]) => {
		dispatch({
			type: 'ADD',
			payload: {
				productId: String(p.id),
				name: getProductName(p, lang),
				price: p.price,
				quantity: 1,
				image: p.main_image,
				merchantName: '',
			},
		});
		setAddedIds((prev) => new Set(prev).add(p.id));
		setTimeout(
			() =>
				setAddedIds((prev) => {
					const n = new Set(prev);
					n.delete(p.id);
					return n;
				}),
			1500,
		);
	};

	/* ── JSX ──────────────────────────────────────────── */
	return (
		<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
			{/* Breadcrumb */}
			<nav className="flex items-center gap-2 text-sm mb-4 overflow-x-auto">
				{breadcrumb.map((item, idx) => (
					<div key={item.label} className="flex items-center gap-2 shrink-0">
						{idx > 0 && <ChevronRight size={14} className="text-aliTextMute" />}
						<Link
							to={item.href}
							className={
								idx === breadcrumb.length - 1
									? 'text-aliText font-semibold'
									: 'text-aliTextMute hover:text-aliOrange transition-colors'
							}
						>
							{item.label}
						</Link>
					</div>
				))}
			</nav>

			<div className="grid lg:grid-cols-[260px_1fr] gap-6">
				{/* Left Sidebar - Category Tree */}
				<div className="hidden lg:block">
					{catLoading ? (
						<CategorySidebarSkeleton />
					) : (
						<div className="bg-white rounded-xl border border-aliBorder shadow-sm sticky top-24">
							<div className="px-4 py-3 border-b border-aliBorder bg-aliSurface/50 flex items-center gap-2">
								<SlidersHorizontal size={16} className="text-aliOrange" />
								<h3 className="font-bold text-aliText">
									{t('categories.ui.sidebarHeading', 'Categories')}
								</h3>
							</div>
							<div className="p-2">
								{/* All */}
								<button
									onClick={() => {
										setActiveCatSlug(null);
										setActiveSubSlug(null);
									}}
									className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
										activeCatSlug === null
											? 'bg-orange-50 text-aliOrange font-semibold'
											: 'text-aliText hover:bg-aliSurface'
									}`}
								>
									<span>{t('categories.ui.allProducts', 'All Products')}</span>
									<span className="text-xs text-aliTextMute bg-aliSurface px-1.5 py-0.5 rounded">
										{totalProductCount}
									</span>
								</button>

								{/* Category tree */}
								{tree.map(({ parent, children }) => {
									const isActive = activeCatSlug === parent.slug;
									const parentCount = parent.product_count ?? 0;
									return (
										<div key={parent.id}>
											<button
												onClick={() => {
													setActiveCatSlug(isActive ? null : parent.slug);
													setActiveSubSlug(null);
												}}
												className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
													isActive
														? 'bg-orange-50 text-aliOrange font-semibold'
														: 'text-aliText hover:bg-aliSurface'
												}`}
											>
												<span className="flex items-center gap-2">
													{isActive ? (
														<ChevronDown size={14} />
													) : (
														<ChevronRight size={14} />
													)}
													{getCatName(parent, lang)}
												</span>
												<span className="text-xs text-aliTextMute bg-aliSurface px-1.5 py-0.5 rounded">
													{parentCount}
												</span>
											</button>
											{/* Subcategories */}
											{isActive && children.length > 0 && (
												<div className="mr-4 border-r-2 border-aliBorder pr-2 mt-1 space-y-0.5">
													{children.map((sub) => {
														const subCount = sub.product_count ?? 0;
														const isSubActive =
															activeSubSlug === sub.slug;
														return (
															<button
																key={sub.id}
																onClick={() =>
																	setActiveSubSlug(
																		isSubActive
																			? null
																			: sub.slug,
																	)
																}
																className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors ${
																	isSubActive
																		? 'text-aliOrange font-medium bg-orange-50'
																		: 'text-aliTextSec hover:text-aliText hover:bg-aliSurface'
																}`}
															>
																<span className="flex items-center justify-between">
																	<span>
																		{getCatName(sub, lang)}
																	</span>
																	<span className="text-[10px] text-aliTextMute">
																		{subCount}
																	</span>
																</span>
															</button>
														);
													})}
												</div>
											)}
										</div>
									);
								})}
							</div>

							{/* Price Filter */}
							<div className="border-t border-aliBorder p-4">
								<h4 className="font-semibold text-sm text-aliText mb-3">
									{t('categories.ui.price', 'Price')}
								</h4>
								<div className="flex items-center gap-2 mb-2">
									<input
										type="number"
										value={priceRange[0]}
										onChange={(e) =>
											setPriceRange([Number(e.target.value), priceRange[1]])
										}
										className="w-full h-9 rounded-lg border border-aliBorder px-2 text-sm text-aliText outline-none focus:border-aliOrange"
										placeholder="Min"
									/>
									<span className="text-aliTextMute">-</span>
									<input
										type="number"
										value={priceRange[1]}
										onChange={(e) =>
											setPriceRange([priceRange[0], Number(e.target.value)])
										}
										className="w-full h-9 rounded-lg border border-aliBorder px-2 text-sm text-aliText outline-none focus:border-aliOrange"
										placeholder="Max"
									/>
								</div>
								<input
									type="range"
									min={0}
									max={200000}
									step={1000}
									value={priceRange[1]}
									aria-label={t('categories.ui.priceMax', 'Maximum price')}
									onChange={(e) =>
										setPriceRange([priceRange[0], Number(e.target.value)])
									}
									className="w-full accent-aliOrange"
								/>
							</div>
						</div>
					)}
				</div>

				{/* Main Content */}
				<div>
					{/* Header */}
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
						<h1 className="text-xl lg:text-2xl font-bold text-aliText">
							{activeParent
								? getCatName(activeParent, lang)
								: t('categories.ui.allProducts', 'All Products')}
							<span className="text-aliTextMute text-sm font-normal ml-2">
								({sorted.length})
							</span>
						</h1>
						<div className="flex items-center gap-2">
							<Filter size={16} className="text-aliTextMute" />
							<select
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
								aria-label={t('categories.ui.sortLabel', 'Sort by')}
								className="h-9 px-3 rounded-lg border border-aliBorder text-sm text-aliText bg-white outline-none focus:border-aliOrange"
							>
								<option value="sold">
									{t('categories.ui.sortBestSelling', 'Best Selling')}
								</option>
								<option value="price-asc">
									{t('categories.ui.sortPriceAsc', 'Price: Low to High')}
								</option>
								<option value="price-desc">
									{t('categories.ui.sortPriceDesc', 'Price: High to Low')}
								</option>
								<option value="rating">
									{t('categories.ui.sortRating', 'Rating')}
								</option>
							</select>
						</div>
					</div>

					{/* Mobile Category Pills */}
					<div className="flex lg:hidden gap-2 overflow-x-auto pb-3 mb-3">
						<button
							onClick={() => {
								setActiveCatSlug(null);
								setActiveSubSlug(null);
							}}
							className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
								activeCatSlug === null
									? 'bg-aliOrange text-white'
									: 'bg-white border border-aliBorder text-aliText'
							}`}
						>
							{t('categories.ui.allFilter', 'All')}
						</button>
						{tree.map(({ parent }) => (
							<button
								key={parent.id}
								onClick={() => {
									setActiveCatSlug(
										parent.slug === activeCatSlug ? null : parent.slug,
									);
									setActiveSubSlug(null);
								}}
								className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
									activeCatSlug === parent.slug
										? 'bg-aliOrange text-white'
										: 'bg-white border border-aliBorder text-aliText'
								}`}
							>
								{getCatName(parent, lang)}
							</button>
						))}
					</div>

					{/* Product Grid */}
					{prodLoading ? (
						<ProductGridSkeleton />
					) : sorted.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
							{sorted.map((product) => (
								<div
									key={product.id}
									className="bg-white rounded-lg border border-aliBorder overflow-hidden hover:shadow-md hover:border-aliOrange/30 transition-all group"
								>
									<Link
										to={`/product/${product.id}`}
										className="block relative aspect-square overflow-hidden bg-aliSurface"
									>
										<img
											src={product.main_image}
											alt={getProductName(product, lang)}
											className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
										/>
										{product.badges?.includes('bestseller') && (
											<span className="absolute top-2 right-2 bg-aliOrange text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
												Hot
											</span>
										)}
										{product.deal_discount > 0 && (
											<span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
												-{product.deal_discount}%
											</span>
										)}
									</Link>
									<div className="p-2.5">
										<Link to={`/product/${product.id}`}>
											<h3 className="text-sm text-aliText line-clamp-2 hover:text-aliOrange transition-colors min-h-[2.5em]">
												{getProductName(product, lang)}
											</h3>
										</Link>
										<div className="mt-1.5">
											<span className="text-aliOrange font-bold">
												{product.price.toLocaleString()}
											</span>
											<span className="text-aliTextMute text-xs ml-1">
												{t('product.currency')}
											</span>
											{product.original_price > product.price && (
												<span className="text-aliTextMute text-xs line-through ml-1">
													{product.original_price.toLocaleString()}
												</span>
											)}
										</div>
										<div className="flex items-center gap-1 mt-1">
											<Star
												size={12}
												className="text-yellow-400 fill-yellow-400"
											/>
											<span className="text-xs text-aliTextSec">
												{product.rating}
											</span>
											<span className="text-[10px] text-aliTextMute">
												({product.review_count})
											</span>
										</div>
										<div className="flex items-center gap-1.5 mt-1.5">
											<span className="text-[10px] bg-aliSurface text-aliTextSec px-1.5 py-0.5 rounded">
												MOQ:{' '}
												{product.moq ?? 10}
											</span>
											<span className="text-[10px] text-aliTextMute">
												{product.sold_count} sold
											</span>
										</div>
										<button
											onClick={() => addToCart(product)}
											className={`w-full mt-2 h-8 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
												addedIds.has(product.id)
													? 'bg-green-500 text-white'
													: 'bg-aliOrange text-white hover:bg-aliOrangeHover'
											}`}
										>
											<ShoppingCart size={12} />
											{addedIds.has(product.id) ? 'Added!' : 'Add to Cart'}
										</button>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-16 bg-white rounded-xl border border-aliBorder">
							<Search size={48} className="text-aliTextMute mx-auto mb-4" />
							<p className="text-aliTextSec text-lg mb-2">
								{t('categories.ui.noProducts', 'No products found')}
							</p>
							<p className="text-aliTextMute text-sm">
								{t(
									'categories.ui.tryAdjustingFilters',
									'Try adjusting your filters',
								)}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
