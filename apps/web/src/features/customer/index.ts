/**
 * Customer dashboard feature public surface.
 */
export { default as Addresses } from './components/Addresses';
export { default as CustomerDashboard } from './components/CustomerDashboard';
export { default as CustomerSidebar } from './components/CustomerSidebar';
export { default as Notifications } from './components/Notifications';
export { default as Reviews } from './components/Reviews';
export { default as Wishlist } from './components/Wishlist';

export {
	createAddress,
	deleteAddress,
	getAddresses,
	updateAddress,
	 type CreateAddressBody,
} from './api/addresses';

export { createReview, getReviews } from './api/reviews';

export {
	getNotifications,
	getUnreadNotificationCount,
	markNotificationAsRead,
} from './api/notifications';

export {
	createRefund,
	resolveRefund,
	 type CreateRefundBody,
	 type ResolveRefundBody,
} from './api/refunds';

export type { Address, Review, ReviewFilters, Notification, Refund } from '@/lib/api/types';
