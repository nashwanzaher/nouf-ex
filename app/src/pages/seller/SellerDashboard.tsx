/**
 * Nouf-ex — Merchant Dashboard
 * C.4 in MASTER_PLAN.md
 *
 * Live data via /api/seller/dashboard + /api/seller/products +
 * /api/seller/orders (C.3 endpoints). Falls back to a friendly empty
 * state when the merchant has no store yet (404 from
 * getMerchantStoreId).
 *
 * This is a focused, accessible, i18n-aware replacement for the old
 * 849-line demo dashboard. The old version is preserved as
 * SellerDashboard.legacy.tsx (not shipped) for reference.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	Package,
	ShoppingBag,
	TrendingUp,
	Users,
	DollarSign,
	AlertTriangle,
	Plus,
	BarChart3,
	Eye,
	Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
	useSellerDashboard,
	useSellerProducts,
	useSellerOrders,
	useSellerMutations,
} from '@/hooks/useApi';
import styles from './SellerDashboard.module.css';

export default function SellerDashboard() {
	const { t } = useTranslation();
	const location = useLocation();
	const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'shipped'>('all');
	const statusFilter = filter === 'all' ? undefined : filter;

	// Read hooks
	const dashboard = useSellerDashboard();
	const products = useSellerProducts();
	const orders = useSellerOrders(statusFilter);

	// Mutation hooks (call refreshAll() after each)
	const mutations = useSellerMutations();

	const isLoading =
		dashboard.loading ||
		products.loading ||
		(orders.loading && filter !== 'all');
	const error = dashboard.error || products.error || orders.error;

	return (
		<div className={styles.dashboard}>
			{/* Header */}
			<div className={styles.header}>
				<div>
					<h1 className={styles.title}>
						{t('seller.dashboard.title', 'Seller Dashboard')}
					</h1>
					<p className={styles.subtitle}>
						{t(
							'seller.dashboard.subtitle',
							'Manage your store, products, and orders.',
						)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link
						to="/seller/products/new"
						className={cn(
							styles.btn,
							styles.btnPrimary,
							'flex items-center gap-1',
						)}
					>
						<Plus size={16} /> {t('seller.product.new', 'New Product')}
					</Link>
				</div>
			</div>

			{/* Error banner */}
			{error && (
				<div className={styles.errorBanner} role="alert">
					<AlertTriangle size={20} />
					<span>
						{t('common.error', 'Error')}: {String(error)}
					</span>
				</div>
			)}

			{/* No store state */}
			{!isLoading && dashboard.data === null && dashboard.error == null && (
				<div className={styles.emptyState}>
					<Package size={48} className="text-aliTextMute" />
					<h2 className="text-lg font-bold mt-4">
						{t('seller.dashboard.noStore', 'You do not have a store yet')}
					</h2>
					<p className="text-aliTextMute text-sm mt-1">
						{t(
							'seller.dashboard.noStoreHint',
							'Contact an admin to set up your store, or apply for merchant status.',
						)}
					</p>
				</div>
			)}

			{/* KPI cards */}
			{dashboard.data && (
				<div className={styles.kpiGrid}>
					<KpiCard
						icon={<DollarSign size={20} />}
						label={t('seller.dashboard.kpi.revenue', 'Revenue')}
						value={dashboard.data.revenue}
						format="currency"
					/>
					<KpiCard
						icon={<ShoppingBag size={20} />}
						label={t('seller.dashboard.kpi.activeOrders', 'Active Orders')}
						value={dashboard.data.active_orders}
					/>
					<KpiCard
						icon={<Clock size={20} />}
						label={t('seller.dashboard.kpi.pendingOrders', 'Pending Orders')}
						value={dashboard.data.pending_orders}
						hint={
							dashboard.data.pending_orders > 0
								? t('seller.dashboard.actionRequired', 'Action required')
								: undefined
						}
					/>
					<KpiCard
						icon={<AlertTriangle size={20} />}
						label={t(
							'seller.dashboard.kpi.lowStock',
							'Low-stock products',
						)}
						value={dashboard.data.low_stock_products}
						hint={
							dashboard.data.low_stock_products > 0
								? t('seller.dashboard.restock', 'Restock soon')
								: undefined
						}
					/>
				</div>
			)}

			{/* Two-column layout: recent orders + recent products */}
			<div className={styles.twoCol}>
				{/* Recent orders */}
				<section className={styles.card}>
					<header className={styles.cardHeader}>
						<h2 className={styles.cardTitle}>
							<BarChart3 size={18} className="inline mr-1" />
							{t('seller.dashboard.recentOrders', 'Recent Orders')}
						</h2>
						<div className={styles.tabs} role="tablist">
							{(['all', 'pending', 'confirmed', 'shipped'] as const).map(
								(f) => (
									<button
										key={f}
										role="tab"
										aria-selected={filter === f}
										onClick={() => setFilter(f)}
										className={cn(
											styles.tab,
											filter === f && styles.tabActive,
										)}
									>
										{t(`seller.dashboard.filter.${f}`, f)}
									</button>
								),
							)}
						</div>
					</header>
					<div className={styles.cardBody}>
						{orders.data?.items.length === 0 && (
							<p className={styles.emptyText}>
								{t(
									'seller.dashboard.noOrders',
									'No orders in this filter yet.',
								)}
							</p>
						)}
						{orders.data?.items.slice(0, 8).map((order) => (
							<OrderRow
								key={order.id}
								order={order}
								t={t}
								onUpdateStatus={mutations.updateOrderStatus}
								onRefresh={mutations.refreshAll}
							/>
						))}
					</div>
				</section>

				{/* Recent products */}
				<section className={styles.card}>
					<header className={styles.cardHeader}>
						<h2 className={styles.cardTitle}>
							<Package size={18} className="inline mr-1" />
							{t('seller.dashboard.recentProducts', 'Recent Products')}
						</h2>
						<Link
							to="/seller/products"
							className={styles.btn + ' ' + styles.btnGhost}
						>
							{t('common.viewAll', 'View all')}
						</Link>
					</header>
					<div className={styles.cardBody}>
						{products.data?.items.length === 0 && (
							<p className={styles.emptyText}>
								{t(
									'seller.dashboard.noProducts',
									'You have no products yet. Add your first one!',
								)}
							</p>
						)}
						{products.data?.items.slice(0, 6).map((p) => (
							<ProductRow key={p.id} product={p} t={t} />
						))}
					</div>
				</section>
			</div>
		</div>
	);
}

// ─── Sub-components ─────────────────────────────────────────

function KpiCard({
	icon,
	label,
	value,
	hint,
	format,
}: {
	icon: React.ReactNode;
	label: string;
	value: number;
	hint?: string;
	format?: 'currency';
}) {
	const formatted =
		format === 'currency'
			? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value) +
				' YER'
			: value.toLocaleString();
	return (
		<div className={styles.kpiCard}>
			<div className={styles.kpiIcon}>{icon}</div>
			<div className="flex-1 min-w-0">
				<p className={styles.kpiLabel}>{label}</p>
				<p className={styles.kpiValue}>{formatted}</p>
				{hint && <p className={styles.kpiHint}>{hint}</p>}
			</div>
		</div>
	);
}

function OrderRow({
	order,
	t,
	onUpdateStatus,
	onRefresh,
}: {
	order: {
		id: number;
		order_number: string;
		status: string;
		total: number;
		created_at: string;
	};
	t: import("i18next").TFunction;
	onUpdateStatus: (
		id: number,
		body: { status: string; tracking_number?: string },
	) => Promise<unknown>;
	onRefresh: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const next: Record<string, { status: string; label: string; icon: React.ReactNode } | null> = {
		pending: { status: 'confirmed', label: t('seller.order.confirm', 'Confirm'), icon: <Clock size={14} /> },
		confirmed: { status: 'processing', label: t('seller.order.process', 'Process'), icon: <Package size={14} /> },
		processing: { status: 'shipped', label: t('seller.order.ship', 'Ship'), icon: <TrendingUp size={14} /> },
		shipped: { status: 'delivered', label: t('seller.order.deliver', 'Mark delivered'), icon: <Users size={14} /> },
	};
	const action = next[order.status];
	const handleAction = async () => {
		if (!action) return;
		setBusy(true);
		try {
			await onUpdateStatus(order.id, { status: action.status });
			onRefresh();
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className={styles.orderRow}>
			<div className="flex-1 min-w-0">
				<p className={styles.orderNumber}>
					#{order.order_number}
				</p>
				<p className={styles.orderDate}>
					{new Date(order.created_at).toLocaleString()}
				</p>
			</div>
			<div className="text-right">
				<p className={styles.orderTotal}>
					{order.total.toLocaleString()} YER
				</p>
				<p className={styles.orderStatus} data-status={order.status}>
					{t(`seller.order.status.${order.status}`, order.status)}
				</p>
			</div>
			{action && (
				<button
					type="button"
					onClick={handleAction}
					disabled={busy}
					className={styles.btn + ' ' + styles.btnSmall}
				>
					{action.icon} {action.label}
				</button>
			)}
		</div>
	);
}

function ProductRow({
	product,
	t,
}: {
	product: {
		id: number;
		name_ar: string;
		name_en: string | null;
		price: number;
		stock: number;
		sold_count: number;
		rating: number | null;
	};
	t: import("i18next").TFunction;
}) {
	const stockStatus =
		product.stock === 0
			? 'out_of_stock'
			: product.stock < 10
				? 'low_stock'
				: 'in_stock';
	return (
		<Link
			to={`/seller/products/${product.id}`}
			className={styles.productRow}
		>
			<div className="flex-1 min-w-0">
				<p className={styles.productName}>
					{product.name_en ?? product.name_ar}
				</p>
				<p className={styles.productMeta}>
					{t('seller.dashboard.sold', 'Sold')}: {product.sold_count}
				</p>
			</div>
			<div className="text-right">
				<p className={styles.productPrice}>
					{product.price.toLocaleString()} YER
				</p>
				<p
					className={styles.stockBadge}
					data-stock={stockStatus}
				>
					{t(`seller.dashboard.stock.${stockStatus}`, stockStatus.replace('_', ' '))}
				</p>
			</div>
			<Eye size={16} className="text-aliTextMute" />
		</Link>
	);
}