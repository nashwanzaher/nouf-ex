import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Smartphone, Shirt, Coffee, Gem, Home, Sparkles, ArrowLeft } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const categories = [
	{
		name: 'إلكترونيات',
		image: '/category-electronics.jpg',
		icon: Smartphone,
		count: '+١٥,٠٠٠ منتج',
	},
	{ name: 'أزياء وموضة', image: '/category-clothing.jpg', icon: Shirt, count: '+٢٥,٠٠٠ منتج' },
	{ name: 'غذائيات', image: '/category-food.jpg', icon: Coffee, count: '+١٠,٠٠٠ منتج' },
	{ name: 'حرف يدوية', image: '/category-handicrafts.jpg', icon: Gem, count: '+٥,٠٠٠ منتج' },
	{ name: 'منزل وأثاث', image: '/category-home.jpg', icon: Home, count: '+١٢,٠٠٠ منتج' },
	{ name: 'جمال وعناية', image: '/category-beauty.jpg', icon: Sparkles, count: '+٨,٠٠٠ منتج' },
];

export default function CategoriesGrid() {
	const sectionRef = useRef<HTMLDivElement>(null);

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
	}, []);

	return (
		<section ref={sectionRef} className="bg-[#F3EDE4] py-16 md:py-24 lg:py-[100px]">
			<div className="max-w-container mx-auto container-pad">
				{/* Section Header */}
				<div className="cat-header text-center mb-10 md:mb-14">
					<span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
						تصفح حسب الفئة
					</span>
					<h2 className="font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl mb-4">
						اكتشف كل ما تحتاجه
					</h2>
					<p className="text-[#6B6B6B] text-sm md:text-lg font-cairo max-w-lg mx-auto">
						من الإلكترونيات إلى المنتجات التقليدية، كل شيء في مكان واحد
					</p>
				</div>

				{/* Grid */}
				<div className="cat-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
					{categories.map((cat) => {
						const Icon = cat.icon;
						return (
							<Link
								to="/categories"
								key={cat.name}
								className="cat-card group relative rounded-3xl overflow-hidden aspect-[3/4] shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
							>
								<img
									src={cat.image}
									alt={cat.name}
									className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-500"
								/>
								<div className="absolute inset-0 gradient-card-overlay" />
								<div className="absolute bottom-0 left-0 right-0 p-4 text-center">
									<Icon
										className="w-6 h-6 text-[#D4A853] mx-auto mb-2"
										strokeWidth={1.5}
									/>
									<h3 className="text-white font-cairo font-bold text-sm md:text-base mb-1">
										{cat.name}
									</h3>
									<span className="text-[#AAAAAA] text-xs font-cairo">
										{cat.count}
									</span>
								</div>
							</Link>
						);
					})}
				</div>

				{/* View All */}
				<div className="text-center mt-8">
					<Link
						to="/categories"
						className="inline-flex items-center gap-2 text-[#D4A853] font-cairo font-semibold text-sm hover:underline transition-all"
					>
						عرض جميع الفئات
						<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
					</Link>
				</div>
			</div>
		</section>
	);
}
