import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	MapPin,
	Package,
	Plus,
	RefreshCw,
	AlertTriangle,
	Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { useDeliveryAgentAvailableOrders, useDeliveryAgentMutations } from '@/hooks/useApi';

export default function DeliveryAgentAvailableOrders() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const lang: 'ar' | 'en' | 'zh' = (i18n.language as 'ar' | 'en' | 'zh') || 'en';
	const [page, setPage] = useState(1);
	const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
	const [locationError, setLocationError] = useState<string | null>(null);
	const mutations = useDeliveryAgentMutations();

	const { data: orders, loading, refetch } = useDeliveryAgentAvailableOrders(
		myLocation?.lat,
		myLocation?.lng
	);

	const handleAcceptOrder = async (orderId: number) => {
		await mutations.acceptOrder(orderId);
		await refetch();
	};

	const handleGetLocation = useCallback(() => {
		if (!navigator.geolocation) {
			setLocationError(t('delivery.geolocationNotSupported'));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
				setLocationError(null);
				refetch();
			},
			(err) => {
				setLocationError(t('delivery.geolocationError'));
				console.error(err);
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
		);
	}, [t, refetch]);

	useEffect(() => {
		handleGetLocation();
	}, [handleGetLocation]);

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
			{/* TOP BAR */}
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
				<div className="max-w-4xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
						aria-label={t('common.back')}
					>
						<ChevronLeft size={20} className={lang === 'ar' ? 'rotate-180' : ''} />
					</button>
					<Link to="/delivery-agent" className="flex items-center gap-2">
						<span className="text-xl font-extrabold text-[#D4A853]">Nouf-ex</span>
						<span className="hidden sm:inline text-xs font-semibold text-gray-400 tracking-wider">DELIVERY</span>
					</Link>
					<div className="flex-1" />
					<h1 className="text-base font-bold text-gray-900">{t('delivery.availableOrders')}</h1>
				</div>

				{/* LOCATION BAR */}
				<div className="border-t border-gray-100 bg-gray-50 px-4 lg:px-6 py-3">
					<div className="max-w-4xl mx-auto flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2">
							<MapPin size={16} className={myLocation ? 'text-emerald-500' : 'text-gray-400'} />
							<span className="text-sm font-medium text-gray-700">
								{myLocation
									? `${t('delivery.currentLocation')}: ${myLocation.lat.toFixed(4)}, ${myLocation.lng.toFixed(4)}`
									: t('delivery.locationNotSet')}
							</span>
						</div>
						<button
							onClick={handleGetLocation}
							disabled={loading}
							className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-white border border-gray-200 hover:bg-gray-50"
						>
							<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
							{t('delivery.refreshLocation')}
						</button>
						{locationError && (
							<span className="text-xs text-red-500 flex items-center gap-1">
								<AlertTriangle size={12} />
								{locationError}
							</span>
						)}
					</div>
				</div>
			</header>

			<div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">
				{/* PAGE HEADER */}
				<div className="flex flex-wrap items-center justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl font-bold text-gray-900">{t('delivery.availableOrdersTitle')}</h1>
						<p className="text-sm text-gray-500 mt-0.5">
							{orders?.length ?? 0} {t('delivery.ordersAvailable')}
						</p>
					</div>
					<Link to="/delivery-agent" className="text-xs font-bold text-[#D4A853] hover:text-[#B8923F] flex items-center gap-1">
						{t('delivery.backToDashboard')}
						<ArrowRight size={12} className={lang === 'ar' ? 'rotate-180' : ''} />
					</Link>
				</div>

				{/* ORDERS LIST */}
				{loading ? (
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
								<div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
								<div className="h-3 bg-gray-200 rounded w-1/2" />
								<div className="h-3 bg-gray-200 rounded w-1/3 mt-2" />
							</div>
						))}
					</div>
				) : orders?.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
						<div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4">
							<Package size={24} className="text-gray-400" />
						</div>
						<p className="text-sm font-semibold text-gray-700">{t('delivery.noAvailableOrders')}</p>
						<p className="text-sm text-gray-500 mt-1">{t('delivery.noAvailableOrdersDesc')}</p>
						{!myLocation && (
							<button onClick={handleGetLocation} className="inline-block mt-4 px-5 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold transition-colors">
								{t('delivery.enableLocation')}
							</button>
						)}
					</div>
				) : (
					<div className="space-y-3">
						{orders?.map((order) => {
							const isCod = order.payment_method === 'cod';
							return (
								<div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-[#D4A853]/40 transition-all">
									<div className="p-4 lg:p-5">
										<div className="flex flex-wrap items-start justify-between gap-3 mb-3">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
													<Package size={18} className="text-orange-600" />
												</div>
												<div>
													<p className="text-xs text-gray-500">
														{t('delivery.orderNumber')} <span className="font-bold text-gray-900">#{order.order_number ?? order.id}</span>
													</p>
													<p className="text-[10px] text-gray-400 mt-0.5">
														{new Date(order.created_at).toLocaleString()}
														{order.store_name && ` · ${order.store_name}`}
													</p>
												</div>
											</div>
											<div className="text-right">
												<p className="text-xl font-extrabold text-gray-900">
													{formatMoney(Number(order.total ?? 0), { lang })}
												</p>
												<p className="text-[10px] text-gray-400">
													{isCod ? t('delivery.cod') : t('delivery.prepaid')}
												</p>
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
											<span className="flex items-center gap-1">
												<MapPin size={14} />
												{order.customer_name}
											</span>
											<span className="flex items-center gap-1">
												<Package size={14} />
												{order.items_count} {t('delivery.items')}
											</span>
										</div>

										{/* Address preview */}
										<div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-700">
											<pre className="whitespace-pre-wrap max-h-20 overflow-hidden">{JSON.stringify(order.shipping_address, null, 2)}</pre>
										</div>

										<div className="flex items-center justify-between">
											<Link
												to={`/delivery-agent/orders/${order.id}`}
												className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700"
											>
												<Eye size={14} />
												{t('delivery.viewDetails')}
											</Link>
											<button
												onClick={() => handleAcceptOrder(order.id)}
												disabled={loading}
												className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-[#D4A853] hover:bg-[#B8923F] text-white font-bold transition-colors disabled:opacity-50"
											>
												<Plus size={14} className="inline mr-1" />
												{t('delivery.acceptOrder')}
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}

				{/* Pagination */}
				{(orders && orders.length > 0) && (
					<div className="flex items-center justify-center gap-2 mt-6">
						<button
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
							className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							aria-label={t('common.previous')}
						>
							<ChevronLeft className={cn('w-5 h-5', lang === 'ar' ? 'rotate-180' : '')} />
						</button>
						<span className="px-4 text-sm font-medium text-gray-700">
							{t('common.page')} {page}
						</span>
						<button
							onClick={() => setPage((p) => p + 1)}
							className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
							aria-label={t('common.next')}
						>
							<ChevronRight className={cn('w-5 h-5', lang === 'ar' ? 'rotate-180' : '')} />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}