import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ArrowRight,
	ChevronLeft,
	CreditCard,
	Loader2,
	MapPin,
	MessageSquare,
	Package,
	Phone,
	RefreshCw,
	Star,
	Truck,
	User as UserIcon,
	XCircle,
} from 'lucide-react';
import { getOrder } from '@/features/orders/api/orders';
import type { OrderWithItems } from '@/lib/api/types';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

type TimelineEntry = { status: string; at: string; note?: string };

function OrderDetail() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const addToast = useApp().addToast;

	const orderId = useMemo(() => {
		const n = Number(id);
		return Number.isFinite(n) && n > 0 ? n : null;
	}, [id]);

	const [order, setOrder] = useState<OrderWithItems | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(() => {
		if (orderId == null) return;
		setLoading(true);
		setError(null);
		const ac = new AbortController();
		getOrder(orderId, { signal: ac.signal })
			.then((data) => {
				setOrder(data);
			})
			.catch((e: unknown) => {
				if (e instanceof Error && e.name === 'AbortError') return;
				setError(e instanceof Error ? e.message : String(e));
				addToast({
					type: 'error',
					message: t('customer.orderLoadError', 'Failed to load order'),
				});
			})
			.finally(() => setLoading(false));
		return () => ac.abort();
	}, [orderId, addToast, t]);

	useEffect(() => {
		if (orderId == null) return;
		const ac = new AbortController();
		let alive = true;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await getOrder(orderId, { signal: ac.signal });
				if (alive) setOrder(data);
			} catch (e) {
				if (alive && !(e instanceof Error && e.name === 'AbortError')) {
					const msg = e instanceof Error ? e.message : String(e);
					setError(msg);
					addToast({
						type: 'error',
						message: t('customer.orderLoadError', 'Failed to load order'),
					});
				}
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
			ac.abort();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [orderId]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[#FAFAF7]">
				<Loader2 className="w-8 h-8 animate-spin text-[#D4A853]" />
			</div>
		);
	}

	if (error || !order) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] p-6">
				<div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-gray-200">
					<div className="w-16 h-16 rounded-full bg-red-50 mx-auto flex items-center justify-center mb-4">
						<XCircle size={28} className="text-red-500" />
					</div>
					<p className="text-lg font-bold text-gray-900">
						{t('customer.orderNotFound')}
					</p>
					<p className="text-sm text-gray-500 mt-1">
						{error ? t('customer.orderLoadError') : ''}
					</p>
					<div className="flex gap-2 justify-center mt-6">
						<button
							onClick={reload}
							className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-semibold flex items-center gap-2"
						>
							<RefreshCw size={14} />
							{t('common.retry')}
						</button>
						<Link
							to="/customer/orders"
							className="px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold"
						>
							{t('customer.backToOrders')}
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const items = (order as { items?: Array<{ id: number; product_id: number; quantity: number; unit_price: number; product_name?: string; product_name_ar?: string; product_image?: string; variant?: string }> }).items ?? [];
	const shippingAddress = (() => {
		try {
			return typeof order.shipping_address === 'string'
				? JSON.parse(order.shipping_address)
				: order.shipping_address;
		} catch {
			return null;
		}
	})();

	const timelineEntries: TimelineEntry[] = (() => {
		try {
			const parsed = typeof order.timeline === 'string' ? JSON.parse(order.timeline) : order.timeline;
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	})();

	const statusColors: Record<string, string> = {
		pending: 'bg-amber-50 text-amber-700 border-amber-200',
		confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
		processing: 'bg-blue-50 text-blue-700 border-blue-200',
		shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
		delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
		cancelled: 'bg-red-50 text-red-700 border-red-200',
		refunded: 'bg-gray-100 text-gray-700 border-gray-200',
	};

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={isRTL ? 'rtl' : 'ltr'}>
			{/* Header */}
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200">
				<div className="max-w-5xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
						aria-label={t('common.back')}
					>
						<ChevronLeft className={cn('w-5 h-5', !isRTL && 'rotate-180')} />
					</button>
					<div>
						<p className="text-[10px] uppercase tracking-widest text-[#D4A853] font-bold">
							{t('customer.orderNumber')}
						</p>
						<p className="text-sm font-extrabold text-gray-900">
							#{order.order_number ?? order.id}
						</p>
					</div>
					<div className="ms-auto flex items-center gap-2">
						<button
							onClick={reload}
							className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
							title={t('common.refresh')}
						>
							<RefreshCw size={16} />
						</button>
					</div>
				</div>
			</header>

			<div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				{/* Status hero */}
				<div
					className={cn(
						'rounded-2xl p-6 border',
						statusColors[order.status] ?? statusColors.pending,
					)}
				>
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="text-[10px] uppercase tracking-widest opacity-70 font-bold">
								{t('customer.orderStatus', 'الحالة')}
							</p>
							<p className="text-xl font-extrabold mt-1 capitalize">
								{order.status}
							</p>
							<p className="text-xs opacity-70 mt-1">
								{t('customer.placedAt')}: {order.created_at?.slice(0, 10)}
							</p>
						</div>
						<div className="text-end">
							<p className="text-[10px] uppercase tracking-widest opacity-70 font-bold">
								{t('customer.orderTotal')}
							</p>
							<p className="text-2xl font-extrabold mt-1">
								{formatMoneyCompact(Number(order.total ?? 0), {
									lang: i18n.language as 'ar' | 'en' | 'zh',
								})}
							</p>
						</div>
					</div>

					<div className="mt-4 flex flex-wrap gap-2">
						{order.status === 'shipped' && (
							<button className="px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-xs font-bold flex items-center gap-2">
								<Truck size={14} />
								{t('customer.trackingNumber')}
							</button>
						)}
						<button className="px-4 py-2 rounded-full bg-white/80 hover:bg-white text-xs font-bold flex items-center gap-2">
							<MessageSquare size={14} />
							{t('customer.contactSeller')}
						</button>
						{order.status === 'delivered' && (
							<>
								<button className="px-4 py-2 rounded-full bg-white/80 hover:bg-white text-xs font-bold flex items-center gap-2">
									<Star size={14} />
									{t('customer.review')}
								</button>
								<button className="px-4 py-2 rounded-full bg-white/80 hover:bg-white text-xs font-bold flex items-center gap-2">
									<RefreshCw size={14} />
									{t('customer.reorder')}
								</button>
							</>
						)}
						{order.status === 'pending' && (
							<button className="px-4 py-2 rounded-full bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
								<XCircle size={14} />
								{t('customer.cancelOrder')}
							</button>
						)}
						{order.status === 'delivered' && (
							<button className="px-4 py-2 rounded-full bg-white/80 hover:bg-white text-xs font-bold flex items-center gap-2">
								<ArrowRight size={14} className="rotate-180" />
								{t('customer.requestRefund')}
							</button>
						)}
					</div>
				</div>

				{/* Timeline */}
				<section className="bg-white rounded-2xl border border-gray-200 p-6">
					<h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
						<Truck size={16} className="text-[#D4A853]" />
						{t('customer.timeline')}
					</h2>
					{timelineEntries.length === 0 ? (
						<p className="text-sm text-gray-500">{t('customer.timelineEmpty')}</p>
					) : (
						<ol className="space-y-4">
							{[...timelineEntries].reverse().map((entry, i) => (
								<li key={i} className="flex gap-3">
									<div className="flex flex-col items-center">
										<div className="w-2.5 h-2.5 rounded-full bg-[#D4A853]" />
										{i < timelineEntries.length - 1 && (
											<div className="w-0.5 flex-1 bg-gray-200 mt-1" />
										)}
									</div>
									<div className="flex-1 pb-2">
										<p className="text-sm font-bold text-gray-900 capitalize">
											{entry.status}
										</p>
										<p className="text-xs text-gray-500">
											{entry.at?.slice(0, 16).replace('T', ' ')}
										</p>
										{entry.note && (
											<p className="text-xs text-gray-600 mt-1">{entry.note}</p>
										)}
									</div>
								</li>
							))}
						</ol>
					)}
				</section>

				{/* Items */}
				<section className="bg-white rounded-2xl border border-gray-200 p-6">
					<h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
						<Package size={16} className="text-[#D4A853]" />
						{t('customer.orderItems')} ({items.length})
					</h2>
					<ul className="divide-y divide-gray-100">
						{items.map((item) => (
							<li key={item.id} className="py-3 flex items-center gap-4">
								{item.product_image ? (
									<img
										src={item.product_image}
										alt={item.product_name ?? ''}
										className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0"
									/>
								) : (
									<div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
										<Package size={20} className="text-gray-400" />
									</div>
								)}
								<div className="flex-1 min-w-0">
									<Link
										to={`/products/${item.product_id}`}
										className="text-sm font-semibold text-gray-900 hover:text-[#D4A853] truncate block"
									>
										{item.product_name_ar ?? item.product_name ?? `#${item.product_id}`}
									</Link>
									{item.variant && (
										<p className="text-xs text-gray-500 mt-0.5">
											{item.variant}
										</p>
									)}
									<p className="text-xs text-gray-500 mt-1">
										{item.quantity} × {formatMoneyCompact(Number(item.unit_price), {
											lang: i18n.language as 'ar' | 'en' | 'zh',
										})}
									</p>
								</div>
								<p className="text-sm font-extrabold text-gray-900 shrink-0">
									{formatMoneyCompact(Number(item.unit_price * item.quantity), {
										lang: i18n.language as 'ar' | 'en' | 'zh',
									})}
								</p>
							</li>
						))}
					</ul>
				</section>

				<div className="grid lg:grid-cols-2 gap-6">
					{/* Shipping address */}
					<section className="bg-white rounded-2xl border border-gray-200 p-6">
						<h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
							<MapPin size={16} className="text-[#D4A853]" />
							{t('customer.shippingAddress')}
						</h2>
						{shippingAddress ? (
							<div className="space-y-2 text-sm">
								<p className="font-bold text-gray-900 flex items-center gap-2">
									<UserIcon size={14} className="text-gray-400" />
									{shippingAddress.full_name ?? shippingAddress.name}
								</p>
								{shippingAddress.phone && (
									<p className="text-gray-600 flex items-center gap-2">
										<Phone size={14} className="text-gray-400" />
										<a
											href={`tel:${shippingAddress.phone}`}
											className="hover:text-[#D4A853]"
										>
											{shippingAddress.phone}
										</a>
									</p>
								)}
								<p className="text-gray-600">
									{[
										shippingAddress.street,
										shippingAddress.building,
										shippingAddress.district,
										shippingAddress.city,
										shippingAddress.governorate,
									]
										.filter(Boolean)
										.join('، ')}
								</p>
								{shippingAddress.notes && (
									<p className="text-xs text-gray-500 italic mt-2">
										"{shippingAddress.notes}"
									</p>
								)}
							</div>
						) : (
							<p className="text-sm text-gray-500">{order.shipping_address}</p>
						)}
					</section>

					{/* Payment summary */}
					<section className="bg-white rounded-2xl border border-gray-200 p-6">
						<h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
							<CreditCard size={16} className="text-[#D4A853]" />
							{t('customer.paymentSummary', 'Payment Summary')}
						</h2>
						<dl className="space-y-2 text-sm">
							<div className="flex justify-between">
								<dt className="text-gray-500">{t('customer.subtotal', 'Subtotal')}</dt>
								<dd className="font-semibold text-gray-900">
									{formatMoneyCompact(Number(order.subtotal ?? 0), {
										lang: i18n.language as 'ar' | 'en' | 'zh',
									})}
								</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-gray-500">{t('customer.shippingCost', 'Shipping')}</dt>
								<dd className="font-semibold text-gray-900">
									{formatMoneyCompact(Number(order.shipping_cost ?? 0), {
										lang: i18n.language as 'ar' | 'en' | 'zh',
									})}
								</dd>
							</div>
							{Number(order.discount) > 0 && (
								<div className="flex justify-between">
									<dt className="text-gray-500">{t('customer.discount', 'Discount')}</dt>
									<dd className="font-semibold text-emerald-600">
										-
										{formatMoneyCompact(Number(order.discount), {
											lang: i18n.language as 'ar' | 'en' | 'zh',
										})}
									</dd>
								</div>
							)}
							<div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
								<dt className="font-bold text-gray-900">{t('customer.orderTotal')}</dt>
								<dd className="font-extrabold text-base text-gray-900">
									{formatMoneyCompact(Number(order.total ?? 0), {
										lang: i18n.language as 'ar' | 'en' | 'zh',
									})}
								</dd>
							</div>
							<div className="flex justify-between text-xs pt-2">
								<dt className="text-gray-500">{t('customer.paymentMethod')}</dt>
								<dd className="font-semibold text-gray-700 uppercase">
									{order.payment_method}
								</dd>
							</div>
							<div className="flex justify-between text-xs">
								<dt className="text-gray-500">
									{t('customer.paymentStatus', 'Payment Status')}
								</dt>
								<dd
									className={cn(
										'font-bold uppercase',
										order.payment_status === 'paid'
											? 'text-emerald-600'
											: 'text-amber-600',
									)}
								>
									{order.payment_status}
								</dd>
							</div>
						</dl>
					</section>
				</div>
			</div>
		</div>
	);
}

export default OrderDetail;
