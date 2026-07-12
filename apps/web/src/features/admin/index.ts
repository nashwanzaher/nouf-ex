/**
 * Admin dashboard feature public surface.
 */
export { default as AdminAuditLog } from './components/AdminAuditLog';
export { default as AdminDashboard } from './components/AdminDashboard';
export { default as AdminOrders } from './components/AdminOrders';
export { default as AdminOverview } from './components/AdminOverview';
export { default as AdminProducts } from './components/AdminProducts';
export { default as DisputesManagement } from './components/DisputesManagement';
export { default as ReportsAnalytics } from './components/ReportsAnalytics';
export { default as StoresManagement } from './components/StoresManagement';
export { default as UsersManagement } from './components/UsersManagement';

export {
	getAdminAuditLog,
	getAdminDisputes,
	getAdminGovernorate,
	getAdminOrders,
	getAdminProducts,
	getAdminStats,
	getAdminStores,
	getAdminTimeSeries,
	getAdminUsers,
	patchAdminDispute,
	patchAdminOrderStatus,
	patchAdminProduct,
	patchAdminStore,
	patchAdminUser,
} from './api/admin';

export type {
	AdminAuditLogEntry,
	AdminAuditLogResponse,
	AdminDispute,
	AdminDisputeListResponse,
	AdminDisputeUpdateBody,
	AdminGovernorate,
	AdminGovernorateResponse,
	AdminOrder,
	AdminOrderListResponse,
	AdminOrderStatusUpdateBody,
	AdminProduct,
	AdminProductListResponse,
	AdminProductUpdateBody,
	AdminStats,
	AdminStore,
	AdminStoreListResponse,
	AdminStoreUpdateBody,
	AdminTimeSeriesPoint,
	AdminTimeSeriesResponse,
	AdminUser,
	AdminUserListResponse,
	AdminUserUpdateBody,
} from '@/lib/api/types';
