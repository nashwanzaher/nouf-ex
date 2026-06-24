import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Star, ArrowLeft, Store } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

const merchants = [
	{
		id: 1,
		name: 'إلكترونيات اليمن',
		banner: '/merchant-banner-default.jpg',
		avatar: '/testimonial-avatar-1.jpg',
		verified: true,
		golden: true,
		category: 'إلكترونيات',
		rating: 4.9,
		products: 1250,
		description: 'أفضل المنتجات الإلكترونية بأسعار تنافسية وضمان شامل',
	},
	{
		id: 2,
		name: 'تراث صنعاء',
		banner: '/merchant-banner-default.jpg',
		avatar: '/testimonial-avatar-3.jpg',
		verified: true,
		golden: false,
		category: 'أزياء تقليدية',
		rating: 4.8,
		products: 890,
		description: 'ملابس تراثية يمنية أصيلة مطرزة بأيدي يمنية',
	},
	{
		id: 3,
		name: 'عسل حضرموت',
		banner: '/merchant-banner-default.jpg',
		avatar: '/testimonial-avatar-2.jpg',
		verified: true,
		golden: true,
		category: 'منتجات غذائية',
		rating: 5.0,
		products: 45,
		description: 'عسل سدر يمني أصلي ١٠٠٪ من خيرات اليمن',
	},
	{
		id: 4,
		name: 'مجوهرات التراث',
		banner: '/merchant-banner-default.jpg',
		avatar: '/testimonial-avatar-3.jpg',
		verified: true,
		golden: false,
		category: 'مجوهرات وحرف',
		rating: 4.7,
		products: 320,
		description: 'مجوهرات فضة يمنية تقليدية منقوشة يدوياً',
	},
	{
		id: 5,
		name: 'عود اليمن',
		banner: '/merchant-banner-default.jpg',
		avatar: '/testimonial-avatar-1.jpg',
		verified: true,
		golden: true,
		category: 'عطور وبخور',
		rating: 4.9,
		products: 67,
		description: 'بخور وعود يمني فاخر طبيعي ١٠٠٪',
	},
	{
		id: 6,
		name: 'بيت التراث',
		banner: '/merchant-banner-default.jpg',
		avatar: '/testimonial-avatar-2.jpg',
		verified: true,
		golden: false,
		category: 'منزل وأثاث',
		rating: 4.6,
		products: 210,
		description: 'أثاث وديكور يمني تقليدي بأناقة عصرية',
	},
];

export default function FeaturedMerchants() {
	const sectionRef = useRef<HTMLDivElement>(null);

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
	}, []);

	return (
		<section ref={sectionRef} className="bg-[#1A1612] py-16 md:py-24 lg:py-[100px]">
			<div className="max-w-container mx-auto container-pad">
				{/* Header */}
				<div className="fm-header text-center mb-10 md:mb-14">
					<span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
						تجار موثوقون
					</span>
					<h2 className="font-amiri font-bold text-white text-2xl md:text-4xl lg:text-5xl mb-4 gradient-text">
						تجارنا المميزون
					</h2>
					<p className="text-[#AAAAAA] text-sm md:text-lg font-cairo max-w-lg mx-auto">
						تجار تم التحقق منهم وحصلوا على أعلى التقييمات
					</p>
				</div>

				{/* Grid */}
				<div className="fm-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{merchants.map((merchant) => (
						<div
							key={merchant.id}
							className="fm-card bg-white/[0.04] border border-white/[0.08] rounded-3xl overflow-hidden hover:border-[#D4A853]/50 hover:shadow-gold transition-all duration-300 hover:-translate-y-1.5 group"
						>
							{/* Banner */}
							<div className="relative h-[120px] overflow-hidden">
								<img
									src={merchant.banner}
									alt=""
									className="w-full h-full object-cover"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-[#1A1612] to-transparent opacity-60" />
							</div>

							{/* Avatar & Info */}
							<div className="relative px-5 pb-5 -mt-10">
								<div className="flex items-end gap-3 mb-3">
									<img
										src={merchant.avatar}
										alt={merchant.name}
										className="w-16 h-16 rounded-full border-3 border-[#1A1612] object-cover"
									/>
									<div className="flex items-center gap-1 mb-1">
										{merchant.verified && (
											<img
												src="/trust-badge-verified.svg"
												alt="موثق"
												className="w-5 h-5"
											/>
										)}
										{merchant.golden && (
											<img
												src="/trust-badge-golden.svg"
												alt="ذهبي"
												className="w-5 h-5"
											/>
										)}
									</div>
								</div>

								<h3 className="font-cairo font-bold text-white text-lg mb-1">
									{merchant.name}
								</h3>
								<span className="inline-block bg-[#D4A853]/10 text-[#D4A853] text-xs font-cairo px-3 py-1 rounded-full mb-3">
									{merchant.category}
								</span>

								<p className="text-[#AAAAAA] text-sm font-cairo leading-relaxed mb-4 line-clamp-2">
									{merchant.description}
								</p>

								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3 text-sm">
										<span className="flex items-center gap-1 text-[#D4A853]">
											<Star className="w-4 h-4 fill-[#D4A853]" />
											{merchant.rating}
										</span>
										<span className="text-[#AAAAAA] font-mono">
											{merchant.products} منتج
										</span>
									</div>
								</div>

								<Link to={`/store/${merchant.id}`} className="block mt-4">
									<Button
										variant="outline"
										className="w-full border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] font-cairo font-semibold rounded-xl h-11 transition-all"
									>
										<Store className="w-4 h-4 ml-2" strokeWidth={1.5} />
										زيارة المتجر
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
							كن تاجراً مميزاً
							<ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
						</Button>
					</Link>
				</div>
			</div>
		</section>
	);
}
