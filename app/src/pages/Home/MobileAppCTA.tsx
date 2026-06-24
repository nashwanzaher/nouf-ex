import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function MobileAppCTA() {
	const sectionRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			gsap.fromTo(
				'.app-content',
				{ x: 40, opacity: 0 },
				{
					x: 0,
					opacity: 1,
					duration: 0.6,
					ease: 'expo.out',
					scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
				},
			);
			gsap.fromTo(
				'.app-mockup',
				{ x: -40, opacity: 0, rotate: 0 },
				{
					x: 0,
					opacity: 1,
					rotate: -5,
					duration: 0.8,
					ease: 'expo.out',
					scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
				},
			);
		}, sectionRef);
		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={sectionRef}
			className="bg-[#1A1612] py-16 md:py-24 lg:py-[100px] overflow-hidden"
		>
			<div className="max-w-container mx-auto container-pad">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
					{/* Content */}
					<div className="app-content text-center lg:text-right">
						<span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
							تطبيق نوف-إكس
						</span>
						<h2 className="font-amiri font-bold text-white text-2xl md:text-4xl lg:text-5xl mb-4 text-shadow-glow">
							التجارة في جيبك
						</h2>
						<p className="text-[#AAAAAA] text-sm md:text-lg font-cairo leading-relaxed mb-8 max-w-md mx-auto lg:mr-0 lg:ml-auto">
							حمّل تطبيق نوف-إكس واستمتع بتجربة تسوق سلسة. تتبع طلباتك، تواصل مع
							التجار، واستلم إشعارات فورية.
						</p>

						{/* App Store Buttons */}
						<div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-6">
							<button className="h-12 px-5 bg-[#111111] border border-white/20 rounded-xl flex items-center gap-3 hover:border-[#D4A853]/50 transition-colors w-full sm:w-auto justify-center">
								<svg
									className="w-6 h-6 text-white"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
								</svg>
								<div className="text-left">
									<div className="text-[9px] text-[#AAAAAA] font-cairo leading-none">
										Download on the
									</div>
									<div className="text-sm text-white font-cairo font-bold leading-tight">
										App Store
									</div>
								</div>
							</button>
							<button className="h-12 px-5 bg-[#111111] border border-white/20 rounded-xl flex items-center gap-3 hover:border-[#D4A853]/50 transition-colors w-full sm:w-auto justify-center">
								<svg
									className="w-6 h-6 text-white"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
								</svg>
								<div className="text-left">
									<div className="text-[9px] text-[#AAAAAA] font-cairo leading-none">
										GET IT ON
									</div>
									<div className="text-sm text-white font-cairo font-bold leading-tight">
										Google Play
									</div>
								</div>
							</button>
						</div>

						{/* QR Code placeholder */}
						<div className="flex items-center gap-3 justify-center lg:justify-start">
							<div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center">
								<svg viewBox="0 0 80 80" className="w-16 h-16">
									<rect x="5" y="5" width="25" height="25" fill="#1A1612" />
									<rect x="10" y="10" width="15" height="15" fill="white" />
									<rect x="13" y="13" width="9" height="9" fill="#1A1612" />
									<rect x="50" y="5" width="25" height="25" fill="#1A1612" />
									<rect x="55" y="10" width="15" height="15" fill="white" />
									<rect x="58" y="13" width="9" height="9" fill="#1A1612" />
									<rect x="5" y="50" width="25" height="25" fill="#1A1612" />
									<rect x="10" y="55" width="15" height="15" fill="white" />
									<rect x="13" y="58" width="9" height="9" fill="#1A1612" />
									<rect x="35" y="5" width="8" height="8" fill="#1A1612" />
									<rect x="35" y="18" width="8" height="8" fill="#1A1612" />
									<rect x="45" y="35" width="8" height="8" fill="#1A1612" />
									<rect x="58" y="35" width="8" height="8" fill="#1A1612" />
									<rect x="35" y="50" width="8" height="8" fill="#1A1612" />
									<rect x="50" y="50" width="8" height="8" fill="#1A1612" />
									<rect x="65" y="50" width="8" height="8" fill="#1A1612" />
									<rect x="35" y="65" width="8" height="8" fill="#1A1612" />
									<rect x="50" y="65" width="8" height="8" fill="#1A1612" />
									<rect x="65" y="65" width="8" height="8" fill="#1A1612" />
								</svg>
							</div>
							<span className="text-xs text-[#AAAAAA] font-cairo">امسح للتحميل</span>
						</div>
					</div>

					{/* Phone Mockup */}
					<div className="app-mockup flex items-center justify-center">
						<img
							src="/app-mockup-hero.png"
							alt="تطبيق نوف-إكس"
							className="max-w-[280px] md:max-w-[320px] animate-float drop-shadow-2xl"
							style={{ transform: 'rotate(-5deg)' }}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
