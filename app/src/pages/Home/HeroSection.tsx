import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Search, Store, ShoppingCart, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import gsap from 'gsap';

const floatingProducts = [
	{
		src: '/category-electronics.jpg',
		style: { top: '10%', right: '5%' },
		size: 120,
		delay: 0,
		speed: 0.03,
		tilt: 4,
	},
	{
		src: '/category-clothing.jpg',
		style: { top: '15%', left: '8%' },
		size: 100,
		delay: 0.1,
		speed: 0.02,
		tilt: -3,
	},
	{
		src: '/category-food.jpg',
		style: { bottom: '20%', right: '8%' },
		size: 90,
		delay: 0.2,
		speed: 0.025,
		tilt: 6,
	},
	{
		src: '/category-handicrafts.jpg',
		style: { bottom: '25%', left: '5%' },
		size: 110,
		delay: 0.3,
		speed: 0.035,
		tilt: -5,
	},
	{
		src: '/category-beauty.jpg',
		style: { top: '45%', right: '2%' },
		size: 80,
		delay: 0.4,
		speed: 0.02,
		tilt: 2,
	},
	{
		src: '/category-home.jpg',
		style: { top: '40%', left: '2%' },
		size: 95,
		delay: 0.5,
		speed: 0.03,
		tilt: -7,
	},
	{
		src: '/hero-products-showcase.png',
		style: { top: '5%', right: '30%' },
		size: 70,
		delay: 0.6,
		speed: 0.015,
		tilt: 5,
	},
	{
		src: '/hero-products-showcase.png',
		style: { bottom: '10%', left: '25%' },
		size: 75,
		delay: 0.7,
		speed: 0.028,
		tilt: -4,
	},
];

export default function HeroSection() {
	const sectionRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const productsRef = useRef<HTMLDivElement>(null);
	const mouseRef = useRef({ x: 0, y: 0 });

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
				.fromTo(
					'.floating-product',
					{ scale: 0.8, opacity: 0 },
					{ scale: 1, opacity: 1, duration: 0.5, stagger: 0.08 },
					1.2,
				);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			mouseRef.current = { x: e.clientX, y: e.clientY };
			if (productsRef.current) {
				const children = productsRef.current.children;
				floatingProducts.forEach((product, i) => {
					if (children[i]) {
						const rect = sectionRef.current?.getBoundingClientRect();
						if (rect) {
							const centerX = rect.width / 2;
							const centerY = rect.height / 2;
							const offsetX = (e.clientX - centerX) * product.speed;
							const offsetY = (e.clientY - centerY) * product.speed;
							gsap.to(children[i], {
								x: -offsetX,
								y: -offsetY,
								duration: 0.8,
								ease: 'power2.out',
							});
						}
					}
				});
			}
		};

		window.addEventListener('mousemove', handleMouseMove, { passive: true });
		return () => window.removeEventListener('mousemove', handleMouseMove);
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
			{/* Floating Products */}
			<div
				ref={productsRef}
				className="absolute inset-0 z-[1] pointer-events-none hidden lg:block"
			>
				{floatingProducts.map((product, i) => (
					<div
						key={i}
						className="floating-product absolute rounded-2xl overflow-hidden shadow-md"
						style={{
							...product.style,
							width: product.size,
							height: product.size * 0.75,
							transform: `rotate(${product.tilt}deg)`,
						}}
					>
						<img src={product.src} alt="" className="w-full h-full object-cover" />
					</div>
				))}
			</div>

			{/* Hero Content */}
			<div
				ref={contentRef}
				className="relative z-10 max-w-3xl mx-auto container-pad text-center py-20"
			>
				{/* Overline Badge */}
				<div className="hero-overline inline-flex items-center gap-2 glass-dark px-5 py-2 rounded-full mb-6">
					<span className="w-2 h-2 bg-[#D4A853] rounded-full animate-pulse" />
					<span className="text-[#D4A853] text-xs font-cairo font-semibold tracking-wide">
						منصة التجارة الإلكترونية الأولى في اليمن
					</span>
				</div>

				{/* Headline */}
				<h1 className="font-amiri font-bold leading-[1.05] mb-4">
					<span className="hero-headline-1 block text-[#1A1612] text-4xl md:text-6xl xl:text-[120px] text-shadow-glow">
						بيع واشتري بثقة
					</span>
					<span className="hero-headline-2 block text-4xl md:text-6xl xl:text-[120px] shimmer-text mt-2">
						في نوف-إكس
					</span>
				</h1>

				{/* Subheadline */}
				<p className="hero-subheadline text-[#6B6B6B] text-base md:text-lg xl:text-xl font-cairo max-w-xl mx-auto leading-relaxed mb-8">
					آلاف التجار والمنتجات بين يديك. أنشئ متجرك الإلكتروني وابدأ البيع خلال دقائق.
				</p>

				{/* CTA Buttons */}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
					<Link to="/seller" className="hero-cta w-full sm:w-auto">
						<Button className="w-full sm:w-auto h-14 px-10 bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
							<Store className="w-5 h-5 ml-2" strokeWidth={1.5} />
							ابدأ البيع مجاناً
						</Button>
					</Link>
					<Link to="/search" className="hero-cta w-full sm:w-auto">
						<Button
							variant="outline"
							className="w-full sm:w-auto h-14 px-10 border-2 border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] font-cairo font-bold text-base rounded-2xl transition-all active:scale-[0.98]"
						>
							<ShoppingCart className="w-5 h-5 ml-2" strokeWidth={1.5} />
							تسوق الآن
						</Button>
					</Link>
				</div>

				{/* Search Bar */}
				<div className="hero-search glass-light rounded-2xl h-14 md:h-16 max-w-2xl mx-auto flex items-center shadow-lg overflow-hidden">
					<Button className="h-10 md:h-12 px-6 bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl mr-2 shrink-0">
						<Search className="w-4 h-4 ml-1" strokeWidth={1.5} />
						بحث
					</Button>
					<div className="hidden sm:flex items-center border-l border-[#e0d5c7] pl-3 ml-3 shrink-0">
						<select className="bg-transparent text-sm font-cairo text-[#6B6B6B] outline-none cursor-pointer">
							<option>جميع الفئات</option>
							<option>إلكترونيات</option>
							<option>أزياء</option>
							<option>غذائيات</option>
						</select>
						<ChevronDown className="w-4 h-4 text-[#AAAAAA] mr-1" strokeWidth={1.5} />
					</div>
					<input
						type="text"
						placeholder="ابحث عن منتجات، تجار، أو ماركات..."
						className="flex-1 h-full bg-transparent px-4 text-sm md:text-base font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none text-right"
						dir="rtl"
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
