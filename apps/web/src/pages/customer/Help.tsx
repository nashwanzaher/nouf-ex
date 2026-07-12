import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, HelpCircle, Mail, MessageCircle, Phone, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQ = [
	{
		qKey: 'customer.help.faq.placeOrder',
		aKey: 'customer.help.faq.placeOrderA',
	},
	{
		qKey: 'customer.help.faq.payment',
		aKey: 'customer.help.faq.paymentA',
	},
	{
		qKey: 'customer.help.faq.shipping',
		aKey: 'customer.help.faq.shippingA',
	},
	{
		qKey: 'customer.help.faq.returns',
		aKey: 'customer.help.faq.returnsA',
	},
	{
		qKey: 'customer.help.faq.account',
		aKey: 'customer.help.faq.accountA',
	},
];

export default function CustomerHelp() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const [openIdx, setOpenIdx] = useState<number | null>(0);
	const [message, setMessage] = useState('');

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={isRTL ? 'rtl' : 'ltr'}>
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200">
				<div className="max-w-4xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<Link
						to="/customer"
						className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
					>
						<ArrowRight
							className={cn('w-5 h-5 text-gray-700', isRTL ? 'rotate-180' : '')}
						/>
					</Link>
					<div>
						<p className="text-[10px] uppercase tracking-widest text-[#D4A853] font-bold">
							{t('customer.help')}
						</p>
						<p className="text-sm font-extrabold text-gray-900">
							{t('customer.help')}
						</p>
					</div>
				</div>
			</header>

			<div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				{/* Hero */}
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex items-center gap-4">
						<div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
							<HelpCircle size={26} className="text-[#D4A853]" />
						</div>
						<div>
							<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
								{t('customer.help')}
							</p>
							<h1 className="text-xl font-bold mt-1">
								{t('customer.help.subtitle', 'How can we help?')}
							</h1>
							<p className="text-sm text-white/60 mt-1">
								{t('customer.help.description', 'Browse FAQs or contact us directly.')}
							</p>
						</div>
					</div>
				</div>

				{/* Contact cards */}
				<div className="grid grid-cols-3 gap-3">
					<ContactCard
						icon={Mail}
						label={t('customer.help.email', 'Email')}
						value="support@noufex.com"
					/>
					<ContactCard
						icon={Phone}
						label={t('customer.help.phone', 'Phone')}
						value="+967 800 0000"
					/>
					<ContactCard
						icon={MessageCircle}
						label={t('customer.help.chat', 'Live chat')}
						value="9am–9pm"
					/>
				</div>

				{/* FAQ */}
				<section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
					<header className="px-5 py-4 border-b border-gray-100">
						<h2 className="text-base font-bold text-gray-900">
							{t('customer.help.faq', 'Frequently asked questions')}
						</h2>
					</header>
					<div className="divide-y divide-gray-100">
						{FAQ.map((item, i) => {
							const open = openIdx === i;
							return (
								<div key={item.qKey}>
									<button
										type="button"
										onClick={() => setOpenIdx(open ? null : i)}
										className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-start"
									>
										<span className="text-sm font-semibold text-gray-900">
											{t(item.qKey)}
										</span>
										<ArrowRight
											size={16}
											className={cn(
												'text-gray-400 shrink-0 transition-transform',
												open && 'rotate-90',
												isRTL && 'rotate-180',
											)}
										/>
									</button>
									{open && (
										<div className="px-5 pb-4 text-sm text-gray-600">
											{t(item.aKey)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</section>

				{/* Contact form */}
				<section className="bg-white rounded-2xl border border-gray-200 p-6">
					<h2 className="text-base font-bold text-gray-900 mb-1">
						{t('customer.help.contactUs', 'Send us a message')}
					</h2>
					<p className="text-xs text-gray-500 mb-4">
						{t('customer.help.responseTime', 'We usually reply within 24 hours.')}
					</p>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							setMessage('');
						}}
						className="space-y-3"
					>
						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder={t('customer.help.messagePlaceholder', 'Type your message…')}
							rows={4}
							className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none resize-none"
						/>
						<button
							type="submit"
							disabled={!message.trim()}
							className="px-5 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
						>
							<Send size={14} />
							{t('customer.help.send', 'Send')}
						</button>
					</form>
				</section>
			</div>
		</div>
	);
}

function ContactCard({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Mail;
	label: string;
	value: string;
}) {
	return (
		<div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
			<div className="w-10 h-10 rounded-lg bg-[#D4A853]/10 text-[#D4A853] flex items-center justify-center mx-auto mb-2">
				<Icon size={18} />
			</div>
			<p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
				{label}
			</p>
			<p className="text-sm font-bold text-gray-900 mt-1 truncate">{value}</p>
		</div>
	);
}
