import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ChevronLeft,
	CreditCard,
	Loader2,
	MapPin,
	Package,
	PackageCheck,
	Phone,
	Truck,
	CheckCircle2,
	X,
	MessageSquare,
	Navigation2,
	User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { useDeliveryAgentOrders, useDeliveryAgentMutations } from '@/hooks/useApi';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
	confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
	processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
	shipped: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
	out_for_delivery: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
	delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
	cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
	returned: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
};

const ORDER_STEPS = ['confirmed', 'shipped', 'out_for_delivery', 'delivered'] as const;

function statusTimeline(status: string): number {
	switch (status) {
		case 'confirmed':
		case 'processing':
			return 1;
		case 'shipped':
			return 2;
		case 'out_for_delivery':
			return 3;
		case 'delivered':
			return 4;
		default:
			return 0;
	}
}

function OrderTimeline({ status }: { status: string }) {
	const { t } = useTranslation();
	const currentStep = statusTimeline(status);
	return (
		<div className="flex items-center gap-1.5 mt-3" role="list">
			{ORDER_STEPS.map((step, i) => {
				const completed = i < currentStep;
				const active = i === currentStep - 1;
				return (
					<div key={step} className="flex items-center gap-1.5 flex-1">
						<div
							className={cn(
								'flex-1 h-1 rounded-full transition-colors',
								completed || active ? 'bg-[#D4A853]' : 'bg-gray-200',
							)}
						/>
						<span
							className={cn(
								'text-[10px] font-medium shrink-0',
								completed || active ? 'text-[#D4A853]' : 'text-gray-400',
							)}
						>
							{t(`delivery.status.${step}`)}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const { t } = useTranslation();
	const colors = STATUS_COLORS[status] ?? STATUS_COLORS.confirmed;
	return (
		<span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', colors.bg, colors.text)}>
			<span className={cn('w-2 h-2 rounded-full', colors.dot)} />
			{t(`delivery.status.${status}`)}
		</span>
	);
}

export default function DeliveryAgentOrderDetail() {
	const { t, i18n } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const lang: 'ar' | 'en' | 'zh' = (i18n.language as 'ar' | 'en' | 'zh') || 'en';
	const orderId = Number(id);
	const mutations = useDeliveryAgentMutations();

	const { data: orders, loading } = useDeliveryAgentOrders();
	const order = orders?.find((o) => o.id === orderId);

	const [showActionSheet, setShowActionSheet] = useState<'out_for_delivery' | 'delivered' | null>(null);

	if (loading || !order) {
		return (
			<div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-[#D4A853]" />
			</div>
		);
	}

	const isDelivered = order.status === 'delivered';
	const canMarkOutForDelivery = ['confirmed', 'processing', 'shipped'].includes(order.status);
	const canMarkDelivered = order.status === 'out_for_delivery';
	const isCod = order.payment_method === 'cod';

	const handleAction = async (status: 'out_for_delivery' | 'delivered') => {
		await mutations.updateDeliveryStatus(orderId, status);
		setShowActionSheet(null);
	};

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
			{/* TOP BAR */}
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
				<div className="max-w-4xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<Link to="/delivery-agent/orders" className="p-2 rounded-lg hover:bg-gray-100">
						<ChevronLeft className={cn('w-5 h-5', lang === 'ar' ? 'rotate-180' : '')} />
					</Link>
					<div className="flex-1">
						<h1 className="text-base font-bold text-gray-900">{t('delivery.orderDetails')}</h1>
						<p className="text-xs text-gray-500">#{order.order_number ?? order.id}</p>
					</div>
				</div>
			</header>

			<div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				{/* STATUS HEADER */}
				<div className="bg-white rounded-2xl border border-gray-200 p-5">
					<div className="flex flex-wrap items-start justify-between gap-4 mb-4">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
								<Package size={22} className="text-orange-600" />
							</div>
							<div>
								<p className="text-xs text-gray-500">{t('delivery.orderNumber')}</p>
								<p className="text-xl font-extrabold text-gray-900">#{order.order_number ?? order.id}</p>
							</div>
						</div>
						<StatusBadge status={order.status} />
					</div>

					<OrderTimeline status={order.status} />

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
						<div>
							<p className="text-xs text-gray-500">{t('delivery.paymentMethod')}</p>
							<p className="font-semibold text-gray-900 flex items-center gap-1">
								{isCod ? <CreditCard size={14} className="text-amber-600" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
								{isCod ? t('delivery.cod') : t('delivery.prepaid')}
							</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">{t('delivery.itemsCount')}</p>
							<p className="font-semibold text-gray-900 flex items-center gap-1">
								<Package size={14} /> {order.items_count}
							</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">{t('delivery.createdAt')}</p>
							<p className="font-semibold text-gray-900">{new Date(order.created_at).toLocaleString()}</p>
						</div>
						<div className="text-right md:text-left">
							<p className="text-xs text-gray-500">{t('delivery.orderTotal')}</p>
							<p className="text-xl font-extrabold text-gray-900">{formatMoney(Number(order.total ?? 0), { lang })}</p>
						</div>
					</div>
				</div>

				{/* ACTION BUTTONS */}
				{!isDelivered && (
					<div className="bg-white rounded-2xl border border-gray-200 p-4">
						<div className="flex flex-wrap gap-3" role="group" aria-label={t('delivery.deliveryActions')}>
							{canMarkOutForDelivery && (
								<button
									onClick={() => setShowActionSheet('out_for_delivery')}
									className="flex-1 min-w-[150px] py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
								>
									<Truck size={18} />
									{t('delivery.markOutForDelivery')}
								</button>
							)}
							{canMarkDelivered && (
								<button
									onClick={() => setShowActionSheet('delivered')}
									className="flex-1 min-w-[150px] py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
								>
									<PackageCheck size={18} />
									{t('delivery.markDelivered')}
								</button>
							)}
						</div>
					</div>
				)}

				{/* CUSTOMER INFO */}
				<div className="bg-white rounded-2xl border border-gray-200 p-6">
					<h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
						<User size={18} className="text-[#D4A853]" />
						{t('delivery.customerInfo')}
					</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<p className="text-xs text-gray-500">{t('delivery.name')}</p>
							<p className="font-medium text-gray-900">{order.customer_name}</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">{t('delivery.phone')}</p>
							<p className="font-medium text-gray-900">{order.customer_phone}</p>
						</div>
					</div>
				</div>

				{/* SHIPPING ADDRESS */}
				<div className="bg-white rounded-2xl border border-gray-200 p-6">
					<h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
						<MapPin size={18} className="text-[#D4A853]" />
						{t('delivery.deliveryAddress')}
					</h3>
					<div className="bg-gray-50 rounded-lg p-4">
						<p className="font-semibold text-gray-900 mb-2">{order.shipping_name ?? order.customer_name}</p>
						<p className="text-sm text-gray-700 mb-1">{order.shipping_phone ?? order.customer_phone}</p>
						<p className="text-sm text-gray-600">
							{JSON.stringify(order.shipping_address, null, 2)}
						</p>
					</div>
					<div className="mt-4 flex gap-2">
						<button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold transition-colors">
							<Navigation2 size={14} />
							{t('delivery.navigate')}
						</button>
						<a href={`tel:${order.shipping_phone ?? order.customer_phone}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-bold text-gray-700">
							<Phone size={14} />
							{t('delivery.call')}
						</a>
						<a href={`sms:${order.shipping_phone ?? order.customer_phone}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-bold text-gray-700">
							<MessageSquare size={14} />
							{t('delivery.message')}
						</a>
					</div>
				</div>

				{/* STORE INFO */}
				<div className="bg-white rounded-2xl border border-gray-200 p-6">
					<h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
						<Package size={18} className="text-[#D4A853]" />
						{t('delivery.storeInfo')}
					</h3>
					<div className="flex items-start gap-4">
						<div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
							{order.store_logo ? (
								<img src={order.store_logo} alt={order.store_name} className="w-full h-full object-cover rounded-full" />
							) : (
								<Package size={16} className="text-gray-400" />
							)}
						</div>
						<div>
							<p className="font-semibold text-gray-900">{order.store_name}</p>
							{order.store_location && <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={12} /> {order.store_location}</p>}
							{order.store_phone && <a href={`tel:${order.store_phone}`} className="text-sm text-[#D4A853] hover:underline flex items-center gap-1"><Phone size={12} /> {order.store_phone}</a>}
						</div>
					</div>
				</div>

				{/* ORDER ITEMS */}
				<div className="bg-white rounded-2xl border border-gray-200 p-6">
					<h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
						<Package size={18} className="text-[#D4A853]" />
						{t('delivery.items')} ({order.items_count})
					</h3>
					<div className="space-y-3">
						{/* Items would come from the detailed order API */}
						<div className="text-center py-8 text-gray-500">
							<Package size={24} className="mx-auto mb-2 text-gray-300" />
							<p>{t('delivery.itemsDetailUnavailable')}</p>
						</div>
					</div>
				</div>

				{/* PAYMENT INFO */}
				<div className="bg-white rounded-2xl border border-gray-200 p-6">
					<h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
						<CreditCard size={18} className="text-[#D4A853]" />
						{t('delivery.paymentInfo')}
					</h3>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-xs text-gray-500">{t('delivery.paymentMethod')}</p>
							<p className="font-medium text-gray-900 capitalize">{order.payment_method}</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">{t('delivery.paymentStatus')}</p>
							<p className="font-medium text-gray-900 capitalize">{order.payment_status}</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">{t('delivery.subtotal')}</p>
							<p className="font-medium text-gray-900">{formatMoney(Number(order.subtotal ?? 0), { lang })}</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">{t('delivery.shippingCost')}</p>
							<p className="font-medium text-gray-900">{formatMoney(Number(order.shipping_cost ?? 0), { lang })}</p>
						</div>
						<div className="sm:col-span-2">
							<p className="text-xs text-gray-500">{t('delivery.discount')}</p>
							<p className="font-medium text-gray-900">{formatMoney(Number(order.discount ?? 0), { lang })}</p>
						</div>
						<div className="sm:col-span-2 pt-2 border-t border-gray-100">
							<p className="text-xs text-gray-500">{t('delivery.total')}</p>
							<p className="text-xl font-extrabold text-gray-900">{formatMoney(Number(order.total ?? 0), { lang })}</p>
						</div>
					</div>
				</div>
			</div>

			{/* ACTION SHEET */}
			{showActionSheet && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<div className="absolute inset-0 bg-black/60" onClick={() => setShowActionSheet(null)} />
					<div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl p-6 animate-slide-up">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-bold text-gray-900">
								{showActionSheet === 'out_for_delivery' ? t('delivery.markOutForDelivery') : t('delivery.markDelivered')}
							</h3>
							<button onClick={() => setShowActionSheet(null)} className="p-2 rounded-full hover:bg-gray-100">
								<X size={20} className="text-gray-500" />
							</button>
						</div>
						<p className="text-gray-600 mb-6">
							{showActionSheet === 'out_for_delivery'
								? t('delivery.confirmOutForDelivery')
								: t('delivery.confirmDelivered')}
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowActionSheet(null)}
								className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={() => handleAction(showActionSheet)}
								className={cn(
									'flex-1 py-3 px-4 rounded-xl font-bold',
									showActionSheet === 'out_for_delivery'
										? 'bg-[#D4A853] text-white hover:bg-[#B8923F]'
										: 'bg-emerald-500 text-white hover:bg-emerald-600',
								)}
							>
								{showActionSheet === 'out_for_delivery' ? t('delivery.confirm') : t('delivery.confirmDeliveredBtn')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}