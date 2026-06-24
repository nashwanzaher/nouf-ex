import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Star, ShoppingCart, Heart } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Badge } from '@/components/ui/badge';

gsap.registerPlugin(ScrollTrigger);

const products = [
	{
		id: 1,
		name: 'سماعات بلوتوث لاسلكية — صوت عالي الجودة',
		merchant: 'إلكترونيات اليمن',
		verified: true,
		price: '١٢,٥٠٠',
		oldPrice: '١٥,٠٠٠',
		rating: 4.8,
		reviews: 124,
		sale: true,
		salePercent: 'خصم ٢٠٪',
		image: '/category-electronics.jpg',
	},
	{
		id: 2,
		name: 'ثوب يمني تقليدي مطرز يدوياً — قماش فاخر',
		merchant: 'تراث صنعاء',
		verified: true,
		price: '٨,٥٠٠',
		rating: 4.9,
		reviews: 89,
		sale: false,
		image: '/category-clothing.jpg',
	},
	{
		id: 3,
		name: 'عسل سدر يمني أصلي — ١ كيلوجرام',
		merchant: 'عسل حضرموت',
		verified: true,
		price: '٢٥,٠٠٠',
		oldPrice: '٣٠,٠٠٠',
		rating: 5.0,
		reviews: 256,
		sale: true,
		salePercent: 'خصم ١٧٪',
		image: '/category-food.jpg',
	},
	{
		id: 4,
		name: 'خاتم فضة يمني منقوش يدوياً',
		merchant: 'مجوهرات التراث',
		verified: false,
		price: '٦,٠٠٠',
		rating: 4.7,
		reviews: 67,
		sale: false,
		image: '/category-handicrafts.jpg',
	},
	{
		id: 5,
		name: 'طقم قهوة عربية فاخر — ٦ أكواب',
		merchant: 'بيت التراث',
		verified: true,
		price: '٩,٥٠٠',
		oldPrice: '١٢,٠٠٠',
		rating: 4.6,
		reviews: 45,
		sale: true,
		salePercent: 'خصم ٢١٪',
		image: '/category-home.jpg',
	},
	{
		id: 6,
		name: 'بخور عود يمني فاخر — طبيعي ١٠٠٪',
		merchant: 'عود اليمن',
		verified: true,
		price: '١٨,٠٠٠',
		rating: 4.9,
		reviews: 178,
		sale: false,
		image: '/category-beauty.jpg',
	},
	{
		id: 7,
		name: 'لابتوب احترافي للألعاب والتصميم',
		merchant: 'تك اليمن',
		verified: true,
		price: '٣٥٠,٠٠٠',
		oldPrice: '٤٠٠,٠٠٠',
		rating: 4.5,
		reviews: 92,
		sale: true,
		salePercent: 'خصم ١٣٪',
		image: '/category-electronics.jpg',
	},
	{
		id: 8,
		name: 'سجادة يمنية يدوية الصنع — صوف طبيعي',
		merchant: 'سجاد صنعاء',
		verified: true,
		price: '٤٥,٠٠٠',
		rating: 4.8,
		reviews: 34,
		sale: false,
		image: '/category-handicrafts.jpg',
	},
];

const tabs = ['الكل', 'إلكترونيات', 'أزياء', 'غذائيات', 'حرف يدوية'];

export default function FeaturedProducts() {
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

	return (
		<section ref={sectionRef} className="bg-white py-16 md:py-24 lg:py-[100px]">
			<div className="max-w-container mx-auto container-pad">
				{/* Header */}
				<div className="fp-header flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
					<div>
						<span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
							منتجات مميزة
						</span>
						<h2 className="font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl">
							الأكثر مبيعاً هذا الأسبوع
						</h2>
					</div>
					{/* Tabs */}
					<div className="flex items-center gap-1 bg-[#F8F8F8] rounded-xl p-1 overflow-x-auto">
						{tabs.map((tab, i) => (
							<button
								key={tab}
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
					<div ref={emblaRef} className="overflow-hidden">
						<div className="flex gap-4 md:gap-5">
							{products.map((product) => (
								<div
									key={product.id}
									className="flex-shrink-0 w-[260px] md:w-[300px]"
								>
									<div className="bg-white rounded-2xl border border-[#F3EDE4] overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
										{/* Image */}
										<div className="relative aspect-square overflow-hidden bg-[#F8F8F8]">
											<img
												src={product.image}
												alt={product.name}
												className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
											/>
											{product.sale && (
												<Badge className="absolute top-3 right-3 bg-[#EF4444] text-white text-[10px] font-cairo font-bold px-2 py-1">
													{product.salePercent}
												</Badge>
											)}
											<button className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
												<Heart
													className="w-4 h-4 text-[#6B6B6B]"
													strokeWidth={1.5}
												/>
											</button>
										</div>
										{/* Content */}
										<div className="p-4">
											<h3 className="font-cairo font-semibold text-sm text-[#111111] line-clamp-2 mb-2 leading-relaxed min-h-[2.8em]">
												{product.name}
											</h3>
											<div className="flex items-center gap-1.5 mb-2">
												<span className="text-xs font-cairo text-[#6B6B6B]">
													{product.merchant}
												</span>
												{product.verified && (
													<img
														src="/trust-badge-verified.svg"
														alt="موثق"
														className="w-3.5 h-3.5"
													/>
												)}
											</div>
											<div className="flex items-center gap-1 mb-3">
												<Star className="w-3.5 h-3.5 fill-[#D4A853] text-[#D4A853]" />
												<span className="text-xs font-mono text-[#111111]">
													{product.rating}
												</span>
												<span className="text-xs text-[#AAAAAA]">
													({product.reviews})
												</span>
											</div>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<span className="font-mono font-bold text-[#D4A853] text-sm">
														{product.price} ر.ي
													</span>
													{product.oldPrice && (
														<span className="font-mono text-xs text-[#AAAAAA] line-through">
															{product.oldPrice}
														</span>
													)}
												</div>
												<button className="w-8 h-8 rounded-full bg-[#F3EDE4] flex items-center justify-center hover:bg-[#D4A853] transition-colors group/btn">
													<ShoppingCart
														className="w-4 h-4 text-[#D4A853] group-hover/btn:text-[#1A1612]"
														strokeWidth={1.5}
													/>
												</button>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Navigation */}
					<div className="flex items-center justify-center gap-4 mt-8">
						<button
							onClick={scrollNext}
							disabled={!canScrollNext}
							className="w-10 h-10 rounded-full border-2 border-[#D4A853] flex items-center justify-center text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						>
							<ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
						</button>
						<button
							onClick={scrollPrev}
							disabled={!canScrollPrev}
							className="w-10 h-10 rounded-full border-2 border-[#D4A853] flex items-center justify-center text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						>
							<ArrowRight className="w-5 h-5" strokeWidth={1.5} />
						</button>
					</div>
				</div>

				{/* View All */}
				<div className="text-center mt-8">
					<Link
						to="/search"
						className="inline-flex items-center gap-2 text-[#D4A853] font-cairo font-semibold text-sm hover:underline"
					>
						عرض جميع المنتجات
						<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
					</Link>
				</div>
			</div>
		</section>
	);
}
