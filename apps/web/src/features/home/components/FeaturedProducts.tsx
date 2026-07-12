import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Star, ShoppingCart, Heart } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Badge } from '@/components/ui/badge';
import { ProductImage } from '@/components/ProductImage';
import { SkeletonGrid, SkeletonProductCard } from '@/components/Skeleton';
import { renderPriceBlock, discountPercent, formatDiscountLabel } from '@/lib/utils/safe-format';
import { formatMoney } from '@/lib/format';
import { getProducts, type Product } from '@/lib/api';

gsap.registerPlugin(ScrollTrigger);

interface FeaturedCard {
	id: number;
	name: string;
	nameEn: string;
	merchant: string;
	verified: boolean;
	imageUrl: string | null;
	price: number;
	originalPrice: number | null;
	rating: number;
	reviews: number;
}

function productToCard(p: Product, merchant = ''): FeaturedCard {
	return {
		id: p.id,
		name: p.name_ar ?? '',
		nameEn: p.name_en ?? '',
		merchant,
		verified: true,
		imageUrl: p.main_image ?? null,
		price: Number(p.price ?? 0),
		originalPrice: p.original_price != null ? Number(p.original_price) : null,
		rating: Number(p.rating ?? 0),
		reviews: Number(p.review_count ?? 0),
	};
}

export default function FeaturedProducts() {
	const { t } = useTranslation();
	const sectionRef = useRef<HTMLDivElement>(null);
	const [activeTab, setActiveTab] = useState(0);
	const [emblaRef, emblaApi] = useEmblaCarousel({
		align: 'start',
		direction: 'rtl',
		containScroll: 'trimSnaps',
		slidesToScroll: 1,
	});
	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(true);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [products, setProducts] = useState<FeaturedCard[]>([]);

	const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
	const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

	const onSelect = useCallback(() => {
		if (!emblaApi) return;
		setCanScrollPrev(emblaApi.canScrollPrev());
		setCanScrollNext(emblaApi.canScrollNext());
	}, [emblaApi]);

	useEffect(() => {
		if (!emblaApi) return;
		emblaApi.on('reInit', onSelect);
		emblaApi.on('select', onSelect);
		emblaApi.on('init', onSelect);
		return () => {
			emblaApi.off('reInit', onSelect);
			emblaApi.off('select', onSelect);
			emblaApi.off('init', onSelect);
		};
	}, [emblaApi, onSelect]);

	// Real API load. We use `getProducts` (server-backed, 24 rows in seed)
	// and slice the first 8 for the featured carousel. The previous
	// hard-coded `products` array is now derived from a live fetch.
	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;
		getProducts({ limit: 8 }, { signal: controller.signal })
			.then((res) => {
				if (cancelled) return;
				setProducts(res.products.map((p) => productToCard(p)));
				setLoading(false);
			})
			.catch((err) => {
				if (cancelled || controller.signal.aborted) return;
				setError(err instanceof Error ? err.message : 'Failed to load featured products');
				setLoading(false);
			});
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, []);

	useEffect(() => {
		const ctx = gsap.context(() => {
			gsap.fromTo(
				'.fp-header',
				{ y: 40, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					duration: 0.5,
					ease: 'expo.out',
					scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
				},
			);
		}, sectionRef);
		return () => ctx.revert();
	}, []);

	const tabLabels = useMemo(
		() => [
			t('home.featured.tabAll', 'الكل'),
			t('home.featured.tabElectronics', 'إلكترونيات'),
			t('home.featured.tabFashion', 'أزياء'),
			t('home.featured.tabFood', 'أغذية'),
			t('home.featured.tabHandicrafts', 'حِرف يدوية'),
		],
		[t],
	);

	return (
		<section dir="rtl" ref={sectionRef} className="bg-white py-16 md:py-24 lg:py-[100px]">
			<div className="max-w-container mx-auto container-pad">
				{/* Header */}
				<div className="fp-header flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
					<div>
						<span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
							{t('home.featured.eyebrow', 'مختارات مميزة')}
						</span>
						<h2 className="font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl">
							{t('home.featured.title', 'منتجات يثق بها التجار')}
						</h2>
					</div>
					{/* Tabs */}
					<div className="flex items-center gap-1 bg-[#F8F8F8] rounded-xl p-1 overflow-x-auto">
						{tabLabels.map((tab, i) => (
							<button
								key={i}
								onClick={() => setActiveTab(i)}
								className={`px-4 py-2 rounded-lg text-sm font-cairo font-semibold whitespace-nowrap transition-all ${
									activeTab === i
										? 'bg-[#D4A853] text-[#1A1612]'
										: 'text-[#6B6B6B] hover:text-[#111111]'
								}`}
							>
								{tab}
							</button>
						))}
					</div>
				</div>

				{/* Carousel */}
				<div className="relative">
					{loading && (
						<div className="overflow-hidden">
							<div className="flex gap-4 md:gap-5">
								<SkeletonGrid
									count={5}
									Card={SkeletonProductCard}
									className="!flex !grid-cols-none"
								/>
							</div>
						</div>
					)}

					{!loading && error && (
						<div className="rounded-2xl border border-[#EF4444] bg-[#FEF2F2] p-6 text-center">
							<p className="font-cairo text-sm text-[#991B1B] mb-3">
								{t('home.featured.error', 'تعذّر تحميل المنتجات المميزة.')}
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

					{!loading && !error && (
						<div ref={emblaRef} className="overflow-hidden">
							<div className="flex gap-4 md:gap-5">
								{products.map((product) => {
									const prices = renderPriceBlock(
										{
											price: product.price,
											original_price: product.originalPrice,
											currency: 'YER',
										},
										formatMoney,
									);
									const pct = discountPercent(
										product.price,
										product.originalPrice,
									);
									const discountLabel = formatDiscountLabel(pct, t);
									return (
										<div
											key={product.id}
											className="flex-shrink-0 w-[260px] md:w-[300px]"
										>
											<div className="bg-white rounded-2xl border border-[#F3EDE4] overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group h-full flex flex-col">
												{/* Image */}
												<div className="relative aspect-square overflow-hidden bg-[#F8F8F8]">
													<ProductImage
														src={product.imageUrl}
														alt={product.name}
														altEn={product.nameEn}
														className="w-full h-full group-hover:scale-[1.05] transition-transform duration-500"
													/>
													{discountLabel && (
														<Badge className="absolute top-3 right-3 bg-[#EF4444] text-white text-[10px] font-cairo font-bold px-2 py-1">
															{discountLabel}
														</Badge>
													)}
													<button
														type="button"
														className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
														aria-label="إضافة إلى المفضلة"
													>
														<Heart
															className="w-4 h-4 text-[#6B6B6B]"
															strokeWidth={1.5}
														/>
													</button>
												</div>
												{/* Content */}
												<div className="p-4 flex-1 flex flex-col">
													<h3
														title={product.name}
														className="font-cairo font-semibold text-sm text-[#111111] line-clamp-2 mb-2 leading-relaxed min-h-[2.8em]"
													>
														{product.name}
													</h3>
													<div className="flex items-center gap-1.5 mb-2">
														<span className="text-xs font-cairo text-[#6B6B6B] truncate">
															{product.merchant}
														</span>
														{product.verified && (
															<img
																src="/trust-badge-verified.svg"
																alt={t('product.verified', 'موثّق')}
																className="w-3.5 h-3.5 shrink-0"
															/>
														)}
													</div>
													<div className="flex items-center gap-1 mb-3">
														<Star className="w-3.5 h-3.5 fill-[#D4A853] text-[#D4A853]" />
														<span className="text-xs font-mono text-[#111111]">
															{product.rating.toFixed(1)}
														</span>
														<span className="text-xs text-[#AAAAAA]">
															({product.reviews})
														</span>
													</div>
													<div className="flex items-center justify-between mt-auto">
														<div className="flex items-center gap-2 min-w-0">
															<span
																title={prices.current}
																className="font-mono font-bold text-[#D4A853] text-sm whitespace-nowrap"
															>
																{prices.current}
															</span>
															{prices.original && (
																<span
																	title={prices.original}
																	className="font-mono text-xs text-[#AAAAAA] line-through whitespace-nowrap"
																>
																	{prices.original}
																</span>
															)}
														</div>
														<button
															type="button"
															className="w-8 h-8 rounded-full bg-[#F3EDE4] flex items-center justify-center hover:bg-[#D4A853] transition-colors"
															aria-label="أضف إلى السلة"
														>
															<ShoppingCart
																className="w-4 h-4 text-[#D4A853]"
																strokeWidth={1.5}
															/>
														</button>
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Navigation */}
					{!loading && !error && products.length > 0 && (
						<div className="flex items-center justify-center gap-4 mt-8">
							<button
								type="button"
								onClick={scrollNext}
								disabled={!canScrollNext}
								className="w-10 h-10 rounded-full border-2 border-[#D4A853] flex items-center justify-center text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								aria-label="السابق"
							>
								<ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
							</button>
							<button
								type="button"
								onClick={scrollPrev}
								disabled={!canScrollPrev}
								className="w-10 h-10 rounded-full border-2 border-[#D4A853] flex items-center justify-center text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								aria-label="التالي"
							>
								<ArrowRight className="w-5 h-5" strokeWidth={1.5} />
							</button>
						</div>
					)}
				</div>

				{/* View All */}
				<div className="text-center mt-8">
					<Link
						to="/search"
						className="inline-flex items-center gap-2 text-[#D4A853] font-cairo font-semibold text-sm hover:underline"
					>
						{t('home.featured.viewAll', 'استعرض كل المنتجات')}
						<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
					</Link>
				</div>
			</div>
		</section>
	);
}
