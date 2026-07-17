import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, ShoppingCart, Store } from 'lucide-react';
import gsap from 'gsap';
import { Button } from '@/components/ui/button';

export default function HeroSection() {
	const { t, i18n } = useTranslation();
	const sectionRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

			tl.fromTo(
				'.hero-overline',
				{ y: 20, opacity: 0 },
				{ y: 0, opacity: 1, duration: 0.4 },
				0,
			)
				.fromTo(
					'.hero-headline-1',
					{ y: 60, opacity: 0 },
					{ y: 0, opacity: 1, duration: 0.6 },
					0.2,
				)
				.fromTo(
					'.hero-headline-2',
					{ y: 60, opacity: 0 },
					{ y: 0, opacity: 1, duration: 0.6 },
					0.4,
				)
				.fromTo(
					'.hero-subheadline',
					{ y: 30, opacity: 0 },
					{ y: 0, opacity: 1, duration: 0.4 },
					0.6,
				)
				.fromTo(
					'.hero-cta',
					{ y: 20, opacity: 0 },
					{ y: 0, opacity: 1, duration: 0.3, stagger: 0.1 },
					0.8,
				)
				.fromTo(
					'.hero-search',
					{ y: 20, opacity: 0 },
					{ y: 0, opacity: 1, duration: 0.4 },
					1,
				)
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={sectionRef}
			className="relative min-h-[100dvh] bg-[#F3EDE4] flex items-center justify-center overflow-hidden"
			style={{
				backgroundImage: 'url(/hero-bg-pattern.svg)',
				backgroundSize: '400px',
				backgroundRepeat: 'repeat',
				backgroundPosition: 'center',
			}}
		>
			{/* Hero Content */}
			<div
				ref={contentRef}
				className="relative z-10 max-w-3xl mx-auto container-pad text-center py-20"
			>
				{/* Overline Badge */}
				<div className="hero-overline inline-flex items-center gap-2 glass-dark px-5 py-2 rounded-full mb-6">
					<span className="w-2 h-2 bg-[#D4A853] rounded-full animate-pulse" />
					<span className="text-[#D4A853] text-xs font-cairo font-semibold tracking-wide">
						{t('hero.overline', "Yemen's #1 e-commerce platform")}
					</span>
				</div>

				{/* Headline */}
				<h1 className="font-amiri font-bold leading-[1.05] mb-4">
					<span className="hero-headline-1 block text-[#1A1612] text-4xl md:text-6xl xl:text-[120px] text-shadow-glow">
						{t('hero.headline1', 'Buy & sell with confidence')}
					</span>
					<span className="hero-headline-2 block text-4xl md:text-6xl xl:text-[120px] shimmer-text mt-2">
						{t('hero.headline2', 'on Nouf-ex')}
					</span>
				</h1>

				{/* Subheadline */}
				<p className="hero-subheadline text-[#6B6B6B] text-base md:text-lg xl:text-xl font-cairo max-w-xl mx-auto leading-relaxed mb-8">
					{t(
						'hero.subheadline',
						'Thousands of merchants and products at your fingertips. Create your online store and start selling in minutes.',
					)}
				</p>

				{/* CTA Buttons */}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
					<Link to="/seller" className="hero-cta w-full sm:w-auto">
						<Button className="w-full sm:w-auto h-14 px-10 bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
							<Store className="w-5 h-5 ml-2" strokeWidth={1.5} />
							{t('hero.ctaStartSelling', 'Start Selling Free')}
						</Button>
					</Link>
					<Link to="/search" className="hero-cta w-full sm:w-auto">
						<Button
							variant="outline"
							className="w-full sm:w-auto h-14 px-10 border-2 border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] font-cairo font-bold text-base rounded-2xl transition-all active:scale-[0.98]"
						>
							<ShoppingCart className="w-5 h-5 ml-2" strokeWidth={1.5} />
							{t('hero.ctaShopNow', 'Shop Now')}
						</Button>
					</Link>
				</div>

				{/* Search Bar */}
				<div className="hero-search glass-light rounded-2xl h-14 md:h-16 max-w-2xl mx-auto flex items-center shadow-lg overflow-hidden">
					<Button className="h-10 md:h-12 px-6 bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl mr-2 shrink-0">
						<Search className="w-4 h-4 ml-1" strokeWidth={1.5} />
						{t('hero.searchButton', 'Search')}
					</Button>
					<div className="hidden sm:flex items-center border-l border-[#e0d5c7] pl-3 ml-3 shrink-0">
						<select
							aria-label={t('hero.searchCategoryLabel', 'Category')}
							className="bg-transparent text-sm font-cairo text-[#6B6B6B] outline-none cursor-pointer"
						>
							<option>{t('hero.searchAllCategories', 'All Categories')}</option>
							<option>{t('hero.searchElectronics', 'Electronics')}</option>
							<option>{t('hero.searchFashion', 'Fashion')}</option>
							<option>{t('hero.searchFood', 'Food')}</option>
						</select>
						<ChevronDown className="w-4 h-4 text-[#AAAAAA] mr-1" strokeWidth={1.5} />
					</div>
					<input
						type="text"
						placeholder={t(
							'hero.searchPlaceholder',
							'Search products, merchants, or brands...',
						)}
						className="flex-1 h-full bg-transparent px-4 text-sm md:text-base font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none text-right"
						dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
					/>
					<Search
						className="w-5 h-5 text-[#AAAAAA] mr-4 shrink-0 hidden md:block"
						strokeWidth={1.5}
					/>
				</div>
			</div>
		</section>
	);
}
