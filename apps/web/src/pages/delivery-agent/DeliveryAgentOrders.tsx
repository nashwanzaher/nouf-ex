import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	ChevronLeft,
	ChevronRight,
	Filter,
	Loader2,
	MapPin,
	Package,
	PackageCheck,
	Plus,
	Search,
	Truck,
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

const STATUS_FILTERS = [
	{ value: '', label: 'delivery.filter.all' },
	{ value: 'confirmed,processing', label: 'delivery.filter.pending' },
	{ value: 'shipped,out_for_delivery', label: 'delivery.filter.inTransit' },
	{ value: 'delivered', label: 'delivery.filter.delivered' },
	{ value: 'cancelled,returned', label: 'delivery.filter.cancelled' },
];

function StatusBadge({ status }: { status: string }) {
	const { t } = useTranslation();
	const colors = STATUS_COLORS[status] ?? STATUS_COLORS.confirmed;
	return (
		<span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', colors.bg, colors.text)}>
			<span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
			{t(`delivery.status.${status}`)}
		</span>
	);
}

function OrderTimeline({ status }: { status: string }) {
	const { t } = useTranslation();
	const ORDER_STEPS = ['confirmed', 'shipped', 'out_for_delivery', 'delivered'] as const;
	const currentStep = ORDER_STEPS.indexOf(status as typeof ORDER_STEPS[number]) + 1;
	if (currentStep <= 0) return null;

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

export default function DeliveryAgentOrders() {
	const { t, i18n } = useTranslation();
	const lang: 'ar' | 'en' | 'zh' = (i18n.language as 'ar' | 'en' | 'zh') || 'en';
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [page, setPage] = useState(1);
	const [showFilters, setShowFilters] = useState(false);
	const mutations = useDeliveryAgentMutations();

	const { data: orders, loading } = useDeliveryAgentOrders(statusFilter || undefined);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setPage(1);
	};

	const handleUpdateStatus = async (orderId: number, status: 'out_for_delivery' | 'delivered') => {
		await mutations.updateDeliveryStatus(orderId, status);
	};

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
			{/* TOP BAR */}
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<Link to="/delivery-agent" className="flex items-center gap-2">
						<span className="text-xl font-extrabold text-[#D4A853]">Nouf-ex</span>
						<span className="hidden sm:inline text-xs font-semibold text-gray-400 tracking-wider">DELIVERY</span>
					</Link>

					<form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-4">
						<div className="flex w-full h-10 rounded-full border border-gray-300 bg-white focus-within:border-[#D4A853] focus-within:shadow-sm transition-all overflow-hidden">
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={t('common.search') + '...'}
								className="flex-1 px-4 text-sm bg-transparent outline-none placeholder-gray-400"
								dir={lang === 'ar' ? 'rtl' : 'ltr'}
							/>
							<button type="submit" className="px-4 bg-[#D4A853] text-white hover:bg-[#B8923F] transition-colors">
								<Search size={16} />
							</button>
						</div>
					</form>

					<div className="flex items-center gap-2 ms-auto">
						<Link to="/delivery-agent/available-orders" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold transition-colors">
							<Plus size={14} />
							{t('delivery.availableOrders')}
						</Link>
						<button
							onClick={() => setShowFilters(!showFilters)}
							className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
							aria-label={t('common.filters')}
						>
							<Filter size={20} />
						</button>
					</div>
				</div>

				{/* Status Filter Tabs */}
				<div className="border-t border-gray-100 bg-white">
					<div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 overflow-x-auto">
						<div className="flex gap-2">
							{STATUS_FILTERS.map((filter) => (
								<button
									key={filter.value}
									onClick={() => {
										setStatusFilter(filter.value);
										setPage(1);
									}}
									className={cn(
										'px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
										statusFilter === filter.value
											? 'bg-[#D4A853] text-white shadow-sm'
											: 'text-gray-600 hover:bg-gray-100',
									)}
								>
									{t(filter.label)}
								</button>
							))}
						</div>
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
				{/* PAGE HEADER */}
				<div className="flex flex-wrap items-center justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl font-bold text-gray-900">{t('delivery.myOrders')}</h1>
						<p className="text-sm text-gray-500 mt-0.5">{orders?.length ?? 0} {t('delivery.ordersFound')}</p>
					</div>
				</div>

				{/* ORDERS LIST */}
				{loading ? (
					<div className="bg-white rounded-xl border border-gray-200 p-12 flex items-center justify-center">
						<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
					</div>
				) : orders?.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
						<div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4">
							<Package size={24} className="text-gray-400" />
						</div>
						<p className="text-sm font-semibold text-gray-700">{t('delivery.noOrders')}</p>
						<p className="text-sm text-gray-500 mt-1">{t('delivery.noOrdersDesc')}</p>
						<Link to="/delivery-agent/available-orders" className="inline-block mt-4 px-5 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold transition-colors">
							{t('delivery.browseAvailable')}
						</Link>
					</div>
				) : (
					<div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
						{orders?.map((order) => {
							const isDelivered = order.status === 'delivered';
							const canMarkOutForDelivery = ['confirmed', 'processing', 'shipped'].includes(order.status);
							const canMarkDelivered = order.status === 'out_for_delivery';

							return (
								<Link key={order.id} to={`/delivery-agent/orders/${order.id}`} className="block p-4 lg:p-5 hover:bg-gray-50 transition-colors group">
									<div className="flex flex-wrap items-start justify-between gap-3 mb-3">
										<div>
											<p className="text-xs text-gray-500">
												{t('delivery.orderNumber')} <span className="font-bold text-gray-900">#{order.order_number ?? order.id}</span>
											</p>
											<p className="text-[10px] text-gray-400 mt-0.5">
												{new Date(order.created_at).toLocaleString()}
												{order.store_name && ` · ${order.store_name}`}
											</p>
										</div>
										<StatusBadge status={order.status} />
									</div>

									<OrderTimeline status={order.status} />

									<div className="flex items-center justify-between mt-3">
										<div className="flex items-center gap-3 text-sm text-gray-600">
											<span className="flex items-center gap-1">
												<MapPin size={14} />
												{order.customer_name}
											</span>
											<span className="flex items-center gap-1">
												<Package size={14} />
												{order.items_count} {t('delivery.items')}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<p className="text-base font-extrabold text-gray-900">
												{formatMoney(Number(order.total ?? 0), { lang })}
											</p>
											{!isDelivered && (
												<div className="flex items-center gap-2">
													{canMarkOutForDelivery && (
														<button
															type="button"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																handleUpdateStatus(order.id, 'out_for_delivery');
															}}
															className="px-3 py-1.5 rounded-full bg-[#D4A853]/10 text-[#D4A853] hover:bg-[#D4A853] hover:text-white text-xs font-bold transition-colors flex items-center gap-1"
														>
															<Truck size={12} />
															{t('delivery.markOutForDelivery')}
														</button>
													)}
													{canMarkDelivered && (
														<button
															type="button"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																handleUpdateStatus(order.id, 'delivered');
															}}
															className="px-3 py-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold transition-colors flex items-center gap-1"
														>
															<PackageCheck size={12} />
															{t('delivery.markDelivered')}
														</button>
													)}
													<ChevronRight className={cn('w-4 h-4 text-gray-400 group-hover:text-[#D4A853] transition-colors', lang === 'ar' ? 'rotate-180' : '')} />
												</div>
											)}
										</div>
									</div>
								</Link>
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