/**
 * Nouf-ex Frontend API Client — Compatibility Barrel
 *
 * Re-exports every domain module so existing call sites that import
 * from `@/lib/api` keep working during the feature-based migration.
 *
 * New code SHOULD import from a specific feature:
 *   import { getProducts } from '@/features/products';
 */

// ─── Base client (ApiError, fetch wrapper) ──────────────────
export { ApiError, isApiError, isErrorCode } from './client';
export type { ApiResponse, RequestOptions } from './client';

// ─── Standardized error codes (mirrors server catalog) ────────
export { ErrorCodes, ErrorStatuses } from './error-codes';
export type { ErrorCode } from './error-codes';

// ─── Localized error messages (3-language catalog) ──────────
export { detectLang, formatApiError, getErrorMessage } from './error-messages';
export { readStoredLang } from './lang-storage';
export type { SupportedLang } from './error-messages';

// ─── Shared types ───────────────────────────────────────────
export type {
	Address,
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
	AuthResponse,
	CartItem,
	Category,
	CategoryWithProducts,
	CouponValidation,
	HomeStats,
	InboxResponse,
	Message,
	MessageThread,
	Notification,
	Order,
	OrderItem,
	OrderWithItems,
	Payment,
	PaymentProviderListEntry,
	Product,
	ProductFilters,
	ProductImage,
	ProductWithDetails,
	Refund,
	Review,
	ReviewFilters,
	SellerAnalytics,
	SellerBalance,
	SellerDashboard,
	SellerInventoryItem,
	SellerOrder,
	SellerOrderWithItems,
	SellerPayout,
	SellerProductCreate,
	SellerStore,
	SellerStoreCreate,
	SellerStoreUpdate,
	ShippingMethod,
	Store,
	StoreFollowStatus,
	StoreWithProducts,
	SystemHealth,
	SystemHealthCheck,
	TwoFactorEnableResponse,
	TwoFactorSetupResponse,
	TwoFactorVerifyResponse,
	UpdateProfileBody,
	User,
	WishlistItem,
} from './types';

// ─── Auth + 2FA ─────────────────────────────────────────────
export type { AuthLoginResult, ForgotPasswordResult } from '@/features/auth/api/auth';
export {
	changePassword,
	disable2FA,
	enable2FA,
	forgotPassword,
	getCurrentUser,
	login,
	regenerateBackupCodes,
	register,
	resetPassword,
	setup2FA,
	updateProfile,
	verify2FA,
} from '@/features/auth/api/auth';

// ─── Catalog: products, stores, categories, search ─────────
export {
	getCategories,
	getCategory,
	getDeals,
	getFeaturedProducts,
	getProduct,
	getProducts,
	getStore,
	getStoreReviews,
	getStores,
	searchProducts,
} from '@/features/products';

// ─── Reviews ────────────────────────────────────────────────
export { createReview, getReviews } from '@/features/customer';

// ─── Orders ─────────────────────────────────────────────────
export { createOrder, getOrder, getOrders } from '@/features/orders';

// ─── Cart, Wishlist, Store followers ────────────────────────
export {
	addToCart,
	addToWishlist,
	checkStoreFollowStatus,
	clearCart,
	getCart,
	getCartCount,
	getWishlist,
	removeFromCart,
	removeFromWishlist,
	updateCartItem,
} from '@/features/cart';

// ─── Notifications ──────────────────────────────────────────
export {
	getNotifications,
	getUnreadNotificationCount,
	markNotificationAsRead,
} from '@/features/customer';

// ─── Addresses ──────────────────────────────────────────────
export { createAddress, deleteAddress, getAddresses, updateAddress } from '@/features/customer';

// ─── Shipping ───────────────────────────────────────────────
export { getShippingMethods } from '@/features/shipping';

// ─── Coupons ────────────────────────────────────────────────
export { redeemCoupon, validateCoupon } from '@/features/coupons';

// ─── Payments ───────────────────────────────────────────────
export { confirmPayment, createPayment, getOrderPayments, getPaymentProviders } from '@/features/checkout';

// ─── Refunds ────────────────────────────────────────────────
export { createRefund, resolveRefund } from '@/features/customer';

// ─── Messaging ──────────────────────────────────────────────
export {
	getConversation,
	getInbox,
	getSent,
	getUnreadMessageCount,
	markMessageRead,
	sendMessage,
} from '@/features/messages';

// ─── System (home stats + readiness probe) ─────────────────
export { getHomeStats, getSystemHealth } from '@/features/home';

// ─── Seller (merchant) ──────────────────────────────────────
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
} from '@/features/seller';

// ─── Admin ──────────────────────────────────────────────────
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
} from '@/features/admin';

// ─── Body types ─────────────────────────────────────────────
export type { CreateAddressBody } from '@/features/customer';
export type { RedeemCouponBody, ValidateCouponBody } from '@/features/coupons';
export type { CreateOrderBody } from '@/features/orders';
export type { CreatePaymentBody } from '@/features/checkout';
export type { CreateRefundBody, ResolveRefundBody } from '@/features/customer';
