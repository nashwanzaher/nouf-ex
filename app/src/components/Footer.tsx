import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Truck, RefreshCw, Headphones } from 'lucide-react';

/**
 * P1-8 — Footer i18n pass.
 *
 * Every user-visible string in this component is now pulled from the
 * `footer.*` (and the small set of `nav.*`) i18n namespaces, with an
 * English fallback so the component still renders correctly during
 * initial load or when a key is missing from the active locale.
 */
export default function Footer() {
	const { t, i18n } = useTranslation();
	const year = new Date().getFullYear();

	const footerColumns = [
		{
			title: t('footer.column.about', 'About Nouf-ex'),
			links: [
				{ label: t('footer.link.about', 'About Us'), href: '#' },
				{ label: t('footer.link.careers', 'Careers'), href: '#' },
				{ label: t('footer.link.press', 'Press'), href: '#' },
				{ label: t('footer.link.blog', 'Blog'), href: '#' },
			],
		},
		{
			title: t('footer.column.buyers', 'For Buyers'),
			links: [
				{ label: t('footer.link.howToBuy', 'How to Buy'), href: '#' },
				{ label: t('nav.rfq', 'Request for Quotation'), href: '#' },
				{ label: t('nav.tradeAssurance', 'Trade Assurance'), href: '#' },
				{ label: t('footer.link.myOrders', 'My Orders'), href: '/customer/orders' },
			],
		},
		{
			title: t('footer.column.sellers', 'For Sellers'),
			links: [
				{ label: t('footer.link.howToSell', 'How to Sell'), href: '#' },
				{ label: t('nav.sellerDashboard', 'Seller Dashboard'), href: '/seller' },
				{ label: t('footer.link.subscriptions', 'Subscriptions'), href: '#' },
				{ label: t('footer.link.helpCenter', 'Help Center'), href: '#' },
			],
		},
		{
			title: t('footer.column.help', 'Help'),
			links: [
				{ label: t('footer.link.contact', 'Contact Us'), href: '#' },
				{ label: t('footer.link.terms', 'Terms of Service'), href: '#' },
				{ label: t('footer.link.privacy', 'Privacy Policy'), href: '#' },
				{ label: t('footer.link.faq', 'FAQ'), href: '#' },
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
								title: t('nav.tradeAssurance', 'Trade Assurance'),
								desc: t('footer.trust.tradeAssurance.desc', 'Buyer protection'),
							},
							{
								icon: Truck,
								title: t('footer.trust.shipping.title', 'Reliable Shipping'),
								desc: t('footer.trust.shipping.desc', 'Trackable delivery'),
							},
							{
								icon: RefreshCw,
								title: t('footer.trust.returns.title', 'Easy Returns'),
								desc: t('footer.trust.returns.desc', '30-day returns'),
							},
							{
								icon: Headphones,
								title: t('footer.trust.support.title', '24/7 Support'),
								desc: t('footer.trust.support.desc', 'Always here to help'),
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
							{t(
								'footer.brand.tagline',
								'The leading B2B trade platform in Yemen & MENA. Connecting you to thousands of verified suppliers.',
							)}
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
										{link.href.startsWith('/') ? (
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
						&copy; {year} Nouf-ex. {t('footer.copyright', 'All rights reserved.')}
					</p>
					<div className="flex items-center gap-4 text-xs text-white/40">
						<span>{t('footer.bottomLinks.terms', 'Terms')}</span>
						<span>{t('footer.bottomLinks.privacy', 'Privacy')}</span>
						<span>{t('footer.bottomLinks.cookies', 'Cookies')}</span>
					</div>
				</div>
			</div>
		</footer>
	);
}
