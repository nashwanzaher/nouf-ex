/**
 * Nouf-ex Frontend API Client — Public Surface
 *
 * Re-exports every domain module so existing call sites that import
 * from `@/lib/api` (the legacy single-file path) keep working without
 * any code change.
 *
 * New code SHOULD import from a specific domain module:
 *   import { getProducts } from '@/lib/api/products';
 * ... instead of the catch-all barrel, so dead-code elimination can
 * strip unused domains from the production bundle.
 */

// ─── Base client (ApiError, fetch wrapper) ──────────────────
export { ApiError, isApiError, isErrorCode } from './client';
export type { ApiResponse, RequestOptions } from './client';

// ─── Standardized error codes (mirrors server catalog) ────────
export { ErrorCodes, ErrorStatuses } from './error-codes';
export type { ErrorCode } from './error-codes';

// ─── Localized error messages (3-language catalog) ──────────
// `formatApiError(err)` is the one-shot helper most call sites want.
// `getErrorMessage(code, lang)` is for component-specific overrides.
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

// ─── Body types ─────────────────────────────────────────────
export type { CreateAddressBody } from './addresses';
export type { RedeemCouponBody, ValidateCouponBody } from './coupons';
export type { CreateOrderBody } from './orders';
export type { CreatePaymentBody } from './payments';
export type { CreateRefundBody, ResolveRefundBody } from './refunds';

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
} from './products';

// ─── Reviews ────────────────────────────────────────────────
export { createReview, getReviews } from './reviews';

// ─── Orders ─────────────────────────────────────────────────
export { createOrder, getOrder, getOrders } from './orders';

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
} from './cart';

// ─── Auth + 2FA ─────────────────────────────────────────────
export {
	changePassword,
	disable2FA,
	enable2FA,
	getCurrentUser,
	login,
	regenerateBackupCodes,
	register,
	setup2FA,
	updateProfile,
	verify2FA,
} from './auth';

// ─── Notifications ──────────────────────────────────────────
export {
	getNotifications,
	getUnreadNotificationCount,
	markNotificationAsRead,
} from './notifications';

// ─── Addresses ──────────────────────────────────────────────
export { createAddress, deleteAddress, getAddresses, updateAddress } from './addresses';

// ─── Shipping ───────────────────────────────────────────────
export { getShippingMethods } from './shipping';

// ─── Coupons ────────────────────────────────────────────────
export { redeemCoupon, validateCoupon } from './coupons';

// ─── Payments ───────────────────────────────────────────────
export { confirmPayment, createPayment, getOrderPayments, getPaymentProviders } from './payments';

// ─── Refunds ────────────────────────────────────────────────
export { createRefund, resolveRefund } from './refunds';

// ─── Messaging ──────────────────────────────────────────────
export {
	getConversation,
	getInbox,
	getSent,
	getUnreadMessageCount,
	markMessageRead,
	sendMessage,
} from './messages';

// ─── System (home stats + readiness probe) ─────────────────
export { getHomeStats, getSystemHealth } from './system';

// ─── Seller (merchant) ──────────────────────────────────────
export {
	addSellerProductImage,
	createSellerProduct,
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
} from './seller';

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
} from './admin';
