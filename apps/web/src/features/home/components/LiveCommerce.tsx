import { useEffect, useRef } from 'react';
import { MessageSquare, Zap, Heart, Bell } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

const features = [
	{ icon: MessageSquare, text: 'دردشة مباشرة مع التاجر' },
	{ icon: Zap, text: 'عروض حصرية أثناء البث' },
	{ icon: Heart, text: 'تفاعل وشارك الآخرين' },
];

export default function LiveCommerce() {
	const sectionRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			gsap.fromTo(
				'.lc-video',
				{ scale: 0.95, opacity: 0 },
				{
					scale: 1,
					opacity: 1,
					duration: 0.6,
					ease: 'expo.out',
					scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
				},
			);
			gsap.fromTo(
				'.lc-content',
				{ x: 40, opacity: 0 },
				{
					x: 0,
					opacity: 1,
					duration: 0.5,
					ease: 'expo.out',
					stagger: 0.1,
					scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
				},
			);
		}, sectionRef);
		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} className="gradient-hero py-16 md:py-24 lg:py-[100px]">
			<div className="max-w-container mx-auto container-pad">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
					<div className="lc-video relative rounded-3xl overflow-hidden aspect-video shadow-2xl bg-[#1A1612] flex items-center justify-center p-8 text-center">
						<p className="text-white/70 font-cairo">قريباً</p>
					</div>

					{/* Content Column */}
					<div>
						<span className="lc-content block text-[#EF4444] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3">
							قريباً
						</span>
						<h2 className="lc-content font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl mb-4">
							تسوق مباشر من التجار
						</h2>
						<p className="lc-content text-[#6B6B6B] text-sm md:text-lg font-cairo leading-relaxed mb-6 max-w-md">
							شاهد التجار يعرضون منتجاتهم مباشرة، اسألهم، تفاعل، واشتري فوراً. تجربة
							تسوق جديدة تجمعك بالتاجر مباشرة.
						</p>

						<ul className="lc-content space-y-3 mb-8">
							{features.map((f) => {
								const Icon = f.icon;
								return (
									<li key={f.text} className="flex items-center gap-3">
										<div className="w-9 h-9 rounded-lg bg-[#1A1612]/5 flex items-center justify-center">
											<Icon
												className="w-4 h-4 text-[#D4A853]"
												strokeWidth={1.5}
											/>
										</div>
										<span className="text-[#111111] text-sm md:text-base font-cairo">
											{f.text}
										</span>
									</li>
								);
							})}
						</ul>

						<Button className="lc-content h-12 px-6 bg-[#1A1612] text-white hover:bg-[#2a241e] font-cairo font-semibold rounded-xl">
							<Bell className="w-4 h-4 ml-2" strokeWidth={1.5} />
							سجّل للوصول المبكر
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
