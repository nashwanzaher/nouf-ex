import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Star, ArrowLeft, Store } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';
import { useStores } from '@/hooks/useApi';
import { safeImageUrl } from '@/lib/utils/safe-format';

gsap.registerPlugin(ScrollTrigger);

function getStoreName(store: { store_name?: string; store_name_en?: string; store_name_zh?: string }, lang: string) {
	if (lang === 'en') return store.store_name_en ?? store.store_name ?? '';
	if (lang === 'zh') return store.store_name_zh ?? store.store_name ?? '';
	return store.store_name ?? store.store_name_en ?? '';
}

function getStoreDescription(store: { description?: string; description_en?: string; description_zh?: string }, lang: string) {
	if (lang === 'en') return store.description_en ?? store.description ?? '';
	if (lang === 'zh') return store.description_zh ?? store.description ?? '';
	return store.description ?? store.description_en ?? '';
}

export default function FeaturedMerchants() {
	const { t, i18n } = useTranslation();
	const sectionRef = useRef<HTMLDivElement>(null);
	const { data: stores, loading } = useStores();

	const merchants = (stores ?? [])
		.filter((s) => s.is_verified || Number(s.rating) >= 4.5)
		.slice(0, 6);

	useEffect(() => {
		const ctx = gsap.context(() => {
			gsap.fromTo(
				'.fm-header',
				{ y: 40, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					duration: 0.5,
					ease: 'expo.out',
					scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
				},
			);
			gsap.fromTo(
				'.fm-card',
				{ y: 40, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					duration: 0.5,
					ease: 'expo.out',
					stagger: 0.15,
					scrollTrigger: { trigger: '.fm-grid', start: 'top 85%' },
				},
			);
		}, sectionRef);
		return () => ctx.revert();
	}, [merchants.length]);

	if (!loading && merchants.length === 0) return null;

	return (
		<section ref={sectionRef} className="bg-[#1A1612] py-16 md:py-24 lg:py-[100px]">
			<div className="max-w-container mx-auto container-pad">
				{/* Header */}
				<div className="fm-header text-center mb-10 md:mb-14">
					<span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
						{t('home.featuredMerchants.eyebrow', 'تجار موثوقون')}
					</span>
					<h2 className="font-amiri font-bold text-white text-2xl md:text-4xl lg:text-5xl mb-4 gradient-text">
						{t('home.featuredMerchants.title', 'تجارنا المميزون')}
					</h2>
					<p className="text-[#AAAAAA] text-sm md:text-lg font-cairo max-w-lg mx-auto">
						{t('home.featuredMerchants.subtitle', 'تجار تم التحقق منهم وحصلوا على أعلى التقييمات')}
					</p>
				</div>

				{/* Grid */}
				<div className="fm-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{loading
						? Array.from({ length: 6 }).map((_, i) => (
								<div
									key={i}
									className="fm-card bg-white/[0.04] border border-white/[0.08] rounded-3xl overflow-hidden animate-pulse"
								>
									<div className="h-[120px] bg-white/10" />
									<div className="px-5 pb-5 -mt-10">
										<div className="w-16 h-16 rounded-full bg-white/10 mb-3" />
										<div className="h-5 bg-white/10 rounded w-1/2 mb-2" />
										<div className="h-3 bg-white/10 rounded w-1/3 mb-3" />
										<div className="h-8 bg-white/10 rounded w-full mt-4" />
									</div>
								</div>
							))
						: merchants.map((merchant) => (
								<div
									key={merchant.id}
									className="fm-card bg-white/[0.04] border border-white/[0.08] rounded-3xl overflow-hidden hover:border-[#D4A853]/50 hover:shadow-gold transition-all duration-300 hover:-translate-y-1.5 group"
								>
									{/* Banner */}
									<div className="relative h-[120px] overflow-hidden">
										<img
											src={safeImageUrl(merchant.banner, { kind: 'store', fallback: '/merchant-banner-default.jpg' })}
											alt=""
											className="w-full h-full object-cover"
										/>
										<div className="absolute inset-0 bg-gradient-to-t from-[#1A1612] to-transparent opacity-60" />
									</div>

									{/* Avatar & Info */}
									<div className="relative px-5 pb-5 -mt-10">
										<div className="flex items-end gap-3 mb-3">
											<img
												src={safeImageUrl(merchant.logo, { kind: 'store', fallback: '/default-avatar.png' })}
												alt={getStoreName(merchant, i18n.language)}
												className="w-16 h-16 rounded-full border-3 border-[#1A1612] object-cover"
											/>
											<div className="flex items-center gap-1 mb-1">
												{merchant.is_verified === 1 && (
													<img
														src="/trust-badge-verified.svg"
														alt={t('home.featuredMerchants.verified', 'موثق')}
														className="w-5 h-5"
													/>
												)}
												{merchant.trust_level === 'golden' && (
													<img
														src="/trust-badge-golden.svg"
														alt={t('home.featuredMerchants.golden', 'ذهبي')}
														className="w-5 h-5"
													/>
												)}
											</div>
										</div>

										<h3 className="font-cairo font-bold text-white text-lg mb-1">
											{getStoreName(merchant, i18n.language)}
										</h3>
										<span className="inline-block bg-[#D4A853]/10 text-[#D4A853] text-xs font-cairo px-3 py-1 rounded-full mb-3">
											{merchant.governorate || t('home.featuredMerchants.store', 'متجر')}
										</span>

										{merchant.description && (
											<p className="text-[#AAAAAA] text-sm font-cairo leading-relaxed mb-4 line-clamp-2">
												{getStoreDescription(merchant, i18n.language)}
											</p>
										)}

										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3 text-sm">
												<span className="flex items-center gap-1 text-[#D4A853]">
													<Star className="w-4 h-4 fill-[#D4A853]" />
													{Number(merchant.rating ?? 0).toFixed(1)}
												</span>
												<span className="text-[#AAAAAA] font-mono">
													{merchant.products_count ?? 0} {t('home.featuredMerchants.productsCount', 'منتج')}
												</span>
											</div>
										</div>

										<Link to={`/store/${merchant.id}`} className="block mt-4">
											<Button
												variant="outline"
												className="w-full border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] font-cairo font-semibold rounded-xl h-11 transition-all"
											>
												<Store className="w-4 h-4 ml-2" strokeWidth={1.5} />
												{t('home.featuredMerchants.visitStore', 'زيارة المتجر')}
											</Button>
										</Link>
									</div>
								</div>
							))}
				</div>

				{/* CTA */}
				<div className="text-center mt-10">
					<Link to="/seller">
						<Button
							variant="outline"
							className="border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] font-cairo font-semibold rounded-xl h-12 px-8"
						>
							{t('home.featuredMerchants.cta', 'كن تاجراً مميزاً')}
							<ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
						</Button>
					</Link>
				</div>
			</div>
		</section>
	);
}
