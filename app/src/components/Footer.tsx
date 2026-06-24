import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Truck, RefreshCw, Headphones } from 'lucide-react';

export default function Footer() {
	const { i18n } = useTranslation();
	const year = new Date().getFullYear();

	const footerColumns = [
		{
			title:
				i18n.language === 'ar'
					? 'عن Nouf-ex'
					: i18n.language === 'zh'
						? '关于Nouf-ex'
						: 'About Nouf-ex',
			links: [
				{ label: i18n.language === 'ar' ? 'عن الشركة' : 'About Us', href: '#' },
				{ label: i18n.language === 'ar' ? 'الوظائف' : 'Careers', href: '#' },
				{ label: i18n.language === 'ar' ? 'الصحافة' : 'Press', href: '#' },
				{ label: i18n.language === 'ar' ? 'مدونة' : 'Blog', href: '#' },
			],
		},
		{
			title:
				i18n.language === 'ar'
					? 'للمشترين'
					: i18n.language === 'zh'
						? '买家中心'
						: 'For Buyers',
			links: [
				{ label: i18n.language === 'ar' ? 'كيفية الشراء' : 'How to Buy', href: '#' },
				{
					label: i18n.language === 'ar' ? 'طلب عرض أسعار' : 'Request for Quotation',
					href: '#',
				},
				{ label: i18n.language === 'ar' ? 'ضمان التجارة' : 'Trade Assurance', href: '#' },
				{
					label: i18n.language === 'ar' ? 'المشتريات' : 'My Orders',
					href: '/customer/orders',
				},
			],
		},
		{
			title:
				i18n.language === 'ar'
					? 'للبائعين'
					: i18n.language === 'zh'
						? '卖家中心'
						: 'For Sellers',
			links: [
				{ label: i18n.language === 'ar' ? 'كيفية البيع' : 'How to Sell', href: '#' },
				{
					label: i18n.language === 'ar' ? 'لوحة التاجر' : 'Seller Dashboard',
					href: '/seller',
				},
				{ label: i18n.language === 'ar' ? 'الاشتراكات' : 'Subscriptions', href: '#' },
				{ label: i18n.language === 'ar' ? 'مركز المساعدة' : 'Help Center', href: '#' },
			],
		},
		{
			title: i18n.language === 'ar' ? 'الدعم' : i18n.language === 'zh' ? '帮助中心' : 'Help',
			links: [
				{ label: i18n.language === 'ar' ? 'اتصل بنا' : 'Contact Us', href: '#' },
				{
					label: i18n.language === 'ar' ? 'الشروط والأحكام' : 'Terms of Service',
					href: '#',
				},
				{ label: i18n.language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy', href: '#' },
				{ label: i18n.language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ', href: '#' },
			],
		},
	];

	return (
		<footer className="bg-[#333333] text-white" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
			{/* Trust Badges */}
			<div className="border-b border-white/10">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						{[
							{
								icon: ShieldCheck,
								title: i18n.language === 'ar' ? 'ضمان التجارة' : 'Trade Assurance',
								desc:
									i18n.language === 'ar' ? 'حماية مشترياتك' : 'Buyer protection',
							},
							{
								icon: Truck,
								title: i18n.language === 'ar' ? 'شحن موثوق' : 'Reliable Shipping',
								desc: i18n.language === 'ar' ? 'تتبع الشحن' : 'Trackable delivery',
							},
							{
								icon: RefreshCw,
								title: i18n.language === 'ar' ? 'سياسة الإرجاع' : 'Easy Returns',
								desc:
									i18n.language === 'ar' ? 'إرجاع خلال 30 يوم' : '30-day returns',
							},
							{
								icon: Headphones,
								title: i18n.language === 'ar' ? 'دعم 24/7' : '24/7 Support',
								desc:
									i18n.language === 'ar' ? 'مساعدة دائمة' : 'Always here to help',
							},
						].map((item) => (
							<div key={item.title} className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
									<item.icon size={20} className="text-aliOrange" />
								</div>
								<div>
									<p className="font-semibold text-sm">{item.title}</p>
									<p className="text-xs text-white/60">{item.desc}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Main Footer */}
			<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-10">
				<div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
					{/* Brand */}
					<div className="col-span-2 lg:col-span-1">
						<Link to="/" className="inline-block mb-3">
							<span className="text-xl font-extrabold text-aliOrange">Nouf-ex</span>
						</Link>
						<p className="text-white/60 text-sm leading-relaxed mb-4">
							{i18n.language === 'ar'
								? 'منصة التجارة B2B الرائدة في اليمن والشرق الأوسط. نوصلك بآلاف الموردين الموثوقين.'
								: i18n.language === 'zh'
									? '也门和中东地区领先的B2B贸易平台。连接您与数千个值得信赖的供应商。'
									: 'The leading B2B trade platform in Yemen & MENA. Connecting you to thousands of verified suppliers.'}
						</p>
						<div className="flex items-center gap-2">
							{['facebook', 'twitter', 'instagram', 'linkedin'].map((social) => (
								<a
									key={social}
									href="#"
									className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-aliOrange transition-colors"
								>
									<span className="text-xs font-bold uppercase">{social[0]}</span>
								</a>
							))}
						</div>
					</div>

					{/* Link Columns */}
					{footerColumns.map((col) => (
						<div key={col.title}>
							<h4 className="font-bold text-sm mb-4">{col.title}</h4>
							<ul className="space-y-2">
								{col.links.map((link) => (
									<li key={link.label}>
										{'href' in link && link.href.startsWith('/') ? (
											<Link
												to={link.href}
												className="text-white/60 text-sm hover:text-aliOrange transition-colors"
											>
												{link.label}
											</Link>
										) : (
											<a
												href={link.href}
												className="text-white/60 text-sm hover:text-aliOrange transition-colors"
											>
												{link.label}
											</a>
										)}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>

			{/* Copyright */}
			<div className="border-t border-white/10">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
					<p className="text-white/40 text-xs">
						&copy; {year} Nouf-ex.{' '}
						{i18n.language === 'ar'
							? 'جميع الحقوق محفوظة'
							: i18n.language === 'zh'
								? '版权所有'
								: 'All rights reserved.'}
					</p>
					<div className="flex items-center gap-4 text-xs text-white/40">
						<span>Terms</span>
						<span>Privacy</span>
						<span>Cookies</span>
					</div>
				</div>
			</div>
		</footer>
	);
}
