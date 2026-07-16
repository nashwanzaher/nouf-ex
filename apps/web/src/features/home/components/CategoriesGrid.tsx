/**
 * CategoriesGrid - live-backed section that lists the top-level
 * categories of the marketplace (server-backed via /api/categories).
 *
 * This is a rewrite of the previous hard-coded list. The original
 * used a static `categories` array with hard-coded image paths that
 * never resolved (the Vite dev server serves the SPA at a different
 * origin than the API, so relative `/category-*.jpg` produced broken
 * <img> tags). The new version:
 *   1. Fetches /api/categories on mount.
 *   2. Falls back to a per-name icon (emojis/lucide) when the server
 *      record has no `image_url` set.
 *   3. Uses <ProductImage> (our safe <img> wrapper) so even missing
 *      paths degrade to /images/placeholder.svg instead of 404.
 *   4. Shows a <SkeletonGrid> while loading, an error retry block if
 *      the fetch fails, and an empty-state message if the API returns
 *      zero rows.
 *
 * Behaviour preserved from the original: 6-column grid on lg, 3 on
 * md, 2 on mobile. RTL layout via `dir="rtl"` on the section.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Smartphone, Shirt, Coffee, Gem, Home, Sparkles, ArrowLeft } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ProductImage } from '@/components/ProductImage';
import { SkeletonCategoryCard, SkeletonGrid } from '@/components/Skeleton';
import { getCategories, type Category } from '@/lib/api';

gsap.registerPlugin(ScrollTrigger);

interface CategoryCard {
	id: number;
	name: string;
	nameEn: string;
	imageUrl: string | null;
	productCount: number;
}

// Map an Arabic / English name to a representative lucide icon.
// The DB doesn't store an icon column, so we derive one from the
// name as a safe fallback. Memoized in useMemo to avoid re-computing
// on every render.
const pickIcon = (name: string) => {
	const n = (name ?? '').toLowerCase();
	if (n.includes('إلكترون') || n.includes('electronic') || n.includes('phone')) return Smartphone;
	if (n.includes('أزياء') || n.includes('موضة') || n.includes('fashion') || n.includes('cloth'))
		return Shirt;
	if (n.includes('أغذية') || n.includes('طعام') || n.includes('food') || n.includes('coffee'))
		return Coffee;
	if (n.includes('حِرف') || n.includes('يدوية') || n.includes('craft') || n.includes('gift'))
		return Gem;
	if (n.includes('جمال') || n.includes('عطور') || n.includes('beauty')) return Sparkles;
	if (n.includes('منزل') || n.includes('أثاث') || n.includes('home') || n.includes('house'))
		return Home;
	return Sparkles;
};

export default function CategoriesGrid() {
	const { t, i18n } = useTranslation();
	const sectionRef = useRef<HTMLDivElement>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [categories, setCategories] = useState<CategoryCard[]>([]);

	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;
		const lang = i18n.language;
		getCategories({ signal: controller.signal })
			.then((res: Category[]) => {
				if (cancelled) return;
				setLoading(false);
				setCategories(
					res.map((c: Category) => ({
						id: c.id,
						name: lang === 'en' ? c.name_en : lang === 'zh' ? c.name_zh : c.name_ar,
						nameEn: c.name_en ?? '',
						imageUrl: c.image_url ?? null,
						productCount: Number(c.product_count ?? 0),
					})),
				);
			})
			.catch((err) => {
				if (cancelled || controller.signal.aborted) return;
				setLoading(false);
				setError(err instanceof Error ? err.message : 'Failed to load categories');
			});
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [i18n.language]);

	useEffect(() => {
		const ctx = gsap.context(() => {
			gsap.fromTo(
				'.cat-header',
				{ y: 40, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					duration: 0.5,
					ease: 'expo.out',
					scrollTrigger: {
						trigger: sectionRef.current,
						start: 'top 80%',
						toggleActions: 'play none none none',
					},
				},
			);
			gsap.fromTo(
				'.cat-card',
				{ y: 30, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					duration: 0.4,
					ease: 'expo.out',
					stagger: 0.1,
					scrollTrigger: {
						trigger: '.cat-grid',
						start: 'top 85%',
						toggleActions: 'play none none none',
					},
				},
			);
		}, sectionRef);
		return () => ctx.revert();
	}, [loading]);

	const headerLabels = useMemo(
		() => ({
			eyebrow: t('home.categories.eyebrow', 'تصفح حسب الفئة'),
			title: t('home.categories.title', 'اكتشف كل ما تحتاجه'),
			subtitle: t(
				'home.categories.subtitle',
				'من الإلكترونيات إلى المنتجات التقليدية، كل شيء في مكان واحد',
			),
			viewAll: t('home.categories.viewAll', 'عرض جميع الفئات'),
			productCount: (n: number) =>
				t('home.categories.productCount', `${n} منتج`, { count: n }),
		}),
		[t],
	);

	return (
		<section dir="rtl" ref={sectionRef} className="bg-[#F3EDE4] py-16 md:py-24 lg:py-[100px]">
			<div className="max-w-container mx-auto container-pad">
				{/* Section Header */}
				<div className="cat-header text-center mb-10 md:mb-14">
					<span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
						{headerLabels.eyebrow}
					</span>
					<h2 className="font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl mb-4">
						{headerLabels.title}
					</h2>
					<p className="text-[#6B6B6B] text-sm md:text-lg font-cairo max-w-lg mx-auto">
						{headerLabels.subtitle}
					</p>
				</div>

				{/* Loading skeleton */}
				{loading && (
					<div className="cat-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
						<SkeletonGrid
							count={6}
							Card={SkeletonCategoryCard}
							className="!flex !grid-cols-none"
						/>
					</div>
				)}

				{/* Error state */}
				{!loading && error && (
					<div className="cat-grid rounded-2xl border border-[#EF4444] bg-[#FEF2F2] p-6 text-center max-w-md mx-auto">
						<p className="font-cairo text-sm text-[#991B1B] mb-3">
							{t('home.categories.error', 'تعذّر تحميل الفئات.')}
						</p>
						<button
							type="button"
							onClick={() => location.reload()}
							className="px-4 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-cairo font-semibold"
						>
							{t('common.retry', 'حاول مجددًا')}
						</button>
					</div>
				)}

				{/* Empty state */}
				{!loading && !error && categories.length === 0 && (
					<div className="text-center py-10">
						<p className="font-cairo text-sm text-[#6B6B6B]">
							{t('home.categories.empty', 'لا توجد فئات متاحة حاليًا.')}
						</p>
					</div>
				)}

				{/* Loaded grid */}
				{!loading && !error && categories.length > 0 && (
					<div className="cat-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
						{categories.map((cat) => {
							const Icon = pickIcon(cat.nameEn || cat.name);
							return (
								<Link
									to={`/search?category=${encodeURIComponent(cat.nameEn || cat.name)}`}
									key={cat.id}
									className="cat-card group relative rounded-3xl overflow-hidden aspect-[3/4] shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
									aria-label={cat.name}
								>
									<ProductImage
										src={cat.imageUrl}
										alt={cat.name}
										altEn={cat.nameEn}
										kind="category"
										className="absolute inset-0 w-full h-full group-hover:scale-[1.08] transition-transform duration-500"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-[#1A1612]/80 via-[#1A1612]/30 to-transparent" />
									<div className="absolute bottom-0 left-0 right-0 p-4 text-center">
										<Icon
											className="w-6 h-6 text-[#D4A853] mx-auto mb-2"
											strokeWidth={1.5}
											aria-hidden="true"
										/>
										<h3 className="text-white font-cairo font-bold text-sm md:text-base mb-1 truncate">
											{cat.name}
										</h3>
										{cat.productCount > 0 && (
											<span className="text-[#FFFFFF]/80 text-xs font-cairo block">
												{headerLabels.productCount(cat.productCount)}
											</span>
										)}
									</div>
								</Link>
							);
						})}
					</div>
				)}

				{/* View All */}
				<div className="text-center mt-8">
					<Link
						to="/categories"
						className="inline-flex items-center gap-2 text-[#D4A853] font-cairo font-semibold text-sm hover:underline transition-all"
					>
						{headerLabels.viewAll}
						<ArrowLeft className="w-4 h-4 rtl-flip" strokeWidth={1.5} />
					</Link>
				</div>
			</div>
		</section>
	);
}
