/**
 * Seller / merchant dashboard feature public surface.
 */
export { default as DashboardShell } from './components/DashboardShell';
export { default as SellerAnalytics } from './components/SellerAnalytics';
export { default as SellerDashboard } from './components/SellerDashboard';
export { default as SellerOnboarding } from './components/SellerOnboarding';
export { default as SellerOrders } from './components/SellerOrders';
export { default as SellerProducts } from './components/SellerProducts';
// G12 fix 2026-07-12: full-page host for the AddProductWizard so
// the /seller/products/new link in SellerDashboard's header resolves.
export { default as SellerProductNew } from './components/SellerProductNew';

export {
	addSellerProductImage,
	createSellerProduct,
	createSellerStore,
	deleteSellerProduct,
	getSellerAnalytics,
	getSellerDashboard,
	getSellerInventory,
	getSellerOrder,
	getSellerOrders,
	getSellerPayouts,
	getSellerProduct,
	getSellerProducts,
	getSellerStoreMe,
	updateSellerOrderStatus,
	updateSellerProduct,
	updateSellerStore,
} from './api/seller';

export type {
	SellerAnalytics as SellerAnalyticsData,
	SellerBalance,
	SellerDashboard as SellerDashboardData,
	SellerInventoryItem,
	SellerOrder,
	SellerOrderWithItems,
	SellerPayout,
	SellerProductCreate,
	SellerStore,
	SellerStoreCreate,
	SellerStoreUpdate,
} from '@/lib/api/types';
