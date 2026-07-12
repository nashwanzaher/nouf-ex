import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ShoppingBag, Package } from 'lucide-react';

interface AuthLayoutProps {
	children: ReactNode;
	showBackLink?: boolean;
	backLink?: string;
	backLabel?: string;
}

export default function AuthLayout({
	children,
	showBackLink = true,
	backLink = '/',
	backLabel = 'العودة للرئيسية',
}: AuthLayoutProps) {
	return (
		<div className="min-h-[100dvh] flex" dir="rtl">
			{/* Right Panel — Brand (hidden on mobile) */}
			<div className="hidden md:flex md:w-[40%] lg:w-[45%] relative flex-col items-center justify-center p-10 gradient-hero overflow-hidden">
				{/* Background pattern */}
				<div className="absolute inset-0 opacity-10">
					<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
						<defs>
							<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
								<path
									d="M 40 0 L 0 0 0 40"
									fill="none"
									stroke="#D4A853"
									strokeWidth="0.5"
								/>
							</pattern>
						</defs>
						<rect width="100%" height="100%" fill="url(#grid)" />
					</svg>
				</div>

				<div className="relative z-10 text-center">
					<Link to="/" className="inline-block mb-8">
						<img src="/noufex-logo.svg" alt="نوف-إكس" className="h-14 mx-auto" />
					</Link>

					<p className="font-cairo text-lg text-[#1A1612] mb-8 leading-relaxed max-w-xs mx-auto">
						منصة التجارة الإلكترونية الأولى في اليمن
					</p>

					{/* Trust badges */}
					<div className="flex items-center justify-center gap-4 mb-8">
						<div className="flex flex-col items-center gap-1">
							<div className="w-10 h-10 bg-[#1A1612]/10 rounded-xl flex items-center justify-center">
								<ShoppingBag className="w-5 h-5 text-[#1A1612]" strokeWidth={1.5} />
							</div>
							<span className="text-[10px] font-cairo text-[#1A1612]/70">موثق</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<div className="w-10 h-10 bg-[#D4A853]/20 rounded-xl flex items-center justify-center">
								<Package className="w-5 h-5 text-[#1A1612]" strokeWidth={1.5} />
							</div>
							<span className="text-[10px] font-cairo text-[#1A1612]/70">ذهبي</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<div className="w-10 h-10 bg-[#1A1612]/10 rounded-xl flex items-center justify-center">
								<svg
									className="w-5 h-5 text-[#1A1612]"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={1.5}
								>
									<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
								</svg>
							</div>
							<span className="text-[10px] font-cairo text-[#1A1612]/70">ماسي</span>
						</div>
					</div>

					{/* Stats */}
					<div className="flex items-center justify-center gap-6 text-sm text-[#6B6B6B] font-cairo">
						<span>+١٠,٠٠٠ تاجر</span>
						<span className="w-1 h-1 bg-[#D4A853] rounded-full" />
						<span>+٥٠٠,٠٠٠ منتج</span>
					</div>
				</div>

				{/* Decorative skyline */}
				<div className="absolute bottom-0 left-0 right-0 h-32 opacity-20 pointer-events-none">
					<svg viewBox="0 0 400 100" preserveAspectRatio="none" className="w-full h-full">
						<path
							d="M0,100 L0,60 L20,60 L20,40 L40,40 L40,70 L60,70 L60,30 L80,30 L80,50 L100,50 L100,80 L120,80 L120,20 L140,20 L140,60 L160,60 L160,45 L180,45 L180,75 L200,75 L200,35 L220,35 L220,55 L240,55 L240,70 L260,70 L260,40 L280,40 L280,60 L300,60 L300,25 L320,25 L320,50 L340,50 L340,65 L360,65 L360,45 L380,45 L380,70 L400,70 L400,100 Z"
							fill="#D4A853"
						/>
					</svg>
				</div>
			</div>

			{/* Left Panel — Form */}
			<div className="flex-1 flex flex-col bg-white overflow-y-auto">
				<div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-20">
					<div className="w-full max-w-[480px] mx-auto">
						{showBackLink && (
							<Link
								to={backLink}
								className="inline-flex items-center gap-1 text-sm text-[#6B6B6B] font-cairo hover:text-[#D4A853] transition-colors mb-6"
							>
								<svg
									className="w-4 h-4 rotate-180"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={1.5}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 5l7 7-7 7"
									/>
								</svg>
								{backLabel}
							</Link>
						)}
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
